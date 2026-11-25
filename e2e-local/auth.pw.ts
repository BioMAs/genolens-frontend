import { randomBytes } from 'crypto';
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';
import { latestLink } from './support/mailpit';
import { freshCode } from './support/totp';

/**
 * Local end-to-end run of the self-hosted sign-in: sign-up, e-mail
 * confirmation, two-factor enrolment, sign-in with a code or a recovery code,
 * silent renewal, password reset and invitation, against a real backend.
 *
 *   npx playwright test -c playwright.auth.config.ts
 *
 * Not part of CI. It creates real accounts (`e2e-<timestamp>-<name>@example.com`)
 * in whatever database the backend points at: use a throwaway one.
 *
 * Prerequisites
 * -------------
 * 1. Mailpit, to read the e-mails (pin the image version when you run it):
 *      docker run -d --name mailpit -p 1025:1025 -p 8025:8025 \
 *        -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 axllent/mailpit
 *    When a port is taken, publish other ones (for example `-p 11025:1025 -p 18025:8025`)
 *    and tell the suite where its API is with `MAILPIT_URL=http://localhost:18025`.
 * 2. The backend with the local sign-in, migrated (`alembic upgrade head`) and started
 *    (`uvicorn app.main:app --port 8001`) with, besides its database and Redis:
 *      AUTH_MODE=local  AUTH_LOCAL_ENABLED=true  ENVIRONMENT=development
 *      AUTH_COOKIE_SECURE=false  AUTH_COOKIE_DOMAIN=            (empty: cookies of `localhost`)
 *      AUTH_ISSUER=http://localhost:8001  APP_URL=http://localhost:3000
 *      CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
 *      SMTP_HOST=<where Mailpit's SMTP port is: host.docker.internal from a container, localhost otherwise>
 *      SMTP_PORT=1025 (or the published one)  SMTP_TLS=false  SMTP_STARTTLS=false
 *      SMTP_USER=<any>  SMTP_PASSWORD=<any>  EMAIL_FROM_ADDRESS=noreply@example.test
 *    Empty signing and encryption keys are fine for a single run (they are ephemeral); see
 *    "Rate limits" for when fixed ones are needed.
 * 3. Nothing listening on :3000. Playwright starts the dev server itself (`npm run dev`)
 *    with AUTH_JWKS_URL, AUTH_ISSUER, NEXT_PUBLIC_API_URL and NEXT_PUBLIC_ADMIN_APP_URL set
 *    in playwright.auth.config.ts, which win over any .env.local, and it never reuses a
 *    server already running: if :3000 is taken the run fails at once, so stop your own dev
 *    server first. Every request the browser makes to a non-local API (a path under
 *    `/api/v1/` on another host) is aborted and fails the test, so a misconfigured
 *    environment cannot create accounts anywhere else.
 *
 * Optional: the invitation needs a local SCILICIUM_ADMIN. Sign up and enrol an account,
 * promote it by hand in the throwaway database
 *      update users set role = 'SCILICIUM_ADMIN' where email = '<its address>';
 * and put E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD and E2E_ADMIN_TOTP_SECRET (the key shown at
 * enrolment) in `.env.test.local` (gitignored, never commit it). Without them that
 * scenario is skipped. Other variables: E2E_BASE_URL (default http://localhost:3000),
 * E2E_API_URL (default http://localhost:8001/api/v1); the suite refuses non-local hosts.
 *
 * Rate limits
 * -----------
 * They are real (in memory, per IP, outside production): sign-in 10/min and 50/h, sign-up,
 * "forgot" and "resend" 5/h each, 3 link e-mails/h per address. One run makes 9 sign-in
 * calls (8 without the invitation) against a budget of 10 a minute, and 2 sign-ups: do not
 * sign in by hand meanwhile. A run right after another, or a third within the hour, can
 * answer `too_many_attempts`: restart uvicorn to reset the counters. Across such a restart
 * the keys must be fixed (AUTH_JWT_PRIVATE_KEYS and AUTH_ENCRYPTION_KEYS, from
 * `python -m app.auth.cli generate-keys`): ephemeral keys die with the process, and the
 * second factor of the admin account with them (a single run needs no fixed keys).
 *
 * Authenticator codes are single-use per 30-second step (see support/totp.ts), so a run
 * sometimes waits for the next step.
 */

test.skip(
  !process.env.E2E_AUTH_SUITE,
  'run with: npx playwright test -c playwright.auth.config.ts',
);

const API = process.env.E2E_API_URL ?? 'http://localhost:8001/api/v1';
// The API refuses a cookie-authenticated unsafe request without this header.
const CLIENT = { 'X-GenoLens-Client': 'e2e' };

const RUN = Date.now();
// RFC 2606 reserved, so nothing real can receive it (the mail goes to Mailpit anyway). Not
// `example.test`: the API's address validation refuses every special-use name, `.test` included.
const address = (name: string) => `e2e-${RUN}-${name}@example.com`;
// 12+ characters, random per run: never a value worth keeping.
const newPassword = () => `e2e-${randomBytes(9).toString('hex')}-Aa1`;

interface Account {
  email: string;
  password: string;
  /** The key shown at enrolment (base32). */
  secret: string;
  recoveryCodes: string[];
}

// Local hosts only: this suite creates accounts. The config checks the URLs of the test side;
// this covers the browser, whose API is whatever the running Next server was configured with.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const remoteApiCalls: string[] = [];

/** A call to the API (`/api/v1/...`) on a host that is not local. */
function isRemoteApiCall(url: URL): boolean {
  return !LOCAL_HOSTS.has(url.hostname) && url.pathname.includes('/api/v1/');
}

test.beforeEach(async ({ context }) => {
  remoteApiCalls.length = 0;
  await context.route(isRemoteApiCall, (route) => {
    const { origin, pathname } = new URL(route.request().url());
    remoteApiCalls.push(`${route.request().method()} ${origin}${pathname}`);
    return route.abort('blockedbyclient');
  });
});

test.afterEach(() => {
  expect(
    remoteApiCalls,
    'the browser tried to reach a non-local API (aborted): the dev server is not using the ' +
      'local API, check NEXT_PUBLIC_API_URL',
  ).toEqual([]);
});

// A first visit starts a guided tour whose overlay covers the page (driver.js): mark
// them seen, as e2e-capture does (keys: src/lib/tours/storage.ts, ids: registry.ts).
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    for (const id of ['dashboard', 'project-overview', 'analyses']) {
      for (let version = 1; version <= 5; version += 1) {
        try {
          window.localStorage.setItem(`genolens.tour.${id}.v${version}`, '1');
        } catch {
          // Storage refused: nothing to mark.
        }
      }
    }
  });
});

// ---- through the API: what a scenario needs but does not test -------------------------------

/** Fails with the status and the API's error code only: never a body, it may hold a secret. */
async function ok(response: APIResponse, what: string): Promise<APIResponse> {
  if (!response.ok()) {
    const detail = await response
      .json()
      .then((body: { detail?: unknown }) => (typeof body.detail === 'string' ? body.detail : '?'))
      .catch(() => '?');
    throw new Error(`${what}: the API answered ${response.status()} (${detail})`);
  }
  return response;
}

const post = (request: APIRequestContext, path: string, data?: unknown) =>
  request.post(`${API}${path}`, { data, headers: CLIENT });

/** Password, then code: leaves the session cookies in `request`'s jar (the browser's, for `context.request`). */
async function apiSignIn(
  request: APIRequestContext,
  email: string,
  password: string,
  secret: string,
): Promise<void> {
  const login = await ok(await post(request, '/auth/login', { email, password }), 'login');
  expect(((await login.json()) as { next: string }).next).toBe('mfa');
  await ok(await post(request, '/auth/mfa/verify', { code: await freshCode(secret) }), 'mfa/verify');
}

/** A confirmed account with its second factor enrolled, made without the browser. */
async function createEnrolledAccount(name: string): Promise<Account> {
  const email = address(name);
  const password = newPassword();
  const api = await playwrightRequest.newContext();

  try {
    await ok(await post(api, '/auth/signup', { email, password }), 'signup');
    const token = new URL(await latestLink(email, '/auth/verify-email')).searchParams.get('token');
    await ok(await post(api, '/auth/verify-email', { token }), 'verify-email');

    const login = await ok(await post(api, '/auth/login', { email, password }), 'login');
    expect(((await login.json()) as { next: string }).next).toBe('mfa_setup');

    const started = await ok(await post(api, '/auth/mfa/setup/start'), 'mfa/setup/start');
    const { secret } = (await started.json()) as { secret: string };
    const confirmed = await ok(
      await post(api, '/auth/mfa/setup/confirm', { code: await freshCode(secret) }),
      'mfa/setup/confirm',
    );
    const { recovery_codes: recoveryCodes } = (await confirmed.json()) as { recovery_codes: string[] };

    return { email, password, secret, recoveryCodes };
  } finally {
    await api.dispose();
  }
}

// One account for the scenarios that only need "somebody who can sign in" (a recovery
// code, the renewal, the password reset): two sign-ups per run, not four. It is made on
// first use and shared by whatever runs after; the reset updates its password.
let sharedAccount: Promise<Account> | null = null;
const shared = () => (sharedAccount ??= createEnrolledAccount('shared'));

/** Opens a session in the browser itself (its cookie jar), then lands on the dashboard. */
async function signedIn(page: Page, account: Account): Promise<void> {
  await apiSignIn(page.context().request, account.email, account.password, account.secret);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
}

// ---- through the screens ---------------------------------------------------------------------

/**
 * The sign-in screen is told by its form, not by its "Welcome back" heading: the
 * dashboard greets a signed-in user with the same words, so the heading alone would
 * also pass for a session that was never left.
 */
async function expectSignInForm(page: Page): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(page.getByTestId('auth-email')).toBeVisible();
}

async function openSignIn(page: Page): Promise<void> {
  await page.goto('/');
  await expectSignInForm(page);
  // The form is client-rendered: typing before the page is interactive would be lost.
  await page.waitForLoadState('networkidle');
}

async function signUpThroughUi(page: Page, email: string, password: string): Promise<void> {
  await openSignIn(page);
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText(/check your inbox/i)).toBeVisible();
}

/** Submits the password step; where it leads (the code, the enrolment, an error) is the caller's to assert. */
async function signInThroughUi(page: Page, email: string, password: string): Promise<void> {
  await openSignIn(page);
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();
}

/** The code step of a sign-in. */
async function submitCode(page: Page, code: string): Promise<void> {
  await page.getByTestId('auth-code').fill(code);
  await page.getByTestId('auth-mfa-submit').click();
}

/** The enrolment screen, up to the dashboard. Returns what a later sign-in needs. */
async function enrolThroughUi(page: Page): Promise<{ secret: string; recoveryCodes: string[] }> {
  await expect(page).toHaveURL(/\/auth\/2fa\/setup/);
  const keyShown = page.getByTestId('totp-secret');
  await expect(keyShown).toBeVisible();
  // Read as the visitor reads it: shown in groups of four, kept in no attribute.
  const secret = (await keyShown.textContent())?.replace(/\s+/g, '');
  expect(secret, 'the enrolment screen shows the key').toBeTruthy();

  await page.locator('#totp-code').fill(await freshCode(secret!));
  await page.getByRole('button', { name: 'Verify' }).click();

  // Shown once; the way out stays shut until they are acknowledged.
  const list = page.getByTestId('recovery-codes');
  await expect(list).toBeVisible();
  const recoveryCodes = await list.locator('li').allTextContents();
  expect(recoveryCodes.length).toBe(10);
  await expect(page.getByRole('button', { name: 'Continue to GenoLens' })).toBeDisabled();

  await page.getByTestId('recovery-ack').check();
  await page.getByRole('button', { name: 'Continue to GenoLens' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  return { secret: secret!, recoveryCodes };
}

/** From the sidebar's account menu; ends on the sign-in screen, the sign-out taken by the API. */
async function signOutThroughUi(page: Page, email: string): Promise<void> {
  await page.locator('button[aria-haspopup="menu"]').filter({ hasText: email }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expectSignInForm(page);
  // `/?reauth=1` would be a sign-out the API did not take.
  await expect(page).toHaveURL((url) => !url.searchParams.has('reauth'));
  await expect(page.getByTestId('sign-out-failed')).toHaveCount(0);
}

// ---- scenarios ----------------------------------------------------------------------------------

test('sign up, confirm, enrol, then sign in with a code', async ({ page }) => {
  const email = address('signup');
  const password = newPassword();

  await signUpThroughUi(page, email, password);

  // Until the address is confirmed the API answers as it does to a wrong password.
  await signInThroughUi(page, email, password);
  await expect(page.getByTestId('auth-error')).toBeVisible();

  await page.goto(await latestLink(email, '/auth/verify-email'));
  await page.getByRole('button', { name: /confirm my email address/i }).click();
  await expect(page.getByText(/email address is confirmed/i)).toBeVisible();

  // First sign-in of an account without a second factor: straight to the enrolment.
  await signInThroughUi(page, email, password);
  const { secret } = await enrolThroughUi(page);

  await signOutThroughUi(page, email);

  await signInThroughUi(page, email, password);
  await submitCode(page, await freshCode(secret));
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a recovery code opens a session once', async ({ page }) => {
  const account = await shared();
  const [recoveryCode] = account.recoveryCodes;

  const signInWithRecoveryCode = async () => {
    await signInThroughUi(page, account.email, account.password);
    await page.getByRole('button', { name: 'Use a recovery code' }).click();
    await submitCode(page, recoveryCode);
  };

  await signInWithRecoveryCode();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Leave the session without touching the account, then offer the same code again.
  await page.context().clearCookies();
  await signInWithRecoveryCode();
  await expect(page.getByTestId('auth-error')).toContainText(/incorrect code/i);
  await expect(page).not.toHaveURL(/\/dashboard/);
});

test('an expired access cookie is renewed silently', async ({ page, context }) => {
  await signedIn(page, await shared());
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/projects$/);

  // Fifteen minutes later: the access token is gone, the refresh cookie is not.
  const renewals: number[] = [];
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && response.url().endsWith('/auth/refresh')) {
      renewals.push(response.status());
    }
  });
  await context.clearCookies({ name: 'gl_at' });
  expect((await context.cookies()).some((cookie) => cookie.name === 'gl_at')).toBe(false);

  await page.goto('/projects');
  await expect(page).toHaveURL(/\/projects$/);

  expect(renewals, 'one renewal, accepted').toEqual([200]);
  expect((await context.cookies()).some((cookie) => cookie.name === 'gl_at')).toBe(true);
});

test('forgot then reset the password', async ({ page }) => {
  const account = await shared();
  const next = newPassword();

  await openSignIn(page);
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/auth\/forgot$/);
  await page.waitForLoadState('networkidle');
  await page.getByTestId('forgot-email').fill(account.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText(/we've sent a link/i)).toBeVisible();

  await page.goto(await latestLink(account.email, '/auth/reset'));
  await page.waitForLoadState('networkidle');
  await page.getByTestId('new-password').fill(next);
  await page.getByTestId('new-password-confirm').fill(next);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText(/your password has been changed/i)).toBeVisible();
  account.password = next;

  // The reset opened no session: signing in takes the new password, then a code.
  await signInThroughUi(page, account.email, next);
  await submitCode(page, await freshCode(account.secret));
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('accept an invitation', async ({ page, request }) => {
  const { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_TOTP_SECRET } = process.env;
  test.skip(
    !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD || !E2E_ADMIN_TOTP_SECRET,
    'needs a local SCILICIUM_ADMIN account in .env.test.local',
  );

  const invitee = address('invitee');
  const password = newPassword();

  // The administrator signs in through the API, in a jar of its own: the page stays the invitee's.
  await apiSignIn(request, E2E_ADMIN_EMAIL!, E2E_ADMIN_PASSWORD!, E2E_ADMIN_TOTP_SECRET!);
  await ok(await post(request, '/admin/users/invite', { email: invitee, plan: 'STARTER' }), 'invite');

  await page.goto(await latestLink(invitee, '/auth/invite'));
  await page.waitForLoadState('networkidle');
  await page.getByTestId('new-password').fill(password);
  await page.getByTestId('new-password-confirm').fill(password);
  await page.getByRole('button', { name: 'Set password' }).click();

  // The password is set, the second factor is not: enrol it, and land on the dashboard.
  await enrolThroughUi(page);
});

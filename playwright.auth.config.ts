import fs from 'fs';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

/**
 * Local end-to-end run of the self-hosted sign-in (e2e-local/auth.pw.ts):
 *
 *   npx playwright test -c playwright.auth.config.ts
 *
 * It needs a local backend and Mailpit; the prerequisites are written at the top
 * of e2e-local/auth.pw.ts. It creates real accounts, so it must only ever reach
 * local hosts, and three things see to it: this config refuses a test-side URL
 * (base, API, Mailpit) that is not local; the dev server is always started here,
 * with the variables below, never reused (a server already running could have been
 * configured, through its .env.local, for another API: so if :3000 is taken the
 * run fails at once, stop that server first); and auth.pw.ts aborts any request
 * of the browser to a non-local API. It is not part of CI.
 *
 * Only `E2E_*` and `MAILPIT_URL` are read from `.env.test.local` (the other
 * suites keep their own variables there, such as a base URL pointing at a
 * remote preprod, which this suite must never inherit).
 */

// Gitignored; a variable already in the environment wins over the file.
try {
  const file = dotenv.parse(fs.readFileSync('.env.test.local'));
  for (const [name, value] of Object.entries(file)) {
    if ((name.startsWith('E2E_') || name === 'MAILPIT_URL') && !(name in process.env)) {
      process.env[name] = value;
    }
  }
} catch {
  // No file: the admin-only scenario is then skipped.
}

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:8001/api/v1').replace(/\/+$/, '');
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
for (const [name, value] of Object.entries({ E2E_BASE_URL: BASE_URL, E2E_API_URL: API_URL, MAILPIT_URL })) {
  if (!LOCAL_HOSTS.has(new URL(value).hostname)) {
    throw new Error(`${name} must point at a local host (it creates accounts): got ${new URL(value).hostname}`);
  }
}

// Handed to the workers, which read them through process.env.
process.env.E2E_AUTH_SUITE = '1';
process.env.E2E_BASE_URL = BASE_URL;
process.env.E2E_API_URL = API_URL;
process.env.MAILPIT_URL = MAILPIT_URL;

export default defineConfig({
  testDir: './e2e-local',
  // Only this suite: playwright.cosmomics.config.ts matches every *.pw.ts, and
  // the file skips itself there.
  testMatch: '**/auth.pw.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A sign-in waits for the next 30-second step of the authenticator code.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    // The dev server compiles each page on its first visit.
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    // Never reuse: a server started elsewhere keeps its own .env.local, while the env below
    // (which wins over .env files) is what points this one at the local API.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_API_URL: API_URL,
      AUTH_JWKS_URL: `${API_URL}/auth/jwks.json`,
      AUTH_ISSUER: new URL(API_URL).origin,
      NEXT_PUBLIC_ADMIN_APP_URL: 'http://localhost:3001',
    },
  },
});

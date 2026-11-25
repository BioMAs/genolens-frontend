/**
 * What the visitor reads when an auth call is refused. The API answers with a
 * machine code (`detail`); the words live here, once, so every screen says the
 * same thing.
 */

export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

const BY_DETAIL: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  too_many_attempts: 'Too many attempts. Wait 15 minutes, or reset your password.',
  invalid_code: 'Incorrect code.',
  challenge_expired: 'This sign-in step has expired. Sign in again.',
  invalid_token: 'This link is invalid or has expired.',
  invalid_password: 'Your current password is incorrect.',
  mfa_not_enabled: 'Two-factor authentication is not turned on for this account.',
  no_rotation_pending: 'This change of device has expired. Start again.',
  'password_policy:too_short': `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  'password_policy:too_long': `Use at most ${MAX_PASSWORD_LENGTH} characters.`,
  'password_policy:too_common': 'This password is too common. Choose a less predictable one.',
  'password_policy:same_as_email': 'Your password must not be your email address.',
};

/** What the visitor reads when the two copies of a new password differ. */
export const PASSWORDS_DIFFER = 'Both passwords must match.';

/**
 * What the visitor reads once a new confirmation link was requested. One
 * sentence for every address: the API accepts them all and says nothing about
 * which needs a link, so the two screens that offer a resend (sign-in and the
 * dead confirmation link) must answer in exactly the same words.
 */
export const RESEND_SENT = "If this address needs confirming, we've sent a new link.";

/**
 * What the visitor reads where a streamed call (the chat, the chart assistant)
 * met a session that could not be renewed: in words, not as the raw refusal.
 */
export const SESSION_EXPIRED = 'Your session has expired. Sign in again to continue.';

/**
 * What the visitor reads on the sign-in page after a renewal of their session
 * failed while the session itself may still be valid (the API answered 5xx or
 * 429, or could not be reached): the failure is shown with a way to retry,
 * rather than a form that looks like a sign-out.
 */
export const SESSION_NOT_RESTORED = "We couldn't restore your session.";
export const TRY_AGAIN = 'Try again';

/**
 * What the visitor reads on the sign-in page after a sign-out the API could not
 * take (unreachable, 5xx): the session is still valid at the API. When the web
 * app's server did expire the cookies the pages read, the second sentence says
 * what is left: the refresh cookie, which only the API host receives.
 */
export const SIGN_OUT_FAILED =
  'We could not sign you out: your session is still active on this device.';
export const SIGN_OUT_FAILED_REFRESH_COOKIE =
  'This browser no longer uses it here, but its refresh cookie on the GenoLens API may remain until the next successful sign-out.';

/** Once the sign-out left pending has gone through. */
export const SIGNED_OUT = 'You are now signed out.';

/**
 * The message for a refused call. A known code wins; otherwise the status
 * decides: 404 is a route the API keeps closed for now (the pre-launch API
 * serves only the admin sign-in), 0 is an API that could not be reached.
 */
export function authErrorMessage(status: number, detail: string | null): string {
  if (detail !== null && Object.hasOwn(BY_DETAIL, detail)) return BY_DETAIL[detail];
  if (status === 404) return 'This is not available yet.';
  if (status === 0) return 'Cannot reach GenoLens. Check your connection and try again.';
  return 'Something went wrong. Try again.';
}

/** The `attempts_left` an `invalid_code` answer carries (its parsed body), when it carries one. */
function attemptsLeft(body: unknown): number | null {
  const value = (body as { attempts_left?: unknown } | null)?.attempts_left;
  return typeof value === 'number' ? value : null;
}

/** "Incorrect code. 4 attempts left." Without a count from the API, only the first sentence. */
function invalidCodeMessage(body: unknown): string {
  const left = attemptsLeft(body);
  const message = BY_DETAIL.invalid_code;
  return left === null ? message : `${message} ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
}

/** What a refused auth call carries: the fields of the `ok: false` side of `AuthResult`. */
interface Refusal {
  status: number;
  detail: string | null;
  body: unknown;
}

/**
 * What a refused second-factor code (sign-in or enrolment) means for the step.
 *
 * `over`: the step cannot go on, only a new sign-in will do. It has expired
 * (`challenge_expired`), or this wrong code used the last attempt (the API
 * answers `attempts_left: 0` and drops the step). Otherwise the visitor stays
 * where they are and tries again; `message` is what to tell them either way.
 * One rule, so the two screens that ask for a code cannot disagree on it.
 */
export function codeRefusal(refusal: Refusal): { over: boolean; message: string } {
  const { status, detail, body } = refusal;
  if (detail === 'challenge_expired' || (detail === 'invalid_code' && attemptsLeft(body) === 0)) {
    return { over: true, message: authErrorMessage(401, 'challenge_expired') };
  }
  return {
    over: false,
    message: detail === 'invalid_code' ? invalidCodeMessage(body) : authErrorMessage(status, detail),
  };
}

/**
 * Length rule for a new password, checked before the call so the visitor is not
 * sent to the network for nothing. Length only: the server also refuses common
 * passwords and the address itself, and has the last word.
 */
export function passwordProblem(password: string): string | null {
  // Code points, not UTF-16 units: the server counts characters.
  const length = Array.from(password).length;
  if (length < MIN_PASSWORD_LENGTH) return BY_DETAIL['password_policy:too_short'];
  if (length > MAX_PASSWORD_LENGTH) return BY_DETAIL['password_policy:too_long'];
  return null;
}

/**
 * The string `detail` of a refused axios call (`err.response.data.detail`), or
 * null when there is none: no response, no body, or a `detail` that is
 * structured (`account_inactive`) or a list of validation errors.
 */
export function apiErrorDetail(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } | null } } | null | undefined)
    ?.response?.data?.detail;
  return typeof detail === 'string' ? detail : null;
}

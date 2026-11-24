import {
  apiErrorDetail,
  attemptsLeft,
  authErrorMessage,
  invalidCodeMessage,
  passwordProblem,
} from '@/utils/auth/messages';

describe('authErrorMessage', () => {
  it.each([
    [401, 'invalid_credentials', 'Incorrect email or password.'],
    [429, 'too_many_attempts', 'Too many attempts. Wait 15 minutes, or reset your password.'],
    [401, 'invalid_code', 'Incorrect code.'],
    [401, 'challenge_expired', 'This sign-in step has expired. Sign in again.'],
    [400, 'invalid_token', 'This link is invalid or has expired.'],
    [400, 'invalid_password', 'Your current password is incorrect.'],
    [400, 'mfa_not_enabled', 'Two-factor authentication is not turned on for this account.'],
    [400, 'no_rotation_pending', 'This change of device has expired. Start again.'],
    [400, 'password_policy:too_short', 'Use at least 12 characters.'],
    [400, 'password_policy:too_long', 'Use at most 128 characters.'],
    [
      400,
      'password_policy:too_common',
      'This password is too common. Choose a less predictable one.',
    ],
    [400, 'password_policy:same_as_email', 'Your password must not be your email address.'],
  ])('%i %s -> %s', (status, detail, message) => {
    expect(authErrorMessage(status, detail)).toBe(message);
  });

  it('says a route is not available yet on a 404', () => {
    expect(authErrorMessage(404, null)).toBe('This is not available yet.');
    expect(authErrorMessage(404, 'not_found')).toBe('This is not available yet.');
  });

  it('says the API cannot be reached on status 0', () => {
    expect(authErrorMessage(0, null)).toBe(
      'Cannot reach GenoLens. Check your connection and try again.',
    );
  });

  it.each([
    [500, null],
    [422, null],
    [400, 'password_policy:something_new'],
    [403, 'csrf_header_missing'],
  ])('falls back to a generic message for %i %s', (status, detail) => {
    expect(authErrorMessage(status, detail)).toBe('Something went wrong. Try again.');
  });

  it('prefers a known code over the status', () => {
    expect(authErrorMessage(404, 'invalid_token')).toBe('This link is invalid or has expired.');
  });
});

describe('passwordProblem', () => {
  it('asks for at least 12 characters', () => {
    expect(passwordProblem('')).toBe('Use at least 12 characters.');
    expect(passwordProblem('a'.repeat(11))).toBe('Use at least 12 characters.');
  });

  it('accepts the bounds', () => {
    expect(passwordProblem('a'.repeat(12))).toBeNull();
    expect(passwordProblem('a'.repeat(128))).toBeNull();
  });

  it('refuses more than 128 characters', () => {
    expect(passwordProblem('a'.repeat(129))).toBe('Use at most 128 characters.');
  });

  it('counts characters, not UTF-16 units', () => {
    // 12 emoji are 24 UTF-16 units but 12 characters; 11 must still be refused.
    expect(passwordProblem('😀'.repeat(12))).toBeNull();
    expect(passwordProblem('😀'.repeat(11))).toBe('Use at least 12 characters.');
  });
});

describe('apiErrorDetail', () => {
  it('reads the string detail of an axios error', () => {
    expect(apiErrorDetail({ response: { status: 400, data: { detail: 'invalid_token' } } })).toBe(
      'invalid_token',
    );
  });

  it.each([
    ['a network error without a response', new Error('Network Error')],
    ['a response with no body', { response: { status: 500 } }],
    ['a null body', { response: { status: 500, data: null } }],
    ['a body that is not an object', { response: { data: 'Bad gateway' } }],
    ['a structured detail', { response: { data: { detail: { error: 'account_inactive' } } } }],
    ['a list of validation errors', { response: { data: { detail: [{ msg: 'x' }] } } }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'boom'],
  ])('returns null for %s', (_label, err) => {
    expect(apiErrorDetail(err)).toBeNull();
  });
});

describe('attemptsLeft', () => {
  it('reads the count an invalid_code answer carries', () => {
    expect(attemptsLeft({ detail: 'invalid_code', attempts_left: 4 })).toBe(4);
    expect(attemptsLeft({ attempts_left: 0 })).toBe(0);
  });

  it.each([
    ['no body', null],
    ['a body without the count', { detail: 'invalid_code' }],
    ['a count that is not a number', { attempts_left: '4' }],
    ['something that is not an object', 'oops'],
  ])('is null for %s', (_label, body) => {
    expect(attemptsLeft(body)).toBeNull();
  });
});

describe('invalidCodeMessage', () => {
  it('counts the attempts left', () => {
    expect(invalidCodeMessage({ attempts_left: 4 })).toBe('Incorrect code. 4 attempts left.');
    expect(invalidCodeMessage({ attempts_left: 0 })).toBe('Incorrect code. 0 attempts left.');
  });

  it('speaks of a single attempt in the singular', () => {
    expect(invalidCodeMessage({ attempts_left: 1 })).toBe('Incorrect code. 1 attempt left.');
  });

  it('says only that the code is wrong when the API gives no count', () => {
    expect(invalidCodeMessage(null)).toBe('Incorrect code.');
    expect(invalidCodeMessage({ detail: 'invalid_code' })).toBe('Incorrect code.');
  });
});

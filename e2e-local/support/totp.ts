import { authenticator } from 'otplib';

const STEP_MS = 30_000;

// The steps already handed out, per secret, for the life of this process.
const lastStepServed = new Map<string, number>();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A TOTP code for a step this run has never used on this secret.
 *
 * The API refuses a step that is not strictly after the last one it accepted
 * (a code is single-use, even inside its own validity window), and accepts the
 * previous, current and next step. So a second code asked for within the same
 * 30 seconds is the next step's, available at once; only a third one has to
 * wait for the clock to catch up.
 *
 * The record lives in this process: two runs that follow each other within a
 * minute on the same secret (a fixed admin account) may meet a replay refusal.
 */
export async function freshCode(secret: string): Promise<string> {
  // The enrolment screen shows the key in blocks of four; accept it as typed.
  const key = secret.replace(/\s+/g, '').toUpperCase();

  for (;;) {
    const current = Math.floor(Date.now() / STEP_MS);
    const step = Math.max(current, (lastStepServed.get(key) ?? -Infinity) + 1);

    if (step <= current + 1) {
      lastStepServed.set(key, step);
      return authenticator.clone({ epoch: step * STEP_MS }).generate(key);
    }

    // Wait for the next step to open (the margin keeps clear of the boundary).
    await sleep(STEP_MS - (Date.now() % STEP_MS) + 250);
  }
}

/**
 * Concurrent API requests share one Supabase getSession() call.
 *
 * The request interceptor used to call getSession() once per request. A page
 * mounting a burst of queries queued that many acquisitions of supabase-js's
 * navigator lock, and the auto-refresh tick (which gives up immediately when the
 * lock is busy) logged "Acquiring an exclusive Navigator LockManager lock ...
 * immediately failed".
 */
const getSession = jest.fn();

jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ auth: { getSession } }),
}));

import { currentSession } from '@/utils/api';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('currentSession', () => {
  beforeEach(() => getSession.mockReset());

  it('coalesces concurrent callers into a single getSession()', async () => {
    const pending = deferred<{ data: { session: { access_token: string } } }>();
    getSession.mockReturnValue(pending.promise);

    const calls = [currentSession(), currentSession(), currentSession()];
    pending.resolve({ data: { session: { access_token: 'tok' } } });
    const sessions = await Promise.all(calls);

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(sessions.map((s) => s?.access_token)).toEqual(['tok', 'tok', 'tok']);
  });

  it('asks again once the previous call has settled (no stale token)', async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: { access_token: 'old' } } })
      .mockResolvedValueOnce({ data: { session: { access_token: 'new' } } });

    expect((await currentSession())?.access_token).toBe('old');
    expect((await currentSession())?.access_token).toBe('new');
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('recovers after a failed getSession()', async () => {
    getSession
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ data: { session: { access_token: 'tok' } } });

    await expect(currentSession()).rejects.toThrow('boom');
    expect((await currentSession())?.access_token).toBe('tok');
  });
});

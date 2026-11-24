/**
 * The axios instance sends the session cookies, never a token, and recovers
 * from a 401 by renewing the session once and replaying the request.
 *
 * The network is a `jest.fn` adapter; `refreshSession` and `navigate` are
 * faked (the single-flight refresh is tested in `auth/client.test.ts`, and
 * jsdom cannot follow or stub `window.location.assign`).
 */
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import api from '@/utils/api';
import { refreshSession } from '@/utils/auth/client';
import { navigate } from '@/utils/auth/navigation';

jest.mock('@/utils/auth/client', () => ({
  ...jest.requireActual('@/utils/auth/client'),
  refreshSession: jest.fn(),
}));
jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn() }));

const mockRefresh = refreshSession as jest.Mock;
const mockNavigate = navigate as jest.Mock;

const adapter = jest.fn<Promise<AxiosResponse>, [InternalAxiosRequestConfig]>();
const initialAdapter = api.defaults.adapter;

function ok(data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} as InternalAxiosRequestConfig };
}

/** What a real adapter rejects with: an AxiosError carrying the response. */
function fail(status: number, detail: unknown): AxiosError {
  const response = { data: { detail }, status, statusText: '', headers: {} } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', undefined, undefined, response);
}

function setLocation(path: string) {
  window.history.pushState({}, '', path);
}

beforeAll(() => {
  // Like a real adapter, tie the request config to the response or error.
  api.defaults.adapter = async (config) => {
    try {
      return { ...(await adapter(config)), config };
    } catch (error) {
      if (error instanceof AxiosError) {
        error.config = config;
        if (error.response) error.response.config = config;
      }
      throw error;
    }
  };
});

afterAll(() => {
  api.defaults.adapter = initialAdapter;
});

beforeEach(() => {
  adapter.mockReset();
  mockRefresh.mockReset();
  mockNavigate.mockReset();
  setLocation('/');
});

afterEach(() => {
  document.cookie = 'account_status=; path=/; max-age=0';
});

it('sends cookies and the client header, never Authorization', async () => {
  adapter.mockResolvedValueOnce(ok({}));

  await api.get('/projects');

  const cfg = adapter.mock.calls[0][0];
  expect(cfg.withCredentials).toBe(true);
  expect(cfg.headers['X-GenoLens-Client']).toBe('web');
  expect(cfg.headers.Authorization).toBeUndefined();
});

it('replays each concurrent 401 once after a renewal', async () => {
  adapter.mockImplementation((cfg) =>
    cfg._authRetried ? Promise.resolve(ok({ url: cfg.url })) : Promise.reject(fail(401, 'invalid_token'))
  );
  mockRefresh.mockResolvedValue(true);

  const res = await Promise.all(['/a', '/b', '/c'].map((u) => api.get(u)));

  expect(res.map((r) => r.data.url)).toEqual(['/a', '/b', '/c']);
  expect(adapter).toHaveBeenCalledTimes(6); // each request, then its replay
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('replays the request as it was sent, body included', async () => {
  adapter.mockRejectedValueOnce(fail(401, 'invalid_token')).mockResolvedValueOnce(ok({}));
  mockRefresh.mockResolvedValue(true);

  await api.post('/projects/', { name: 'P' });

  const [first, replay] = adapter.mock.calls.map(([cfg]) => cfg);
  expect(first._authRetried).toBeUndefined();
  expect(replay._authRetried).toBe(true);
  expect([replay.method, replay.url, replay.data]).toEqual([first.method, first.url, first.data]);
  expect(JSON.parse(replay.data)).toEqual({ name: 'P' });
  expect(replay.headers['X-GenoLens-Client']).toBe('web');
});

it('treats the pre-launch 403 "Not authenticated" as signed out', async () => {
  adapter.mockRejectedValueOnce(fail(403, 'Not authenticated')).mockResolvedValueOnce(ok({}));
  mockRefresh.mockResolvedValue(true);

  await api.get('/users/me');

  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

it('never refreshes on csrf_header_missing nor account_inactive', async () => {
  adapter.mockRejectedValueOnce(fail(403, 'csrf_header_missing'));
  await expect(api.post('/projects/')).rejects.toBeDefined();

  adapter.mockRejectedValueOnce(fail(403, { error: 'account_inactive', status: 'suspended' }));
  await expect(api.get('/users/me')).rejects.toBeDefined();

  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/suspended');
  expect(document.cookie).toContain('account_status=suspended');
});

it('sends a signed-out user to the login page with next, except on a public page', async () => {
  setLocation('/projects/p1?tab=2');
  adapter.mockRejectedValue(fail(401, 'invalid_token'));
  mockRefresh.mockResolvedValue(false);

  await expect(api.get('/projects/p1')).rejects.toBeDefined();
  expect(mockNavigate).toHaveBeenCalledWith('/?next=%2Fprojects%2Fp1%3Ftab%3D2');

  setLocation('/pricing');
  mockNavigate.mockClear();
  await expect(api.get('/users/me')).rejects.toBeDefined();
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('rejects with the original error when the renewal is refused', async () => {
  setLocation('/dashboard');
  adapter.mockRejectedValue(fail(401, 'invalid_token'));
  mockRefresh.mockResolvedValue(false);

  await expect(api.get('/projects')).rejects.toMatchObject({ response: { status: 401 } });
  expect(adapter).toHaveBeenCalledTimes(1); // no replay
});

it('does not refresh twice for a replay that fails again', async () => {
  setLocation('/dashboard');
  adapter.mockRejectedValue(fail(401, 'invalid_token'));
  mockRefresh.mockResolvedValue(true);

  await expect(api.get('/a')).rejects.toBeDefined();

  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(mockNavigate).toHaveBeenCalledWith('/?next=%2Fdashboard');
});

it('leaves other failures alone: no renewal, no redirect', async () => {
  setLocation('/dashboard');
  adapter.mockRejectedValueOnce(fail(500, 'boom'));
  await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 500 } });

  adapter.mockRejectedValueOnce(fail(403, 'Forbidden'));
  await expect(api.get('/b')).rejects.toMatchObject({ response: { status: 403 } });

  adapter.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
  await expect(api.get('/c')).rejects.toMatchObject({ code: 'ERR_NETWORK' });

  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('passes a cancelled request straight through', async () => {
  setLocation('/dashboard');
  adapter.mockRejectedValueOnce(new AxiosError('timeout', 'ECONNABORTED'));

  await expect(api.get('/a')).rejects.toMatchObject({ code: 'ECONNABORTED' });

  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

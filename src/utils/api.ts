import axios from 'axios';
import { apiBaseUrl, isSignedOut, refreshSession } from '@/utils/auth/client';
import { CLIENT_HEADER, CLIENT_NAME } from '@/utils/auth/constants';
import { navigate } from '@/utils/auth/navigation';
import { isPublicPath, loginPath } from '@/utils/auth/paths';

declare module 'axios' {
  // The type parameter must match axios's own declaration, used or not.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface InternalAxiosRequestConfig<D = any> {
    /** Set on the replay that follows a session renewal, so it is never replayed twice. */
    _authRetried?: boolean;
  }
}

// The session is carried by httpOnly cookies the API sets: the browser sends
// them (`withCredentials`) and this code never sees a token. The API refuses a
// cookie-authenticated write that lacks the client header (CSRF guard).
const api = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    [CLIENT_HEADER]: CLIENT_NAME,
  },
});

/** A Blob's text. `FileReader` rather than `Blob.text()`, which jsdom (the tests) lacks. */
function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/**
 * The `detail` of a refusal's body. On a `responseType: 'blob'` call (report and
 * export downloads) the body arrives as a Blob even for an error, so a 403 is
 * read out of it: without that the pre-launch "Not authenticated" would go
 * unrecognised and the session never renewed. A body that is not JSON, or has
 * no `detail`, yields `undefined`.
 */
async function refusalDetail(status: number, data: unknown): Promise<unknown> {
  let body = data;
  if (status === 403 && typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      body = JSON.parse(await readText(data));
    } catch {
      return undefined;
    }
  }
  return (body as { detail?: unknown } | null | undefined)?.detail;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Ignore ECONNABORTED errors (request cancellation is normal with React Query)
    if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
      return Promise.reject(error);
    }

    // The access token lasts minutes: a request met by "signed out" renews the
    // session (one refresh shared by every request that failed together) and is
    // replayed once. A refused renewal, or a replay refused again, ends the
    // session: back to the sign-in page, remembering where the user was.
    const detail = error.response
      ? await refusalDetail(error.response.status, error.response.data)
      : undefined;

    if (error.response && isSignedOut(error.response.status, detail)) {
      const config = error.config;
      if (config && !config._authRetried && (await refreshSession())) {
        return api.request({ ...config, _authRetried: true });
      }
      if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
        navigate(loginPath(window.location.pathname + window.location.search));
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 403 && (detail as { error?: unknown } | undefined)?.error === 'account_inactive') {
      const accountStatus = (detail as { status: string }).status;
      if (typeof document !== 'undefined') {
        document.cookie = `account_status=${accountStatus}; path=/; max-age=3600`;
        navigate('/suspended');
      }
      return Promise.reject(error);
    }

    // `subscription_expired` is deliberately NOT redirected. It means the access
    // period ended and the account is read-only: the user keeps browsing the
    // projects and results they paid for, and only writes are refused. Sending
    // them to /suspended would hide exactly the data they are still entitled to.
    // The persistent banner explains the state; the caller shows the refusal.

    // Propagate the error — callers handle their own feedback (alert, toast, etc.)
    return Promise.reject(error);
  }
);

export default api;

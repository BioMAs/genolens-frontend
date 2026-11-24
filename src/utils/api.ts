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
    if (error.response && isSignedOut(error.response.status, error.response.data?.detail)) {
      const config = error.config;
      if (config && !config._authRetried && (await refreshSession())) {
        return api.request({ ...config, _authRetried: true });
      }
      if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
        navigate(loginPath(window.location.pathname + window.location.search));
      }
      return Promise.reject(error);
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.detail?.error === 'account_inactive'
    ) {
      const accountStatus = error.response.data.detail.status as string;
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

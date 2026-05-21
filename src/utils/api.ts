import axios from 'axios';
import { createClient } from '@/utils/supabase/client';

// Sanitize baseURL to prevent double slashes or path duplication issues
const getBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || '';
  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  // Safe-guard: if somehow the url ends with double /api/v1, fix it (though unlikely)
  // But more importantly, ensure we don't end up with empty string
  return url || 'http://localhost:8000/api/v1';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    // Supabase client failed to initialise (e.g. missing NEXT_PUBLIC_SUPABASE_URL env var).
    // Log the issue but let the request proceed without auth — the backend will return 401/403.
    console.error('[api] Supabase client error in request interceptor:', err);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ignore ECONNABORTED errors (request cancellation is normal with React Query)
    if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
      return Promise.reject(error);
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.detail?.error === 'account_inactive'
    ) {
      const accountStatus = error.response.data.detail.status as string;
      if (typeof document !== 'undefined') {
        document.cookie = `account_status=${accountStatus}; path=/; max-age=3600`;
        window.location.href = '/suspended';
      }
      return Promise.reject(error);
    }

    // Propagate the error — callers handle their own feedback (alert, toast, etc.)
    return Promise.reject(error);
  }
);

export default api;

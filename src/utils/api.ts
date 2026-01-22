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
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
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

    if (error.response?.status === 401) {
      // Handle unauthorized access (e.g., redirect to login)
      console.error('Unauthorized access');
    }

    // Log other errors for debugging
    if (error.response?.status !== 401) {
      console.error('API Error:', error.message, error.response?.data);
    }

    return Promise.reject(error);
  }
);

export default api;

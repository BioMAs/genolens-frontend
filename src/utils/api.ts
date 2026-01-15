import axios from 'axios';
import { createClient } from '@/utils/supabase/client';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
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

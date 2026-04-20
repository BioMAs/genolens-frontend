/**
 * Hook for Stripe billing API calls — checkout and portal.
 */
'use client';

import { useState } from 'react';
import axios from 'axios';
import api from '@/utils/api';

interface CheckoutResponse {
  checkout_url: string;
}

interface PortalResponse {
  portal_url: string;
}

export function useBilling() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateCheckout = async (plan: string): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<CheckoutResponse>('/billing/checkout', { plan });
      return res.data.checkout_url;
    } catch (err) {
      let message = 'Failed to start checkout. Please try again.';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.detail ?? err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const getBillingPortal = async (): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PortalResponse>('/billing/portal');
      return res.data.portal_url;
    } catch (err) {
      let message = 'Failed to open billing portal. Please try again.';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.detail ?? err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  return { initiateCheckout, getBillingPortal, loading, error, clearError: () => setError(null) };
}

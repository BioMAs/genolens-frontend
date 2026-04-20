/**
 * Hook for Stripe billing API calls — checkout and portal.
 */
'use client';

import { useState } from 'react';
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

  const startCheckout = async (plan: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<CheckoutResponse>('/billing/checkout', { plan });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to start checkout. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PortalResponse>('/billing/portal');
      window.location.href = res.data.portal_url;
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to open billing portal. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, openPortal, loading, error, clearError: () => setError(null) };
}

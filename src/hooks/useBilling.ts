/**
 * Hook for Stripe billing API calls — checkout and portal.
 */
'use client';

import { useState, useCallback } from 'react';
import axios from 'axios';
import api from '@/utils/api';

interface CheckoutResponse {
  checkout_url: string;
}

interface PortalResponse {
  portal_url: string;
}

export interface SubscriptionInfo {
  plan: string;
  is_active: boolean;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  stripe_customer_id: string | null;
  ai_interpretations_used: number;
  ai_tokens_purchased: number;
  ai_tokens_used: number;
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

  const getSubscription = useCallback(async (): Promise<SubscriptionInfo> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SubscriptionInfo>('/billing/subscription');
      return res.data;
    } catch (err) {
      let message = 'Failed to load subscription info. Please try again.';
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
  }, []); // no deps — api is a module-level singleton

  return { initiateCheckout, getBillingPortal, getSubscription, loading, error, clearError: () => setError(null) };
}

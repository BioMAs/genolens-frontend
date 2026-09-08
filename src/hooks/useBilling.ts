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

/**
 * Charge utile EXACTE de `GET /billing/subscription`.
 *
 * Ce type declarait huit champs que la route ne renvoie pas, et ne renvoyait
 * deja pas sur main : `status`, `ai_interpretations_used`,
 * `ai_tokens_purchased`, `ai_tokens_used`, `project_count`, `max_projects`,
 * `storage_used_bytes`, `max_storage_bytes`. Les trois `ai_*` etaient meme
 * declares NON optionnels, ce qui explique que tout compilait alors que
 * chaque lecture recevait `undefined` — d'ou la barriere de projets qui ne
 * bloquait personne, la jauge bloquee a zero, et un bloc de dates que
 * personne n'a jamais vu.
 *
 * Les quotas et l'usage se lisent sur `/users/me`, via `useQuotas`. Ne rien
 * rajouter ici sans l'avoir vu dans la reponse de la route.
 */
export interface SubscriptionInfo {
  plan: string;
  is_active: boolean;
  stripe_customer_id: string | null;
  /** ISO 8601 en String(50) cote modele, formate par le client. */
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  analyses_used_this_month: number;
  analyses_quota: number | null;
  analyses_remaining: number | null;
  can_use_ai: boolean;
  can_use_multi_comparison: boolean;
}

export function useBilling() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateCheckout = async (plan: string, billingCycle: 'monthly' | 'annual' = 'monthly'): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<CheckoutResponse>('/billing/checkout', { plan, billing_cycle: billingCycle });
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

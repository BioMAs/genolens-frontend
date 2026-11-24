/**
 * The session calls of the auth API: password, two-factor authentication,
 * recovery codes, signed-in devices. Components do not call `api` themselves;
 * they go through these hooks.
 *
 * These routes answer 400 (never 401) for a wrong password or code, so a
 * refusal arrives as an axios error whose `response.data.detail` carries the
 * code (see `apiErrorDetail`). A 401 always means "signed out", and the `api`
 * interceptor deals with it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidateUserProfile } from '@/hooks/useUserProfile';
import type { AuthSessionInfo } from '@/types';
import api from '@/utils/api';
import type { MfaSecret } from '@/utils/auth/client';

const SESSIONS_KEY = ['authSessions'] as const;

/** The account's open sessions, the current one flagged. */
export function useAuthSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => (await api.get<AuthSessionInfo[]>('/auth/sessions')).data,
    // A security list is never served from the cache: it is read again each time
    // the page opens (the application default is to keep what it has).
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** Signs another session out. The list is read again even on a 404: that session is gone already. */
export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/sessions/${encodeURIComponent(id)}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/** Signs every session out but the current one; answers how many it closed. */
export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ revoked: number }>('/auth/sessions/revoke-all')).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/** `204`: the other sessions were revoked, so the list is stale. */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { current_password: string; new_password: string }) => {
      await api.post('/auth/password/change', input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/** First step of a change of phone: the new secret, waiting for its first code. */
export function useStartMfaRotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { password: string; code: string }) =>
      (await api.post<MfaSecret>('/auth/mfa/rotate/start', input)).data,
    onSuccess: () => invalidateUserProfile(queryClient),
  });
}

/**
 * Confirms the new secret and answers the new recovery codes. An `invalid_code`
 * makes the API throw the pending secret away: the change has to start again.
 */
export function useConfirmMfaRotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post<{ recovery_codes: string[] }>('/auth/mfa/rotate/confirm', { code })).data,
    onSuccess: () => invalidateUserProfile(queryClient),
  });
}

/** Replaces the recovery codes. The new ones are shown once. */
export function useRegenerateRecoveryCodes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post<{ recovery_codes: string[] }>('/auth/mfa/recovery-codes/regenerate', { code }))
        .data,
    onSuccess: () => invalidateUserProfile(queryClient),
  });
}

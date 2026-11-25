import { apiErrorDetail, authErrorMessage } from '@/utils/auth/messages';

/**
 * What to tell the user about a refused session call (an axios error): the
 * words of the API's `detail` code, or of the status when it has none. A call
 * that never got an answer has no `response`: status 0, "cannot reach".
 */
export function refusalMessage(err: unknown): string {
  const status = (err as { response?: { status?: unknown } } | null | undefined)?.response?.status;
  return authErrorMessage(typeof status === 'number' ? status : 0, apiErrorDetail(err));
}

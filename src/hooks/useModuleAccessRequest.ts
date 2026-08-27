'use client';

import { useCallback, useState } from 'react';
import api from '@/utils/api';
import { MODULE_LABELS, type ModuleId } from '@/components/modules/ModuleSelector';

export interface ModuleRequestNotice {
  kind: 'success' | 'error';
  text: string;
}

/**
 * Ask the team for access to an add-on module.
 *
 * Shared by the profile page and the comparison results page so both entry
 * points send the same request and speak with the same wording.
 */
export function useModuleAccessRequest() {
  const [notice, setNotice] = useState<ModuleRequestNotice | null>(null);
  const [pending, setPending] = useState<ModuleId | null>(null);
  const [requested, setRequested] = useState<ModuleId[]>([]);

  const request = useCallback(async (id: ModuleId) => {
    setNotice(null);
    setPending(id);
    try {
      await api.post('/users/requests', { type: 'module', item: MODULE_LABELS[id] });
      setRequested((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setNotice({ kind: 'success', text: "Request sent — we'll get back to you soon." });
    } catch {
      setNotice({ kind: 'error', text: 'Could not send your request. Please try again later.' });
    } finally {
      setPending(null);
    }
  }, []);

  const reset = useCallback(() => setNotice(null), []);

  return { request, pending, notice, requested, reset };
}

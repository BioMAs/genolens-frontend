'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import api from '@/utils/api';
import { UserProfile } from '@/types';
import ModuleSelector, { MODULE_LABELS, ModuleId } from '@/components/modules/ModuleSelector';

/** Read-only view of the current user's active add-on modules, with a
 *  "request access" action for locked ones (emails the team, then confirms). */
export default function MyModules() {
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<ModuleId | null>(null);

  const { data } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => (await api.get<UserProfile>('/users/me')).data,
    staleTime: 1000 * 60 * 5,
  });

  const requestAccess = async (id: ModuleId) => {
    setNotice(null);
    setBusy(id);
    try {
      await api.post('/users/requests', { type: 'module', item: MODULE_LABELS[id] });
      setNotice({ kind: 'success', text: "Request sent — we'll get back to you soon." });
    } catch {
      setNotice({ kind: 'error', text: 'Could not send your request. Please try again later.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {notice && (
        <div
          className="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm"
          style={
            notice.kind === 'success'
              ? { background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)' }
              : { background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)' }
          }
        >
          {notice.kind === 'success'
            ? <Check className="h-4 w-4" style={{ color: 'var(--sl-teal)' }} />
            : <X className="h-4 w-4" style={{ color: 'var(--sl-red-dark)' }} />}
          <span style={{ color: 'var(--text-primary)' }}>{notice.text}</span>
        </div>
      )}
      <ModuleSelector
        readOnly
        busy={busy}
        onRequestAccess={requestAccess}
        value={{
          claim: !!data?.has_cosmetics_module,
          reporting: !!data?.has_report_customization,
        }}
      />
    </div>
  );
}

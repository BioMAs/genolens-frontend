'use client';

import { Check, X } from 'lucide-react';
import ModuleSelector from '@/components/modules/ModuleSelector';
import { useModuleAccessRequest } from '@/hooks/useModuleAccessRequest';
import { useUserProfile } from '@/hooks/useUserProfile';

/** Read-only view of the current user's active add-on modules, with a
 *  "request access" action for locked ones (emails the team, then confirms). */
export default function MyModules() {
  const { request: requestAccess, pending, notice } = useModuleAccessRequest();

  const { data } = useUserProfile();

  return (
    <div className="space-y-3">
      {notice && (
        <div
          className="flex items-center gap-3 rounded-card border px-4 py-2.5 text-body-sm"
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
        busy={pending}
        onRequestAccess={requestAccess}
        value={{
          claim: !!data?.has_cosmetics_module,
          reporting: !!data?.has_report_customization,
          science: !!data?.has_scientific_module,
          drugdiscovery: !!data?.has_drug_discovery_module,
        }}
      />
    </div>
  );
}

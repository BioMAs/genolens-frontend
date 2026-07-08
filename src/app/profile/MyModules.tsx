'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { UserProfile } from '@/types';
import ModuleSelector, { MODULE_LABELS, ModuleId } from '@/components/modules/ModuleSelector';

const ADMIN_EMAIL = 'contact@scilicium.com';

/** Read-only view of the current user's active add-on modules, with a
 *  "request access" action for locked ones (opens a prefilled email — no
 *  self-service activation). */
export default function MyModules() {
  const { data } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => (await api.get<UserProfile>('/users/me')).data,
    staleTime: 1000 * 60 * 5,
  });

  const requestAccess = (id: ModuleId) => {
    const label = MODULE_LABELS[id];
    const who = data?.email ? ` (${data.email})` : '';
    const subject = encodeURIComponent(`Module access request — ${label}`);
    const body = encodeURIComponent(
      `Hello,\n\nI would like to request access to the "${label}" module for my GenoLens account${who}.\n\nThank you.`,
    );
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <ModuleSelector
      readOnly
      onRequestAccess={requestAccess}
      value={{
        claim: !!data?.has_cosmetics_module,
        reporting: !!data?.has_report_customization,
      }}
    />
  );
}

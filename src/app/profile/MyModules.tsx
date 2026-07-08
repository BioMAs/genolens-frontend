'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { UserProfile } from '@/types';
import ModuleSelector from '@/components/modules/ModuleSelector';

/** Read-only view of the current user's active add-on modules. */
export default function MyModules() {
  const { data } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => (await api.get<UserProfile>('/users/me')).data,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <ModuleSelector
      readOnly
      value={{
        claim: !!data?.has_cosmetics_module,
        reporting: !!data?.has_report_customization,
      }}
    />
  );
}

import { useProjectSummary } from '@/hooks/useProjectData';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectMembers } from '@/hooks/useProjectMembers';

/**
 * Who may manage a project's data and launch analyses: the owner, or a member
 * with ADMIN access. One rule, shared by every page that shows a launch button,
 * so the overview and the Analyses page cannot drift apart.
 *
 * The queries are the ones ProjectHub already runs; React Query deduplicates
 * them by key.
 */
export function useProjectPermissions(projectId: string) {
  const { data: summary } = useProjectSummary(projectId);
  const { user: currentUser } = useCurrentUser();
  const { data: membersData } = useProjectMembers(projectId);

  const project = summary?.project;
  const isOwner = !!project && !!currentUser && project.owner_id === currentUser.id;
  const currentMember = membersData?.members?.find((m) => m.user_id === currentUser?.id);
  const canManageData = isOwner || currentMember?.access_level === 'ADMIN';

  return { isOwner, canManageData };
}

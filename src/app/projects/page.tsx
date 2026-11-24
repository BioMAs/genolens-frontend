import { getSessionUser } from '@/utils/auth/server';
import { redirect } from 'next/navigation';
import ProjectsView from '@/components/projects/ProjectsView';

export default async function ProjectsPage() {
  if (!(await getSessionUser())) {
    redirect('/');
  }

  return (
    <div className="page-container">
      <ProjectsView />
    </div>
  );
}

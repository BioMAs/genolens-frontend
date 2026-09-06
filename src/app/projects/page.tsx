import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ProjectsView from '@/components/projects/ProjectsView';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return (
    <div className="page-container">
      <ProjectsView />
    </div>
  );
}

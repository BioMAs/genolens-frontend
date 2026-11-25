import { getSessionUser } from '@/utils/auth/server';
import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';

export default async function DashboardPage() {
  if (!(await getSessionUser())) {
    redirect('/');
  }

  return (
    <div className="page-container">
      <Dashboard />
    </div>
  );
}

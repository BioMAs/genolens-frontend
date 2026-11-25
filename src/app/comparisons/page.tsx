import { getSessionUser } from '@/utils/auth/server';
import { redirect } from 'next/navigation';
import AllComparisonsView from '@/components/comparisons/AllComparisonsView';

export default async function ComparisonsPage() {
  if (!(await getSessionUser())) {
    redirect('/');
  }

  return (
    <div className="page-container">
      <AllComparisonsView />
    </div>
  );
}

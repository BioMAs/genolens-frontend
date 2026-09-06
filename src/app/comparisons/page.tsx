import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AllComparisonsView from '@/components/comparisons/AllComparisonsView';

export default async function ComparisonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return (
    <div className="page-container">
      <AllComparisonsView />
    </div>
  );
}

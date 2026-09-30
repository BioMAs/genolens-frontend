import { redirect } from 'next/navigation';

/**
 * Former entry point of a multi-method launcher that posted to an endpoint the
 * backend never had. Every « New analysis » button now opens the setup wizard;
 * this route stays only so old links and bookmarks land there too.
 */
export default async function NewAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}/setup`);
}

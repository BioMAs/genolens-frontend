import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getDoc, listDocs } from '@/lib/docs';
import DocArticle from '@/components/docs/DocArticle';

export function generateStaticParams() {
  return listDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return { title: 'Documentation — GenoLens' };
  return { title: `${doc.title} — GenoLens`, description: doc.description };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  // Précédent/suivant dans l'ordre de l'index, donc par catégorie puis order.
  const all = listDocs();
  const index = all.findIndex((d) => d.slug === slug);

  return (
    <div className="page-container">
      <Link
        href="/docs"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: 'var(--sl-purple)' }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All guides
      </Link>
      <DocArticle
        doc={doc}
        previous={index > 0 ? all[index - 1] : null}
        next={index >= 0 && index < all.length - 1 ? all[index + 1] : null}
      />
    </div>
  );
}

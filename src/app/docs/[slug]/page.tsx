import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getDoc, listDocs } from '@/lib/docs';
import DocArticle from '@/components/docs/DocArticle';

// Pas de `generateStaticParams` : la page lit la session pour sa garde
// d'authentification, elle est donc rendue à la demande. Pré-générer les dix
// slugs ne ferait qu'annoncer un rendu statique que la lecture des cookies
// abandonne aussitôt.

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
  // Garde avant toute lecture de guide : un visiteur anonyme ne doit ni lire
  // le contenu, ni distinguer un slug existant d'un slug inconnu.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

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

import { isValidElement } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { CATEGORY_LABELS } from '@/lib/docs-categories';
import type { Doc, DocMeta, Heading } from '@/lib/docs';
import { PageHeader } from '@/components/ui/page-header';

interface DocArticleProps {
  doc: Doc;
  previous: DocMeta | null;
  next: DocMeta | null;
}

/**
 * Étiquette les titres rendus avec les ancres calculées par `extractHeadings`.
 *
 * Un `slugify` local recalculait l'ancre depuis le texte du titre, et
 * divergeait dès qu'un guide répétait un titre de section : `extractHeadings`
 * suffixe le second (`overview-2`), un slug recalculé rendait `overview` deux
 * fois — le sommaire renvoyait alors au premier des deux, et React voyait
 * deux clés identiques. `doc.headings` est donc la seule source d'ancres, et
 * la file est consommée dans l'ordre du document, celui dans lequel
 * react-markdown rend les titres.
 */
function createAnchorReader(headings: Heading[]): (text: string) => string | undefined {
  const queues = new Map<string, string[]>();
  for (const heading of headings) {
    const queue = queues.get(heading.text);
    if (queue) queue.push(heading.id);
    else queues.set(heading.text, [heading.id]);
  }
  return (text) => queues.get(text)?.shift();
}

/**
 * Texte brut d'un titre, y compris quand il porte du balisage inline
 * (`` `code` ``, **gras**, [lien](url)…) : react-markdown transmet alors des
 * éléments React (ex. `<code>`) dans `children`, pas de simples chaînes.
 * Sans descendre dans leurs props, l'ancre calculée ici divergerait de celle
 * d'`extractHeadings`, qui lit le Markdown brut — cassant le sommaire pour
 * tout titre du type `### \`go_terms\`` (présent dans plusieurs guides).
 */
function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

export default function DocArticle({ doc, previous, next }: DocArticleProps) {
  // Créé à chaque rendu : la file est consommée par les titres de ce rendu-là.
  const anchorFor = createAnchorReader(doc.headings);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_200px]">
      <article className="min-w-0">
        {/* Le sur-titre de categorie etait un `<p>` en teal de MARQUE, pose a
            la main au-dessus d'un `.page-title`. C'est exactement ce que
            `eyebrow` designe, et la classe `.eyebrow` le rend dans l'encre
            discrete plutot que dans une couleur de marque. */}
        <PageHeader
          eyebrow={CATEGORY_LABELS[doc.category]}
          title={doc.title}
          titleVariant="name"
          description={doc.description}
        />

        <div className="doc-prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => <h2 id={anchorFor(textOf(children))}>{children}</h2>,
              h3: ({ children }) => <h3 id={anchorFor(textOf(children))}>{children}</h3>,
              // Les tables GFM des guides débordent sur mobile : le défilement
              // reste dans le tableau, jamais sur le corps de la page.
              table: ({ children }) => (
                <div style={{ overflowX: 'auto' }}>
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </div>

        {(previous || next) && (
          <div
            className="mt-12 flex flex-wrap items-stretch justify-between gap-3 border-t pt-5"
            style={{ borderColor: 'var(--border)' }}
          >
            {previous ? (
              <Link
                href={`/docs/${previous.slug}`}
                className="gl-card flex items-center gap-2 p-3 text-caption transition-colors hover:border-[var(--sl-purple)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                <span>
                  <span className="block" style={{ color: 'var(--text-muted)' }}>
                    Previous
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {previous.title}
                  </span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/docs/${next.slug}`}
                className="gl-card ml-auto flex items-center gap-2 p-3 text-right text-caption transition-colors hover:border-[var(--sl-purple)]"
              >
                <span>
                  <span className="block" style={{ color: 'var(--text-muted)' }}>
                    Next
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {next.title}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </article>

      {doc.headings.length > 0 && (
        <nav aria-label="On this page" className="hidden lg:block">
          <p
            className="mb-2 text-micro uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            On this page
          </p>
          <ul className="sticky top-4 space-y-2 border-l pl-3" style={{ borderColor: 'var(--border)' }}>
            {doc.headings.map((heading) => (
              <li key={heading.id} style={{ paddingLeft: heading.depth === 3 ? 10 : 0 }}>
                <a
                  href={`#${heading.id}`}
                  className="text-caption hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

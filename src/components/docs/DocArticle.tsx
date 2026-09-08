import { isValidElement } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { CATEGORY_LABELS } from '@/lib/docs-categories';
import type { Doc, DocMeta } from '@/lib/docs';

interface DocArticleProps {
  doc: Doc;
  previous: DocMeta | null;
  next: DocMeta | null;
}

/** Les titres du corps portent l'ancre calculée par extractHeadings, pour que
 *  les liens du sommaire tombent au bon endroit. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_200px]">
      <article className="min-w-0">
        <p
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--sl-teal)' }}
        >
          {CATEGORY_LABELS[doc.category]}
        </p>
        <h1 className="page-title mt-1">{doc.title}</h1>
        {doc.description && (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {doc.description}
          </p>
        )}

        <div className="doc-prose mt-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => <h2 id={slugify(textOf(children))}>{children}</h2>,
              h3: ({ children }) => <h3 id={slugify(textOf(children))}>{children}</h3>,
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
            className="mt-10 flex flex-wrap items-stretch justify-between gap-3 border-t pt-5"
            style={{ borderColor: 'var(--border)' }}
          >
            {previous ? (
              <Link
                href={`/docs/${previous.slug}`}
                className="gl-card flex items-center gap-2 p-3 text-xs transition-colors hover:border-[var(--sl-purple)]"
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
                className="gl-card ml-auto flex items-center gap-2 p-3 text-right text-xs transition-colors hover:border-[var(--sl-purple)]"
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
            className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            On this page
          </p>
          <ul className="sticky top-4 space-y-1.5 border-l pl-3" style={{ borderColor: 'var(--border)' }}>
            {doc.headings.map((heading) => (
              <li key={heading.id} style={{ paddingLeft: heading.depth === 3 ? 10 : 0 }}>
                <a
                  href={`#${heading.id}`}
                  className="text-xs hover:underline"
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

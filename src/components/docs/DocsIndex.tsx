'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { CATEGORY_LABELS, DOC_CATEGORIES } from '@/lib/docs-categories';
import type { SearchEntry } from '@/lib/docs';
import DocsSearch from './DocsSearch';

interface DocsIndexProps {
  docs: SearchEntry[];
}

/** Le filtre porte aussi sur les titres de sections : chercher « volcano »
 *  doit trouver un guide qui ne le mentionne qu'à l'intérieur. */
function matches(doc: SearchEntry, query: string): boolean {
  const haystack = [doc.title, doc.description, doc.category, ...doc.headings]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export default function DocsIndex({ docs }: DocsIndexProps) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? docs.filter((d) => matches(d, needle)) : docs;
  }, [docs, query]);

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <DocsSearch value={query} onChange={setQuery} count={docs.length} />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No guide matches “{query}”.
        </p>
      ) : (
        DOC_CATEGORIES.map((category) => {
          const inCategory = visible.filter((d) => d.category === category);
          if (inCategory.length === 0) return null;

          return (
            <section key={category}>
              <h2
                className="mb-3 font-display text-[15px] font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {inCategory.map((doc) => (
                  <Link
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    className="gl-card group flex items-start gap-3 p-4 transition-colors hover:border-[var(--sl-purple)]"
                  >
                    <BookOpen
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: 'var(--sl-teal)' }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {doc.title}
                      </span>
                      <span
                        className="mt-1 block text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {doc.description}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: 'var(--sl-purple)' }}
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

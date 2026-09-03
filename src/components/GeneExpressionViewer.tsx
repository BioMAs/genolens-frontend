'use client';

/**
 * Pick a gene, see its expression across the conditions of a comparison.
 *
 * Now a shell: the fetching moved to `useGeneExpressionByCondition` and the drawing to
 * `GeneExpressionBoxplot`, both of which the gene detail card uses directly. What is left here
 * is the part the card does not want — an autocomplete over the matrix's genes, for browsing
 * rather than following a selection.
 *
 * It went from 355 lines to this. It is still mounted nowhere, but it is no longer a *divergent
 * copy* of the fetch and the plot, which was the actual risk of leaving it around.
 */

import { useMemo, useState } from 'react';
import { Dataset } from '@/types';
import { useGeneExpressionByCondition } from '@/hooks/useGeneExpressionByCondition';
import GeneExpressionBoxplot from './GeneExpressionBoxplot';

interface Props {
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName: string;
  allGenes: string[];
  sampleConditionMap?: Record<string, string>;
  geneNameMap?: Record<string, string>;
}

/** How many suggestions to offer; the matrix can hold a hundred thousand genes. */
const MAX_SUGGESTIONS = 50;

export default function GeneExpressionViewer({
  matrixDataset,
  sampleIds,
  comparisonName,
  allGenes,
  sampleConditionMap,
  geneNameMap,
}: Props) {
  // Opens on the first gene of the list, as it always did.
  const [gene, setGene] = useState<string>(() => allGenes[0] ?? '');
  const [search, setSearch] = useState('');

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return allGenes
      .filter((id) => {
        const symbol = geneNameMap?.[id] ?? '';
        return id.toLowerCase().includes(term) || symbol.toLowerCase().includes(term);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [search, allGenes, geneNameMap]);

  const { data, isLoading } = useGeneExpressionByCondition({
    matrixDatasetId: matrixDataset.id,
    gene,
    comparisonName,
    sampleIds,
    conditionBySample: sampleConditionMap,
  });

  const label = geneNameMap?.[gene] ?? gene;

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a gene by symbol or id"
          aria-label="Search a gene"
          className="w-full px-3 py-2 text-sm"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--text-primary)',
          }}
        />
        {suggestions.length > 0 && (
          <ul
            className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto py-1"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-panel)',
            }}
          >
            {suggestions.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setGene(id);
                    setSearch('');
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span className="gene-symbol">{geneNameMap?.[id] ?? id}</span>
                  {geneNameMap?.[id] ? (
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {id}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {label || 'No gene selected'}
        </p>
        <GeneExpressionBoxplot data={data} loading={isLoading} height={340} showModeBar />
      </div>
    </div>
  );
}

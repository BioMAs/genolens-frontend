'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Filter, ChevronLeft, ChevronRight, BarChart2, Table as TableIcon, GitMerge, Grid } from 'lucide-react';
import { useDataset, useDatasetColumns, useDatasetData } from '@/hooks/useDatasets';
import DatasetVisualizer from './DatasetVisualizer';
import { PageHeader } from '@/components/ui/page-header';

interface DatasetExplorerProps {
  projectId: string;
  datasetId: string;
}

interface DatasetQueryFilters {
  limit: number;
  offset: number;
  columns?: string[];
  gene_ids?: string[];
}

export default function DatasetExplorer({ projectId, datasetId }: DatasetExplorerProps) {
  // Utilise React Query pour récupérer les métadonnées et colonnes
  const { data: dataset, isLoading: datasetLoading } = useDataset(datasetId);
  const { data: columnsData } = useDatasetColumns(datasetId);
  
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Colonnes disponibles depuis l'endpoint optimisé
  const availableColumns = useMemo(() => columnsData?.columns ?? [], [columnsData?.columns]);
  const effectiveColumns = selectedColumns.length === 0 ? availableColumns : selectedColumns;

  // Prépare les filtres pour l'endpoint optimisé
  const filters: DatasetQueryFilters = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    columns: effectiveColumns.length > 0 && effectiveColumns.length < availableColumns.length
      ? effectiveColumns
      : undefined,
  };

  // Ajoute le filtre de recherche si applicable
  if (searchQuery.trim()) {
    const ids = searchQuery.split(/[\s,]+/).filter(Boolean);
    if (ids.length > 0) {
      // Note: l'API doit supporter un paramètre gene_ids ou équivalent
      filters.gene_ids = ids;
    }
  }

  // Utilise l'endpoint optimisé avec filtrage backend
  const { data, isLoading, error } = useDatasetData(datasetId, filters);

  const loading = datasetLoading || isLoading;

    // Debounce search
  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col)
        : [...prev, col]
    );
    // Réinitialise la page quand on change les colonnes
    setPage(1);
  };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load data. Please try again.';
    return (
      <div className="p-8">
        <div className="page-container">
          <div className="rounded-sm bg-danger-soft p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-body-sm font-medium text-danger-ink">Error</h3>
                <div className="mt-2 text-body-sm text-danger-ink">
                  <p>{errorMessage}</p>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/projects/${projectId}`}
                    className="text-body-sm font-medium text-danger-ink hover:text-danger-ink-hover"
                  >
                    &larr; Back to Project
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* L'en-tete etait une bande `bg-surface shadow-sm` collee en haut de
          l'ecran, avec sa fleche de retour et sa barre d'outils dedans. La
          fleche disparait — le fil d'Ariane dit d'ou l'on vient — et le nom du
          jeu de donnees devient un titre de page plutot qu'un titre de bande.

          `titleVariant="name"` : un nom de jeu de donnees est saisi. */}
      <div className="page-container">
        <PageHeader
          eyebrow="Dataset explorer"
          title={dataset?.name || 'Loading…'}
          titleVariant="name"
          crumbs={[
            { label: 'Projects', href: '/projects' },
            { label: 'Project', href: `/projects/${projectId}` },
            { label: dataset?.name ?? 'Dataset' },
          ]}
        />
        <div className="mb-6 flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative rounded-sm shadow-sm">
              <input
                type="text"
                className="focus:ring-brand-primary focus:border-brand-primary block w-full sm:text-body-sm border-strong rounded-sm"
                placeholder="Search IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Column Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="inline-flex items-center px-3 py-2 border border-strong shadow-sm text-body-sm leading-4 font-medium rounded-sm text-primary bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              >
                <Filter className="h-4 w-4 mr-2" />
                Columns ({selectedColumns.length})
              </button>
              
              {showColumnSelector && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-sm shadow-lg bg-surface ring-1 ring-black ring-opacity-5 z-50 max-h-96 overflow-y-auto">
                  <div className="py-1" role="menu" aria-orientation="vertical">
                    <div className="px-4 py-2 border-b border-subtle">
                      <button 
                        className="text-caption text-brand-primary hover:text-brand-primary/80"
                        onClick={() => setSelectedColumns(availableColumns)}
                      >
                        Select All
                      </button>
                      <span className="mx-2 text-muted">|</span>
                      <button 
                        className="text-caption text-brand-primary hover:text-brand-primary/80"
                        onClick={() => setSelectedColumns([])}
                      >
                        Clear
                      </button>
                    </div>
                    {availableColumns.map((col) => (
                      <label key={col} className="flex items-center px-4 py-2 hover:bg-hover cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-strong rounded-sm"
                          checked={selectedColumns.includes(col)}
                          onChange={() => toggleColumn(col)}
                        />
                        <span className="ml-2 text-body-sm text-primary truncate" title={col}>
                          {col}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="inline-flex items-center px-3 py-2 border border-strong shadow-sm text-body-sm leading-4 font-medium rounded-sm text-primary bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
        </div>

        {/* View Mode Switcher */}
        <div className="mb-6">
          <div className="border-b border-line">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setViewMode('table')}
                className={`${
                  viewMode === 'table'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-secondary hover:text-primary hover:border-strong'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-body-sm flex items-center`}
              >
                <TableIcon className="h-4 w-4 mr-2" />
                Table View
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`${
                  viewMode === 'chart'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-secondary hover:text-primary hover:border-strong'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-body-sm flex items-center`}
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                Visualization
              </button>

              {dataset?.type === 'MATRIX' && (
                <Link
                  href={`/projects/${projectId}/datasets/${datasetId}/clustering`}
                  className="border-transparent text-secondary hover:text-primary hover:border-strong whitespace-nowrap py-4 px-1 border-b-2 font-medium text-body-sm flex items-center"
                >
                  <GitMerge className="h-4 w-4 mr-2" />
                  Clustering
                </Link>
              )}

              <Link
                href={`/projects/${projectId}/datasets/${datasetId}/enrichment`}
                className="border-transparent text-secondary hover:text-primary hover:border-strong whitespace-nowrap py-4 px-1 border-b-2 font-medium text-body-sm flex items-center"
              >
                <Grid className="h-4 w-4 mr-2" />
                Enrichment
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {viewMode === 'table' ? (
            <div className="bg-surface shadow rounded-control overflow-hidden">
              {loading && !data ? (
                <div className="p-12 text-center text-secondary">Loading data...</div>
              ) : data ? (
                <div className="overflow-x-auto">
                <table className="data-table">
                  <thead className="bg-surface-2">
                    <tr>
                      {data.columns.map((col) => (
                        <th
                          key={col}
                          scope="col"
                          className="px-6 py-3 text-left text-caption font-medium text-secondary uppercase tracking-wider whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-line">
                    {data.data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-hover">
                        {data.columns.map((col) => (
                          <td
                            key={`${idx}-${col}`}
                            className="px-6 py-4 whitespace-nowrap text-body-sm text-secondary"
                          >
                            {typeof row[col] === 'number' 
                              ? row[col].toLocaleString(undefined, { maximumFractionDigits: 4 }) 
                              : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-secondary">No data available</div>
            )}
          </div>
          ) : (
            <div className="h-full">
              {dataset && data ? (
                <DatasetVisualizer dataset={dataset} data={data} />
              ) : (
                <div className="p-12 text-center text-secondary">Loading visualization...</div>
              )}
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        {viewMode === 'table' && data && (
          <div className="bg-surface border-t border-line px-4 py-3 flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-body-sm text-primary">
                  Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(page * pageSize, data.total_rows)}
                  </span>{' '}
                  of <span className="font-medium">{data.total_rows}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-sm shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-sm border border-strong bg-surface text-body-sm font-medium text-secondary hover:bg-hover disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= data.total_rows}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-sm border border-strong bg-surface text-body-sm font-medium text-secondary hover:bg-hover disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

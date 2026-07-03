'use client';

import React, { useState } from 'react';
import {
  Search, RefreshCw, ExternalLink, Download, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { GEODataset } from '@/types';
import { useGeoSearch, useImportFromGeo } from '@/hooks/useGeo';

// Map a GEO organism string to a GenoLens-supported key, or null if unsupported.
function toOrganismKey(organism: string): 'human' | 'mouse' | null {
  const o = (organism || '').toLowerCase();
  if (o.includes('homo sapiens') || o.includes('human')) return 'human';
  if (o.includes('mus musculus') || o.includes('mouse')) return 'mouse';
  return null;
}

interface GeoImportPanelProps {
  projectId: string;
  /** Called once the two datasets (matrix + samples) have been created. */
  onImported: (ids: { matrixDatasetId: string; samplesDatasetId: string }) => void;
}

export default function GeoImportPanel({ projectId, onImported }: GeoImportPanelProps) {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const search = useGeoSearch();
  const importGeo = useImportFromGeo();
  const [importingAcc, setImportingAcc] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const runSearch = () => {
    if (query.trim().length < 3) return;
    setImportError(null);
    search.mutate({ query: query.trim(), maxResults, countsOnly: true });
  };

  const handleImport = async (ds: GEODataset) => {
    const organism = toOrganismKey(ds.organism);
    if (!organism) return;
    setImportError(null);
    setImportingAcc(ds.accession);
    try {
      const res = await importGeo.mutateAsync({ projectId, accession: ds.accession, organism });
      onImported({
        matrixDatasetId: res.matrix_dataset_id,
        samplesDatasetId: res.samples_dataset_id,
      });
    } catch (e) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setImportError(detail || `Import of ${ds.accession} failed. Please try another series.`);
    } finally {
      setImportingAcc(null);
    }
  };

  const result = search.data;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700">
        Search public <strong>NCBI GEO</strong> RNA-seq series. Only human/mouse series with
        NCBI-generated count matrices can be imported — they arrive as a count matrix + sample
        sheet, ready to run through the pipeline.
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="e.g. breast cancer RNA-seq, Alzheimer hippocampus, GSE164073…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <select
          value={maxResults}
          onChange={(e) => setMaxResults(Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          title="Maximum number of results"
        >
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>{n} results</option>
          ))}
        </select>
        <button
          type="button"
          onClick={runSearch}
          disabled={search.isPending || query.trim().length < 3}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {search.isPending
            ? <RefreshCw className="h-4 w-4 animate-spin" />
            : <Search className="h-4 w-4" />}
          {search.isPending ? 'Searching…' : 'Search'}
        </button>
      </div>

      {search.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Error searching NCBI GEO. Please try again.
        </div>
      )}
      {importError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {importError}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            <strong>{result.total.toLocaleString()}</strong> importable series found · showing the
            first {result.datasets.length}
          </p>
          {result.datasets.length === 0 && (
            <p className="text-sm text-amber-600">
              No importable series matched. Try broader terms — only human/mouse RNA-seq series
              processed by NCBI are shown.
            </p>
          )}
          {result.datasets.map((ds) => (
            <GeoResultCard
              key={ds.uid}
              ds={ds}
              importing={importingAcc === ds.accession}
              disabled={!!importingAcc}
              onImport={() => handleImport(ds)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GeoResultCard({
  ds, importing, disabled, onImport,
}: {
  ds: GEODataset;
  importing: boolean;
  disabled: boolean;
  onImport: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const organism = toOrganismKey(ds.organism);
  const supported = organism !== null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs font-bold text-indigo-600">
              {ds.accession}
            </span>
            {ds.organism && <span className="text-xs text-gray-500">· {ds.organism}</span>}
            {ds.samples_n > 0 && <span className="text-xs text-gray-500">· {ds.samples_n} samples</span>}
            {ds.pub_date && <span className="text-xs text-gray-400">· {ds.pub_date}</span>}
          </div>
          <h4 className="line-clamp-2 text-sm font-semibold text-gray-900">{ds.title || '—'}</h4>
        </div>
        <a
          href={ds.geo_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-shrink-0 items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          GEO <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {ds.summary && (
        <>
          <p className={`mt-2 text-xs text-gray-600 ${expanded ? '' : 'line-clamp-2'}`}>
            {ds.summary}
          </p>
          {ds.summary.length > 200 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 flex items-center gap-0.5 text-xs text-indigo-500 hover:text-indigo-700"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Collapse</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
            </button>
          )}
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        {ds.platform
          ? <p className="text-xs text-gray-400">Platform: {ds.platform}</p>
          : <span />}
        <button
          type="button"
          onClick={onImport}
          disabled={!supported || disabled}
          title={supported ? 'Import this series into your project' : 'Only human/mouse series can be imported'}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing
            ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importing…</>
            : <><Download className="h-3.5 w-3.5" /> Import</>}
        </button>
      </div>
    </div>
  );
}

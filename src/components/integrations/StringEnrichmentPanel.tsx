/**
 * Functional enrichment of a gene list through STRING's annotation API.
 *
 * Extracted verbatim from `ExternalIntegrationsPanel`, which held it beside the PPI network in
 * a sub-tab. The two answer different questions and now live on different screens: the network
 * is evidence in Understand, this is a database lookup in Tools.
 *
 * A correction to what the split was described as, while we are here: that panel did **two**
 * jobs, not three. Its GEO search tab existed but was never listed in the tab array, so it was
 * unreachable — and duplicated `wizard/GeoImportPanel`, which does the same thing on
 * `useGeoSearch` and is actually mounted. It went with the panel rather than being carried over.
 */
'use client';

import { useState, useCallback } from 'react';
import { Download, FlaskConical, RefreshCw } from 'lucide-react';
import api from '@/utils/api';

interface StringEnrichment {
  category: string;
  term: string;
  description: string;
  number_of_genes: number;
  number_of_genes_in_background: number;
  p_value: number;
  fdr: number;
  matching_genes: string;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

const SPECIES_OPTIONS = [
  { label: 'Homo sapiens (human)', value: 9606 },
  { label: 'Mus musculus (mouse)', value: 10090 },
  { label: 'Rattus norvegicus (rat)', value: 10116 },
  { label: 'Danio rerio (zebrafish)', value: 7955 },
  { label: 'Drosophila melanogaster', value: 7227 },
  { label: 'C. elegans', value: 6239 },
  { label: 'Saccharomyces cerevisiae', value: 4932 },
];

const ENRICH_CATEGORIES: Record<string, { label: string; color: string }> = {
  'Process': { label: 'Biological Process', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  'Function': { label: 'Molecular Function', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  'Component': { label: 'Cellular Component', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  'KEGG': { label: 'KEGG', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  'Reactome': { label: 'Reactome', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' },
  'WikiPathways': { label: 'WikiPathways', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
};

function fmtPval(v: number): string {
  if (v < 0.0001) return v.toExponential(2);
  return v.toFixed(4);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as ApiError).response?.data?.detail || fallback;
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

export default function StringEnrichmentPanel({
  initialGenes = '',
}: {
  initialGenes?: string;
}) {
  const [genesInput, setGenesInput] = useState(initialGenes);
  const [species, setSpecies] = useState(9606);
  const [enrichments, setEnrichments] = useState<StringEnrichment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const parseGenes = useCallback(
    () => genesInput.split(/[\n,;\s]+/).map((g) => g.trim()).filter(Boolean),
    [genesInput],
  );

  const run = useCallback(async () => {
    const genes = parseGenes();
    if (!genes.length) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/integrations/string/enrichment', {
        gene_symbols: genes,
        species,
      });
      setEnrichments(data.enrichments || []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'STRING enrichment error'));
    } finally {
      setLoading(false);
    }
  }, [parseGenes, species]);

  const visible = enrichments.filter((e) => {
    const matchText = !filter || e.description.toLowerCase().includes(filter.toLowerCase()) || e.term.toLowerCase().includes(filter.toLowerCase());
    const matchCat = !catFilter || e.category === catFilter;
    return matchText && matchCat;
  });

  const allCats = [...new Set(enrichments.map((e) => e.category))];

  const exportCSV = () => {
    const header = 'Category,Term,Description,Genes,Background,P-value,FDR,Matching Genes';
    const rows = visible.map((e) =>
      [e.category, e.term, `"${e.description}"`, e.number_of_genes, e.number_of_genes_in_background,
       e.p_value, e.fdr, `"${e.matching_genes}"`].join(',')
    );
    downloadFile([header, ...rows].join('\n'), 'string_enrichment.csv', 'text/csv');
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Gene list
          </label>
          <textarea
            value={genesInput}
            onChange={(e) => setGenesInput(e.target.value)}
            rows={5}
            placeholder="TP53&#10;BRCA1&#10;MYC"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono resize-y"
          />
          <p className="mt-1 text-xs text-gray-500">{parseGenes().length} gene(s) · max 500</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organism</label>
          <select
            value={species}
            onChange={(e) => setSpecies(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {SPECIES_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <p className="mt-3 text-xs text-gray-500 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100 dark:border-indigo-800">
            <strong>Note:</strong> STRING uses the same biological data as GO/KEGG/Reactome
            but applies its own statistical enrichments. Complementary to local GO analysis.
          </p>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading || !parseGenes().length}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
        {loading ? 'Analyzing…' : 'Run STRING enrichment'}
      </button>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {enrichments.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <Stat label="Enriched terms" value={enrichments.length} color="text-indigo-700 dark:text-indigo-300" />
            <input
              type="text"
              placeholder="Filter by term…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 min-w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">All categories</option>
              {allCats.map((c) => (
                <option key={c} value={c}>{ENRICH_CATEGORIES[c]?.label || c}</option>
              ))}
            </select>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-400"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>

          <div className="overflow-auto max-h-96 border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Genes</th>
                  <th className="px-3 py-2 text-right">P-value</th>
                  <th className="px-3 py-2 text-right">FDR</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 200).map((e, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${ENRICH_CATEGORIES[e.category]?.color || 'bg-gray-100 text-gray-700'}`}>
                        {ENRICH_CATEGORIES[e.category]?.label || e.category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 max-w-xs">
                      <span title={e.description}>{e.description.length > 80 ? e.description.slice(0, 79) + '…' : e.description}</span>
                      <span className="ml-1 text-gray-400">· {e.term}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right">{e.number_of_genes}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtPval(e.p_value)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${e.fdr < 0.05 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                      {fmtPval(e.fdr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 200 && (
            <p className="text-xs text-gray-400">Display limited to 200 results. Use CSV export to retrieve all.</p>
          )}
        </div>
      )}
    </div>
  );
}

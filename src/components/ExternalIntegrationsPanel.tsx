/**
 * ExternalIntegrationsPanel
 *
 * Provides three integration panels accessible via sub-tabs:
 *
 *  1. STRING PPI     – Fetch and visualise the protein-protein interaction
 *                      network for a set of genes directly from STRING DB.
 *                      Includes export to CX2 / GraphML for Cytoscape Desktop.
 *
 *  2. STRING Enrich  – Functional enrichment (GO, KEGG, Reactome, …) of a
 *                      gene list via the STRING annotation API.
 *
 *  3. GEO Datasets   – Search NCBI GEO for public reference datasets to
 *                      compare with the user's own experiment.
 *
 * Accepts an optional `genesToPreload` prop so the parent can pass the current
 * DEG list directly into the STRING inputs.
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Network,
  Search,
  Database,
  Download,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Share2,
  FlaskConical,
} from 'lucide-react';
import api from '@/utils/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkNode {
  id: string;
  name: string;
  annotation?: string;
  string_id?: string;
}

interface NetworkEdge {
  source: string;
  target: string;
  score: number;
  evidence: string;
}

interface PPINetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  species: number;
  count: number;
  error?: string;
}

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

interface GEODataset {
  uid: string;
  accession: string;
  title: string;
  summary: string;
  organism: string;
  samples_n: number;
  platform: string;
  type: string;
  pub_date: string;
  geo_link: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EVIDENCE_COLORS: Record<string, string> = {
  highest: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  high: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const SCORE_PRESETS = [
  { label: 'Low (≥0.15)', value: 150 },
  { label: 'Medium (≥0.4)', value: 400 },
  { label: 'High (≥0.7)', value: 700 },
  { label: 'Highest (≥0.9)', value: 900 },
];

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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: PPI network SVG (force-free circular layout)
// ─────────────────────────────────────────────────────────────────────────────

function NetworkGraph({ network }: { network: PPINetwork }) {
  const W = 600;
  const H = 420;
  const R = 170; // layout radius
  const nodes = network.nodes.slice(0, 40); // cap for legibility
  const nodeSet = new Set(nodes.map((n) => n.id));
  const edges = network.edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));

  // Circular positions
  const coords: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
    coords[n.id] = {
      x: W / 2 + R * Math.cos(angle),
      y: H / 2 + R * Math.sin(angle),
    };
  });

  // Colour nodes by degree
  const degrees: Record<string, number> = {};
  edges.forEach((e) => {
    degrees[e.source] = (degrees[e.source] || 0) + 1;
    degrees[e.target] = (degrees[e.target] || 0) + 1;
  });
  const maxDeg = Math.max(1, ...Object.values(degrees));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
      {/* Edges */}
      {edges.map((e, i) => {
        const s = coords[e.source];
        const t = coords[e.target];
        if (!s || !t) return null;
        const opacity = 0.15 + e.score * 0.7;
        return (
          <line
            key={i}
            x1={s.x} y1={s.y}
            x2={t.x} y2={t.y}
            stroke="#6366f1"
            strokeOpacity={opacity}
            strokeWidth={1 + e.score * 2}
          />
        );
      })}
      {/* Nodes */}
      {nodes.map((n) => {
        const pos = coords[n.id];
        if (!pos) return null;
        const deg = degrees[n.id] || 0;
        const nr = 6 + (deg / maxDeg) * 10;
        const fill = deg > maxDeg * 0.7 ? '#ef4444' : deg > maxDeg * 0.4 ? '#f59e0b' : '#6366f1';
        return (
          <g key={n.id}>
            <circle cx={pos.x} cy={pos.y} r={nr} fill={fill} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
            <text
              x={pos.x}
              y={pos.y - nr - 3}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              className="fill-gray-700 dark:fill-gray-300"
            >
              {n.name.length > 10 ? n.name.slice(0, 9) + '…' : n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 – STRING PPI Network
// ─────────────────────────────────────────────────────────────────────────────

function StringNetworkTab({ initialGenes }: { initialGenes: string }) {
  const [genesInput, setGenesInput] = useState(initialGenes);
  const [species, setSpecies] = useState(9606);
  const [score, setScore] = useState(400);
  const [limit, setLimit] = useState(10);
  const [network, setNetwork] = useState<PPINetwork | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const parseGenes = () =>
    genesInput
      .split(/[\n,;\s]+/)
      .map((g) => g.trim())
      .filter(Boolean);

  const fetchNetwork = useCallback(async () => {
    const genes = parseGenes();
    if (!genes.length) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/integrations/string/network', {
        gene_symbols: genes,
        species,
        required_score: score,
        limit,
      });
      setNetwork(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur lors de la requête STRING DB');
    } finally {
      setLoading(false);
    }
  }, [genesInput, species, score, limit]);

  const exportFormat = useCallback(async (fmt: 'cx2' | 'graphml' | 'cytoscapejs') => {
    if (!network) return;
    setExporting(fmt);
    try {
      const { data, headers } = await api.post(
        `/integrations/cytoscape/${fmt}`,
        { network, network_name: 'GenoLens_PPI_Network' },
        fmt !== 'cytoscapejs' ? { responseType: 'blob' } : {},
      );
      if (fmt === 'cx2') {
        const text = await (data as Blob).text();
        downloadFile(text, 'GenoLens_PPI_Network.cx2', 'application/json');
      } else if (fmt === 'graphml') {
        const text = await (data as Blob).text();
        downloadFile(text, 'GenoLens_PPI_Network.graphml', 'application/xml');
      } else {
        downloadFile(JSON.stringify(data, null, 2), 'GenoLens_cytoscapejs.json', 'application/json');
      }
    } catch {
      // silent
    } finally {
      setExporting(null);
    }
  }, [network]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Liste de gènes <span className="text-gray-400">(un par ligne, virgules, ou espaces)</span>
          </label>
          <textarea
            value={genesInput}
            onChange={(e) => setGenesInput(e.target.value)}
            rows={5}
            placeholder="TP53&#10;BRCA1&#10;MYC&#10;EGFR"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono resize-y"
          />
          <p className="mt-1 text-xs text-gray-500">{parseGenes().length} gène(s) · max 100</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organisme</label>
            <select
              value={species}
              onChange={(e) => setSpecies(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {SPECIES_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Score minimum : <strong>{score}</strong>
            </label>
            <div className="flex gap-2 flex-wrap">
              {SCORE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setScore(p.value)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    score === p.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Partenaires max par gène : <strong>{limit}</strong>
            </label>
            <input
              type="range"
              min={5} max={50} step={5}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={fetchNetwork}
          disabled={loading || !parseGenes().length}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
          {loading ? 'Chargement…' : 'Charger le réseau STRING'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {network && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <Stat label="Nœuds" value={network.nodes.length} color="text-indigo-700 dark:text-indigo-300" />
            <Stat label="Interactions" value={network.count} color="text-indigo-700 dark:text-indigo-300" />
            {network.count === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Info className="w-4 h-4" />
                Aucune interaction trouvée avec ce score minimum. Essayez un score plus bas.
              </p>
            )}
          </div>

          {/* Export buttons */}
          {network.count > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 self-center">Exporter&nbsp;:</span>
              {[
                { fmt: 'cx2' as const, label: 'CX2 (Cytoscape)' },
                { fmt: 'graphml' as const, label: 'GraphML' },
                { fmt: 'cytoscapejs' as const, label: 'cytoscape.js JSON' },
              ].map(({ fmt, label }) => (
                <button
                  key={fmt}
                  onClick={() => exportFormat(fmt)}
                  disabled={exporting === fmt}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-400 transition-colors"
                >
                  {exporting === fmt ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {label}
                </button>
              ))}
              <a
                href={`https://string-db.org/network/${network.nodes.map((n) => n.name).slice(0, 10).join('%0d')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Voir sur STRING
              </a>
            </div>
          )}

          {/* SVG visualisation */}
          {network.count > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Visualisation (layout circulaire · 40 nœuds max)
              </h3>
              <NetworkGraph network={network} />
              <p className="text-xs text-gray-400 mt-1">
                Taille des nœuds = degré · Couleur&nbsp;: <span className="text-red-500">●</span> hub  
                <span className="text-amber-500"> ●</span> semi-hub 
                <span className="text-indigo-500"> ●</span> périphérique 
                · Largeur des arêtes = score
              </p>
            </div>
          )}

          {/* Edge table */}
          {network.count > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600">
                Tableau des interactions ({network.edges.length})
              </summary>
              <div className="mt-2 overflow-auto max-h-64 border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Protéine A</th>
                      <th className="px-3 py-2 text-left">Protéine B</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2 text-left">Confiance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {network.edges.map((e, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-1.5 font-mono font-semibold">{e.source}</td>
                        <td className="px-3 py-1.5 font-mono font-semibold">{e.target}</td>
                        <td className="px-3 py-1.5 text-right">{e.score.toFixed(3)}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs ${EVIDENCE_COLORS[e.evidence] || EVIDENCE_COLORS.low}`}>
                            {e.evidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 – STRING Functional Enrichment
// ─────────────────────────────────────────────────────────────────────────────

function StringEnrichTab({ initialGenes }: { initialGenes: string }) {
  const [genesInput, setGenesInput] = useState(initialGenes);
  const [species, setSpecies] = useState(9606);
  const [enrichments, setEnrichments] = useState<StringEnrichment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const parseGenes = () =>
    genesInput.split(/[\n,;\s]+/).map((g) => g.trim()).filter(Boolean);

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
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur STRING enrichment');
    } finally {
      setLoading(false);
    }
  }, [genesInput, species]);

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
            Liste de gènes
          </label>
          <textarea
            value={genesInput}
            onChange={(e) => setGenesInput(e.target.value)}
            rows={5}
            placeholder="TP53&#10;BRCA1&#10;MYC"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono resize-y"
          />
          <p className="mt-1 text-xs text-gray-500">{parseGenes().length} gène(s) · max 500</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organisme</label>
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
            <strong>Note :</strong> STRING utilise les mêmes données biologiques que les bases GO/KEGG/Reactome
            mais applique ses propres enrichissements statistiques. Complémentaire à l&apos;analyse GO locale.
          </p>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading || !parseGenes().length}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
        {loading ? 'Analyse en cours…' : 'Lancer l\'enrichissement STRING'}
      </button>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {enrichments.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <Stat label="Termes enrichis" value={enrichments.length} color="text-indigo-700 dark:text-indigo-300" />
            <input
              type="text"
              placeholder="Filtrer par terme…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 min-w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Toutes catégories</option>
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
                  <th className="px-3 py-2 text-left">Catégorie</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Gènes</th>
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
            <p className="text-xs text-gray-400">Affichage limité à 200 résultats. Utilisez l&apos;export CSV pour tout récupérer.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3 – GEO Datasets search
// ─────────────────────────────────────────────────────────────────────────────

function GEOSearchTab() {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ total: number; datasets: GEODataset[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/integrations/geo/search', {
        params: { q: query, max_results: maxResults, db: 'gds' },
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur lors de la recherche NCBI GEO');
    } finally {
      setLoading(false);
    }
  }, [query, maxResults]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="ex: breast cancer RNA-seq Homo sapiens, Alzheimer hippocampus, GSE223547…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <select
          value={maxResults}
          onChange={(e) => setMaxResults(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          title="Nombre maximum de résultats"
        >
          {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} résultats</option>)}
        </select>
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>

      {/* Tips */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <p><strong>Conseils de recherche :</strong></p>
        <ul className="list-disc ml-4 space-y-0.5">
          <li>Incluez le type de données : <em>RNA-seq</em>, <em>microarray</em>, <em>scRNA-seq</em></li>
          <li>Précisez l&apos;organisme : <em>Homo sapiens</em>, <em>Mus musculus</em></li>
          <li>Cherchez par accession directe : <em>GSE223547</em></li>
        </ul>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>{result.total.toLocaleString()}</strong> résultats trouvés · affichage des {result.datasets.length} premiers
          </p>
          {result.datasets.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Aucun dataset correspondant. Essayez des termes plus généraux.
            </p>
          )}
          <div className="space-y-3">
            {result.datasets.map((ds) => (
              <GEOCard key={ds.uid} ds={ds} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GEOCard({ ds }: { ds: GEODataset }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/50 hover:border-indigo-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
              {ds.accession}
            </span>
            {ds.organism && (
              <span className="text-xs text-gray-500 dark:text-gray-400">· {ds.organism}</span>
            )}
            {ds.samples_n > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">· {ds.samples_n} échantillons</span>
            )}
            {ds.pub_date && (
              <span className="text-xs text-gray-400">· {ds.pub_date}</span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
            {ds.title || '—'}
          </h4>
        </div>
        <a
          href={ds.geo_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          GEO <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {ds.summary && (
        <>
          <p className={`mt-2 text-xs text-gray-600 dark:text-gray-400 ${expanded ? '' : 'line-clamp-2'}`}>
            {ds.summary}
          </p>
          {ds.summary.length > 200 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
            >
              {expanded ? <><ChevronUp className="w-3 h-3" /> Réduire</> : <><ChevronDown className="w-3 h-3" /> Lire la suite</>}
            </button>
          )}
        </>
      )}

      {ds.platform && (
        <p className="mt-2 text-xs text-gray-400">Plateforme : {ds.platform}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable Stat box
// ─────────────────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type SubTab = 'ppi' | 'enrich' | 'geo';

interface ExternalIntegrationsPanelProps {
  /** Optional genes to pre-populate STRING inputs (e.g. top DEGs from the comparison) */
  genesToPreload?: string[];
}

export default function ExternalIntegrationsPanel({
  genesToPreload = [],
}: ExternalIntegrationsPanelProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('ppi');
  const initialGenes = genesToPreload.slice(0, 50).join('\n');

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ppi', label: 'Réseau PPI (STRING)', icon: <Share2 className="w-4 h-4" /> },
    { id: 'enrich', label: 'Enrichissement STRING', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'geo', label: 'Datasets GEO publics', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Network className="w-5 h-5 text-indigo-500" />
          Intégrations externes
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Interrogez des bases de données publiques (STRING&nbsp;DB, NCBI&nbsp;GEO) et exportez vos réseaux vers Cytoscape.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'ppi' && <StringNetworkTab initialGenes={initialGenes} />}
        {activeTab === 'enrich' && <StringEnrichTab initialGenes={initialGenes} />}
        {activeTab === 'geo' && <GEOSearchTab />}
      </div>
    </div>
  );
}

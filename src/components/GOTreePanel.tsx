'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ChevronRight, ChevronDown, ExternalLink, Network, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GOTreeNode, GOHierarchyResponse } from '@/types';
import api from '@/utils/api';

const GOForceGraph = dynamic(() => import('./GOForceGraph'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface GOTreePanelProps {
  datasetId: string;
  comparisonName: string;
  regulation?: string;
  projectId?: string;
}

type NamespaceKey = 'biological_process' | 'molecular_function' | 'cellular_component';

const NS_LABELS: Record<NamespaceKey, string> = {
  biological_process: 'BP',
  molecular_function: 'MF',
  cellular_component: 'CC',
};

const NS_FULL: Record<NamespaceKey, string> = {
  biological_process: 'Biological Process',
  molecular_function: 'Molecular Function',
  cellular_component: 'Cellular Component',
};

const NS_BADGE_CLASS: Record<NamespaceKey, string> = {
  biological_process: 'bg-blue-100 text-blue-700',
  molecular_function: 'bg-amber-100 text-amber-700',
  cellular_component: 'bg-emerald-100 text-emerald-700',
};

// ─── FDR colour helper ────────────────────────────────────────────────────────

function fdrDotColor(fdr: number | null | undefined): string {
  if (!fdr) return '#e5e7eb';
  if (fdr <= 1e-6) return '#4338ca';
  if (fdr <= 1e-4) return '#6366f1';
  if (fdr <= 0.01) return '#818cf8';
  if (fdr <= 0.05) return '#a5b4fc';
  return '#e5e7eb';
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: GOTreeNode;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  selectedId: string | null;
  onSelect: (node: GOTreeNode) => void;
  depth: number;
}

function TreeNode({ node, expandedIds, toggleExpand, selectedId, onSelect, depth }: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.go_id);
  const isSelected = selectedId === node.go_id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors
          ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'hover:bg-gray-50'}
          ${!node.is_enriched ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node)}
      >
        <button
          className="w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(node.go_id); }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : null}
        </button>

        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: fdrDotColor(node.fdr) }}
        />

        <span className={`flex-1 truncate ${node.is_enriched ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
          {node.go_name}
        </span>

        {node.is_enriched && node.fdr != null && (
          <span className="text-xs font-semibold text-indigo-600 ml-1 flex-shrink-0">
            {node.fdr < 0.001 ? node.fdr.toExponential(1) : node.fdr.toFixed(3)}
          </span>
        )}
        {!node.is_enriched && (
          <span className="text-xs text-gray-300 ml-1 flex-shrink-0">not sig.</span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="border-l border-indigo-100 ml-5">
          {node.children.map(child => (
            <TreeNode
              key={child.go_id}
              node={child}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ node }: { node: GOTreeNode | null }) {
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6 text-center">
        Click a node in the tree to see details.
      </div>
    );
  }

  const ns = node.namespace as NamespaceKey;
  const genes = node.genes ?? [];
  const visibleGenes = genes.slice(0, 10);
  const extraCount = genes.length - visibleGenes.length;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div>
        <div className="text-xs font-semibold text-indigo-500 mb-0.5">{node.go_id}</div>
        <div className="text-base font-bold text-gray-900 leading-snug mb-2">{node.go_name}</div>
        <Badge className={`text-xs ${NS_BADGE_CLASS[ns] ?? 'bg-gray-100 text-gray-600'}`}>
          {NS_FULL[ns] ?? node.namespace}
        </Badge>
      </div>

      {node.is_enriched && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'FDR', value: node.fdr != null ? node.fdr.toExponential(2) : '—' },
            { label: 'Enrichment', value: node.enrichment_ratio != null ? `${node.enrichment_ratio.toFixed(2)}×` : '—' },
            { label: 'Genes', value: node.gene_count ?? '—' },
            { label: 'GO level', value: node.level ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-lg font-bold text-indigo-600">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {node.is_enriched && genes.length > 0 && (
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Enriched genes</div>
          <div className="flex flex-wrap gap-1">
            {visibleGenes.map(g => (
              <span key={g} className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-1.5 py-0.5 rounded">
                {g}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="text-xs text-gray-400 self-center">+{extraCount} more</span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => window.open(`https://amigo.geneontology.org/amigo/term/${node.go_id}`, '_blank')}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          View in AmiGO
        </Button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TreeSkeleton() {
  return (
    <div className="p-4 space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-200" style={{ marginLeft: `${(i % 3) * 16}px` }} />
          <div className="h-3 bg-gray-200 rounded flex-1" style={{ width: `${60 + (i * 13) % 30}%` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GOTreePanel({ datasetId, comparisonName, regulation }: GOTreePanelProps) {
  /** Observed so the ancestor traversal is only asked for once the panel is scrolled near. */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeNs, setActiveNs] = useState<NamespaceKey>('biological_process');
  const [hierarchy, setHierarchy] = useState<GOHierarchyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<GOTreeNode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');

  const loadHierarchy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (regulation) params.regulation = regulation;
      const qs = new URLSearchParams(params).toString();
      const url = `/datasets/${datasetId}/comparisons/${encodeURIComponent(comparisonName)}/go-hierarchy${qs ? `?${qs}` : ''}`;
      const res = await api.get(url);
      setHierarchy(res.data);
      setLoaded(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load GO hierarchy';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [datasetId, comparisonName, regulation]);

  /**
   * Fetched when scrolled near, not on mount.
   *
   * The layout promise of the approved enrichment spec is untouched: the tree stays pinned
   * below the sub-tabs, always visible, no click to reveal. What changes is *when* it is
   * fetched. `go-hierarchy` is an ancestor traversal over the enriched terms, and this panel
   * now sits roughly two thousand pixels down a merged screen — a cost the spec never had to
   * price, because it assumed a tab of its own that only opened on demand.
   *
   * Reverting is one line: call `loadHierarchy()` unconditionally again.
   */
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      // No observer to lean on — fetch as before rather than never showing the tree.
      loadHierarchy();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          loadHierarchy();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadHierarchy]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!hierarchy) return;
    const collectIds = (nodes: GOTreeNode[]): string[] =>
      nodes.flatMap(n => [n.go_id, ...collectIds(n.children)]);
    setExpandedIds(new Set(collectIds(hierarchy[activeNs])));
  }, [hierarchy, activeNs]);

  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  const currentNodes = hierarchy?.[activeNs] ?? [];
  const enrichedCount = hierarchy
    ? hierarchy[activeNs].reduce((acc, n) => acc + (n.is_enriched ? 1 : 0), 0)
    : 0;

  return (
    <div
      ref={containerRef}
      className="overflow-hidden"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-panel)',
        background: 'var(--surface)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-indigo-50/50">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide">GO Hierarchy</div>
            {hierarchy && (
              <div className="text-xs text-gray-400 mt-0.5">
                {enrichedCount} enriched terms · grey = parent context
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'tree' && (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />significant
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />context only
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={expandAll} disabled={!hierarchy}>
                Expand all
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={collapseAll} disabled={!hierarchy}>
                Collapse all
              </Button>
            </>
          )}
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors
                ${viewMode === 'tree' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="Tree view"
            >
              <List className="h-3.5 w-3.5" />
              Tree
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors
                ${viewMode === 'graph' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="Force-directed graph"
            >
              <Network className="h-3.5 w-3.5" />
              Graph
            </button>
          </div>
        </div>
      </div>

      {/* Namespace tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {(Object.keys(NS_LABELS) as NamespaceKey[]).map(ns => (
          <button
            key={ns}
            onClick={() => { setActiveNs(ns); setSelectedNode(null); }}
            className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2
              ${activeNs === ns
                ? 'text-indigo-600 border-indigo-500 bg-white'
                : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
          >
            {NS_FULL[ns]}
            {hierarchy && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]
                ${activeNs === ns ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                {hierarchy[ns].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body: tree + detail OR force graph */}
      {viewMode === 'graph' ? (
        <div style={{ height: 480 }}>
          {loading && <TreeSkeleton />}
          {error && <div className="p-4 text-sm text-red-500 text-center">{error}</div>}
          {!loading && !error && hierarchy && (
            <GOForceGraph
              data={hierarchy}
              onNodeClick={(node) => { setSelectedNode(node); setViewMode('tree'); }}
            />
          )}
          {!loading && !error && !hierarchy && loaded && (
            <div className="p-6 text-sm text-center text-muted-foreground">No hierarchy data available.</div>
          )}
        </div>
      ) : (
        <div className="flex" style={{ minHeight: 300, maxHeight: 420 }}>
          {/* Tree pane */}
          <div className="flex-1 overflow-y-auto border-r border-gray-100 py-2">
            {loading && <TreeSkeleton />}
            {error && (
              <div className="p-4 text-sm text-red-500 text-center">{error}</div>
            )}
            {!loading && !error && currentNodes.length === 0 && loaded && (
              <div className="p-6 text-sm text-center text-muted-foreground">
                No enriched terms for {NS_FULL[activeNs]}.
              </div>
            )}
            {!loading && !error && currentNodes.map(node => (
              <TreeNode
                key={node.go_id}
                node={node}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                selectedId={selectedNode?.go_id ?? null}
                onSelect={setSelectedNode}
                depth={0}
              />
            ))}
          </div>

          {/* Detail pane */}
          <div className="w-72 shrink-0 bg-gray-50/50 overflow-y-auto">
            <DetailPanel node={selectedNode} />
          </div>
        </div>
      )}
    </div>
  );
}

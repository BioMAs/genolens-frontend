'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { GOTreeNode, GOHierarchyResponse } from '@/types';

interface Props {
  data: GOHierarchyResponse;
  onNodeClick?: (node: GOTreeNode) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  go_id: string;
  go_name: string;
  namespace: string;
  is_enriched: boolean;
  fdr?: number | null;
  gene_count?: number | null;
  r: number;
  color: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

type NamespaceKey = 'biological_process' | 'molecular_function' | 'cellular_component';

const NS_COLORS: Record<NamespaceKey, string> = {
  biological_process: '#4f46e5',
  molecular_function: '#d97706',
  cellular_component: '#059669',
};

function fdrToColor(fdr: number | null | undefined, ns: string): string {
  const base = NS_COLORS[(ns as NamespaceKey)] ?? '#64748b';
  if (!fdr) return '#cbd5e1';
  if (fdr <= 1e-6) return base;
  if (fdr <= 1e-4) return d3.interpolateRgb(base, '#94a3b8')(0.2);
  if (fdr <= 0.01) return d3.interpolateRgb(base, '#94a3b8')(0.45);
  if (fdr <= 0.05) return d3.interpolateRgb(base, '#94a3b8')(0.65);
  return '#cbd5e1';
}

function nodeRadius(gene_count: number | null | undefined): number {
  if (!gene_count) return 5;
  return Math.min(25, Math.max(5, Math.sqrt(gene_count) * 3));
}

function flattenToGraph(
  trees: GOTreeNode[],
  visited: Set<string>,
  nodes: GraphNode[],
  links: GraphLink[],
  parentId?: string
) {
  for (const node of trees) {
    if (!visited.has(node.go_id)) {
      visited.add(node.go_id);
      nodes.push({
        go_id: node.go_id,
        go_name: node.go_name,
        namespace: node.namespace,
        is_enriched: node.is_enriched,
        fdr: node.fdr,
        gene_count: node.gene_count,
        r: nodeRadius(node.gene_count),
        color: fdrToColor(node.fdr, node.namespace),
      });
    }
    if (parentId) {
      links.push({ source: parentId, target: node.go_id });
    }
    if (node.children.length > 0) {
      flattenToGraph(node.children, visited, nodes, links, node.go_id);
    }
  }
}

const ALL_NS: NamespaceKey[] = ['biological_process', 'molecular_function', 'cellular_component'];
const NS_LABELS: Record<NamespaceKey, string> = { biological_process: 'BP', molecular_function: 'MF', cellular_component: 'CC' };

export default function GOForceGraph({ data, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabledNs, setEnabledNs] = useState<Set<NamespaceKey>>(new Set(ALL_NS));
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [truncatedBanner, setTruncatedBanner] = useState(false);

  const toggleNs = (ns: NamespaceKey) => {
    setEnabledNs(prev => {
      const next = new Set(prev);
      next.has(ns) ? next.delete(ns) : next.add(ns);
      return next;
    });
  };

  const buildGraph = useCallback(() => {
    const allNodes: GraphNode[] = [];
    const allLinks: GraphLink[] = [];
    const visited = new Set<string>();

    for (const ns of ALL_NS) {
      if (enabledNs.has(ns)) {
        flattenToGraph(data[ns], visited, allNodes, allLinks);
      }
    }

    let nodes = allNodes;
    let banner = false;
    if (nodes.length > 150) {
      nodes = nodes.filter(n => n.is_enriched);
      banner = true;
    }
    setTruncatedBanner(banner);

    const nodeIds = new Set(nodes.map(n => n.go_id));
    const links = allLinks.filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));

    return { nodes, links };
  }, [data, enabledNs]);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    d3.select(svg).selectAll('*').remove();

    const { nodes, links } = buildGraph();
    if (nodes.length === 0) return;

    const svgEl = d3.select(svg)
      .attr('width', width)
      .attr('height', height);

    const g = svgEl.append('g');

    // Zoom / pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svgEl.call(zoom);

    // Links
    const linkEl = g.append('g').selectAll<SVGLineElement, GraphLink>('line')
      .data(links).enter().append('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    // Node groups
    const nodeEl = g.append('g').selectAll<SVGGElement, GraphNode>('g')
      .data(nodes, (d) => d.go_id).enter().append('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeEl.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => d.color)
      .attr('stroke', d => d.is_enriched ? '#fff' : 'none')
      .attr('stroke-width', 1.5);

    nodeEl.append('text')
      .text(d => d.go_name.length > 20 ? d.go_name.slice(0, 20) + '…' : d.go_name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 11)
      .attr('font-size', 9)
      .attr('fill', '#374151')
      .attr('pointer-events', 'none');

    // Events
    nodeEl
      .on('mouseover', (event: MouseEvent, d) => {
        const rect = svg.getBoundingClientRect();
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d });
      })
      .on('mousemove', (event: MouseEvent, d) => {
        const rect = svg.getBoundingClientRect();
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d });
      })
      .on('mouseout', () => setTooltip(null))
      .on('click', (_event, d) => {
        const fullNode: GOTreeNode = {
          go_id: d.go_id, go_name: d.go_name, namespace: d.namespace,
          level: null, is_enriched: d.is_enriched, fdr: d.fdr,
          gene_count: d.gene_count, children: [],
        };
        onNodeClick?.(fullNode);
      });

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.go_id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => d.r + 5))
      .on('tick', () => {
        linkEl
          .attr('x1', d => (d.source as GraphNode).x ?? 0)
          .attr('y1', d => (d.source as GraphNode).y ?? 0)
          .attr('x2', d => (d.target as GraphNode).x ?? 0)
          .attr('y2', d => (d.target as GraphNode).y ?? 0);
        nodeEl.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    return () => { sim.stop(); };
  }, [buildGraph]);

  return (
    <div className="flex flex-col h-full">
      {/* Namespace filters */}
      <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs">
        {ALL_NS.map(ns => (
          <label key={ns} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabledNs.has(ns)}
              onChange={() => toggleNs(ns)}
              className="rounded"
              style={{ accentColor: NS_COLORS[ns] }}
            />
            <span style={{ color: NS_COLORS[ns] }} className="font-medium">{NS_LABELS[ns]}</span>
          </label>
        ))}
        <span className="ml-auto text-gray-400">Scroll to zoom · Drag nodes to reposition</span>
      </div>

      {truncatedBanner && (
        <div className="px-3 py-1 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
          More than 150 terms — showing enriched terms only
        </div>
      )}

      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-white">
        <svg ref={svgRef} className="w-full h-full" />

        {tooltip && (
          <div
            className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs pointer-events-none max-w-48"
            style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          >
            <div className="font-semibold text-gray-900 mb-1 leading-snug">{tooltip.node.go_name}</div>
            <div className="text-indigo-500 mb-1">{tooltip.node.go_id}</div>
            {tooltip.node.fdr != null && (
              <div className="text-gray-600">FDR: <span className="font-medium">{tooltip.node.fdr.toExponential(2)}</span></div>
            )}
            {tooltip.node.gene_count != null && (
              <div className="text-gray-600">Genes: <span className="font-medium">{tooltip.node.gene_count}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

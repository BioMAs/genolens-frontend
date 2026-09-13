'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GOTreeNode, GOHierarchyResponse } from '@/types';
import { useChartPalette, CHART_VARS } from '@/utils/chartTheme';
import type { Palette } from '@/utils/chartPalettes';
import { fdrToColor, namespaceColor, type NamespaceKey } from '@/utils/goGraphColors';

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



function nodeRadius(gene_count: number | null | undefined): number {
  if (!gene_count) return 5;
  return Math.min(25, Math.max(5, Math.sqrt(gene_count) * 3));
}

function flattenToGraph(
  trees: GOTreeNode[],
  visited: Set<string>,
  nodes: GraphNode[],
  links: GraphLink[],
  palette: Palette,
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
        color: fdrToColor(node.fdr, node.namespace, palette),
      });
    }
    if (parentId) {
      links.push({ source: parentId, target: node.go_id });
    }
    if (node.children.length > 0) {
      flattenToGraph(node.children, visited, nodes, links, palette, node.go_id);
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
  const palette = useChartPalette();

  const toggleNs = (ns: NamespaceKey) => {
    setEnabledNs(prev => {
      const next = new Set(prev);
      if (next.has(ns)) {
        next.delete(ns);
      } else {
        next.add(ns);
      }
      return next;
    });
  };

  const graphData = useMemo(() => {
    const allNodes: GraphNode[] = [];
    const allLinks: GraphLink[] = [];
    const visited = new Set<string>();

    for (const ns of ALL_NS) {
      if (enabledNs.has(ns)) {
        flattenToGraph(data[ns], visited, allNodes, allLinks, palette);
      }
    }

    let nodes = allNodes;
    let truncatedBanner = false;
    if (nodes.length > 150) {
      nodes = nodes.filter(n => n.is_enriched);
      truncatedBanner = true;
    }

    const nodeIds = new Set(nodes.map(n => n.go_id));
    const links = allLinks.filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));

    return { nodes, links, truncatedBanner };
  }, [data, enabledNs, palette]);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    d3.select(svg).selectAll('*').remove();

    const { nodes, links } = graphData;
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
      .style('stroke', CHART_VARS.grid)
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
      // L'anneau detache le noeud de ses voisins ; en blanc fixe, il le
      // faisait briller au milieu d'un panneau sombre. Il vaut la surface.
      .style('stroke', d => (d.is_enriched ? CHART_VARS.surface : 'none'))
      .attr('stroke-width', 1.5);

    nodeEl.append('text')
      .text(d => d.go_name.length > 20 ? d.go_name.slice(0, 20) + '…' : d.go_name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 11)
      .attr('font-size', 9)
      .style('fill', CHART_VARS.inkSubtle)
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
  }, [graphData, onNodeClick]);

  return (
    <div className="flex flex-col h-full">
      {/* Namespace filters */}
      <div className="flex items-center gap-4 px-3 py-2 bg-surface-2 border-b border-subtle text-caption">
        {ALL_NS.map(ns => (
          <label key={ns} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabledNs.has(ns)}
              onChange={() => toggleNs(ns)}
              className="rounded-sm"
              style={{ accentColor: namespaceColor(ns, palette) }}
            />
            <span style={{ color: namespaceColor(ns, palette) }} className="font-medium">{NS_LABELS[ns]}</span>
          </label>
        ))}
        <span className="ml-auto text-muted">Scroll to zoom · Drag nodes to reposition</span>
      </div>

      {graphData.truncatedBanner && (
        <div className="px-3 py-1 bg-amber-50 border-b border-amber-100 text-caption text-amber-700">
          More than 150 terms — showing enriched terms only
        </div>
      )}

      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-surface">
        <svg ref={svgRef} className="w-full h-full" />

        {tooltip && (
          <div
            className="absolute z-10 bg-surface border border-line rounded-control shadow-lg p-2 text-caption pointer-events-none max-w-48"
            style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          >
            <div className="font-semibold text-primary mb-1 leading-snug">{tooltip.node.go_name}</div>
            <div className="text-accent-ink mb-1">{tooltip.node.go_id}</div>
            {tooltip.node.fdr != null && (
              <div className="text-secondary">FDR: <span className="font-medium">{tooltip.node.fdr.toExponential(2)}</span></div>
            )}
            {tooltip.node.gene_count != null && (
              <div className="text-secondary">Genes: <span className="font-medium">{tooltip.node.gene_count}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

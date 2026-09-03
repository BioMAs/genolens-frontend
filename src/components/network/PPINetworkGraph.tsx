'use client';

/**
 * The cytoscape canvas. No fetching, no controls — hand it elements, it draws them.
 *
 * Loaded through `dynamic(..., { ssr: false })` by its section, because cytoscape touches
 * `window` at construction.
 *
 * Three hazards, each handled explicitly below: the theme has to be read *after* paint, the
 * instance has to be destroyed or every mount leaks a canvas context, and the layout must never
 * re-run on resize or the nodes jump under the reader.
 */

import { useEffect, useRef } from 'react';
import cytoscape, { type Core } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { useTheme } from '@/contexts/ThemeContext';
import { buildStylesheet, readGraphTheme, type CytoscapeElements } from './cytoscapeAdapters';

// Registered once, inside the dynamically imported module: a second `use()` of the same
// extension throws.
let registered = false;
if (!registered) {
  cytoscape.use(fcose);
  registered = true;
}

interface Props {
  elements: CytoscapeElements;
  /** Owned by the section, so the graph never hard-codes a size again. */
  height: number | string;
  /**
   * Must be referentially stable — wrap it in `useCallback`.
   *
   * It is a dependency of the effect that builds the graph, so a new identity each render would
   * rebuild and re-lay-out the whole thing. Keeping it in a ref refreshed during render is the
   * usual dodge, and the React compiler rule refuses it, correctly: writing a ref while
   * rendering is exactly what it is there to stop.
   */
  onNodeClick?: (gene: string) => void;
  /** Summarises the graph for assistive technology, which cannot see a canvas. */
  ariaLabel: string;
}

/** fcose settings: a spectral start then force refinement, which is what makes PPI readable. */
const LAYOUT = {
  name: 'fcose',
  quality: 'default',
  randomize: true,
  animate: false,
  nodeSeparation: 90,
  idealEdgeLength: 90,
  nodeRepulsion: 6000,
  padding: 24,
} as const;

export default function PPINetworkGraph({ elements, height, onNodeClick, ariaLabel }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const cy = useRef<Core | null>(null);
  const { theme } = useTheme();

  // Build and rebuild on new elements. The container already has its height by the time this
  // runs — the section only mounts this component once it is on screen.
  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const instance = cytoscape({
      container: element,
      elements: [...elements.nodes, ...elements.edges],
      style: buildStylesheet(readGraphTheme(element)),
      minZoom: 0.15,
      maxZoom: 4,
      wheelSensitivity: 0.2,
    });

    instance.on('tap', 'node', (event) => {
      const label = event.target.data('label');
      if (label) onNodeClick?.(label);
    });

    instance.layout(LAYOUT).run();
    instance.fit(undefined, 24);
    cy.current = instance;

    return () => {
      // Without this every remount leaks a canvas context, and browsers cap how many exist.
      instance.destroy();
      cy.current = null;
    };
  }, [elements, onNodeClick]);

  // Restyle on a theme change, and only restyle: destroying and re-laying out would make the
  // nodes jump. Read in an effect keyed on `theme` because ThemeContext toggles the `.dark`
  // class inside an effect of its own — a read during render returns the old colours.
  useEffect(() => {
    const instance = cy.current;
    const element = container.current;
    if (!instance || instance.destroyed() || !element) return;
    instance.style().fromJson(buildStylesheet(readGraphTheme(element))).update();
  }, [theme]);

  // Refit on resize, never relayout: positions must be stable.
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const instance = cy.current;
        if (!instance || instance.destroyed()) return;
        instance.resize();
        instance.fit(undefined, 24);
      }, 100);
    });
    observer.observe(element);

    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  /** Keyboard panning and zooming, since the canvas itself takes no focus. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const instance = cy.current;
    if (!instance || instance.destroyed()) return;
    const step = 60;
    switch (event.key) {
      case 'ArrowLeft':
        instance.panBy({ x: step, y: 0 });
        break;
      case 'ArrowRight':
        instance.panBy({ x: -step, y: 0 });
        break;
      case 'ArrowUp':
        instance.panBy({ x: 0, y: step });
        break;
      case 'ArrowDown':
        instance.panBy({ x: 0, y: -step });
        break;
      case '+':
      case '=':
        instance.zoom(instance.zoom() * 1.2);
        break;
      case '-':
        instance.zoom(instance.zoom() / 1.2);
        break;
      case '0':
        instance.fit(undefined, 24);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={container}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="ppi-network-graph"
      style={{
        height,
        width: '100%',
        borderRadius: 'var(--radius-panel)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    />
  );
}

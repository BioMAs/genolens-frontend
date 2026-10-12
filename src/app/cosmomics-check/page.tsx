'use client';

/**
 * CosmOmics nova bench — DEVELOPMENT ONLY, the page answers 404 in production.
 *
 * Renders the module body without a backend, so the nova can be checked on its
 * reference fixture (docs/reference/cosmomics/cosmomics_nova_mock.json):
 *   /cosmomics-check            reference fixture (compare with CosmOmics_pathway_nova_flyer.png)
 *   /cosmomics-check?perf=1     15 claims · 300 sub-groups · 2 000 terms, render time shown
 * A real payload can be injected before load (Playwright `addInitScript`) as
 * `window.__COSMOMICS_DATA__`; it is never fetched nor stored by the page.
 */

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import CosmOmicsNovaView from '@/components/cosmomics/CosmOmicsNovaView';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import { syntheticNova } from '@/components/cosmomics/novaSynthetic';

declare global {
  interface Window {
    __COSMOMICS_DATA__?: CosmOmicsNovaData;
    __NOVA_RENDER_MS__?: number;
  }
}

function Bench() {
  const params = useSearchParams();
  const perf = params.get('perf') === '1';
  const [bench, setBench] = useState<{ data: CosmOmicsNovaData; source: string } | null>(null);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const started = useRef(0);

  // The payload is built first, then the clock starts: the measure covers layout,
  // React render and DOM commit of the nova, not the synthetic generator.
  useEffect(() => {
    const next = perf
      ? { data: syntheticNova(15, 300, 2000), source: 'synthetic' }
      : window.__COSMOMICS_DATA__
        ? { data: window.__COSMOMICS_DATA__, source: 'injected' }
        : { data: mock as unknown as CosmOmicsNovaData, source: 'reference fixture' };
    started.current = performance.now();
    // Deliberate: the injected payload only exists in the browser, and the clock
    // must start right before the commit it measures.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBench(next);
  }, [perf]);

  useLayoutEffect(() => {
    if (!bench) return;
    const ms = performance.now() - started.current;
    window.__NOVA_RENDER_MS__ = ms;
    setRenderMs(ms);
  }, [bench]);

  if (!bench) return null;
  const { data, source } = bench;

  return (
    <div className="page-container space-y-4" data-measure="wide">
      <header>
        <h1 className="text-display text-primary">CosmOmics nova — bench</h1>
        <p className="mt-1 text-body-sm text-secondary" data-bench-status>
          Source: {source}
          {renderMs !== null && <> · render {renderMs.toFixed(0)} ms</>}
        </p>
      </header>
      <CosmOmicsNovaView
        data={data}
        seed={`bench|${source}`}
        filename={`CosmOmics_nova_${source.replace(/\s+/g, '_')}`}
        footer={source === 'reference fixture' ? 'Illustrative data · not study results' : undefined}
      />
    </div>
  );
}

export default function CosmOmicsCheckPage() {
  // A verification tool, not a product page.
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense fallback={null}>
      <Bench />
    </Suspense>
  );
}

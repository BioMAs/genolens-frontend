'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import { exportChartPng, exportChartSvg } from '@/utils/chartExport';
import { useIsDemoAccount } from '@/hooks/useIsDemoAccount';
import { HatchPattern, NOVA_FONT, NovaGraphic } from './CosmOmicsNova';
import { NovaLegendSvg } from './NovaLegend';
import { layoutNova } from './novaLayout';
import { NOVA_INK } from './novaPalette';

/** Width of the exported figure, as the reference flyer (1000 × 1030). */
export const EXPORT_WIDTH = 1000;
const HEADER_BOTTOM = 120;
const LOGO_URL = '/cosmomics/logo_scilicium.png';

let logoRequest: Promise<string> | null = null;

/** The SciLicium logo as a data URI: an SVG rasterised to PNG cannot fetch an external image. */
export function loadLogoDataUrl(): Promise<string> {
  logoRequest ??= fetch(LOGO_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`logo ${res.status}`);
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch((err) => {
      logoRequest = null;
      throw err;
    });
  return logoRequest;
}

export interface NovaExportFigureProps {
  data: CosmOmicsNovaData;
  seed: string;
  showDust: boolean;
  /** Logo as a data URI; the "SciLicium" wordmark is written instead when absent. */
  logoHref?: string;
  footer: string;
}

/**
 * The exported figure: "CosmOmics by SciLicium" header with the contrast, the
 * nova in the reference frame, the reference legend at the bottom.
 */
export const NovaExportFigure = forwardRef<SVGSVGElement, NovaExportFigureProps>(function NovaExportFigure(
  { data, seed, showDust, logoHref, footer },
  ref,
) {
  const layout = useMemo(() => layoutNova(data, { seed, showDust }), [data, seed, showDust]);
  // Labels pushed upwards by many narrow sectors must not run into the header.
  const shift = Math.max(0, HEADER_BOTTOM - layout.bounds.y);
  const height = Math.max(1030, Math.ceil(layout.bounds.y + layout.bounds.height + shift) + 90);
  const hatchId = 'cosmomics-export-hatch';
  const logoW = 170;
  const logoH = (logoW * 190) / 1024;
  const contrast = data.contrast.length > 70 ? `${data.contrast.slice(0, 69)}…` : data.contrast;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={EXPORT_WIDTH}
      height={height}
      viewBox={`0 0 ${EXPORT_WIDTH} ${height}`}
    >
      <defs>
        <HatchPattern id={hatchId} />
      </defs>
      {/* The font sits on a group, not on <svg>: the shared exporter keeps only the
          children of the root element, so a root font-family would be dropped. */}
      <g fontFamily={NOVA_FONT}>
        <rect width={EXPORT_WIDTH} height={height} fill={NOVA_INK.background} />
        <text x={50} y={72} fontSize={46} fontWeight={700} letterSpacing={-0.5}>
          <tspan fill={NOVA_INK.core}>Cosm</tspan>
          <tspan fill={NOVA_INK.green}>Omics</tspan>
        </text>
        <text x={950 - logoW - 8} y={72} fontSize={15} fill={NOVA_INK.muted} textAnchor="end">
          by
        </text>
        {logoHref ? (
          <image x={950 - logoW} y={72 - logoH + 4} width={logoW} height={logoH} href={logoHref} />
        ) : (
          <text x={950} y={72} fontSize={30} fontWeight={600} fill={NOVA_INK.core} textAnchor="end">
            SciLicium
          </text>
        )}
        <text x={50} y={104} fontSize={16} fill={NOVA_INK.muted}>
          {`Pathway nova · ${contrast} · further out = more significant`}
        </text>
        <g transform={shift ? `translate(0, ${shift})` : undefined}>
          <NovaGraphic layout={layout} hatchId={hatchId} />
        </g>
        <NovaLegendSvg y={height - 46} footer={footer} hatchId={hatchId} />
      </g>
    </svg>
  );
});

interface UseNovaExport {
  data: CosmOmicsNovaData;
  seed: string;
  showDust: boolean;
  filename: string;
  footer: string;
}

/**
 * Export in two steps: mount the figure off-screen, then hand its `<svg>` to the
 * shared chart exporter (fonts embedded, demo watermark, PNG at ×3).
 */
export function useNovaExport({ data, seed, showDust, filename, footer }: UseNovaExport): {
  run: (kind: 'svg' | 'png') => Promise<void>;
  busy: boolean;
  figure: ReactNode;
} {
  const demo = useIsDemoAccount();
  const ref = useRef<SVGSVGElement>(null);
  const [job, setJob] = useState<{ kind: 'svg' | 'png'; logo?: string } | null>(null);

  useEffect(() => {
    if (!job || !ref.current) return;
    const svg = ref.current;
    const opts = { filename, background: NOVA_INK.background, demo };
    (job.kind === 'png' ? exportChartPng(svg, { ...opts, scale: 3 }) : exportChartSvg(svg, opts))
      .catch((err) => console.error('CosmOmics export failed', err))
      .finally(() => setJob(null));
  }, [job, filename, demo]);

  const run = useCallback(
    async (kind: 'svg' | 'png') => {
      if (job) return;
      const logo = await loadLogoDataUrl().catch(() => undefined);
      setJob({ kind, logo });
    },
    [job],
  );

  const figure = job ? (
    <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: EXPORT_WIDTH, pointerEvents: 'none' }}>
      <NovaExportFigure ref={ref} data={data} seed={seed} showDust={showDust} logoHref={job.logo} footer={footer} />
    </div>
  ) : null;

  return { run, busy: !!job, figure };
}

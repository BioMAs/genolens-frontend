'use client';

import { useRef, useState } from 'react';
import { Download, FileImage, FileCode2 } from 'lucide-react';
import { OverflowMenu } from '@/components/ui/menu';
import { exportChartPng, exportChartSvg } from '@/utils/chartExport';
import { useChartTheme } from '@/utils/chartTheme';

/**
 * Export d'un graphique en PNG ou en SVG.
 *
 * Le bouton cherche le `<svg>` dans la figure qui le contient, plutot que de se
 * faire passer une reference : il vit dans la legende, le trace vit dans le
 * corps, et un `ref` traverserait `ChartCard` pour rien. `closest('figure')` est
 * exact ici parce que `ChartCard` rend justement une figure.
 *
 * Les graphiques Plotly ne passent PAS par ici : leur barre d'outils expose
 * deja un export natif, qui connait leur rendu WebGL — un `<svg>` serialise
 * n'en contiendrait pas les marques.
 */
export default function ChartExportButton({ filename }: { filename: string }) {
  const theme = useChartTheme();
  const [busy, setBusy] = useState(false);
  // Ancre deterministe : remonter par `document.activeElement` echouerait
  // des que le menu rend le focus en se fermant.
  const host = useRef<HTMLSpanElement>(null);

  const run = async (kind: 'png' | 'svg') => {
    // Le `<svg>` est cherche dans la ZONE DE TRACE et non dans la figure
    // entiere : l'icone du bouton d'export est elle aussi un `<svg>`, et elle
    // precede le graphique dans l'ordre du document.
    const svg = host.current?.closest('figure')?.querySelector('[data-chart-body] svg');
    if (!(svg instanceof SVGSVGElement) || busy) return;
    setBusy(true);
    try {
      // `theme.surface` est deja un LITTERAL : `useChartTheme` a resolu les
      // jetons. Un `var()` peint sur un canvas ne donnerait rien du tout.
      const opts = { filename, background: theme.surface };
      if (kind === 'png') await exportChartPng(svg, opts);
      else await exportChartSvg(svg, opts);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span ref={host} className="inline-flex">
      <OverflowMenu
        label="Export chart"
        icon={<Download className="h-4 w-4" />}
        items={[
          {
            label: 'Download PNG',
            icon: <FileImage className="h-3.5 w-3.5 shrink-0" />,
            onSelect: () => void run('png'),
          },
          {
            label: 'Download SVG',
            icon: <FileCode2 className="h-3.5 w-3.5 shrink-0" />,
            onSelect: () => void run('svg'),
          },
        ]}
      />
    </span>
  );
}

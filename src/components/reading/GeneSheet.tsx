'use client';

/**
 * La fiche d'un gène : tout ce que la lecture sait de lui, au même endroit.
 *
 * D'abord la carte de détail que le volcano montre à côté de son nuage (`GeneDetailCard`, câblée
 * comme `SelectionCard` la câble : valeurs, boîte par condition, voies, partenaires STRING, et son
 * lien STRING — on n'en ajoute pas un second). Puis « Across this study » : le gène dans les
 * autres comparaisons du projet, une ligne par comparaison, avec son log2FC, son padj et une barre
 * depuis le zéro. Puis les liens vers NCBI Gene et UniProt, dans un nouvel onglet.
 *
 * « Across this study » vient de `GET /genes/search`, qui lit la table `deg_genes` : il ne connaît
 * que les comparaisons où le gène a été retenu à l'ingestion, d'où la phrase de l'état vide. On ne
 * garde que les résultats `exact` (le symbole ou l'identifiant EST la requête, pas `IL6R` quand on
 * cherche `IL6`) de CE projet : la recherche couvre tous ceux du compte.
 */

import { useId, useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import GeneDetailCard from '@/components/comparison/explorer/GeneDetailCard';
import { useGeneSearch } from '@/hooks/useGeneSearch';
import type { GeneSearchResult } from '@/types/gene-search';
import { conditionsOf, sampleIdsOf, type FocusContext } from './FocusDialog';
import { formatLog2fc, formatPadj } from './formatStats';
import { readingHref } from './readingRoutes';

interface GeneSheetProps {
  /** La clé du gène regardé : son symbole, ou son identifiant quand le jeu n'a pas de symbole. */
  symbol: string;
  projectId: string;
  context: FocusContext;
}

/** Combien de comparaisons la recherche rend au plus : un projet en a rarement davantage. */
const ACROSS_LIMIT = 50;

/**
 * La barre ne montre jamais un effet plus grand que lui-même : sous un log2FC de 1, elle garde
 * l'échelle de 1, si bien qu'un gène à 0,3 partout ne remplit pas la piste.
 */
const BAR_MIN_SCALE = 1;

/** Les bases, ouvertes dans un autre onglet : le lecteur ne perd pas sa lecture. */
const DATABASES: ReadonlyArray<{ label: string; href: (symbol: string) => string }> = [
  { label: 'NCBI Gene', href: (s) => `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(s)}` },
  { label: 'UniProt', href: (s) => `https://www.uniprot.org/uniprotkb?query=gene:${encodeURIComponent(s)}` },
];

/** Un résultat par comparaison, dans l'ordre des noms : une liste qui ne bouge pas d'une ouverture à l'autre. */
function acrossRows(results: GeneSearchResult[] | undefined, projectId: string): GeneSearchResult[] {
  return (results ?? [])
    .filter((row) => row.project_id === projectId && row.exact)
    .sort((a, b) => a.comparison_name.localeCompare(b.comparison_name));
}

/** Une barre depuis le zéro de la piste : à droite pour une hausse, à gauche pour une baisse. */
function FoldBar({ logFc, scale }: { logFc: number; scale: number }) {
  const width = `${Math.min(Math.abs(logFc) / scale, 1) * 50}%`;
  const up = logFc > 0;
  return (
    <span className="relative block h-2 w-full rounded-pill bg-surface-2" aria-hidden>
      <span className="absolute inset-y-[-2px] left-1/2 w-px bg-line" />
      <span
        data-testid="across-bar"
        className={cn('absolute inset-y-0 block', up ? 'rounded-r-pill bg-up' : 'rounded-l-pill bg-down')}
        style={up ? { left: '50%', width } : { right: '50%', width }}
      />
    </span>
  );
}

/** Le corps de « Across this study » : l'attente, l'échec, le vide, ou la table. */
function AcrossBody({
  symbol,
  projectId,
  context,
}: {
  symbol: string;
  projectId: string;
  context: FocusContext;
}) {
  const { degDataset, actualComparisonName } = context;
  const { data, isLoading, isError } = useGeneSearch({
    query: symbol,
    limit: ACROSS_LIMIT,
    enabled: !!symbol,
  });
  const rows = useMemo(() => acrossRows(data?.results, projectId), [data?.results, projectId]);
  const scale = Math.max(BAR_MIN_SCALE, ...rows.map((row) => Math.abs(row.log_fc ?? 0)));

  let body;
  if (isLoading) {
    body = (
      <p role="status" className="text-caption text-muted">
        Looking through this study…
      </p>
    );
  } else if (isError) {
    body = <p className="text-caption text-secondary">The other comparisons could not be read.</p>;
  } else if (rows.length === 0) {
    body = <p className="text-caption text-secondary">No comparison of this study lists this gene.</p>;
  } else {
    body = (
      <table className="w-full text-left text-caption">
        <thead>
          <tr className="border-b border-line text-muted">
            <th scope="col" className="py-1 pr-2 font-medium">
              Comparison
            </th>
            <th scope="col" className="w-16 px-2 py-1 font-medium">
              <span className="sr-only">Fold change, drawn from zero</span>
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              log2FC
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">
              adj. p
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {rows.map((row) => {
            const current =
              row.dataset_id === degDataset.id && row.comparison_name === actualComparisonName;
            return (
              <tr
                key={`${row.dataset_id}|${row.comparison_name}`}
                aria-current={current ? 'true' : undefined}
                className={cn(current && 'bg-plum-soft')}
              >
                <td className="max-w-0 py-1.5 pr-2">
                  <Link
                    href={`${readingHref(row.project_id, row.comparison_name)}?gene=${encodeURIComponent(symbol)}`}
                    title={row.comparison_name}
                    className="block truncate text-accent-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {row.comparison_name}
                  </Link>
                </td>
                <td className="px-2 py-1.5">
                  {row.log_fc !== null && <FoldBar logFc={row.log_fc} scale={scale} />}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-secondary">
                  {row.log_fc !== null ? formatLog2fc(row.log_fc) : '—'}
                </td>
                <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-secondary">
                  {row.padj !== null ? formatPadj(row.padj) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return body;
}

export default function GeneSheet({ symbol, projectId, context }: GeneSheetProps) {
  const { degDataset, enrichmentDataset, matrixDataset, actualComparisonName, geneMap } = context;
  // Une accession est cherchée sous son symbole dans les bases quand la matrice le connaît.
  const databaseSymbol = geneMap.nameByGene[symbol] || symbol;
  const acrossId = useId();

  return (
    <div className="space-y-6">
      <GeneDetailCard
        gene={symbol}
        symbol={geneMap.nameByGene[symbol]}
        dataset={degDataset}
        comparisonName={actualComparisonName}
        matrixDataset={matrixDataset}
        enrichmentDataset={enrichmentDataset}
        sampleIds={sampleIdsOf(context)}
        conditionBySample={conditionsOf(context)}
      />

      <section aria-labelledby={acrossId} className="border-t border-line pt-4">
        <h3 id={acrossId} className="mb-2 text-title text-primary">
          Across this study
        </h3>
        <AcrossBody symbol={symbol} projectId={projectId} context={context} />
      </section>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-body-sm">
        {DATABASES.map(({ label, href }) => (
          <li key={label}>
            <a
              href={href(databaseSymbol)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {label}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

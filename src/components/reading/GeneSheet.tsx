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

/**
 * Un résultat par comparaison, dans l'ordre des noms : une liste qui ne bouge pas d'une ouverture
 * à l'autre. La recherche rend une ligne par jeu de données et par gène : un même nom de
 * comparaison revient quand plusieurs analyses la portent. On garde celle du jeu qu'on lit, sinon
 * la plus significative (un padj absent passe en dernier), et on n'affiche jamais deux lignes
 * pour un nom.
 */
function acrossRows(
  results: GeneSearchResult[] | undefined,
  projectId: string,
  currentDatasetId: string
): GeneSearchResult[] {
  const better = (a: GeneSearchResult, b: GeneSearchResult): boolean => {
    const aCurrent = a.dataset_id === currentDatasetId;
    if (aCurrent !== (b.dataset_id === currentDatasetId)) return aCurrent;
    if (a.padj === null) return false;
    return b.padj === null || a.padj < b.padj;
  };

  const byName = new Map<string, GeneSearchResult>();
  for (const row of results ?? []) {
    // Le serveur filtre déjà sur le projet (avant sa limite) ; ce filtre-ci et `exact` sont le
    // filet : jamais une ligne d'un autre projet, jamais `IL6R` pour `IL6`.
    if (row.project_id !== projectId || !row.exact) continue;
    const kept = byName.get(row.comparison_name);
    if (!kept || better(row, kept)) byName.set(row.comparison_name, row);
  }
  return Array.from(byName.values()).sort((a, b) => a.comparison_name.localeCompare(b.comparison_name));
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
  // `projectId` part dans la requête : le serveur trie par exactitude et padj puis coupe à la limite
  // AVANT de filtrer, si bien que les lignes de ce projet pouvaient tomber hors des cinquante et la
  // fiche écrire un vide faux.
  const { data, isLoading, isError } = useGeneSearch({
    query: symbol,
    projectId,
    limit: ACROSS_LIMIT,
    enabled: !!symbol,
  });
  const rows = useMemo(
    () => acrossRows(data?.results, projectId, degDataset.id),
    [data?.results, projectId, degDataset.id]
  );
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
            // Une ligne par nom : c'est la ligne de la comparaison qu'on lit, quelle que soit la
            // ligne gardée pour ce nom.
            const current = row.comparison_name === actualComparisonName;
            return (
              <tr
                key={`${row.comparison_name}|${row.dataset_id}|${row.gene_id}`}
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

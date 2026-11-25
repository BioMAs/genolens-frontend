/**
 * Les cinq réponses de la lecture : une phrase par question, calculée à partir des données.
 *
 * Pur et sans React, comme `readingRoutes.ts` : la formulation est le contrat (c'est ce que le
 * lecteur voit sous chaque question), donc chaque branche se teste sans rendu. Rien n'est lu ici,
 * tout arrive en entrée ; l'appelant décide d'où.
 *
 * `by` dit qui parle, et la colonne vertébrale s'en sert : `'data'` est ce que GenoLens a compté,
 * `'model'` ce que le modèle a écrit (la mention d'ardoise s'affiche), `'pending'` une phrase de
 * remplacement (lue plus bas, sans mention).
 *
 * **« Genes tested » n'est jamais `summary.total`.** `total` est le nombre de points du nuage,
 * que le serveur ne définit pas partout comme les gènes testés (voir `SignificanceSummary`) :
 * `tested` est une entrée à part, et `null` fait disparaître le membre de phrase plutôt que de le
 * remplacer par un chiffre voisin.
 */

import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { TopPathway } from '@/hooks/useTopPathways';
import type { NovaClaim } from '@/types/cosmomics';
import type { SignificanceSummary } from '@/utils/volcano';
import type { ReadingPart } from './readingRoutes';

/** Les cinq questions, qui sont aussi cinq parties de la lecture (d'où le `Extract`). */
export type AnswerKey = Extract<ReadingPart, 'counts' | 'genes' | 'processes' | 'meaning' | 'applications'>;

export type Answer = { text: string; by: 'data' | 'model' | 'pending' };

export interface AnswersInput {
  /** `null` tant que le nuage du volcano n'est pas calculé. */
  summary: SignificanceSummary | null;
  /** Gènes testés (lignes de la table de résultats) ; `null` quand on ne le sait pas. */
  tested: number | null;
  topUp: string[];
  topDown: string[];
  /** `null` : pas de fichier d'enrichissement ; `[]` : un fichier, aucune voie à ce seuil. */
  pathways: TopPathway[] | null;
  /** La lecture IA, en Markdown ; `null` tant qu'elle n'est pas écrite. */
  interpretation: string | null;
  access: ModuleAccess;
  /** `null` : pas de données d'allégations pour cette comparaison. */
  claims: NovaClaim[] | null;
}

/** Une allégation est « supported » quand elle est cohérente (≥ 0,5) et a au moins un sous-groupe pour. */
export function isClaimSupported(claim: NovaClaim): boolean {
  return claim.coherence >= 0.5 && claim.n_for > 0;
}

/** `A`, `A and B`, `A, B and C`. */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function counts({ summary, tested }: AnswersInput): Answer {
  if (!summary) return { text: 'Counting genes…', by: 'pending' };
  const changed = `${summary.up} up and ${summary.down} down`;
  return { text: tested === null ? changed : `${changed}, of ${tested} genes tested`, by: 'data' };
}

function genes({ topUp, topDown }: AnswersInput): Answer {
  // Le verbe s'accorde avec le nombre de gènes : « KRT1 falls », « KRT1 and LCE1A fall ».
  const halves: string[] = [];
  if (topUp.length > 0) halves.push(`${list(topUp)} ${topUp.length === 1 ? 'rises' : 'rise'} most`);
  if (topDown.length > 0) halves.push(`${list(topDown)} ${topDown.length === 1 ? 'falls' : 'fall'} most`);
  return { text: halves.length > 0 ? halves.join('; ') : 'No gene passes the thresholds', by: 'data' };
}

function processes({ pathways }: AnswersInput): Answer {
  if (pathways === null) return { text: 'No enrichment file for this comparison', by: 'data' };
  if (pathways.length === 0) return { text: 'No process is enriched at these thresholds', by: 'data' };

  // Les voies arrivent triées par l'appelant : la première de chaque sens est la plus forte.
  const pu = pathways.find((p) => p.direction === 'up');
  const pd = pathways.find((p) => p.direction === 'down');
  if (pu && pd) return { text: `${pu.name} rises; ${pd.name.toLowerCase()} falls`, by: 'data' };
  if (pu) return { text: `${pu.name} rises`, by: 'data' };
  if (pd) return { text: `${pd.name} falls`, by: 'data' };
  // Enrichissement « tous les DEG » : aucune voie n'a de sens.
  return { text: `${pathways[0].name} is enriched`, by: 'data' };
}

const HEADING = /^\s*#/;
/** Puce, numéro (`1.`, `1)`) ou citation en tête de ligne : sans quoi « 1. » ferait une phrase. */
const LIST_MARK = /^\s*(?:>\s*)?(?:[-+*]|\d+[.)])\s+/;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
/** Gras, italique, code. */
const EMPHASIS = /[*_`]+/g;
/** Jusqu'au premier `.`, `!` ou `?` suivi d'une espace ou de la fin : « 2.5 fold » ne coupe pas. */
const SENTENCE = /^[\s\S]*?[.!?](?=\s|$)/;
/** Ce qu'il reste d'une règle horizontale (`---`) une fois les marques retirées. */
const HAS_TEXT = /[^\s=-]/;

/**
 * La première phrase du premier paragraphe d'un texte Markdown, sans sa mise en forme.
 * Les titres sont ignorés ; `null` quand il ne reste aucun texte.
 */
function firstSentence(markdown: string): string | null {
  const body = markdown
    .split(/\r?\n/)
    .filter((line) => !HEADING.test(line))
    .join('\n');

  for (const paragraph of body.split(/\n\s*\n/)) {
    const text = paragraph
      .split('\n')
      .map((line) => line.replace(LIST_MARK, ''))
      .join(' ')
      .replace(LINK, '$1')
      .replace(EMPHASIS, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (HAS_TEXT.test(text)) return (SENTENCE.exec(text)?.[0] ?? text).trim();
  }
  return null;
}

function meaning({ interpretation }: AnswersInput): Answer {
  const sentence = interpretation === null ? null : firstSentence(interpretation);
  return sentence
    ? { text: sentence, by: 'model' }
    : { text: 'Not written yet: open question 4 to write it', by: 'pending' };
}

function applications({ access, claims }: AnswersInput): Answer {
  if (!access.skin) return { text: 'Skin claims need the CosmOmics module', by: 'data' };
  if (claims === null) return { text: 'No skin claim data for this comparison', by: 'data' };

  const names = claims.filter(isClaimSupported).map((claim) => claim.name);
  if (names.length === 0) return { text: 'No skin claim supported', by: 'data' };
  return { text: `${list(names)} ${names.length === 1 ? 'claim' : 'claims'} supported`, by: 'data' };
}

/** Les cinq réponses, dans l'ordre de la lecture. */
export function buildAnswers(input: AnswersInput): Record<AnswerKey, Answer> {
  return {
    counts: counts(input),
    genes: genes(input),
    processes: processes(input),
    meaning: meaning(input),
    applications: applications(input),
  };
}

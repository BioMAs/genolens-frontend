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

/**
 * `1284` devient `1,284` : les milliers se lisent d'un coup d'œil sur de vrais comptages.
 * Exportée pour que le chapitre des comptes écrive les nombres comme la réponse 1.
 */
export const formatCount = (n: number): string => n.toLocaleString('en-US');

function counts({ summary, tested }: AnswersInput): Answer {
  if (!summary) return { text: 'Counting genes…', by: 'pending' };
  const changed = `${formatCount(summary.up)} up and ${formatCount(summary.down)} down`;
  return {
    text: tested === null ? changed : `${changed}, of ${formatCount(tested)} genes tested`,
    by: 'data',
  };
}

function genes({ topUp, topDown }: AnswersInput): Answer {
  // Le verbe s'accorde avec le nombre de gènes : « KRT1 falls », « KRT1 and LCE1A fall ».
  const halves: string[] = [];
  if (topUp.length > 0) halves.push(`${list(topUp)} ${topUp.length === 1 ? 'rises' : 'rise'} most`);
  if (topDown.length > 0) halves.push(`${list(topDown)} ${topDown.length === 1 ? 'falls' : 'fall'} most`);
  return { text: halves.length > 0 ? halves.join('; ') : 'No gene passes the thresholds', by: 'data' };
}

/**
 * Le nom d'une voie en milieu de phrase : l'initiale passe en minuscule, mais seulement quand la
 * deuxième lettre est une minuscule (`Cell cycle` donne `cell cycle`). Un sigle (`DNA repair`), un
 * symbole à chiffre (`p53 signalling`) ou une capitale isolée (`T cell activation`) restent tels
 * quels : un `toLowerCase()` complet les abîmerait, et le reste du nom n'est jamais touché.
 */
function lowerInitial(name: string): string {
  const second = name.charAt(1);
  const secondIsLower = second !== '' && second !== second.toUpperCase();
  return secondIsLower ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

/**
 * Les deux phrases de la réponse 3 quand il n'y a rien à classer. Exportées : le chapitre des
 * processus les redit mot pour mot, la réponse et sa preuve ne se contredisent pas.
 */
export const NO_ENRICHMENT_FILE = 'No enrichment file for this comparison';
export const NO_PROCESS_ENRICHED = 'No process is enriched at these thresholds';

function processes({ pathways }: AnswersInput): Answer {
  if (pathways === null) return { text: NO_ENRICHMENT_FILE, by: 'data' };
  if (pathways.length === 0) return { text: NO_PROCESS_ENRICHED, by: 'data' };

  // Les voies arrivent triées par l'appelant : la première de chaque sens est la plus forte.
  const pu = pathways.find((p) => p.direction === 'up');
  const pd = pathways.find((p) => p.direction === 'down');
  if (pu && pd) return { text: `${pu.name} rises; ${lowerInitial(pd.name)} falls`, by: 'data' };
  if (pu) return { text: `${pu.name} rises`, by: 'data' };
  if (pd) return { text: `${pd.name} falls`, by: 'data' };
  // Enrichissement « tous les DEG » : aucune voie n'a de sens.
  return { text: `${pathways[0].name} is enriched`, by: 'data' };
}

const HEADING = /^\s*#/;
/** Puce, numéro (`1.`, `1)`) ou citation en tête de ligne : sans quoi « 1. » ferait une phrase. */
const LIST_MARK = /^\s*(?:>\s*)?(?:[-+*]|\d+[.)])\s+/;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
/** Un `code span` : ses marques et son contenu, que rien d'autre ne doit toucher. */
const CODE_SPAN = /`[^`]*`/g;
/** Gras / italique en `*` : une paire dont l'intérieur ne commence ni ne finit par une espace. */
const STAR_EMPHASIS = /(\*{1,3})(?=\S)(.*?\S)\1/g;
/**
 * Gras / italique en `_` : seulement en bord de mot, comme CommonMark. Le `_` d'ouverture ne suit
 * pas un caractère de mot et celui de fermeture n'en précède pas un : `KO_vs_WT` et `HLA_DRB1`
 * sont des identifiants, pas de l'emphase.
 */
const UNDERSCORE_EMPHASIS = /(^|\W)(_{1,2})(?=\S)(.*?\S)\2(?!\w)/g;
/** Un caractère de la zone d'usage privé, qui tient la place d'un code span le temps du traitement. */
const CODE_SLOT = /[\uE000-\uF8FF]/g;
const CODE_SLOT_BASE = 0xe000;
/** Jusqu'au premier `.`, `!` ou `?` suivi d'une espace ou de la fin : « 2.5 fold » ne coupe pas. */
const SENTENCE = /^[\s\S]*?[.!?](?=\s|$)/;
/** Ce qu'il reste d'une règle horizontale (`---`) une fois les marques retirées. */
const HAS_TEXT = /[^\s=-]/;

/**
 * Un texte Markdown sans ses marques : le gras et l'italique (`*`, `**`, `_`, `__`) comme
 * délimiteurs seulement, les backticks d'un code span, mais jamais ce que le code contient.
 *
 * Les code spans sont mis à l'abri d'abord (un caractère chacun), puis remis tels quels : le
 * lecteur y trouve ses noms de comparaison (`KO_vs_WT`) et de gènes à l'identique, et une emphase
 * qui entoure un code span est quand même retirée. Un délimiteur qui ne ferme rien reste littéral.
 */
function stripMarkdownMarks(text: string): string {
  const spans: string[] = [];
  let current = text.replace(CODE_SPAN, (span) => {
    spans.push(span.slice(1, -1));
    return String.fromCharCode(CODE_SLOT_BASE + spans.length - 1);
  });

  // Emphase imbriquée (`**gras et *italique***`) : on repasse tant que quelque chose tombe.
  for (let previous = ''; previous !== current; ) {
    previous = current;
    current = current.replace(STAR_EMPHASIS, '$2').replace(UNDERSCORE_EMPHASIS, '$1$3');
  }

  // Un backtick resté seul n'ouvre aucun code span : il disparaît avec les autres marques.
  return current
    .replace(/`/g, '')
    .replace(CODE_SLOT, (slot) => spans[slot.charCodeAt(0) - CODE_SLOT_BASE] ?? slot);
}

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
    const joined = paragraph
      .split('\n')
      .map((line) => line.replace(LIST_MARK, ''))
      .join(' ')
      .replace(LINK, '$1');
    const text = stripMarkdownMarks(joined).replace(/\s+/g, ' ').trim();
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
  // Avant l'arrivée du profil tous les drapeaux sont faux : afficher le verrou ici l'annoncerait à
  // quelqu'un qui a le module. On attend plutôt de savoir.
  if (!access.loaded) return { text: 'Checking your modules…', by: 'pending' };
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

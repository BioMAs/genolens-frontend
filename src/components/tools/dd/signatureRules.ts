/**
 * Règles de rejet d'une signature (SIG001…SIG006), en anglais.
 *
 * genolens-dd porte `rule_id` et `conditions` **en attributs** de son rejet, précisément pour
 * que le support puisse router sur la règle plutôt que sur une phrase. On s'en sert ici pour la
 * raison jumelle : les textes amont sont en français, l'interface est en anglais, et rendre le
 * message amont verbatim régresserait la localisation du module. L'identifiant est stable et
 * traduisible ; la phrase ne l'est pas.
 *
 * Le texte amont reste affiché en détail secondaire — il porte parfois une précision que ce
 * tableau n'a pas — mais il n'est jamais le message principal.
 */
import { DdSignatureRejection } from '@/types/drugDiscovery';

export interface SignatureRuleCopy {
  title: string;
  explanation: string;
  /** `true` seulement pour SIG002 : les autres n'ont aucune échappatoire. */
  appealable: boolean;
}

export const SIGNATURE_RULES: Record<string, SignatureRuleCopy> = {
  SIG001: {
    title: 'A condition has a single replicate',
    explanation:
      'No inference is possible from one replicate, and no flag lifts this. Re-run the '
      + 'differential analysis with at least three replicates per condition.',
    appealable: false,
  },
  SIG002: {
    title: 'A condition has only two replicates',
    explanation:
      'This is accepted only if you take responsibility for it, and the signature is then '
      + 'marked low-confidence — every statement derived from it is weakened.',
    appealable: true,
  },
  SIG003: {
    title: 'The signature contains no condition',
    explanation: 'Nothing was selected to send. Check the direction filter.',
    appealable: false,
  },
  SIG004: {
    title: 'A condition contains no gene',
    explanation:
      'An enrichment over the empty set would return meaningless p-values rather than an '
      + 'error. Loosen the padj or |log2FC| thresholds.',
    appealable: false,
  },
  SIG005: {
    title: 'A condition has no declared replicate count',
    explanation:
      'Replicate counts are never guessed: assuming one is sufficient would be the most '
      + 'dangerous default available. Fill them in and run again.',
    appealable: false,
  },
  SIG006: {
    title: 'None of your genes could be resolved',
    explanation:
      'This is not a weak signature but a format problem — probe identifiers, the wrong '
      + 'column, or a non-human species. Check that your matrix carried gene symbols.',
    appealable: false,
  },
};

const RULE_ID = /SIG\d{3}/;

/**
 * Extrait un rejet codé d'une erreur axios, ou `null`.
 *
 * Accepte les deux formes : le détail structuré (ce que la route amont renvoie) et une chaîne
 * commençant par l'identifiant (repli, si un intermédiaire l'aplatissait un jour). Sans ce
 * repli, une réponse aplatie ne s'afficherait pas du tout.
 */
export function parseSignatureRejection(error: unknown): DdSignatureRejection | null {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (!detail) return null;

  if (typeof detail === 'object' && detail !== null && 'rule_id' in detail) {
    const structured = detail as DdSignatureRejection;
    return RULE_ID.test(structured.rule_id) ? structured : null;
  }
  if (typeof detail === 'string') {
    const match = RULE_ID.exec(detail);
    return match ? { rule_id: match[0], conditions: [], message: detail } : null;
  }
  return null;
}

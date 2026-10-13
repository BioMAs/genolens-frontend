/**
 * What the interaction network sends to STRING: which names, for which organism.
 *
 * Both used to be wrong in a way that read as "no interactions" rather than as an error:
 *
 * - The seeds were the volcano's raw `gene` field, which is the DEG file's id column — often a
 *   versioned Ensembl id (`ENSG00000141510.17`). STRING answers 404 "nothing found" to a version
 *   suffix, the backend turned that into an empty network, and the panel said there was nothing
 *   at this confidence. Unversioned ids resolved, but every node came back grey: STRING names
 *   nodes by symbol, the colour join was keyed by Ensembl id.
 * - The organism was always 9606. A mouse project asked STRING for human proteins named
 *   `ENSMUSG…`, which it does not have.
 *
 * Kept free of React so the rules are unit-testable on their own.
 */

import { normalizeGeneKey, stripEnsemblVersion } from '@/utils/geneKeys';

/** Human. STRING's own default, and the one the endpoint falls back to. */
export const HUMAN_TAXON = 9606;

/** NCBI taxon ids of the organisms the analysis wizard offers, under every spelling seen. */
const TAXON_BY_NAME: Record<string, number> = {
  human: 9606,
  'homo sapiens': 9606,
  hsapiens: 9606,
  mouse: 10090,
  'mus musculus': 10090,
  mmusculus: 10090,
  rat: 10116,
  'rattus norvegicus': 10116,
  rnorvegicus: 10116,
  zebrafish: 7955,
  'danio rerio': 7955,
  drerio: 7955,
  pig: 9823,
  'sus scrofa': 9823,
  sscrofa: 9823,
};

/** Ensembl gene-id prefixes of the same organisms, for projects that never stated one. */
const TAXON_BY_ENSEMBL_PREFIX: [RegExp, number][] = [
  [/^ENSMUSG\d/, 10090],
  [/^ENSRNOG\d/, 10116],
  [/^ENSDARG\d/, 7955],
  [/^ENSSSCG\d/, 9823],
  [/^ENSG\d/, 9606],
];

const ENSEMBL_GENE = /^ENS[A-Z]*G\d+$/;

/** `Trp53`, `Cd4`, `Actb`: the rodent nomenclature. Human symbols are upper-case (`TP53`). */
const RODENT_SYMBOL = /^[A-Z][a-z][A-Za-z0-9-]*$/;
const MOUSE_TAXON = 10090;

/**
 * The STRING organism of a comparison, from the best evidence available:
 *
 * 1. a declared species we know — the dataset's metadata, or the project's;
 * 2. the organism its Ensembl ids betray (`ENSMUSG…` is mouse);
 * 3. symbol case — rodent symbols are title-case, so a majority of `Trp53`-like names is mouse
 *    (rat writes them the same way, but mouse is by far the likelier);
 * 4. human.
 *
 * Nothing on the client knows the species an analysis was launched with — it lives in the
 * analysis parameters on the server — hence the inference.
 */
export function stringTaxon(
  declaredSpecies: string | null | undefined,
  genes: readonly string[]
): number {
  const declared = (declaredSpecies ?? '').trim().toLowerCase();
  if (/^\d+$/.test(declared)) return Number(declared);
  const named = TAXON_BY_NAME[declared] ?? TAXON_BY_NAME[declared.replace(/[\s_.]+/g, ' ')];
  if (named) return named;

  let symbols = 0;
  let rodent = 0;
  for (const gene of genes) {
    const key = normalizeGeneKey(gene);
    for (const [pattern, taxon] of TAXON_BY_ENSEMBL_PREFIX) {
      if (pattern.test(key)) return taxon;
    }
    const raw = (gene ?? '').trim();
    if (!raw) continue;
    symbols += 1;
    if (RODENT_SYMBOL.test(raw)) rodent += 1;
  }
  if (symbols > 0 && rodent / symbols > 0.5) return MOUSE_TAXON;
  return HUMAN_TAXON;
}

/**
 * Index a `Record<gene_id, gene_name>` by unversioned, normalised id, keeping the symbol's case.
 *
 * Case is kept on purpose: mouse and rat symbols are title-case (`Trp53`), and the network's
 * labels and table show them back to the reader.
 */
export function symbolLookup(nameByGene: Record<string, string> | undefined): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [id, name] of Object.entries(nameByGene ?? {})) {
    const symbol = typeof name === 'string' ? name.trim() : '';
    if (!symbol) continue;
    const key = stripEnsemblVersion(id);
    if (key && !lookup.has(key)) lookup.set(key, symbol);
  }
  return lookup;
}

/** The name STRING should be asked for one gene of this comparison. */
export function toStringSymbol(gene: string, lookup: Map<string, string>): string {
  const key = stripEnsemblVersion(gene);
  const symbol = lookup.get(key);
  if (symbol) return symbol;
  // An Ensembl id with no known symbol still resolves once its version is gone.
  return ENSEMBL_GENE.test(key) ? key : gene.trim();
}

/** Seeds as STRING names, deduplicated in input order — order is strength, the cap trims the tail. */
export function toStringSymbols(genes: readonly string[], lookup: Map<string, string>): string[] {
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const gene of genes) {
    if (!gene) continue;
    const symbol = toStringSymbol(gene, lookup);
    const key = normalizeGeneKey(symbol);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    symbols.push(symbol);
  }
  return symbols;
}

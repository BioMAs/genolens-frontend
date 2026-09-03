/**
 * Reconciling the two gene keys of a comparison.
 *
 * A comparison names its genes twice, from two different sources:
 *
 * - The **volcano** reads the Parquet file. The backend picks the gene column by heuristic —
 *   the first column matching /gene|symbol|id/ (`datasets.py:2118`) — so a point's `gene` is an
 *   Ensembl id on one dataset and a bare symbol on the next.
 * - The **DEG table** reads Postgres, where `gene_id` is the primary key and `gene_name` the
 *   symbol. Either may be the Ensembl id depending on how the dataset was ingested.
 *
 * Cross-filtering the two therefore needs one place that knows both names belong to the same
 * gene. Everything that maps a selection onto a chart, a table row, a pathway's gene list or a
 * STRING query goes through here, so the matching rule lives in exactly one file.
 *
 * The rule: compare on a normalised key (trimmed, upper-cased), and index a gene under *every*
 * alias it answers to — its id, its symbol, and the unversioned form of an Ensembl id. Extra
 * aliases only ever widen a lookup; they never make a wrong match, because each alias maps to
 * the same identity object.
 */

/** An Ensembl-style accession carrying a version suffix, e.g. `ENSG00000141510.17`. */
const VERSIONED_ENSEMBL = /^(ENS[A-Z]*[GTPER]\d+)\.\d+$/;

/** A gene named by both of its keys. `symbol` is null when the source only knew one name. */
export interface GeneIdentity {
  /** Normalised primary key — the canonical form to store in a selection. */
  id: string;
  /** Normalised display symbol, when known. */
  symbol: string | null;
}

/** One gene as a source describes it, before normalisation. */
export interface GeneEntry {
  id: string | null | undefined;
  symbol?: string | null;
}

/**
 * Trim and upper-case a gene key so two spellings of the same gene compare equal.
 *
 * Returns `''` for anything empty — callers should treat that as "no gene", never as a key.
 */
export function normalizeGeneKey(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().toUpperCase();
}

/**
 * Drop the version suffix from an Ensembl accession, leaving anything else untouched.
 *
 * `ENSG00000141510.17` → `ENSG00000141510`, but `HLA-DRB1` and `C1orf134` pass through: only
 * an Ensembl-shaped accession is rewritten, so a symbol that happens to contain a dot survives.
 */
export function stripEnsemblVersion(raw: string | null | undefined): string {
  const key = normalizeGeneKey(raw);
  const match = VERSIONED_ENSEMBL.exec(key);
  return match ? match[1] : key;
}

/**
 * Every normalised form one raw gene key should answer to, most specific first, deduplicated.
 *
 * A versioned Ensembl id yields two aliases; everything else yields one. Empty input yields
 * an empty array rather than `['']`, so a missing gene cannot collide with another.
 */
export function geneKeyAliases(raw: string | null | undefined): string[] {
  const key = normalizeGeneKey(raw);
  if (!key) return [];
  const unversioned = stripEnsemblVersion(key);
  return unversioned === key ? [key] : [key, unversioned];
}

/** Lookup built from a set of genes, resolving any of their aliases to one identity. */
export interface GeneIndex {
  /** Resolve a raw key of unknown provenance, or null when this index has never seen it. */
  resolve(raw: string | null | undefined): GeneIdentity | null;
  /** Display symbol for a raw key, falling back to its normalised form when unknown. */
  symbolOf(raw: string | null | undefined): string;
  /** Number of distinct genes indexed — not the number of aliases. */
  readonly size: number;
}

/**
 * Index genes by every alias of both their id and their symbol.
 *
 * This is the pattern `GOEnrichmentAnalysis` already applies inline when it builds its
 * `degGeneMap` (indexing each DEG row under both `gene_id` and `gene_name`, upper-cased);
 * extracting it here means the volcano, the table, the gene card and the network all agree
 * instead of each re-deriving it.
 *
 * When two entries claim the same alias the **first** wins, so pass the more authoritative
 * source first. An entry with no usable id is skipped.
 */
export function buildGeneIndex(entries: Iterable<GeneEntry>): GeneIndex {
  const byAlias = new Map<string, GeneIdentity>();
  const identities = new Set<GeneIdentity>();

  for (const entry of entries) {
    const id = normalizeGeneKey(entry.id);
    if (!id) continue;

    const symbol = normalizeGeneKey(entry.symbol) || null;
    const identity: GeneIdentity = { id, symbol };

    let claimed = false;
    for (const alias of [...geneKeyAliases(id), ...geneKeyAliases(symbol)]) {
      if (byAlias.has(alias)) continue;
      byAlias.set(alias, identity);
      claimed = true;
    }
    if (claimed) identities.add(identity);
  }

  return {
    resolve(raw) {
      for (const alias of geneKeyAliases(raw)) {
        const hit = byAlias.get(alias);
        if (hit) return hit;
      }
      return null;
    },
    symbolOf(raw) {
      const hit = this.resolve(raw);
      if (hit) return hit.symbol ?? hit.id;
      return normalizeGeneKey(raw);
    },
    get size() {
      return identities.size;
    },
  };
}

/**
 * Build an index from the `geneNameMap` shape `ComparisonDetail` already assembles from the
 * matrix — `Record<gene_id, gene_name>`.
 */
export function buildGeneIndexFromNameMap(map: Record<string, string>): GeneIndex {
  return buildGeneIndex(
    Object.entries(map).map(([id, symbol]) => ({ id, symbol }))
  );
}

/**
 * Resolve a raw gene key against an index, or fall back to its normalised form.
 *
 * Use when a gene must be usable even if it is absent from the index — a volcano point whose
 * gene has no DEG row, for instance, which happens routinely because `deg_genes` only holds
 * genes that were already significant at ingestion.
 */
export function resolveGene(
  raw: string | null | undefined,
  index: GeneIndex | null | undefined
): GeneIdentity | null {
  const key = normalizeGeneKey(raw);
  if (!key) return null;
  return index?.resolve(key) ?? { id: key, symbol: null };
}

/**
 * Keep the members of `keys` that the index knows, deduplicated, in input order.
 *
 * The order matters: a selection's order is the user's intent, and the gene card shows it back
 * to them in that order.
 */
export function intersectWithIndex(
  keys: Iterable<string | null | undefined>,
  index: GeneIndex
): GeneIdentity[] {
  const seen = new Set<string>();
  const out: GeneIdentity[] = [];
  for (const raw of keys) {
    const hit = index.resolve(raw);
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push(hit);
  }
  return out;
}

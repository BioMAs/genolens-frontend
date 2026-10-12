import type { CosmOmicsNovaData, NovaClaim, NovaSubgroup, NovaTerm } from '@/types/cosmomics';
import { seededRandom } from './novaLayout';

/**
 * A synthetic nova of a given size, built with the backend definitions
 * (S_pro / S_anti / balance / coherence) — for the performance bench only.
 */
export function syntheticNova(nClaims = 15, nSubgroups = 300, nTerms = 2000, seed = 'perf'): CosmOmicsNovaData {
  const rng = seededRandom(seed);
  const perClaim = Math.ceil(nSubgroups / nClaims);
  let termsLeft = nTerms;
  let subsLeft = nSubgroups;
  const claims: NovaClaim[] = [];

  for (let c = 0; c < nClaims && subsLeft > 0; c += 1) {
    const subgroups: NovaSubgroup[] = [];
    for (let s = 0; s < perClaim && subsLeft > 0; s += 1, subsLeft -= 1) {
      const n = Math.max(1, Math.round(termsLeft / subsLeft));
      termsLeft -= n;
      const terms: NovaTerm[] = Array.from({ length: n }, (_, t) => ({
        id: `GO:${String(c * 10000 + s * 100 + t).padStart(7, '0')}`,
        label: `Synthetic term ${c}.${s}.${t}`,
        nl: 0.8 + rng.random() * 7,
        effect: rng.random() < 0.8 ? 1 : -1,
        obs: rng.random() < 0.6 ? 'up' : 'down',
      }));
      const s_pro = terms.filter((t) => t.effect > 0).reduce((sum, t) => sum + t.nl, 0);
      const s_anti = terms.filter((t) => t.effect < 0).reduce((sum, t) => sum + t.nl, 0);
      const up = terms.filter((t) => t.obs === 'up').reduce((sum, t) => sum + t.nl, 0);
      const down = terms.filter((t) => t.obs === 'down').reduce((sum, t) => sum + t.nl, 0);
      subgroups.push({
        name: `Synthetic pathway ${c}.${s}`,
        nl: Math.max(...terms.map((t) => t.nl)) + rng.random() * 2,
        s_pro,
        s_anti,
        delta: s_pro - s_anti,
        balance: (s_pro - s_anti) / (s_pro + s_anti),
        obs: up >= down ? 'up' : 'down',
        terms,
      });
    }
    const s_pro = subgroups.reduce((sum, s) => sum + s.s_pro, 0);
    const s_anti = subgroups.reduce((sum, s) => sum + s.s_anti, 0);
    claims.push({
      name: `Claim ${c + 1}`,
      importance: s_pro + s_anti,
      s_pro,
      s_anti,
      coherence: s_pro / (s_pro + s_anti),
      n_for: subgroups.filter((s) => s.delta > 0).length,
      n_against: subgroups.filter((s) => s.delta <= 0).length,
      subgroups,
    });
  }
  claims.sort((a, b) => b.s_pro - a.s_pro);
  return { contrast: `Synthetic ${nClaims} claims · ${nSubgroups} sub-groups · ${nTerms} terms`, claims, unlinked: [] };
}

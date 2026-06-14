/**
 * Static demo data for the locked Cosmetics teaser.
 * Fictional values — never fetched from the API. Shown (blurred) to users who
 * have not unlocked the module, so they can preview what it offers.
 */
import { CosmeticsResult } from '@/hooks/useCosmetics';

export const DEMO_COSMETICS: CosmeticsResult = {
  dataset_id: 'demo',
  comparison_name: 'Active ingredient vs Placebo',
  claims: [
    {
      slug: 'firming',
      label: 'Firming & Elasticity',
      color: '#db2777',
      icon: 'activity',
      skin_zone: 'dermis',
      description: 'Reinforces extracellular matrix for firmer, more elastic skin.',
      score: 86,
      direction: 'favorable',
      n_supporting: 7,
      n_contradicting: 1,
      confidence: 'HIGH',
      evidence_pathways: [
        { term_id: 'GO:0030198', pathway_name: 'Extracellular matrix organization', direction: 'UP', evidence_level: 'HIGH', padj: 1e-6, category: 'ECM_CYTO', weight: 1.4 },
      ],
      top_genes: ['COL1A1', 'COL3A1', 'ELN', 'FBN1', 'LOX'],
    },
    {
      slug: 'anti-ageing',
      label: 'Anti-ageing',
      color: '#8b5cf6',
      icon: 'sparkles',
      skin_zone: 'cellular',
      description: 'Supports cellular resilience and proteostasis.',
      score: 78,
      direction: 'favorable',
      n_supporting: 6,
      n_contradicting: 1,
      confidence: 'HIGH',
      evidence_pathways: [
        { term_id: 'HSA-9646399', pathway_name: 'Aggrephagy', direction: 'UP', evidence_level: 'HIGH', padj: 3e-5, category: 'PROTEOSTASIS', weight: 1.2 },
      ],
      top_genes: ['SIRT1', 'FOXO3', 'HSPA1A', 'SQSTM1'],
    },
    {
      slug: 'moisturising',
      label: 'Moisturising & Barrier',
      color: '#0ea5e9',
      icon: 'droplet',
      skin_zone: 'stratum_corneum',
      description: 'Supports barrier lipid synthesis for better hydration.',
      score: 71,
      direction: 'favorable',
      n_supporting: 4,
      n_contradicting: 0,
      confidence: 'MODERATE',
      evidence_pathways: [
        { term_id: 'GO:0071616', pathway_name: 'Acyl-CoA biosynthetic process', direction: 'UP', evidence_level: 'HIGH', padj: 8e-4, category: 'BARRIER_LIPID', weight: 1.1 },
      ],
      top_genes: ['ELOVL4', 'CERS3', 'ABCA12'],
    },
    {
      slug: 'soothing',
      label: 'Soothing & Anti-redness',
      color: '#10b981',
      icon: 'shield',
      skin_zone: 'inflammation',
      description: 'Modulates inflammatory signaling to calm redness.',
      score: 64,
      direction: 'favorable',
      n_supporting: 5,
      n_contradicting: 2,
      confidence: 'MODERATE',
      evidence_pathways: [
        { term_id: 'GO:0006954', pathway_name: 'Inflammatory response', direction: 'DOWN', evidence_level: 'MODERATE', padj: 2e-3, category: 'IMMUNE_INFLAM', weight: 0.9 },
      ],
      top_genes: ['IL6', 'TNF', 'NFKB1', 'PTGS2'],
    },
    {
      slug: 'antioxidant',
      label: 'Antioxidant & Detox',
      color: '#f59e0b',
      icon: 'zap-off',
      skin_zone: 'antioxidant',
      description: 'Reinforces redox defenses against oxidative stress.',
      score: 58,
      direction: 'favorable',
      n_supporting: 3,
      n_contradicting: 1,
      confidence: 'MODERATE',
      evidence_pathways: [
        { term_id: 'GO:0006979', pathway_name: 'Response to oxidative stress', direction: 'UP', evidence_level: 'MODERATE', padj: 5e-3, category: 'REDOX_ANTIOX', weight: 0.8 },
      ],
      top_genes: ['NFE2L2', 'SOD2', 'GPX1', 'HMOX1'],
    },
    {
      slug: 'regenerating',
      label: 'Regenerating & Renewal',
      color: '#16a34a',
      icon: 'refresh-cw',
      skin_zone: 'epidermis',
      description: 'Stimulates turnover and protein synthesis.',
      score: 52,
      direction: 'favorable',
      n_supporting: 4,
      n_contradicting: 2,
      confidence: 'MODERATE',
      evidence_pathways: [],
      top_genes: ['MKI67', 'KRT14', 'TP63'],
    },
    {
      slug: 'energising',
      label: 'Energising',
      color: '#ef4444',
      icon: 'battery-charging',
      skin_zone: 'energy',
      description: 'Boosts mitochondrial and metabolic activity.',
      score: 47,
      direction: 'favorable',
      n_supporting: 3,
      n_contradicting: 1,
      confidence: 'LOW',
      evidence_pathways: [],
      top_genes: ['PPARGC1A', 'NDUFA1'],
    },
    {
      slug: 'anti-wrinkles',
      label: 'Anti-wrinkles',
      color: '#7c3aed',
      icon: 'waves',
      skin_zone: 'dermis',
      description: 'Targets dermal matrix mechanics linked to fine lines.',
      score: 41,
      direction: 'favorable',
      n_supporting: 2,
      n_contradicting: 1,
      confidence: 'LOW',
      evidence_pathways: [],
      top_genes: ['MMP1', 'TIMP1'],
    },
  ],
  skin_zones: [
    { slug: 'stratum_corneum', label: 'Skin barrier (stratum corneum)', activity: 72, dominant_direction: 'up', n_pathways: 5 },
    { slug: 'epidermis', label: 'Epidermis (renewal & repair)', activity: 64, dominant_direction: 'up', n_pathways: 8 },
    { slug: 'dermis', label: 'Dermis (collagen & elasticity)', activity: 100, dominant_direction: 'up', n_pathways: 12 },
    { slug: 'inflammation', label: 'Inflammation & redness', activity: 55, dominant_direction: 'down', n_pathways: 6 },
    { slug: 'antioxidant', label: 'Antioxidant defense', activity: 48, dominant_direction: 'up', n_pathways: 4 },
    { slug: 'energy', label: 'Cellular energy', activity: 39, dominant_direction: 'up', n_pathways: 3 },
    { slug: 'cellular', label: 'Cellular resilience & ageing', activity: 81, dominant_direction: 'up', n_pathways: 9 },
  ],
  caveats: [
    { term_id: 'HSA-111447', pathway_name: 'Activation of BAD and translocation to mitochondria', flag: 'CONTEXT', note: 'Apoptosis modulation — interpret with care depending on context.' },
  ],
  references: [],
  coverage: { n_significant: 140, n_matched: 96, n_terms_matched: 88, match_rate: 0.686 },
};

export const DEMO_INTERPRETATION = `## Claim-by-claim narrative

**Firming & Elasticity** is the strongest signal: extracellular-matrix and collagen pathways are clearly up-regulated (COL1A1, COL3A1, ELN), suggesting the active helps support skin firmness and elasticity.

**Anti-ageing** is also well supported, with proteostasis and cellular cleanup pathways engaged — markers associated with more resilient, younger-looking skin.

**Moisturising & Barrier** appears favorable through enhanced barrier-lipid synthesis, which may help support hydration and reduce water loss.

## Executive summary

Overall, the tested active paints a compelling picture for a firming, age-defying positioning. The data points to stronger dermal architecture, better cellular housekeeping, and a reinforced moisture barrier, with a secondary soothing benefit. This is a strong basis for "firming + anti-ageing" communication backed by transcriptomic evidence.

## Regulatory note

These are cosmetic effects only and do not constitute medical or therapeutic claims. The active appears to help support skin firmness and barrier function; wording such as "helps support" and "may contribute to" should be preferred. Some apoptosis-related pathways are context-dependent and should be reviewed before final claim wording.`;

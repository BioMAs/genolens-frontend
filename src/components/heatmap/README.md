# heatmap/ — logique partagée de heatmap

Ce dossier ne contient **plus de composant de rendu**. Les composants `HeatmapPlot`,
`HeatmapVisualization`, `HeatmapControls`, `HeatmapModal` et le baril `index.ts` ont été supprimés :
ils n'étaient atteignables que l'un par l'autre, `index.ts` n'étant importé par personne.

Ce qui reste est la logique métier, consommée **par chemin direct** (pas par le baril) :

```
frontend/src/components/heatmap/
├── types.ts           # ClusteringParams, HeatmapData, HeatmapConfig, TopNOption
├── heatmapConfig.ts   # DEFAULT_/MODAL_/MOBILE_HEATMAP_CONFIG, TOP_N_OPTIONS, getColorscale
└── useHeatmapData.ts  # récupération + clustering côté backend
```

## Consommateurs

| Fichier | Importe |
|---|---|
| `src/components/analysis/DEGClusteringView.tsx` | `types` (`ClusteringParams`), `useHeatmapData` |
| `src/components/analysis/ClusteringAnalysis.tsx` | `heatmapConfig` (`getColorscale`) |

Le rendu Plotly vit désormais dans ces deux composants.

## useHeatmapData

Appelle `POST /datasets/{matrixId}/cluster-heatmap` et lui transmet des listes de gènes explicites
(`up_gene_ids`, `down_gene_ids`, et `sample_ids` quand ils sont fournis, voir `:209-211`).

Le hook découvre lui-même ces gènes, en deux stratégies essayées dans l'ordre :

- **A** — l'endpoint base `/deg-genes/{comparison}` (gère les colonnes préfixées) ;
- **B** — repli sur `/query` (Parquet) pour les jeux de données mono-comparaison historiques.

Les deux bornent la découverte à `padj_max: 0.05` et `logfc_min: 1.0`, **codés en dur** dans le hook
(`:79-80` et `:136-137`). L'appelant n'a donc aujourd'hui aucun moyen d'imposer sa propre liste de
gènes, alors que l'endpoint, lui, l'accepterait.

Le clustering est fait côté serveur : rien n'est calculé dans le navigateur.

## Configuration

`heatmapConfig.ts` porte les hauteurs et marges par point de rupture ainsi que les échelles de
couleur. Les options « Top N » sont dans `TOP_N_OPTIONS`.

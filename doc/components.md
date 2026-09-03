# Composants - GenoLens Frontend

## Vue d'ensemble

Les composants React sont organisés dans `src/components/` avec une structure par domaine fonctionnel. Les primitives de `ui/` sont **écrites à la main** dans le style shadcn, mais le projet n'utilise **ni shadcn/ui ni Radix** : pas de `components.json`, pas de `@radix-ui/*`, pas de `class-variance-authority`. Bibliothèques de visualisation : Recharts, Plotly.js, D3.

---

## Structure des dossiers

```
components/
├── admin/              # Composants d'administration
├── analysis/           # Widgets d'analyse (clustering, enrichment)
├── analyses/           # Hub et résultats d'analyses
├── heatmap/            # Visualisation heatmaps
├── profile/            # Composants profil/subscription
├── tools/              # Outils bioinformatiques
├── ui/                 # Primitives UI écrites à la main (style shadcn, sans Radix)
├── wizard/             # Wizard d'analyse auto-service
│   └── steps/          # Étapes du wizard
└── [composants globaux]
```

---

## Composants UI de base (`ui/`)

Primitives réutilisables, écrites à la main (aucune dépendance Radix) :

| Composant | Usage |
|---|---|
| `badge.tsx` | Badges (statut, tag, plan) |
| `button.tsx` | Boutons (primary, secondary, ghost...) |
| `card.tsx` | Cartes avec header/content/footer |
| `input.tsx` | Champs de saisie textuels |
| `label.tsx` | Labels pour formulaires |
| `select.tsx` | Sélecteurs dropdown |
| `tabs.tsx` | Onglets de navigation |
| `ColorblindToggle.tsx` | Toggle accessibilité daltonisme |

---

## Composants globaux

### Layout & Navigation

| Composant | Description |
|---|---|
| `AppShell` | Wrapper layout (Sidebar + TopBar + content) |
| `Sidebar` | Menu latéral de navigation |
| `TopBar` | Barre supérieure (recherche, quota, profil) |
| `Navbar` | Navigation alternative / mobile |
| `Footer` | Pied de page |

### Dashboard

| Composant | Description |
|---|---|
| `Dashboard` | Page dashboard principale |
| `DashboardKpiBar` | Barre de KPIs (projets, datasets, analyses) |
| `DashboardSubscriptionCard` | Carte d'état abonnement |
| `DashboardWelcomeBanner` | Banner de bienvenue contextuel |
| `RecentProjectsSection` | Section projets récents |

### Projets

| Composant | Description |
|---|---|
| `ProjectHub` | Hub liste des projets |
| `ProjectList` | Liste paginée des projets |
| `ProjectDetail` | Détail d'un projet (vue principale) |
| `ProjectDetailWithQuery` | ProjectDetail avec React Query intégré |
| `ProjectHistory` | Historique d'activité du projet |
| `ProjectStatsDashboard` | Stats avancées du projet |
| `CreateProjectModal` | Modal de création de projet |
| `EditDatasetModal` | Modal d'édition de dataset |
| `ProjectMembersModal` | Gestion des membres du projet |

### Datasets & Upload

| Composant | Description |
|---|---|
| `DatasetExplorer` | Explorateur principal de datasets |
| `DatasetVisualizer` | Visualiseur de données (table + plots) |
| `MetadataTable` | Table des metadata d'un dataset |
| `SampleStatsTable` | Stats par échantillon |

### Analyses bioinformatiques

#### DEG (Differential Expression)

| Composant | Description |
|---|---|
| `DEGTable` | Tableau des gènes différentiellement exprimés |

#### Visualisations scientifiques

| Composant | Description | Bibliothèque |
|---|---|---|
| `VolcanoPlot` | Volcano plot (log2FC vs -log10(p)) | Recharts |
| `PCAPlot` | Analyse en composantes principales | Recharts |
| `UMAPPlot` | Uniform Manifold Approximation | Recharts |
| `EnrichmentPlot` | Plot d'enrichissement | Recharts |
| `EnrichmentHistogram` | Histogramme d'enrichissement | Recharts |
| `EnrichmentRadarPlot` | Radar chart enrichment (Up/Down) | Recharts |
| `GOEnrichmentPlot` | Visualisation GO enrichment | — |
| `GSEAEnrichmentPlot` | Plot de résultat GSEA | Recharts |
| `LibrarySizePlot` | Graphique taille des libraries | Recharts |

#### Enrichment & GO

| Composant | Description |
|---|---|
| `GOEnrichmentAnalysis` | Interface d'analyse GO enrichment |
| `GOEnrichmentTable` | Table des résultats GO enrichment |
| `GSEAAnalysis` | Interface d'analyse GSEA |
| `GSEATable` | Table des résultats GSEA |
| `GOForceGraph` | Graph force-directed des termes GO |
| `GOTreePanel` | Panneau arbre des termes GO |

#### Comparaisons & Venn

| Composant | Description |
|---|---|
| `ComparisonDetail` | Détail d'une comparaison |
| `MultiComparisonVenn` | Diagramme de Venn multi-comparaison |

#### Clustering & Analysis

| Composant | Description |
|---|---|
| `ClusteringAnalysis` | Interface de clustering |
| `EnrichmentAnalysis` | Interface d'enrichissement |

### IA & Chat

| Composant | Description |
|---|---|
| `AIChartAssistant` | Assistant IA pour suggestions de visualisations |
| `AIInterpretationPanel` | Panel d'interprétation IA des résultats |
| `QuotaDisplay` | Affichage du quota AI restant/utilisé |

### Bookmarks & Comments

| Composant | Description |
|---|---|
| `BookmarkButton` | Bouton de bookmark sur un élément |
| `BookmarkManager` | Gestionnaire global de bookmarks |
| `CommentsSection` | Section commentaires d'un projet |
| `CommentThread` | Thread de commentaires imbriqués |
| `CommentEditor` | Éditeur de commentaire (rich text) |

### Export & Utilities

| Composant | Description |
|---|---|
| `ExportMenu` | Menu d'export (PNG, PDF, CSV...) |
| `GeneListManager` | Gestionnaire de listes de gènes |
| `GlobalGeneSearch` | Recherche globale de gènes |
| `GeneExpressionViewer` | Visualiseur d'expression génique |

### Skeletons & Loading

| Composant | Description |
|---|---|
| `Skeletons` | Composants skeleton pour le loading state |

---

## Composants Admin (`admin/`)

| Composant | Description |
|---|---|
| `UserManagement` | Gestion des utilisateurs (liste, rôles) |
| `ProjectManagement` | Gestion de tous les projets |
| `SystemStats` | Métriques système en temps réel |
| `AIUsageLogs` | Logs d'utilisation IA par utilisateur |
| `UserConnections` | Connexions externes des utilisateurs |

---

## Composants Wizard (`wizard/`)

Wizard d'analyse auto-service avec étapes guidées :

| Composant | Description |
|---|---|
| `AnalysisWizard` | Wizard principal (orchestrateur) |
| `WizardStepBar` | Barre de progression des étapes |
| `StepUploadFiles` | Étape 1 — Upload des fichiers |
| `StepDataValidation` | Étape 2 — Validation des données |
| `StepAnalysisSettings` | Étape 3 — Paramètres d'analyse |
| `StepResults` | Étape 4 — Résultats |
| `StepLaunch` | Étape 5 — Lancement de l'analyse |

---

## Composants Analyses (`analyses/`)

| Composant | Description |
|---|---|
| `AnalysesListView` | Liste des analyses d'un projet |
| `AnalysisLauncher` | Lanceur d'analyses (formulaire) |
| `AnalysisResultsHub` | Hub central des résultats |
| `AnalysisStatusCard` | Carte de statut d'une analyse |
| `ComparisonGrid` | Grille de comparaisons DEG |
| `PreprocessingResults` | Résultats du preprocessing |

---

## Composants Heatmap (`heatmap/`)

Logique partagée uniquement — **plus aucun composant de rendu**. Les composants et le baril
`index.ts` ont été supprimés : ils n'étaient atteignables que l'un par l'autre. Voir
`src/components/heatmap/README.md`.

| Fichier | Description |
|---|---|
| `useHeatmapData.ts` | Récupération + clustering serveur (`POST /cluster-heatmap`) |
| `heatmapConfig.ts` | Échelles de couleur, hauteurs par point de rupture, options Top N |
| `types.ts` | `ClusteringParams`, `HeatmapData`, `HeatmapConfig`, `TopNOption` |

Le rendu Plotly vit chez les consommateurs, qui importent **par chemin direct** :
`analysis/DEGClusteringView.tsx` et `analysis/ClusteringAnalysis.tsx`.

---

## Composants Profile (`profile/`)

| Composant | Description |
|---|---|
| `SubscriptionDetails` | Détails de l'abonnement Stripe |

---

## Composants Tools (`tools/`)

| Composant | Description |
|---|---|
| `GoBrowser` | Navigateur GO (interface principale) |
| `PowerAnalysis` | Outil d'analyse de puissance statistique |

---

## Patterns de composants

### 1. Chargement des plots lourds

Les enrobages `*Memo` documentés ici auparavant n'ont jamais été importés et ont été supprimés.
Les deux patterns réellement en vigueur :

**Plotly — toujours en import dynamique**, sinon le rendu serveur casse (`window` au montage) :

```tsx
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });
```

**Recharts — `isAnimationActive={false}` obligatoire.** recharts 3.6 + React 19 bloque l'animation
et laisse des échardes de 1 px :

```tsx
<Bar dataKey="value" isAnimationActive={false} />
```

### 2. Props pattern pour les visualisations

Tous les composants de visualisation suivent un pattern de props cohérent :

```tsx
interface BasePlotProps {
  data: PlotData[];           // Données à afficher
  loading?: boolean;          // État de chargement
  error?: string | null;      // Message d'erreur
  onPointClick?: (point: PlotData) => void;  // Callback au clic
  onHover?: (point: PlotData | null) => void; // Callback au survol
  width?: number;             // Largeur du plot
  height?: number;            // Hauteur du plot
  theme?: 'light' | 'dark';   // Thème clair/sombre
}
```

### 3. Error Boundary

Les composants complexes sont enveloppés dans un `ErrorBoundary` :

```tsx
// app/layout.tsx
<ErrorBoundary>
  <QueryProvider>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </QueryProvider>
</ErrorBoundary>
```

### 4. Skeleton loading pattern

Les composants utilisent des skeletons pendant le chargement :

```tsx
// Dans un composant avec useQuery
const { data, isLoading } = useDatasets(projectId);

if (isLoading) return <Skeletons.DatasetList />;
if (!data?.length) return <EmptyState>No datasets</EmptyState>;

return <DatasetExplorer datasets={data} />;
```

---

## Dépendances entre composants

```
AppShell
├── Sidebar
│   └── RecentProjectsSection (useProjects hook)
├── TopBar
│   ├── GlobalGeneSearch (useGeneSearch hook)
│   ├── QuotaDisplay (useSubscription hook)
│   └── UserMenu
│
└── main content
    ├── Dashboard
    │   ├── DashboardKpiBar
    │   ├── RecentProjectsSection
    │   └── DashboardSubscriptionCard
    │
    ├── ProjectDetail
    │   ├── DatasetExplorer
    │   │   ├── DatasetList
    │   │   └── UploadButton
    │   ├── AnalysisResultsHub
    │   │   ├── DEGTable / DEGTableMemo
    │   │   ├── EnrichmentPlot
    │   │   ├── GSEATable
    │   │   └── GOEnrichmentTable
    │   ├── VisualizationPanel
    │   │   ├── PCAPlot
    │   │   ├── UMAPPlot
    │   │   ├── VolcanoPlot
    │   │   └── DEGClusteringView
    │   ├── AIChartAssistant
    │   └── CommentsSection
    │       └── CommentThread
    │
    ├── AdminPanel
    │   ├── UserManagement
    │   ├── ProjectManagement
    │   └── SystemStats
    │
    └── AnalysisWizard
        ├── StepUploadFiles
        ├── StepDataValidation
        ├── StepAnalysisSettings
        ├── StepResults
        └── StepLaunch
```

---

## Ajout d'un nouveau composant

### Checklist

1. **Emplacement** : Placer dans le dossier approprié (`components/`)
2. **Nomination** : PascalCase, descriptif (ex: `GeneExpressionViewer.tsx`)
3. **Types** : Définir les props avec TypeScript interfaces
4. **Memoization** : Si le composant est lourd (plots), utiliser `memo`
5. **Skeletons** : Prévoir un état de chargement
6. **Error handling** : Gérer les états d'erreur
7. **Export** : Ajouter dans l'index barrel si nécessaire (`index.ts`)

### Template de composant

```tsx
'use client';

import React from 'react';

interface MyComponentProps {
  data: SomeType[];
  loading?: boolean;
  error?: string | null;
  onAction?: (item: SomeType) => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ 
  data, 
  loading = false, 
  error = null,
  onAction 
}) => {
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div className="my-component">
      {data.map((item) => (
        <button key={item.id} onClick={() => onAction?.(item)}>
          {item.name}
        </button>
      ))}
    </div>
  );
};

export default MyComponent;
```
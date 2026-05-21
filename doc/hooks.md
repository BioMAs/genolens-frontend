# Hooks personnalisés - GenoLens Frontend

## Vue d'ensemble

Les hooks React sont situés dans `src/hooks/` et encapsulent toute la logique de data fetching, mutation et état côté client via **TanStack Query** (React Query).

---

## Architecture des hooks

Tous les hooks suivent un pattern cohérent :

```tsx
// 1. Import des dépendances
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/utils/api';

// 2. Hook de lecture (query)
export function useXxx() {
  return useQuery({
    queryKey: ['xxx'],
    queryFn: () => api.get('/endpoint').then(r => r.data),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

// 3. Hook de mutation (write)
export function useCreateXxx() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post('/endpoint', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xxx'] });
    },
  });
}

// 4. Hook combiné (optionnel)
export function useXxxManager() {
  const query = useXxx();
  const mutation = useCreateXxx();
  
  return { ...query, ...mutation };
}
```

---

## Liste des hooks

### `useProjects.ts` — Gestion des projets

**Query keys** : `['projects']`, `['project', id]`

| Fonction | Type | Description |
|---|---|---|
| `useProjects()` | Query | Liste paginée des projets de l'utilisateur |
| `useProject(id)` | Query | Détails d'un projet spécifique |
| `useCreateProject()` | Mutation | Créer un nouveau projet |
| `useUpdateProject()` | Mutation | Mettre à jour un projet |
| `useDeleteProject()` | Mutation | Supprimer un projet |

**Exemple d'utilisation** :
```tsx
const { data: projects, isLoading } = useProjects();
const createMutation = useCreateProject();

// Créer un projet
createMutation.mutate({ name: 'My Project', species: 'homo_sapiens' });
```

---

### `useDatasets.ts` — Gestion des datasets

**Query keys** : `['datasets', projectId]`, `['dataset', id]`

| Fonction | Type | Description |
|---|---|---|
| `useDatasets(projectId)` | Query | Liste des datasets d'un projet |
| `useDataset(id)` | Query | Détails d'un dataset |
| `useUploadDataset()` | Mutation | Upload un fichier (CSV/TSV/XLSX) |
| `useDeleteDataset()` | Mutation | Supprimer un dataset |

**Exemple d'utilisation** :
```tsx
const { data: datasets } = useDatasets(projectId);
const uploadMutation = useUploadDataset();

// Upload un fichier
const formData = new FormData();
formData.append('file', file);
uploadMutation.mutate({ projectId, file: formData });
```

---

### `useAnalyses.ts` — Gestion des analyses

**Query keys** : `['analyses', projectId]`, `['analysis', id]`

| Fonction | Type | Description |
|---|---|---|
| `useAnalyses(projectId)` | Query | Liste des analyses d'un projet |
| `useAnalysis(id)` | Query | Résultats d'une analyse spécifique |
| `useRunDegAnalysis()` | Mutation | Lancer une analyse différentielle (DESeq2) |
| `useRunGseaAnalysis()` | Mutation | Lancer une analyse GSEA |
| `useRunGoEnrichment()` | Mutation | Lancer un enrichissement GO |

**Polling du statut** :
```tsx
const { data: analysis, refetch } = useAnalysis(analysisId);

// Polling toutes les 5 secondes pendant le running
useEffect(() => {
  if (analysis?.status === 'running') {
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }
}, [analysis?.status]);
```

---

### `useBookmarks.ts` — Gestion des bookmarks

**Query keys** : `['bookmarks']`, `['bookmark', id]`

| Fonction | Type | Description |
|---|---|---|
| `useBookmarks()` | Query | Liste de tous les bookmarks |
| `useCreateBookmark()` | Mutation | Créer un bookmark |
| `useDeleteBookmark()` | Mutation | Supprimer un bookmark |

---

### `useComments.ts` — Gestion des commentaires

**Query keys** : `['comments', projectId]`, `['comment', id]`

| Fonction | Type | Description |
|---|---|---|
| `useComments(projectId)` | Query | Commentaires d'un projet |
| `useCreateComment()` | Mutation | Ajouter un commentaire |
| `useUpdateComment()` | Mutation | Modifier un commentaire |
| `useDeleteComment()` | Mutation | Supprimer un commentaire |

---

### `useCurrentUser.ts` — Info utilisateur courant

**Query keys** : `['user', 'current']`

| Fonction | Type | Description |
|---|---|---|
| `useCurrentUser()` | Query | Informations de l'utilisateur connecté |
| `useUpdateProfile()` | Mutation | Mettre à jour le profil |

---

### `useSubscription.ts` — État abonnement Stripe

**Query keys** : `['subscription', userId]`

| Fonction | Type | Description |
|---|---|---|
| `useSubscription()` | Query | Plan actuel, statut, dates de cycle |
| `useCreateCheckout()` | Mutation | Créer une session checkout Stripe |
| `useCreatePortalSession()` | Mutation | Session portal client Stripe |

**Valeurs retournées** :
```tsx
interface SubscriptionInfo {
  plan: 'free' | 'premium' | 'advanced';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}
```

---

### `useBilling.ts` — Facturation

**Query keys** : `['billing', userId]`

| Fonction | Type | Description |
|---|---|---|
| `useBillingHistory()` | Query | Historique des factures |
| `useUpdatePaymentMethod()` | Mutation | Mettre à jour le moyen de paiement |

---

### `useGeneSearch.ts` — Recherche de gènes

**Query keys** : `['gene-search', query]`

| Fonction | Type | Description |
|---|---|---|
| `useGeneSearch(query)` | Query | Recherche de gènes par nom/symbole |
| `useValidateGeneList()` | Mutation | Valider une liste de symboles de gènes |

**Exemple d'utilisation** :
```tsx
const { data: genes, isLoading } = useGeneSearch('TP53');
// Retourne: [{ id, symbol, name, species }, ...]
```

---

### `useComparisons.ts` — Comparaisons DEG

**Query keys** : `['comparisons', projectId]`, `['comparison', id]`

| Fonction | Type | Description |
|---|---|---|
| `useComparisons(projectId)` | Query | Liste des comparaisons DEG |
| `useGetComparison(id)` | Query | Détails d'une comparaison |
| `useCreateComparison()` | Mutation | Créer une nouvelle comparaison |

---

### `useVisualizations.ts` — Données pour les visualisations

**Query keys** : `['viz', type, datasetId]`, `['viz', 'deg-data', analysisId]`

| Fonction | Type | Description |
|---|---|---|
| `useDegData(analysisId)` | Query | Données DEG pour volcano plot |
| `usePcaData(datasetId)` | Query | Données PCA |
| `useUmapData(datasetId)` | Query | Données UMAP |
| `useClusteringData(datasetId, method)` | Query | Données de clustering |
| `useHeatmapData(datasetId, genes?)` | Query | Données heatmap |

---

### `useChartAI.ts` — Assistant IA pour visualisations

**Query keys** : `['ai-chat', conversationId]`, `['ai-suggestions', analysisType]`

| Fonction | Type | Description |
|---|---|---|
| `useAiChat(conversationId?)` | Mutation/Query | Conversation avec l'IA (streaming SSE) |
| `useAiSuggestions(analysisType)` | Query | Suggestions de visualisations IA |
| `useGetQuota()` | Query | Quota AI restant |

**Exemple d'utilisation (streaming)** :
```tsx
const { data: messages, append } = useAiChat();

// Envoyer un message et recevoir le streaming
append({ role: 'user', content: 'Interprète les résultats DEG' });
```

---

### `useProjectData.ts` — Données projet combinées

**Query keys** : `['project-data', projectId]`

| Fonction | Type | Description |
|---|---|---|
| `useProjectData(projectId)` | Query | Toutes les données d'un projet (projets, datasets, analyses) en une requête |

**Optimisation** : Combine plusieurs queries en un seul hook pour réduire le nombre de fetchs.

---

### `useProjectHistory.ts` — Historique du projet

**Query keys** : `['project-history', projectId]`

| Fonction | Type | Description |
|---|---|---|
| `useProjectHistory(projectId)` | Query | Journal d'activité du projet |

---

### `useProjectMembers.ts` — Membres du projet

**Query keys** : `['project-members', projectId]`

| Fonction | Type | Description |
|---|---|---|
| `useProjectMembers(projectId)` | Query | Liste des membres d'un projet |
| `useAddMember()` | Mutation | Ajouter un membre au projet |
| `useRemoveMember()` | Mutation | Retirer un membre du projet |

---

### `useProjectDashboardStats.ts` — Stats dashboard projet

**Query keys** : `['project-stats', projectId]`

| Fonction | Type | Description |
|---|---|---|
| `useProjectDashboardStats(projectId)` | Query | KPIs du projet (counts, tailles, etc.) |

---

### `useUserDashboardStats.ts` — Stats dashboard utilisateur

**Query keys** : `['user-stats']`

| Fonction | Type | Description |
|---|---|---|
| `useUserDashboardStats()` | Query | KPIs globaux de l'utilisateur (total projets, datasets, analyses) |

---

### `useLoginStats.ts` — Stats de connexion

**Query keys** : `['login-stats']`

| Fonction | Type | Description |
|---|---|---|
| `useLoginStats()` | Query | Historique des connexions (dates, IPs) |

---

### `useSavedFilters.ts` — Filtres sauvegardés

**State local** (useState, pas de query)

| Fonction | Type | Description |
|---|---|---|
| `useSavedFilters(key)` | State | Persistance des filtres dans localStorage |

**Exemple d'utilisation** :
```tsx
const { filters, setFilter, clearFilters } = useSavedFilters('deg-table');
// Les filtres persistent entre les sessions
```

---

## Patterns avancés

### 1. Polling pour les analyses en cours

```tsx
function useAnalysisStatus(analysisId: string) {
  const { data, refetch } = useQuery({
    queryKey: ['analysis-status', analysisId],
    queryFn: () => api.get(`/analyses/${analysisId}`).then(r => r.data),
    // Refetch toutes les 5 secondes si l'analyse est en cours
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 5000 : false;
    },
  });
  
  return data;
}
```

### 2. Optimistic updates pour les mutations

```tsx
const deleteMutation = useDeleteDataset();

deleteMutation.mutate(datasetId, {
  // Mise à jour optimiste immédiate
  onMutate: async (datasetId) => {
    await queryClient.cancelQueries({ queryKey: ['datasets', projectId] });
    const previous = queryClient.getQueryData(['datasets', projectId]);
    
    // Retirer le dataset du cache immédiatement
    queryClient.setQueryData(
      ['datasets', projectId],
      (old) => old.filter(d => d.id !== datasetId)
    );
    
    return { previous };
  },
  
  // Rollback en cas d'erreur
  onError: (err, datasetId, context) => {
    queryClient.setQueryData(
      ['datasets', projectId],
      context.previous
    );
  },
});
```

### 3. Prefetching pour la navigation rapide

```tsx
// Dans un composant parent ou un link prefetch
import { prefetchQuery } from '@tanstack/react-query';

async function navigateToProject(id: string) {
  // Pré-charger les données avant que le composant ne monte
  await Promise.all([
    prefetchQuery({ queryKey: ['project', id], queryFn: ... }),
    prefetchQuery({ queryKey: ['datasets', id], queryFn: ... }),
    prefetchQuery({ queryKey: ['analyses', id], queryFn: ... }),
  ]);
  
  router.push(`/projects/${id}`);
}
```

### 4. Query invalidation groupée

```tsx
const invalidateProjectQueries = (projectId: string) => {
  queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  queryClient.invalidateQueries({ queryKey: ['datasets', projectId] });
  queryClient.invalidateQueries({ queryKey: ['analyses', projectId] });
  queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
};
```

---

## Configuration TanStack Query

Fichier : `src/lib/queryClient.ts`

```tsx
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 min - données "fraîches"
      gcTime: 1000 * 60 * 5,       // 5 min - cache存活 (formerly cacheTime)
      refetchOnWindowFocus: false,  // Ne pas re-fetch au focus
      refetchOnMount: false,        // Ne pas re-fetch si données existantes
      retry: 1,                     // Une seule tentative en cas d'erreur
    },
  },
});
```

---

## Dépendances entre hooks

```
useProjectData (combiné)
├── useProjects()
├── useDatasets(projectId)
├── useAnalyses(projectId)
└── useProjectDashboardStats(projectId)

useAnalysisResults(analysisId)
├── useAnalysis(analysisId)
├── useDegData(analysisId)
├── usePcaData(datasetId)
├── useUmapData(datasetId)
└── useHeatmapData(datasetId, genes)

useProjectDetail(projectId)
├── useProject(id)
├── useDatasets(projectId)
├── useAnalyses(projectId)
├── useComments(projectId)
├── useProjectMembers(projectId)
└── useProjectHistory(projectId)
```

---

## Testing des hooks

Les hooks sont testés avec `@testing-library/react-hooks` :

```tsx
// hooks/__tests__/useProjects.test.tsx
import { renderHook } from '@testing-library/react-hooks';
import { useProjects } from '../useProjects';

describe('useProjects', () => {
  it('returns projects when API succeeds', async () => {
    const { result, waitFor } = renderHook(() => useProjects());
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.data).toHaveLength(3);
  });
  
  it('handles error state', async () => {
    // Mock API error...
  });
});
```
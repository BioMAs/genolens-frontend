# Architecture Frontend - GenoLens

## 1. Vue d'ensemble architecturale

Le frontend suit l'architecture **App Router** de Next.js avec une séparation claire entre composants serveur et client.

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              Next.js App Router                 │  │
│  │                                                 │  │
│  │  ┌──────────┐  ┌─────────────┐  ┌──────────┐  │  │
│  │  │ Server   │  │  Client     │  │  Layout  │  │  │
│  │  │ Comp.    │→│  Components │←│ Wrappers │  │  │
│  │  │ (data)   │  │  (UI/State) │  │          │  │  │
│  │  └──────────┘  └─────────────┘  └──────────┘  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ TanStack     │  │ Supabase     │  │ Axios     │  │
│  │ Query        │  │ Auth         │  │ Client    │  │
│  │ (cache/data) │  │ (session)    │  │ (HTTP)    │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└──────────────────────────────────────────────────────┘
                        ↕ HTTPS
┌──────────────────────────────────────────────────────┐
│              GenoLens Backend API                     │
│         (FastAPI - localhost:8000)                    │
└──────────────────────────────────────────────────────┘
```

## 2. Patterns de conception utilisés

### 2.1 Server Components / Client Components

**Server Components** (par défaut dans App Router) :
- Pages qui fetchent des données depuis le backend
- Layouts racine (QueryProvider, ThemeProvider)
- Composants qui ne nécessitent pas d'interactivité client

```tsx
// Server Component - fetch data server-side
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  return <Dashboard />; // Client component receives props
}
```

**Client Components** (`'use client'`) :
- Composants avec state, effects, event handlers
- Intégration Supabase client
- Visualisations interactives (Recharts, Plotly)

```tsx
'use client';

import { useState } from 'react';

export default function DatasetExplorer() {
  const [filter, setFilter] = useState('');
  // ... interactive logic
}
```

### 2.2 TanStack Query (React Query)

Toute la data fetching passe par React Query pour le caching, la refetch et les mutations :

```tsx
// hooks/useProjects.ts
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ProjectCreate) => api.post('/projects', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
```

### 2.3 Provider Pattern

Les providers sont empilés dans le layout racine :

```tsx
// app/layout.tsx
export default async function RootLayout({ children }) {
  const user = await getUser(); // Server component
  
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <QueryProvider>           {/* TanStack Query */}
            <ThemeProvider>        {/* Dark/Light mode */}
              {user ? (
                <AppShell user={user}>
                  {children}
                </AppShell>
              ) : (
                <main>{children}</main>
              )}
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

### 2.4 Custom Hooks Pattern

La logique métier côté client est encapsulée dans des hooks réutilisables :

```
useProjects()       → CRUD projets
useDatasets()       → CRUD datasets
useAnalyses()       → Lancement & suivi analyses
useVisualizations() → Data pour les plots
useCurrentUser()    → Info utilisateur courant
useSubscription()   → État abonnement Stripe
useBookmarks()      → Gestion bookmarks
```

### 2.5 Component Composition

Les composants complexes sont composés de sous-composants :

```
ProjectDetail (page)
├── ProjectHeader
├── DatasetExplorer
│   ├── DatasetList
│   └── UploadButton
├── AnalysisResultsHub
│   ├── DEGTable
│   │   └── DEGTableMemo (memoized)
│   ├── EnrichmentPlot
│   │   └── EnrichmentPlotMemo (memoized)
│   └── GSEATable
├── VisualizationPanel
│   ├── PCAPlot
│   ├── UMAPPlot
│   ├── VolcanoPlot
│   └── HeatmapVisualization
├── AIChartAssistant
└── CommentsSection
    └── CommentThread
```

## 3. Flux de données typique

### Chargement d'une page projet

```
1. Server Component (page.tsx)
   ├─► createClient() → Supabase server auth
   ├─► redirect si non authentifié
   └─► Rend le composant client avec user en prop

2. Client Component (ProjectDetail.tsx)
   ├─► useProjects(id) → React Query fetch
   │   └─► api.get('/projects/{id}')
   │       └─► axios interceptor ajoute Bearer token
   │           └─► Backend valide JWT Supabase
   │
   ├─► useDatasets(projectId) → React Query fetch
   │   └─► api.get('/projects/{id}/datasets')
   │
   └─► Rend le JSX avec les données

3. React Query cache
   ├─► staleTime: 2 min (données "fraîches")
   ├─► gcTime: 5 min (cache存活)
   ├─► retry: 1 (une seule tentative)
   └─► Invalidation automatique sur mutation
```

### Upload d'un dataset

```
Client Component (DatasetExplorer.tsx)
├─► User sélectionne un fichier
├─► FormData.append('file', file)
├─► api.post('/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
├─► axios interceptor ajoute Bearer token automatiquement
├─► Backend :
│   ├─► Validation (taille, extension)
│   ├─► Parsing CSV/TSV/XLSX → Parquet
│   ├─► Upload Supabase Storage
│   └─► Celery task: ingest_dataset.delay()
└─► React Query invalidate datasets cache
```

### Analyse bioinformatique (DEG)

```
Client Component (AnalysisLauncher.tsx)
├─► User configure les paramètres
├─► api.post('/analyses/differential-expression', {
      dataset_ids: [...],
      comparison: { group1, group2 },
      species: 'homo_sapiens',
    })
├─► Backend :
│   ├─► Vérification quota AI/abonnement Stripe
│   ├─► Création AnalysisRun (provenance)
│   └─► Celery task: run_deseq_analysis.delay()
└─► Polling du statut via React Query
    └─► useQuery({ queryFn: ..., refetchInterval: 5000 })
        └─► Affichage spinner → résultats
```

## 4. Architecture des hooks

### Pattern de base

```tsx
// hooks/useXxx.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/utils/api';

export function useXxx() {
  // Query pour la lecture
  const query = useQuery({
    queryKey: ['xxx'],
    queryFn: () => api.get('/endpoint').then(r => r.data),
  });
  
  // Mutation pour l'écriture
  const mutation = useMutation({
    mutationFn: (data) => api.post('/endpoint', data),
    onSuccess: () => {
      // Invalidate les queries concernées
    },
  });
  
  return { query, mutation };
}
```

### Exemple complet : useAnalyses

```tsx
export function useAnalyses(projectId: string) {
  // Liste des analyses du projet
  const { data: analyses, isLoading } = useQuery({
    queryKey: ['analyses', projectId],
    queryFn: () => api.get(`/analyses/project/${projectId}`).then(r => r.data),
  });
  
  // Lancer une nouvelle analyse
  const runAnalysis = useMutation({
    mutationFn: (params) => 
      api.post('/analyses/differential-expression', params),
    onSuccess: (_, variables) => {
      // Polling du statut
      pollAnalysisStatus(variables.analysis_id);
    },
  });
  
  return { analyses, isLoading, runAnalysis };
}
```

## 5. Système de routing

### Routes principales

| Route | Page | Auth requise | Type |
|---|---|---|---|
| `/` | Home / Login | Non (redirect si auth) | Server → Client |
| `/dashboard` | Dashboard principal | Oui | Server → Client |
| `/projects` | Liste des projets | Oui | Server → Client |
| `/projects/[id]` | Détail d'un projet | Oui | Server → Client |
| `/projects/[id]/analyses` | Hub analyses | Oui | Server → Client |
| `/tools/ontology` | Browser GO | Oui | Client |
| `/tools/power-analysis` | Power analysis | Oui | Client |
| `/admin/*` | Panel admin | Admin role | Server → Client |
| `/pricing` | Page tarifaire | Non | Server |
| `/profile` | Profil utilisateur | Oui | Server → Client |
| `/auth/callback` | Callback auth Supabase | Non | Server |

### Dynamic Routes

```
/projects/[id]              → Détail projet
/projects/[id]/datasets     → Datasets du projet
/projects/[id]/analyses     → Analyses du projet
/projects/[id]/settings     → Paramètres du projet
```

## 6. Gestion d'état

### État global (React Query)

Toutes les données serveur sont gérées par React Query :

```tsx
// Cache keys convention
['projects']                    // Tous les projets
['projects', projectId]         // Projet spécifique
['datasets', projectId]         // Datasets d'un projet
['analyses', projectId]         // Analyses d'un projet
['user', userId]                // Info utilisateur
['subscription', userId]        // Abonnement
['bookmarks']                   // Bookmarks utilisateur
```

### État local (useState, useReducer)

- Filtres de tableaux (DEGTable)
- États de formulaires
- Modals et overlays
- Sélection d'éléments

### Context API

| Context | Usage |
|---|---|
| `ThemeContext` | Dark/Light mode global |

## 7. Middleware Next.js

Le middleware gère l'authentification au niveau du router :

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(...);
  const { data: { user } } = await supabase.auth.getUser();
  
  // Redirect authenticated users from home to dashboard
  if (user && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

// Matcher : toutes les routes sauf static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png)$).*)'],
};
```

## 8. Performance optimizations

### Memoization des composants lourds

```tsx
// VolcanoPlotMemo.tsx — évite les re-renders inutiles
const VolcanoPlot = memo(({ data, options }) => {
  return <PlotlyComponent ... />;
});

// PCAPlotMemo.tsx
const PCAPlot = memo(({ data }) => {
  return <RechartsChart ... />;
});
```

### React Query caching

```tsx
queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,  // 2 min - données fraîches
      gcTime: 5 * 60 * 1000,     // 5 min - cache存活
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Server Components pour le data fetching initial

Les pages fetchent les données côté serveur avant de hydrater le client :

```tsx
// Réduit le temps de chargement perçu
export default async function DashboardPage() {
  const projects = await getProjects(); // Server fetch
  return <Dashboard initialProjects={projects} />;
}
```

## 9. Sécurité côté frontend

### Token management

Le token Supabase JWT est automatiquement ajouté par l'interceptor Axios :

```typescript
api.interceptors.request.use(async (config) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
```

### Validation côté client

- Schémas de validation des formulaires (React Hook Form / Zod)
- Vérification du rôle admin avant d'afficher les pages admin
- Contrôle d'accès aux datasets via le projet parent

## 10. Design System

Le design system est basé sur :
- **Tailwind CSS v4** avec variables CSS custom pour theming
- **shadcn/ui** pour les composants de base (button, card, input...)
- **Polices** : Syne (display), DM Sans (body), Geist Mono (code)

### Variables CSS principales

```css
:root {
  --sl-purple: #6B21A8;      /* Couleur principale */
  --sl-teal: #0D9488;        /* Accent */
  --text-primary: #1a1a2e;   /* Texte principal */
  --surface: #ffffff;        /* Fond des surfaces */
}

.dark {
  --sl-purple: #9333EA;
  --text-primary: #f0f0f0;
  --surface: #1a1a2e;
}
```
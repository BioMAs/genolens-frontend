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
│  │ TanStack     │  │ Session      │  │ Axios     │  │
│  │ Query        │  │ cookies      │  │ Client    │  │
│  │ (cache/data) │  │ (httpOnly)   │  │ (HTTP)    │  │
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
  // Lit le cookie gl_at et le vérifie localement (aucun appel réseau)
  if (!(await getSessionUser())) redirect('/');

  return <Dashboard />; // Client component
}
```

**Client Components** (`'use client'`) :
- Composants avec state, effects, event handlers
- Formulaires d'authentification (appels via `src/utils/auth/client.ts`)
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
   ├─► getSessionUser() → cookie gl_at vérifié localement
   ├─► redirect si non authentifié
   └─► Rend le composant client

2. Client Component (ProjectDetail.tsx)
   ├─► useProjects(id) → React Query fetch
   │   └─► api.get('/projects/{id}')
   │       └─► le navigateur joint les cookies de session
   │           └─► Backend valide le jeton d'accès (gl_at)
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
├─► les cookies de session sont joints automatiquement
├─► Backend :
│   ├─► Validation (taille, extension)
│   ├─► Parsing CSV/TSV/XLSX → Parquet
│   ├─► Stockage du fichier (Parquet)
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
| `/` | Connexion en deux étapes (mot de passe, puis code) et inscription | Non (redirect si connecté) | Server → Client |
| `/dashboard` | Dashboard principal | Oui | Server → Client |
| `/projects` | Liste des projets | Oui | Server → Client |
| `/projects/[id]` | Détail d'un projet | Oui | Server → Client |
| `/projects/[id]/analyses` | Hub analyses | Oui | Server → Client |
| `/tools/ontology` | Browser GO | Oui | Client |
| `/tools/power-analysis` | Power analysis | Oui | Client |
| `/admin/*` | Panel admin | Admin role | Server → Client |
| `/pricing` | Page tarifaire | Non | Server |
| `/profile` | Profil utilisateur | Oui | Server → Client |
| `/auth/2fa/setup` | Enrôlement de la double authentification | Étape de connexion en cours | Client |
| `/auth/forgot`, `/auth/reset` | Demande puis choix d'un nouveau mot de passe | Non | Client |
| `/auth/invite` | Acceptation d'une invitation | Non | Client |
| `/auth/verify-email` | Confirmation de l'adresse e-mail | Non | Client |
| `/auth/refresh` | Renouvellement silencieux de la session | Non | Client |
| `/auth/callback` | Anciens liens : redirige vers `/` | Non | Route |

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

Le middleware (`src/middleware.ts`) garde les pages au niveau du router. Une session est le cookie `gl_at`, **vérifié localement** par `verifyAccessToken` (`src/utils/auth/jwt.ts`) avec les clés publiques de l'API (`AUTH_JWKS_URL`) : pas d'appel à l'API à chaque requête, seulement la récupération des clés, mise en cache. Un jeton n'est accepté que s'il est signé en ES256, émis par `AUTH_ISSUER`, destiné à `genolens`, non expiré, et si son `amr` contient `otp` ou `recovery` (une session sans second facteur n'est pas une session).

Décisions, dans l'ordre :

1. Un compte signalé inactif (cookie `account_status`) va sur `/suspended`.
2. Les pages ouvertes depuis un lien reçu par e-mail (`/auth/reset`, `/auth/invite`, `/auth/verify-email`) reçoivent `Referrer-Policy: no-referrer` et `Cache-Control: no-store`, rien d'autre : le jeton voyage dans l'URL.
3. Le jeton d'accès est vérifié, ou absent.
4. `/` est la page de connexion : avec une session, le visiteur est envoyé vers `next` (`/dashboard` par défaut) ; avec le seul indice `gl_session`, la session est d'abord renouvelée ; sinon le formulaire s'affiche.
5. Toute autre page publique (`isPublicPath`) est servie.
6. Une page protégée est servie avec une session. Sans jeton valide mais avec l'indice `gl_session`, le visiteur passe par `/auth/refresh?next=…` ; sans rien, il est renvoyé vers `/?next=…`.

### Renouvellement silencieux

Le jeton d'accès dure 15 minutes. `/auth/refresh` appelle `POST /auth/refresh` (`refreshSession`) puis renvoie le visiteur vers sa destination par navigation complète. Si le renouvellement échoue, le visiteur arrive sur `/?reauth=1` : ce paramètre indique au middleware de montrer le formulaire au lieu de renvoyer `/` vers `/auth/refresh`, ce qui évite une boucle quand l'API est injoignable alors que l'indice est encore là. Un renouvellement qui vient de réussir sans que le nouveau jeton soit vérifiable ici (mauvais `AUTH_ISSUER` ou `AUTH_JWKS_URL`, domaine de cookie qui ne couvre pas cet hôte) laisse le cookie `gl_renewed` pendant 30 secondes : ni le middleware ni la page `/auth/refresh` ne renouvellent une seconde fois, et le visiteur retrouve le formulaire de connexion (le serveur journalise de quoi vérifier ces deux variables).

### Destination après connexion

`next` ne passe que par `safeNext` (`src/utils/auth/paths.ts`) : un chemin relatif, ou une URL absolue dont l'origine est exactement `NEXT_PUBLIC_ADMIN_APP_URL`. Tout le reste (`//hôte`, `https://hôte`, `\hôte`, `javascript:`, caractères de contrôle) est ignoré au profit de `/dashboard`.

### Matcher

```typescript
// Toutes les routes sauf les assets de build et les fichiers statiques,
// reconnus par leur extension
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpe?g|gif|webp|svg|txt|xml|webmanifest|js|css|map|woff2?)$).*)'],
};
```

### Côté serveur

Le layout racine (`src/app/layout.tsx`) appelle `getServerUser()` (`src/utils/auth/server.ts`) pour choisir la coquille de la page : l'application avec sa navigation pour un utilisateur connecté, la coquille nue des pages d'authentification sinon. C'est le seul endroit où le serveur Next envoie `Authorization: Bearer <gl_at>`, vers `/users/me` ; l'appel a un délai de 5 secondes et n'est jamais mis en cache. Le layout n'étant pas re-rendu par une navigation côté client, tout changement de session (connexion, enrôlement, renouvellement, déconnexion) se termine par une navigation complète, via `src/utils/auth/navigation.ts`.

### Pages d'authentification

Les écrans partagés vivent dans `src/components/auth/` (`AuthShell`, `AuthCard`, `AuthField`, `MfaChallengeForm`, `TotpEnrollment`, `RecoveryCodesPanel`, `NewPasswordForm`...). Les appels d'avant session passent par `src/utils/auth/client.ts` ; la section « Sécurité » du profil (mot de passe, double authentification, sessions) passe par les hooks React Query de `src/hooks/useAccountSecurity.ts`. Voir [pages-routes.md](pages-routes.md) et [api-client.md](api-client.md).

---

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

### Gestion de la session

Le navigateur ne lit et n'envoie jamais de jeton. La session est portée par des cookies httpOnly que l'API pose (`gl_at`, `gl_rt`, `gl_mfa`) et un indice lisible (`gl_session`) ; chaque appel à l'API les joint (`withCredentials: true` pour axios, `credentials: 'include'` pour `fetch`) et porte l'en-tête `X-GenoLens-Client: web`, garde anti-CSRF exigée par l'API :

```typescript
const api = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    [CLIENT_HEADER]: CLIENT_NAME, // X-GenoLens-Client: web
  },
});
```

Une réponse « déconnecté » (`401`) renouvelle la session une fois et rejoue la requête ; voir [api-client.md](api-client.md).

La double authentification (TOTP) est obligatoire : un compte sans second facteur est envoyé vers `/auth/2fa/setup` à sa première connexion, et le middleware refuse tout jeton dont l'`amr` ne contient ni `otp` ni `recovery`.

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
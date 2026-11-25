# API Client - GenoLens Frontend

## Vue d'ensemble

Le client API est basé sur **Axios** et est configuré dans `src/utils/api.ts`. La session est portée par des **cookies que l'API pose elle-même** : le navigateur les joint à chaque requête, et le code qui s'exécute dans le navigateur ne lit et n'envoie jamais de jeton. Le client gère aussi le renouvellement silencieux de la session, la gestion des erreurs et la sanitization de l'URL de base.

---

## Configuration

### Fichier : `src/utils/api.ts`

```typescript
import axios from 'axios';
import { apiBaseUrl } from '@/utils/auth/client';
import { CLIENT_HEADER, CLIENT_NAME } from '@/utils/auth/constants';

const api = axios.create({
  baseURL: apiBaseUrl(),   // NEXT_PUBLIC_API_URL sans slash final
  withCredentials: true,   // le navigateur joint les cookies de session
  headers: {
    'Content-Type': 'application/json',
    [CLIENT_HEADER]: CLIENT_NAME, // X-GenoLens-Client: web
  },
});
```

`apiBaseUrl()` (dans `src/utils/auth/client.ts`) retire le slash final de `NEXT_PUBLIC_API_URL` pour éviter les doubles slashes, et retombe sur `http://localhost:8000/api/v2` si la variable est vide.

### Variables d'environnement

| Variable | Description | Lue | Défaut |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de l'API backend | navigateur (inlinée au build) | `http://localhost:8000/api/v2` |
| `AUTH_JWKS_URL` | Clés publiques de l'API (`/auth/jwks.json`) | serveur Next et middleware, à l'exécution | — |
| `AUTH_ISSUER` | Valeur attendue du `iss` des jetons | serveur Next et middleware, à l'exécution | — |
| `NEXT_PUBLIC_ADMIN_APP_URL` | Origine de l'app d'administration, seule URL absolue admise pour `?next=` | navigateur (inlinée au build) | — |

Valeurs de développement : `http://localhost:8001/api/v1`, `http://localhost:8001/api/v1/auth/jwks.json`, `http://localhost:8001` et `http://localhost:3001`.

---

## Transport par cookies (authentification)

### Les cookies

L'API pose les cookies de session à la connexion et les renouvelle. Le code du navigateur n'en lit aucun, à l'exception de l'indice `gl_session` (`hasSessionHint`) ; le middleware et le serveur Next lisent `gl_at` et `gl_session` dans la requête.

| Cookie | Portée | Rôle |
|---|---|---|
| `gl_at` | httpOnly, domaine parent en production, 15 min | Jeton d'accès (JWT ES256) |
| `gl_rt` | httpOnly, hôte de l'API seulement, chemin `/api/v1/auth` | Jeton de renouvellement |
| `gl_session=1` | lisible en JavaScript, même domaine que `gl_at` | Indice qu'une session existe |
| `gl_mfa` | httpOnly, hôte de l'API, `SameSite=Strict` | Étape de connexion en cours (entre le mot de passe et le code) |

En local, sans domaine de cookie configuré, les cookies appartiennent à `localhost` et sont partagés entre les ports 3000 (cette app), 3001 (admin) et 8001 (API).

### Les règles du client

- `withCredentials: true` (axios) ou `credentials: 'include'` (fetch) sur **chaque** appel à l'API, sinon le navigateur n'envoie pas les cookies.
- L'en-tête `X-GenoLens-Client: web` sur **chaque** appel : c'est la garde anti-CSRF de l'API, qui répond `403 csrf_header_missing` à toute requête non sûre portée par cookie qui en est dépourvue.
- Le navigateur n'envoie jamais `Authorization`. Seul le serveur Next l'envoie (`Authorization: Bearer <gl_at>`), vers `/users/me`, pour choisir la coquille de la page (`getServerUser`).

### Les modules

| Fichier | Rôle |
|---|---|
| `src/utils/api.ts` | Instance axios des appels de session (projets, datasets, analyses...), avec renouvellement sur « déconnecté » |
| `src/utils/auth/client.ts` | Appels d'avant session (`login`, `verifyMfa`, `signup`, `forgotPassword`...), `refreshSession`, `authedFetch`, `signOut` |
| `src/utils/auth/server.ts` | Côté serveur : `getSessionUser` (vérification locale du jeton), `getServerUser` (profil via `/users/me`) |
| `src/utils/auth/jwt.ts` | `verifyAccessToken` : signature ES256, `iss`, `aud` = `genolens`, expiration, `amr` contenant `otp` ou `recovery` |
| `src/utils/auth/paths.ts` | `isPublicPath`, `safeNext`, `loginPath`, `reauthLoginPath`, `refreshPath` |
| `src/utils/auth/navigation.ts` | `navigate` et `replaceLocation` : navigation complète (rechargement) |

Les composants n'appellent pas l'API eux-mêmes : les appels d'avant session passent par `src/utils/auth/client.ts` (qui retourne une valeur `AuthResult`, un refus n'est pas une exception), les appels de session par des hooks React Query qui utilisent `api`.

Après tout changement de session (connexion, enrôlement, renouvellement, déconnexion), la navigation est **complète** (`window.location.assign` ou `replace`) et jamais `router.push` : le layout racine choisit la coquille côté serveur et n'est pas re-rendu par une navigation client.

### Flux d'une requête

```
Composant → api.get('/projects')
            │
            ├─► Requête HTTP vers l'API, cookies joints par le navigateur
            │   GET /api/v1/projects
            │   Cookie: gl_at=…; gl_session=1        (jamais lus par le code)
            │   X-GenoLens-Client: web
            │
            ├─► 200 : les données
            │
            └─► 401 « déconnecté » (jeton d'accès expiré, session révoquée)
                ├─► refreshSession() → POST /auth/refresh
                │   (un seul appel pour toutes les requêtes en échec ensemble)
                ├─► renouvelée : la requête est rejouée une fois
                └─► refusée : navigate('/?next=<page courante>')
```

---

## Interceptor de réponse (Erreurs)

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Ignorer les ECONNABORTED (cancellation React Query est normale)
    if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
      return Promise.reject(error);
    }

    // « Déconnecté » : renouveler la session, rejouer une fois, sinon page de connexion
    if (error.response && isSignedOut(error.response.status, error.response.data?.detail)) {
      const config = error.config;
      if (config && !config._authRetried && (await refreshSession())) {
        return api.request({ ...config, _authRetried: true });
      }
      if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
        navigate(loginPath(window.location.pathname + window.location.search));
      }
      return Promise.reject(error);
    }

    // Compte inactif : la page /suspended explique l'état du compte
    if (error.response?.status === 403 && error.response?.data?.detail?.error === 'account_inactive') {
      // cookie account_status + navigate('/suspended')
      return Promise.reject(error);
    }

    // Les autres erreurs sont propagées : chaque appelant gère son retour utilisateur
    return Promise.reject(error);
  }
);
```

`isSignedOut(status, detail)` vaut `true` pour un `401`, et pour un `403` dont le `detail` est `"Not authenticated"` (l'API en mode pré-lancement répond ainsi quand le cookie d'accès a expiré). Les autres `403` (`csrf_header_missing`, `account_inactive`) ne sont pas une déconnexion : renouveler ne changerait rien, ils ne déclenchent ni renouvellement ni redirection vers la connexion.

Une route de session ne répond jamais `401` pour un mauvais mot de passe ou un mauvais code (c'est `400`) : un `401` veut toujours dire « déconnecté ».

### Renouvellement partagé

Le renouvellement est **partagé** : `refreshSession()` (`src/utils/auth/client.ts`) n'a jamais plus d'un appel en vol. Une page qui monte une douzaine de requêtes avec un jeton tout juste expiré reçoit une douzaine de `401` ensemble, et elles attendent toutes le même `POST /auth/refresh`. Chacune est ensuite rejouée une fois (`_authRetried`). Un rejeu refusé à nouveau, ou un renouvellement refusé, termine la session.

### Appels `fetch` (réponses en flux)

Pour ce qu'axios ne sait pas servir (les réponses SSE du chat IA, par exemple), `authedFetch(url, init)` envoie les mêmes cookies et le même en-tête, avec la même reprise : une réponse « déconnecté » renouvelle la session et rejoue l'appel une fois. Si le renouvellement est refusé, la réponse d'origine est rendue.

### Au-delà de 15 minutes sur une page

Le jeton d'accès dure 15 minutes. Une page laissée ouverte plus longtemps, puis une action (requête axios ou question au chat), se renouvelle sans bruit : la requête reçoit `401`, la session est renouvelée, la requête est rejouée. Au chargement d'une page protégée, c'est le middleware qui renouvelle (voir [architecture.md](architecture.md), section Middleware).

---

## Utilisation dans les hooks

### Pattern de base — Query (lecture)

```typescript
// hooks/useProjects.ts
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
```

### Pattern de base — Mutation (écriture)

```typescript
// hooks/useCreateProject.ts
import { useMutation } from '@tanstack/react-query';
import api from '@/utils/api';

export function useCreateProject() {
  return useMutation({
    mutationFn: async (data: ProjectCreate) => {
      const response = await api.post('/projects', data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate les queries de projets
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
```

---

## Upload de fichiers (multipart/form-data)

Pour l'upload de datasets, le Content-Type est automatiquement ajusté :

```typescript
// hooks/useDatasets.ts — upload
const response = await api.post('/datasets/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
```

### Exemple complet d'upload

```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await api.post('/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total!
        );
        setUploadProgress(percent);
      },
    });
    
    return response.data; // { dataset_id, status }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Upload failed:', error.response?.data);
    }
    throw error;
  }
};
```

---

## Pattern de gestion d'erreurs

### Dans les composants

```typescript
const createMutation = useCreateProject();

createMutation.mutate(
  { name: 'My Project', species: 'homo_sapiens' },
  {
    onSuccess: (data) => {
      router.push(`/projects/${data.id}`);
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.detail || 'Erreur lors de la création';
        setError(message);
      } else {
        setError('Une erreur inattendue est survenue');
      }
    },
  }
);
```

### Codes HTTP traités

| Code | Signification | Action frontend |
|---|---|---|
| `200` / `201` | Succès | Retourne les données |
| `400` | Bad Request | Affiche le message d'erreur dans `detail` |
| `401` | Déconnecté | Renouvelle la session et rejoue la requête une fois ; si refusé, redirige vers `/?next=…` |
| `403` | Forbidden | `account_inactive` mène à `/suspended` ; `csrf_header_missing` est un défaut de client, sans renouvellement ; sinon affiche "Accès refusé" |
| `404` | Not Found | Affiche "Ressource non trouvée" |
| `422` | Validation Error | Affiche les erreurs de validation détaillées |
| `429` | Rate Limit | Affiche "Trop de requêtes, réessayez plus tard" |
| `500` | Server Error | Affiche "Erreur serveur" |

---

## Types des réponses API

### Pagination

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
```

### Erreur standard

```typescript
interface ApiError {
  detail: string | object[]; // Peut être un tableau pour les validation errors
}
```

### Validation error (422)

```typescript
interface ValidationError {
  loc: string[];      // ["body", "name"]
  msg: string;        // "field required"
  type: string;       // "value_error.missing"
  ctx?: Record<string, any>;  // Contexte optionnel
}
```

---

## Exemples d'appels API courants

### GET avec paramètres de requête

```typescript
// Recherche de gènes
const { data } = await api.get('/genes/search', {
  params: { q: 'TP53', species: 'homo_sapiens' },
});

// Liste paginée des projets
const { data } = await api.get('/projects', {
  params: { page: 1, page_size: 20 },
});
```

### POST avec body JSON

```typescript
// Créer un projet
const response = await api.post('/projects', {
  name: 'My Analysis',
  description: 'Differential expression analysis',
  species: 'homo_sapiens',
});

// Lancer une analyse DEG
const response = await api.post('/analyses/differential-expression', {
  dataset_ids: ['uuid-1', 'uuid-2'],
  comparison: { group1: 'control', group2: 'treated' },
  species: 'homo_sapiens',
  multiple_testing_correction: 'fdr',
});
```

### PATCH / PUT

```typescript
// Mettre à jour un projet
const response = await api.patch('/projects/{id}', {
  name: 'Updated Name',
});

// Modifier un bookmark
const response = await api.patch('/bookmarks/{id}', {
  name: 'New Bookmark Name',
});
```

### DELETE

```typescript
// Supprimer un projet
await api.delete(`/projects/${projectId}`);

// Supprimer un dataset
await api.delete(`/datasets/${datasetId}`);
```

---

## AbortController (cancellation)

React Query gère automatiquement l'abort des requêtes lors du démontage ou du refetch. Les erreurs `ECONNABORTED` sont ignorées par l'interceptor :

```typescript
// Dans un hook React Query, la requête est automatiquement abortée
const { data } = useQuery({
  queryKey: ['projects'],
  queryFn: ({ signal }) => 
    api.get('/projects', { signal }).then(r => r.data), // signal passé par React Query
});
```

---

## Testing du client API

Le réseau de l'instance axios est simulé par un adaptateur `jest.fn` ; `refreshSession` et `navigate` sont remplacés (jsdom ne sait ni observer ni suivre `window.location.assign`). Voir [testing.md](testing.md).

### Mock de l'API pour les tests

```typescript
// utils/__mocks__/api.ts
export default {
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  patch: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
};
```

### Test d'un hook avec API mockée

```typescript
import api from '@/utils/__mocks__/api';

describe('useProjects', () => {
  it('returns projects from the API', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];
    
    (api.get as jest.Mock).mockResolvedValueOnce({ data: mockProjects });
    
    const { result, waitFor } = renderHook(() => useProjects());
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(mockProjects);
  });
});
```

---

## Configuration CORS (développement)

En développement, le frontend (`localhost:3000`) doit être autorisé par le backend :

```python
# Backend .env
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

Le backend ajoute automatiquement les headers CORS nécessaires. Les requêtes portant des cookies, l'origine doit être explicite (jamais `*`) et les credentials autorisés :

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

---

## Migration vers une autre bibliothèque HTTP

Si besoin de migrer d'Axios (ex: vers `fetch` ou `ky`) :

1. Modifier uniquement `src/utils/api.ts`
2. Adapter les interceptors (en conservant l'envoi des cookies, l'en-tête `X-GenoLens-Client` et le renouvellement de session)
3. Les hooks n'ont pas besoin de changer (ils appellent `api.get/post/patch/delete`)
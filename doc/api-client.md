# API Client - GenoLens Frontend

## Vue d'ensemble

Le client API est basé sur **Axios** et est configuré dans `src/utils/api.ts`. Il gère automatiquement l'ajout du token JWT Supabase, la gestion des erreurs et la sanitization de l'URL de base.

---

## Configuration

### Fichier : `src/utils/api.ts`

```typescript
import axios from 'axios';
import { createClient } from '@/utils/supabase/client';

// Sanitize baseURL pour éviter les doubles slashes
const getBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || '';
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url || 'http://localhost:8000/api/v2';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Variables d'environnement requises

| Variable | Description | Défaut |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de l'API backend | `http://localhost:8000/api/v2` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase | — |

---

## Interceptor de requête (Auth)

Le token JWT Supabase est automatiquement ajouté à chaque requête :

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

### Flux d'authentification automatique

```
Composant → api.get('/projects')
            │
            ├─► Interceptor request
            │   ├─► Supabase.auth.getSession()
            │   └─► config.headers.Authorization = "Bearer <token>"
            │
            ├─► Requête HTTP vers backend
            │   GET /api/v2/projects
            │   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
            │
            └─► Backend valide le JWT via Supabase
```

---

## Interceptor de réponse (Erreurs)

```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ignorer les ECONNABORTED (cancellation React Query est normale)
    if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
      return Promise.reject(error);
    }

    // Gestion des erreurs 401 (non autorisé)
    if (error.response?.status === 401) {
      console.error('Unauthorized access');
      // TODO: redirect to login
    }

    // Log des autres erreurs
    if (error.response?.status !== 401) {
      console.error('API Error:', error.message, error.response?.data);
    }

    return Promise.reject(error);
  }
);
```

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
| `401` | Non autorisé | Log + redirect vers login (TODO) |
| `403` | Forbidden | Affiche "Accès refusé" |
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

Le backend ajoute automatiquement les headers CORS nécessaires :

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

---

## Migration vers une autre bibliothèque HTTP

Si besoin de migrer d'Axios (ex: vers `fetch` ou `ky`) :

1. Modifier uniquement `src/utils/api.ts`
2. Adapter les interceptors
3. Les hooks n'ont pas besoin de changer (ils appellent `api.get/post/patch/delete`)
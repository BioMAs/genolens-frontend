# Types TypeScript - GenoLens Frontend

## Vue d'ensemble

Les types TypeScript sont définis dans `src/types/` et partagés entre les composants, hooks et utils. Ils correspondent aux schémas de la base de données backend.

---

## Fichiers de types

### `types/index.ts` — Types principaux

#### Project

```typescript
interface Project {
  id: string;              // UUID
  name: string;            // Nom du projet (max 255 chars)
  description?: string;    // Description optionnelle (max 5000 chars)
  owner_id: string;        // UUID de l'owner
  species: string | null;  // homo_sapiens, mus_musculus...
  created_at: string;      // ISO datetime
  updated_at: string;      // ISO datetime
}

interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
}
```

#### Dataset

```typescript
enum DatasetType {
  MATRIX = 'MATRIX',           // Matrice de comptage
  METADATA = 'METADATA',       // Metadata échantillon
  METADATA_SAMPLE = 'METADATA_SAMPLE',
  METADATA_CONTRAST = 'METADATA_CONTRAST',
  DEG = 'DEG',                 // Résultats DEG
  ENRICHMENT = 'ENRICHMENT'    // Résultats enrichment
}

enum DatasetStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED'
}

interface Dataset {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  type: DatasetType;
  status: DatasetStatus;
  created_at: string;
  updated_at: string;
  error_message?: string;
  dataset_metadata?: any;
  raw_file_path?: string;
  column_mapping?: Record<string, string>;
}

interface DatasetQueryResponse {
  columns: string[];
  data: Record<string, any>[];
  total_rows: number;
  returned_rows: number;
}
```

#### UserProfile & Subscription

```typescript
interface UserProfile {
  id: string;
  email: string;
  role: string;              // 'user' | 'admin'
  subscription_plan: string; // 'free' | 'premium' | 'advanced'
  ai_interpretations_used: number;
  ai_tokens_purchased: number;
  ai_tokens_used: number;
  full_name?: string;
}
```

#### Enrichment & GO

```typescript
interface EnrichmentResult {
  id: string;
  pathway_id: string;
  pathway_name: string;
  category: string;          // BP, MF, CC
  description?: string;
  gene_count: number;
  pvalue: number;
  padj: number;              // FDR corrected
  gene_ratio?: string;
  bg_ratio?: string;
  regulation: string;        // 'up' | 'down' | 'both'
  genes?: string[];          // Liste des gènes contributeurs
}

interface GOTreeNode {
  go_id: string;             // GO:XXXXXXX
  go_name: string;
  namespace: string;         // BP, MF, CC
  level: number | null;
  is_enriched: boolean;
  pvalue?: number | null;
  fdr?: number | null;
  enrichment_ratio?: number | null;
  gene_count?: number | null;
  genes?: string[];
  children: GOTreeNode[];    // Enfants dans le DAG GO
}

interface GOHierarchyResponse {
  biological_process: GOTreeNode[];
  molecular_function: GOTreeNode[];
  cellular_component: GOTreeNode[];
}
```

#### Self-Service Analysis (Wizard)

```typescript
enum SelfServiceAnalysisStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

interface AnalysisParams {
  design: 'auto' | 'condition' | 'batch_condition';
  fdr: number;               // Seuil FDR (0.05)
  min_log2fc: number;        // Seuil log2FC (1)
  min_reads: number;         // Min reads par gène
  min_genes: number;         // Min genes
  min_count: number;         // Min count
  min_reps: number;          // Min replicates
  threads: number;           // Threads R
  enrichment_databases?: string[] | null;
}

interface ProgressLogEntry {
  step: string;              // Nom de l'étape
  message?: string;          // Message détaillé
  timestamp: string;         // ISO datetime
}

interface SelfServiceAnalysis {
  id: string;
  project_id: string;
  name: string;
  status: SelfServiceAnalysisStatus;
  matrix_dataset_id: string | null;
  samples_dataset_id: string | null;
  comparisons_dataset_id: string | null;
  params: AnalysisParams;
  result_dataset_ids: string[];
  intermediate_dataset_ids: { vst?: string; normalized?: string };
  celery_task_id: string | null;
  current_step: string | null;
  progress_log: ProgressLogEntry[];
  error_message: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface SelfServiceAnalysisCreate {
  project_id: string;
  name: string;
  matrix_dataset_id: string;
  samples_dataset_id: string;
  comparisons_dataset_id: string;
  params: AnalysisParams;
}
```

---

### `types/bookmark.ts` — Types bookmarks

```typescript
interface Bookmark {
  id: string;
  user_id: string;
  dataset_id?: string;
  name: string;
  description?: string;
  gene_list?: string[];      // Liste de gènes sauvegardés
  created_at: string;
  updated_at: string;
}

interface BookmarkCreate {
  dataset_id?: string;
  name: string;
  description?: string;
  gene_list?: string[];
}
```

---

### `types/comment.ts` — Types comments

```typescript
interface Comment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface CommentCreate {
  project_id: string;
  content: string;
}
```

---

### `types/history.ts` — Types history/login stats

```typescript
interface DailyLoginCount {
  date: string;              // YYYY-MM-DD
  count: number;
}

interface RecentLoginEvent {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

interface LoginStatsResponse {
  daily_counts: DailyLoginCount[];
  active_today: number;
  active_7_days: number;
  active_30_days: number;
  recent_events: RecentLoginEvent[];
}
```

---

### `types/gene-search.ts` — Types gene search

```typescript
interface GeneSearchResult {
  id: string;
  symbol: string;            // Symbole du gène (TP53)
  name: string;              // Nom complet
  species: string;           // homo_sapiens, mus_musculus...
  chromosome?: string;       // Chromosome d'annotation
  description?: string;      // Description annotée
}

interface GeneValidationResult {
  valid_genes: string[];     // Symboles valides
  invalid_genes: string[];   // Symboles non trouvés
  ambiguous_genes: string[]; // Symboles ambigus
}
```

---

### `types/project-member.ts` — Types project members

```typescript
interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'member';
  added_at: string;
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface ProjectMemberCreate {
  user_id: string;
  role?: 'owner' | 'member';
}
```

---

### `types/project-stats.ts` — Types project stats

```typescript
interface ProjectStats {
  total_datasets: number;
  total_analyses: number;
  total_size_mb: number;
  recent_activity_count: number;
  member_count: number;
}
```

---

## Utilisation des types dans les hooks

### Pattern de typage des queries

```typescript
// hooks/useProjects.ts
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import type { Project, ProjectListResponse } from '@/types';

export function useProjects() {
  return useQuery<ProjectListResponse>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get<ProjectListResponse>('/projects');
      return response.data;
    },
  });
}
```

### Pattern de typage des mutations

```typescript
// hooks/useCreateProject.ts
import { useMutation } from '@tanstack/react-query';
import api from '@/utils/api';
import type { Project, ProjectListResponse } from '@/types';

interface ProjectCreate {
  name: string;
  description?: string;
  species?: string;
}

export function useCreateProject() {
  return useMutation<Project, Error, ProjectCreate>({
    mutationFn: async (data) => {
      const response = await api.post<Project>('/projects', data);
      return response.data;
    },
  });
}
```

---

## Validation des types côté client

### Zod schemas pour la validation formulaire

```typescript
import { z } from 'zod';

const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  species: z.enum(['homo_sapiens', 'mus_musculus', 'danio_rerio']).optional(),
});

type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
```

### Validation des données API

```typescript
function validateProjectList(data: unknown): ProjectListResponse {
  if (!Array.isArray((data as any).items)) {
    throw new Error('Invalid project list response');
  }
  
  return data as ProjectListResponse;
}
```

---

## Mapping Backend → Frontend

| Champ Backend | Type Backend | Type Frontend | Notes |
|---|---|---|---|
| `id` | UUID | `string` | Converti automatiquement |
| `created_at` | DateTime | `string` (ISO) | Format ISO 8601 |
| `owner_id` | UUID | `string` | — |
| `species` | String(100) | `string \| null` | Convention snake_case |
| `status` | Enum string | Enum TS | PENDING, READY, FAILED... |
| `parameters` | JSON | `AnalysisParams` | Typé manuellement |

---

## Évolution des types

Lors d'une migration backend → frontend :

1. **Modifier le modèle SQLAlchemy** (backend)
2. **Mettre à jour la migration Alembic**
3. **Ajouter/Modifier le type TypeScript** dans `src/types/`
4. **Vérifier les hooks** qui utilisent ce type
5. **Vérifier les composants** qui affichent ces données

Exemple : Ajout d'un champ `tags` sur Project

```typescript
// 1. Backend (modèle)
class Project(Base):
    tags = Column(JSON, default=list)

# 2. Migration Alembic
op.add_column('projects', sa.Column('tags', sa.JSON(), nullable=True))

# 3. Frontend (type)
interface Project {
  id: string;
  name: string;
  // ... existing fields
  tags?: string[];  // Nouveau champ
}

# 4. Hook (si nécessaire)
interface ProjectCreate {
  name: string;
  tags?: string[];  // Nouveau champ
}

# 5. Composant (affichage)
<ProjectCard project={project} />
// Le composant doit gérer le cas où tags est undefined
```
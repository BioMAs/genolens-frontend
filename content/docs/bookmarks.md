---
title: Bookmarks and gene lists
description: Save genes of interest and organise them into reusable lists.
category: explore
order: 20
---

# Gene Bookmarks & Custom Lists

Système complet de bookmarks et listes personnalisées de gènes pour organiser les gènes d'intérêt dans les projets.

## Architecture

### Database

**`gene_bookmarks`**

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | Utilisateur propriétaire |
| `project_id` | UUID | Projet associé |
| `gene_symbol` | string | Symbole du gène (ex: TP53) |
| `gene_id` | string | ID Entrez/Ensembl (optionnel) |
| `notes` | text | Notes libres |
| `tags` | JSON | Tags de catégorisation |
| `color` | string | Couleur hex pour visualisation |
| `is_favorite` | boolean | Flag favori rapide |
| `extra_data` | JSON | Métadonnées additionnelles |

Indexes: `(user_id, project_id)`, `(project_id, gene_symbol)` UNIQUE, `gene_symbol`

**`gene_lists`**

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | PK |
| `name` | string | Nom de la liste |
| `user_id` | UUID | Créateur |
| `project_id` | UUID | Projet |
| `genes` | JSON | Tableau de symboles |
| `gene_count` | integer | Calculé automatiquement |
| `is_public` | boolean | Visible aux membres du projet |
| `tags` | JSON | Tags |

Indexes: `(user_id, project_id)`, `name`

### Backend service

`backend/app/services/bookmarks_service.py`

**Bookmarks:** `get_bookmarks`, `is_bookmarked`, `create_bookmark`, `update_bookmark`, `delete_bookmark`

**Gene Lists:** `get_gene_lists`, `create_gene_list`, `update_gene_list`, `add_genes_to_list`, `remove_genes_from_list`, `delete_gene_list`

### API Endpoints

`backend/app/api/endpoints/bookmarks.py`

```
GET  /projects/{project_id}/bookmarks
GET  /projects/{project_id}/bookmarks/check/{gene_symbol}
POST /projects/{project_id}/bookmarks
POST /projects/{project_id}/bookmarks/batch
PUT  /bookmarks/{bookmark_id}
DELETE /bookmarks/{bookmark_id}

GET  /projects/{project_id}/gene-lists?include_public=true
POST /projects/{project_id}/gene-lists
PUT  /gene-lists/{list_id}
POST /gene-lists/{list_id}/add-genes
POST /gene-lists/{list_id}/remove-genes
DELETE /gene-lists/{list_id}
```

---

## Frontend

### TypeScript types

`frontend/src/types/bookmark.ts` — `GeneBookmark`, `GeneBookmarkCreate`, `GeneBookmarkUpdate`, `GeneList`, `GeneListCreate`, `GeneListUpdate`, `BookmarkBatchCreate`, `BookmarkBatchResponse`

### React Query hooks

`frontend/src/hooks/useBookmarks.ts`

**Bookmarks:** `useBookmarks`, `useIsBookmarked`, `useCreateBookmark`, `useCreateBookmarksBatch`, `useUpdateBookmark`, `useDeleteBookmark`

**Gene Lists:** `useGeneLists`, `useCreateGeneList`, `useUpdateGeneList`, `useAddGenesToList`, `useRemoveGenesFromList`, `useDeleteGeneList`

Cache: `staleTime` 1 min, `gcTime` 5 min, invalidation automatique.

### Composants UI

**`BookmarkButton`** (`src/components/BookmarkButton.tsx`)

```tsx
<BookmarkButton 
  projectId={project.id} 
  geneSymbol="TP53" 
  size="sm"        // 'sm' | 'md' | 'lg'
  variant="icon"   // 'icon' | 'button'
/>
```

Icône étoile qui se remplit quand bookmarké, loading states automatiques.

**`BookmarkManager`** (`src/components/BookmarkManager.tsx`)

```tsx
<BookmarkManager 
  projectId={project.id}
  onClose={() => setShowPanel(false)}
/>
```

Liste complète, édition inline notes/tags, sélecteur couleur (16 presets), suppression avec confirmation.

**`GeneListManager`** (`src/components/GeneListManager.tsx`)

```tsx
<GeneListManager 
  projectId={project.id}
  onClose={() => setShowPanel(false)}
/>
```

Création de listes, input multiligne gènes, toggle public/privé, sélecteur couleur.

---

## Intégration

### Intégration actuelle

- ✅ **DEGTable** — colonne ⭐ à gauche
- ✅ **DEGTableWithAdvancedFilters** — colonne ⭐
- ✅ **GOEnrichmentTable** — icône ⭐ dans lignes expandables

### Ajouter dans une table de gènes

```tsx
// Colonne TanStack Table
{
  accessorKey: 'bookmark',
  header: '⭐',
  cell: ({ row }) => (
    <BookmarkButton 
      projectId={projectId}
      geneSymbol={row.original.gene_symbol}
      size="sm"
      variant="icon"
    />
  ),
}
```

### Ajouter dans ProjectDetail

```tsx
const [activePanel, setActivePanel] = useState<'bookmarks' | 'lists' | null>(null);

<div className="flex gap-2">
  <button onClick={() => setActivePanel('bookmarks')}>
    <Star className="h-4 w-4" /> Bookmarks
  </button>
  <button onClick={() => setActivePanel('lists')}>
    <List className="h-4 w-4" /> Gene Lists
  </button>
</div>

{activePanel === 'bookmarks' && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="bg-white rounded-lg w-full max-w-3xl h-[80vh] overflow-hidden">
      <BookmarkManager projectId={project.id} onClose={() => setActivePanel(null)} />
    </div>
  </div>
)}
```

### Bookmark batch depuis résultats DEG

```tsx
const createBatch = useCreateBookmarksBatch();

const handleBookmarkSignificant = async () => {
  const significantGenes = degResults
    .filter(g => g.padj < 0.05 && Math.abs(g.log2FoldChange) > 1)
    .map(g => g.gene_symbol);
    
  await createBatch.mutateAsync({
    projectId,
    data: {
      gene_symbols: significantGenes,
      tags: ['significant', 'auto'],
      notes: 'Auto-bookmarked: padj<0.05 & |FC|>1',
    }
  });
};
```

---

## Tests

```bash
# Backend
cd backend && docker-compose exec api python -m pytest tests/test_bookmarks.py -v

# API manuel
curl -X POST http://localhost:8000/api/v1/projects/{project_id}/bookmarks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gene_symbol": "TP53", "notes": "Tumor suppressor", "tags": ["cancer"]}'

# Frontend
npm run dev  # puis naviguer vers un projet et cliquer sur ⭐
```

---

## Troubleshooting

**Bouton bookmark invisible** — vérifier que `projectId` est passé et que `dataset.project_id` est valide.

**Bookmarks non sauvegardés** — vérifier que l'API tourne (`docker-compose ps`), vérifier tables: `\dt gene_*` dans psql, vérifier le token JWT dans DevTools Network.

---

## Performance

- Index sur `(user_id, project_id)` pour fetch rapide
- Index unique `(project_id, gene_symbol)` pour éviter les doublons
- Requêtes optimisées avec `joinedload` pour les relations

## Sécurité

- Tous les endpoints nécessitent authentification
- Vérification `user_id` sur toutes les mutations
- Foreign key CASCADE sur project deletion
- Validation Pydantic sur toutes les entrées

---

## Roadmap

- [ ] Recherche/filtre dans BookmarkManager
- [ ] Export CSV/TXT des listes
- [ ] Import de listes depuis fichier
- [ ] Partage de listes entre utilisateurs
- [ ] Intersection/union entre listes
- [ ] Intégration enrichment analysis

**Last Updated**: Mai 2026 — GenoLens V2

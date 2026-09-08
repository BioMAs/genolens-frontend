---
title: Comments and annotations
description: Annotate results and discuss them with your collaborators.
category: collaboration
order: 10
---

# Comments & Annotations System

Système de commentaires threadés pour collaborer sur projets, gènes, comparaisons et pathways.

## Features

- **Threaded discussions** : top-level + réponses (3 niveaux max)
- **Types** : GENERAL, GENE, COMPARISON, PATHWAY
- **Resolved status** : marquer les threads comme résolus
- **Markdown** : rich text dans le contenu
- **Edit & Delete** : sur ses propres commentaires
- **Live counts** : compteur par projet/cible

---

## Database

### Table `project_comments`

```sql
CREATE TABLE project_comments (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    comment_type comment_type_enum NOT NULL DEFAULT 'GENERAL',
    target_id VARCHAR(255),        -- gene_symbol, comparison_name, pathway_id
    content TEXT NOT NULL,         -- Markdown
    parent_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    extra_metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Enum `comment_type_enum` : `GENERAL | GENE | COMPARISON | PATHWAY`

Indexes : `project_id`, `user_id`, `target_id`, `parent_id`, `(project_id, comment_type)`, `(project_id, target_id)`

Migration : `backend/alembic/versions/2026_02_26_1600-project_comments.py`

---

## Backend API

### Endpoints

```
GET  /api/v1/projects/{project_id}/comments
     ?comment_type=GENE&target_id=TP53&include_resolved=true

GET  /api/v1/comments/{comment_id}
GET  /api/v1/comments/{comment_id}/thread
POST /api/v1/projects/{project_id}/comments
PATCH /api/v1/comments/{comment_id}
DELETE /api/v1/comments/{comment_id}   # cascade to replies
GET  /api/v1/projects/{project_id}/comments/count?target_id={optional}
GET  /api/v1/users/me/comments?project_id={optional}&limit=50
```

### Python service

```python
from app.services.comments_service import comments_service

comments = await comments_service.get_comments(
    db, project_id=project_id,
    comment_type=CommentType.GENE,
    target_id="TP53"
)

comment = await comments_service.create_comment(
    db, project_id=project_id, user_id=user_id,
    content="This gene is interesting!",
    comment_type=CommentType.GENE, target_id="TP53"
)

reply = await comments_service.create_comment(
    db, project_id=project_id, user_id=user_id,
    content="I agree!", parent_id=comment.id
)

await comments_service.update_comment(
    db, comment_id=comment.id, user_id=user_id, is_resolved=True
)
```

---

## Frontend Integration

### Quick integration (3 steps)

```typescript
// 1. Import
import CommentsSection from '@/components/CommentsSection';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// 2. Get user
const { data: currentUser } = useCurrentUser();

// 3. Render
<CommentsSection
  projectId={projectId}
  commentType="GENE"          // GENE | COMPARISON | PATHWAY | GENERAL
  targetId={geneSymbol}
  currentUserId={currentUser?.sub}
  title={`Comments on ${geneSymbol}`}
  emptyMessage="No comments yet."
/>
```

### React Query hooks

`frontend/src/hooks/useComments.ts`

```typescript
import {
  useComments, useCreateComment, useUpdateComment,
  useDeleteComment, useCommentCount,
} from '@/hooks/useComments';

const { data: comments } = useComments(projectId, 'GENE', 'TP53', true);
const { data: count } = useCommentCount(projectId, 'TP53');
const createComment = useCreateComment();

createComment.mutate({
  projectId,
  data: { content: 'My comment', comment_type: 'GENE', target_id: 'TP53' }
});
```

### Composants

| Composant | Utilisation |
|-----------|-------------|
| `CommentsSection` | Solution complète avec liste + formulaire |
| `CommentThread` | Affichage d'un thread individuel |
| `CommentEditor` | Formulaire seul (création/réponse) |

```tsx
// CommentThread
<CommentThread
  comment={comment}
  projectId={projectId}
  currentUserId={userId}
  level={0}
  maxDepth={3}
/>

// CommentEditor
<CommentEditor
  projectId={projectId}
  commentType="GENE"
  targetId="TP53"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

---

## Exemples d'intégration

### Commentaires de projet

```tsx
// ProjectDetail.tsx
<CommentsSection
  projectId={projectId}
  commentType="GENERAL"
  currentUserId={currentUser?.sub}
  title="Project Discussion"
/>
```

### Commentaires sur une comparaison

```tsx
// ComparisonDetail.tsx
{activeTab === 'comments' && (
  <CommentsSection
    projectId={projectId}
    commentType="COMPARISON"
    targetId={comparisonName}
    currentUserId={currentUser?.sub}
    title={`Discussion: ${comparisonName}`}
  />
)}
```

### Compteur inline dans une table

```tsx
import { useCommentCount } from '@/hooks/useComments';
import { MessageSquare } from 'lucide-react';

function GeneRow({ projectId, geneSymbol }) {
  const { data: count } = useCommentCount(projectId, geneSymbol);
  
  return (
    <div className="flex items-center gap-2">
      <span>{geneSymbol}</span>
      {count?.count > 0 && (
        <button onClick={() => openCommentsModal()} className="text-sm text-gray-500 hover:text-indigo-600">
          <MessageSquare className="h-4 w-4 inline" /> {count.count}
        </button>
      )}
    </div>
  );
}
```

### Section collapsible

```tsx
function CollapsibleComments({ ...props }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="flex w-full items-center justify-between p-4">
        <span className="font-medium">Comments</span>
        {isOpen ? <ChevronUp /> : <ChevronDown />}
      </button>
      {isOpen && <div className="p-4"><CommentsSection {...props} /></div>}
    </div>
  );
}
```

---

## Best Practices

```tsx
// ✅ Toujours passer currentUserId
<CommentsSection currentUserId={currentUser?.sub} />

// ✅ Utiliser des types spécifiques avec targetId
<CommentsSection commentType="GENE" targetId="TP53" />

// ✅ Titre contextuel
<CommentsSection title={`Comments on ${geneSymbol}`} />

// ✅ Gérer les loading states
const { data: comments, isLoading } = useComments(projectId);
if (isLoading) return <Spinner />;
```

---

## Sécurité & Permissions

- Auth JWT Supabase requis sur tous les endpoints
- **View** : membres du projet
- **Create** : membres du projet
- **Edit** : auteur uniquement
- **Delete** : auteur uniquement (cascade vers les réponses)
- **Mark resolved** : tout membre du projet

---

## Tests

```bash
# Backend
cd backend && pytest tests/test_comments.py -v

# Frontend
cd frontend && npm test -- --testPathPattern=comments
```

---

## Troubleshooting

**Commentaires invisibles** — vérifier `projectId`, authentification, migration appliquée (`alembic upgrade head`).

**Impossible de créer** — vérifier l'enregistrement ProjectMember, erreurs 401/403 dans Network tab, backend enregistré dans `main.py`.

**Problèmes de style** — importer Tailwind, vérifier classes dark mode, vérifier disponibilité Button/Card.

---

## Roadmap

- [ ] @mentions avec notifications
- [ ] Réactions emoji
- [ ] Pièces jointes (images/fichiers)
- [ ] Notifications email
- [ ] Recherche dans les commentaires
- [ ] Export PDF/HTML des threads
- [ ] Résumé AI des longs threads

---

**Status**: ✅ Phase 3 Complete (Février 2026) — GenoLens V2

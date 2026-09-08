---
title: Account and subscription
description: Your plan, your quotas, and how to change them.
category: account
order: 10
---

# Account Management & Subscription (Phase 1)

Gestion des comptes utilisateurs, plans d'abonnement, quotas et contrôle d'accès aux features.

## Plans d'abonnement

| Plan | Projets max | Stockage | IA | Lancer des analyses |
|------|-------------|----------|----|---------------------|
| **BASIC** | 3 | 500 MB | ❌ | ❌ |
| **PREMIUM** | 20 | 10 GB | ✅ (15 free + tokens) | ❌ |
| **ADVANCED** | Illimité | 50 GB | ✅ illimité | ✅ |
| **ADMIN** | Illimité | Illimité | ✅ illimité | ✅ |

Les admins contournent toutes les limites de plan, quel que soit leur `subscription_plan`.

---

## Backend

### Plan limits (`backend/app/core/plan_config.py`)

```python
from app.core.plan_config import get_max_projects, get_max_storage_bytes, get_plan_limits

# Limite projets pour un utilisateur
max_projects = get_max_projects(user.subscription_plan, user.role)
# → None si illimité, int sinon

# Limites complètes
limits = get_plan_limits(user.subscription_plan, user.role)
# → { "max_projects": 3, "max_storage_bytes": 524288000 }
```

### Subscription gate (`backend/app/api/deps/subscription.py`)

FastAPI dependencies à injecter dans les endpoints protégés :

| Dependency | Usage |
|------------|-------|
| `get_or_create_user` | Base : récupère/crée le profil depuis le JWT Supabase. Gère aussi la revendication des invitations en attente (PENDING → ACTIVE). |
| `require_admin` | Endpoints admin uniquement (403 si non ADMIN) |
| `require_ai_access` | Features IA (PREMIUM ou ADVANCED requis) |
| `check_ai_quota` | Vérifie le quota IA restant avant génération |
| `increment_ai_usage` | Incrémente compteurs usage IA + log |
| `require_analysis_access` | Lancement d'analyses (ADVANCED uniquement) |

```python
from app.api.deps.subscription import (
    get_or_create_user,
    require_ai_access,
    check_ai_quota,
    require_analysis_access,
)

# Exemple endpoint IA
@router.post("/interpret")
async def interpret(
    user: Annotated[User, Depends(check_ai_quota)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await ai_interpreter.interpret(...)
    await increment_ai_usage(user, db)
    return result
```

### Quotas IA (PREMIUM)

- 15 interprétations gratuites par utilisateur (compteur `ai_interpretations_used`)
- Au-delà : consomme des tokens achetés (`ai_tokens_used`)
- ADVANCED : illimité
- ADMIN : logué mais pas compté

### Gestion des invitations

`get_or_create_user` détecte automatiquement les utilisateurs invités (statut `PENDING` avec même email que le JWT) et les active en swappant l'UUID Supabase via `UPDATE` raw (SQLAlchemy ne peut pas muter un PK via ORM).

---

## Frontend

### Composants Dashboard (phase 1)

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `DashboardKpiBar` | `src/components/DashboardKpiBar.tsx` | KPIs en haut du dashboard (projets, datasets, analyses) |
| `DashboardSubscriptionCard` | `src/components/DashboardSubscriptionCard.tsx` | Plan actuel + quotas + bouton upgrade |
| `DashboardWelcomeBanner` | `src/components/DashboardWelcomeBanner.tsx` | Message de bienvenue personnalisé |
| `RecentProjectsSection` | `src/components/RecentProjectsSection.tsx` | Projets récents avec accès rapide |
| `ProjectHub` | `src/components/ProjectHub.tsx` | Hub centralisé de navigation projets |

### Hooks

```typescript
// Statistiques dashboard
import { useUserDashboardStats } from '@/hooks/useUserDashboardStats';
const { data: stats } = useUserDashboardStats();
// → { projects_count, datasets_count, analyses_count, storage_used_bytes }

// Abonnement
import { useSubscription } from '@/hooks/useSubscription';
const { data: subscription } = useSubscription();
// → { plan, max_projects, max_storage_bytes, ai_interpretations_remaining, ... }

// Billing / Stripe
import { useBilling } from '@/hooks/useBilling';
const { data: billing, upgrade } = useBilling();
```

### Afficher les limites dans l'UI

```tsx
import { useSubscription } from '@/hooks/useSubscription';
import { DashboardSubscriptionCard } from '@/components/DashboardSubscriptionCard';

function ProjectsPage({ userId }) {
  const { data: subscription } = useSubscription();
  const atLimit = subscription?.max_projects !== null 
    && projectsCount >= subscription.max_projects;

  return (
    <>
      {atLimit && (
        <div className="alert">
          Limite de {subscription.max_projects} projets atteinte.
          <DashboardSubscriptionCard />
        </div>
      )}
      {/* ... */}
    </>
  );
}
```

---

## Page Setup projet (wizard)

Nouveau flow de création guidée pour les projets phase1 :

- Route : `/projects/[id]/setup/`
- Composants : `src/components/wizard/`
- Inclut : sélection du type d'analyse, upload dataset, configuration des paramètres

---

## Routes analyses

Nouvelles routes dédiées pour la gestion des analyses :

- `/projects/[id]/analyses/` — liste et lancement des analyses
- Composants : `src/components/analyses/`
- Hook : `useAnalyses(projectId)` — liste, statut, lancement

---

## Endpoint admin

`backend/app/api/endpoints/admin.py` expose des routes protégées par `require_admin` :
- Gestion utilisateurs (list, update plan, roles)
- Stats globales usage
- Audit des accès IA

---

## Modèle User

Champs clés dans `app/models/models.py` :

```python
class User(Base):
    subscription_plan: SubscriptionPlan  # BASIC | PREMIUM | ADVANCED
    role: UserRole                        # USER | ADMIN
    status: UserStatus                    # ACTIVE | PENDING | SUSPENDED
    ai_interpretations_used: int          # compteur interprétations gratuites
    ai_tokens_used: int                   # tokens achetés consommés
    storage_used_bytes: int               # stockage cumulé

    @property
    def can_use_ai(self) -> bool:
        return self.subscription_plan in (SubscriptionPlan.PREMIUM, SubscriptionPlan.ADVANCED)

    @property
    def can_launch_analyses(self) -> bool:
        return self.subscription_plan == SubscriptionPlan.ADVANCED or self.role == UserRole.ADMIN

    @property
    def ai_interpretations_remaining(self) -> int:
        return max(0, 15 - self.ai_interpretations_used)
```

---

## Stripe Billing

Voir [`setup/stripe-billing.md`](../setup/stripe-billing.md) pour la configuration des webhooks et plans Stripe.

La mise à jour de plan se fait via webhook Stripe → `billing.py` endpoint → mise à jour `User.subscription_plan` en DB.

---

**Last Updated**: Mai 2026 — GenoLens V2 Phase 1

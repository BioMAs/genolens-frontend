# Pages & Routes - GenoLens Frontend

## Vue d'ensemble

Le frontend utilise le **Next.js App Router** avec des routes basées sur les dossiers. Les pages peuvent être des Server Components (par défaut) ou Client Components (`'use client'`).

---

## Routes publiques

### `GET /` — Page d'accueil / Login

**Fichier** : `src/app/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise (redirige vers `/dashboard` si connecté)

**Description** : Page de login/signup avec formulaire email/password. Affiche le branding GenoLens à gauche et le formulaire d'authentification à droite.

**Composants clés** :
- Formulaire signin/signup toggle
- Validation Supabase Auth
- Redirection automatique vers `/dashboard` après connexion

---

### `GET /pricing` — Page tarifaire

**Fichier** : `src/app/pricing/page.tsx`  
**Type** : Server Component  
**Auth** : Non requise

**Description** : Présentation des plans (Free, Premium, Advanced) avec comparaison des features et boutons de souscription.

---

## Routes d'authentification

### `GET /auth/callback` — Callback Supabase

**Fichier** : `src/app/auth/callback/page.tsx`  
**Type** : Server Component  
**Auth** : Non requise

**Description** : Gère le callback après l'authentification Supabase (confirmation email, OAuth, etc.). Échange le token de session et redirige vers `/dashboard`.

---

## Routes protégées — Dashboard

### `GET /dashboard` — Dashboard principal

**Fichier** : `src/app/dashboard/page.tsx`  
**Type** : Server Component → Client Component (`Dashboard`)  
**Auth** : Requise (redirige vers `/` si non authentifié)

**Description** : Vue d'ensemble de l'espace utilisateur avec :
- KPIs (nombre de projets, datasets, analyses récentes)
- Section "Projets récents"
- Banner de bienvenue
- Accès rapide aux fonctionnalités

**Composants clés** :
- `DashboardKpiBar` — Barre de KPIs
- `RecentProjectsSection` — Projets récents avec accès rapide
- `DashboardSubscriptionCard` — État de l'abonnement
- `DashboardWelcomeBanner` — Message de bienvenue contextuel

---

## Routes protégées — Projets

### `GET /projects` — Liste des projets

**Fichier** : `src/app/projects/page.tsx`  
**Type** : Server Component → Client Component (`ProjectHub`)  
**Auth** : Requise

**Description** : Hub principal de gestion des projets. Affiche la liste des projets avec filtres, recherche et bouton de création.

**Composants clés** :
- `ProjectList` — Liste paginée des projets
- `CreateProjectModal` — Modal de création de projet
- Filtres par date, nom, propriétaire

---

### `GET /projects/[id]` — Détail d'un projet

**Fichier** : `src/app/projects/[id]/page.tsx`  
**Type** : Server Component → Client Component (`ProjectDetail`)  
**Auth** : Requise (vérifie l'accès au projet)

**Description** : Page principale du projet avec tous les sous-onglets.

**Sous-sections** :
| Route | Composant | Description |
|---|---|---|
| `/projects/[id]` | `ProjectDetailWithQuery` | Vue par défaut — overview + datasets |
| `/projects/[id]/analyses` | `AnalysisResultsHub` | Hub des résultats d'analyses |
| `/projects/[id]/datasets` | `DatasetExplorer` | Explorateur de datasets |
| `/projects/[id]/members` | `ProjectMembersModal` | Gestion des membres |

**Composants clés** :
- `ProjectHeader` — Nom, description, actions du projet
- `DatasetExplorer` — Upload et liste des datasets
- `AnalysisResultsHub` — Résultats DEG, GSEA, GO enrichment
- `CommentsSection` — Commentaires du projet
- `ExternalIntegrationsPanel` — Données UniProt/NCBI

---

## Routes protégées — Outils

### `GET /tools` — Page outils

**Fichier** : `src/app/tools/page.tsx`  
**Type** : Client Component  
**Auth** : Requise

**Description** : Hub des outils bioinformatiques disponibles.

---

### `GET /tools/ontology` — Browser GO

**Fichier** : `src/app/tools/ontology/page.tsx`  
**Type** : Client Component  
**Auth** : Requise

**Description** : Navigateur de l'ontologie Gene Ontology (GO). Permet de naviguer le DAG GO, rechercher des termes et voir les annotations.

**Composants clés** :
- `GOHierarchyGraph` — Visualisation hiérarchique GO
- `GOTreePanel` — Arbre des termes GO
- `GOForceGraph` — Graph force-directed des termes
- `GOEnrichmentTable` — Table d'enrichissement

---

### `GET /tools/power-analysis` — Power Analysis

**Fichier** : `src/app/tools/power-analysis/page.tsx`  
**Type** : Client Component  
**Auth** : Requise

**Description** : Outil de calcul de puissance statistique pour les expériences RNA-seq. Permet de déterminer la taille d'échantillon nécessaire.

---

## Routes protégées — Admin

### `GET /admin` — Panel admin

**Fichier** : `src/app/admin/page.tsx`  
**Type** : Server Component → Client Component  
**Auth** : Rôle admin requis

**Description** : Panneau d'administration avec vue d'ensemble du système.

**Sous-sections** :
| Route | Composant | Description |
|---|---|---|
| `/admin` | Vue par défaut | Stats système, KPIs globaux |
| `/admin/users` | `UserManagement` | Gestion des utilisateurs (rôles) |
| `/admin/projects` | `ProjectManagement` | Gestion de tous les projets |
| `/admin/ai-logs` | `AIUsageLogs` | Logs d'utilisation IA |
| `/admin/system-stats` | `SystemStats` | Métriques système en temps réel |

**Composants clés** :
- `UserManagement` — Liste, recherche, changement de rôle
- `ProjectManagement` — Vue globale des projets, actions admin
- `AIUsageLogs` — Monitoring quota IA
- `SystemStats` — CPU, mémoire, DB connections (Prometheus)

---

## Routes protégées — Profil

### `GET /profile` — Profil utilisateur

**Fichier** : `src/app/profile/page.tsx`  
**Type** : Server Component → Client Component  
**Auth** : Requise

**Description** : Page de gestion du profil utilisateur.

**Sections** :
- Informations personnelles (nom, email)
- Détails de l'abonnement (`SubscriptionDetails`)
- Quota AI utilisé/restant (`QuotaDisplay`)
- Historique des connexions (`useLoginStats`)

---

## Routes de diagnostic

### `GET /diagnostic` — Diagnostic complet

**Fichier** : `src/app/diagnostic/page.tsx`  
**Type** : Client Component  
**Auth** : Requise (optionnel)

**Description** : Outil de diagnostic pour tester les connexions API, Supabase, et les fonctionnalités.

### `GET /diagnostic-simple` — Diagnostic simplifié

**Fichier** : `src/app/diagnostic-simple/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise

**Description** : Version simplifiée du diagnostic accessible sans auth.

---

## Routes de test

### `GET /test-comparisons` — Test des comparaisons

**Fichier** : `src/app/test-comparisons/page.tsx`  
**Type** : Client Component  
**Auth** : Requise (optionnel)

**Description** : Page de test pour les fonctionnalités de comparaison entre datasets.

---

## Dynamic Routes

### `/projects/[id]/*` — Sous-routes projet

Le paramètre dynamique `[id]` correspond à l'UUID du projet.

```
/projects/abc123-def456-...
├── (default)     → Overview + datasets
├── /analyses     → Résultats d'analyses
├── /datasets     → Explorateur de datasets
├── /settings     → Paramètres du projet
└── /members      → Gestion des membres
```

---

## Layout nesting

### Layout racine (`app/layout.tsx`)

```
<html>
  <body>
    ErrorBoundary          ← Capture d'erreurs React
      QueryProvider        ← TanStack Query client
        ThemeProvider      ← Dark/Light mode
          AppShell         ← Sidebar + TopBar (si auth)
            {children}     ← Page courante
```

### Layouts intermédiaires

| Route | Layout spécifique |
|---|---|
| `/admin/*` | Layout admin avec navigation admin |
| `/projects/[id]/*` | Layout projet avec breadcrumb |
| `/tools/*` | Layout outils avec grille de cartes |

---

## Navigation

### Sidebar (composant `Sidebar`)

La sidebar est le menu principal de navigation :

```
GenoLens
├── 📊 Dashboard          (/dashboard)
├── 📁 Projects           (/projects)
│   ├── Recent projects
│   └── Create new project
├── 🔬 Analyses           (via projet)
├── 🧬 Tools              (/tools)
│   ├── GO Browser        (/tools/ontology)
│   └── Power Analysis    (/tools/power-analysis)
├── ⚙️ Settings           (/profile)
└── 👤 Admin              (/admin) — admin only
```

### TopBar (composant `TopBar`)

La topbar contient :
- Recherche globale de gènes (`GlobalGeneSearch`)
- Notifications
- Affichage du quota AI (`QuotaDisplay`)
- Menu utilisateur (profil, déconnexion)

---

## Redirections

| Condition | Action |
|---|---|
| Utilisateur non auth → `/dashboard` | Redirect vers `/` (login) |
| Utilisateur auth → `/` | Redirect vers `/dashboard` |
| Non admin → `/admin/*` | Access denied / redirect |
| Projet inaccessible | Access denied / redirect |

---

## SEO & Metadata

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: "GenoLens — Transcriptomics Platform",
  description: "Advanced transcriptomics data visualization and analysis powered by AI",
};
```

Chaque page peut surcharger les metadata :

```tsx
export const metadata: Metadata = {
  title: "Dashboard — GenoLens",
  description: "Vue d'ensemble de votre espace de travail",
};
```
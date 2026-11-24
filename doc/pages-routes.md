# Pages & Routes - GenoLens Frontend

## Vue d'ensemble

Le frontend utilise le **Next.js App Router** avec des routes basées sur les dossiers. Les pages peuvent être des Server Components (par défaut) ou Client Components (`'use client'`).

---

## Routes publiques

### `GET /` — Page d'accueil / Login

**Fichier** : `src/app/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise (le middleware redirige vers `/dashboard`, ou vers `next`, si une session est valide)

**Description** : Page de connexion et d'inscription. Affiche le branding GenoLens à gauche et le formulaire d'authentification à droite. La connexion se fait en deux étapes : e-mail et mot de passe, puis un code à 6 chiffres de l'application d'authentification (ou un code de secours). Un compte sans second facteur est envoyé vers `/auth/2fa/setup` après son mot de passe. `?step=mfa` ouvre directement l'étape du code (où atterrit une invitation acceptée) ; `?next=` donne la destination après connexion.

**Composants clés** :
- Formulaire signin/signup toggle (appels `login`, `signup`, `resendVerification` de `src/utils/auth/client.ts`)
- `MfaChallengeForm` — étape du code (authentificateur ou code de secours)
- Navigation **complète** vers `next` à la fin : le layout racine choisit la coquille côté serveur

L'adresse non confirmée reçoit la même réponse qu'un mauvais mot de passe (`invalid_credentials`) ; la page propose alors de renvoyer le lien de confirmation. La route `/login` redirige vers `/`.

---

### `GET /pricing` — Page tarifaire

**Fichier** : `src/app/pricing/page.tsx`  
**Type** : Server Component  
**Auth** : Non requise

**Description** : Présentation des plans (Free, Premium, Advanced) avec comparaison des features et boutons de souscription.

---

## Routes d'authentification

Les pages de `/auth/*` sont publiques pour le middleware (il ne les protège pas) ; celles ouvertes depuis un lien e-mail reçoivent en plus `Referrer-Policy: no-referrer` et `Cache-Control: no-store`, et retirent le jeton de la barre d'adresse dès qu'elles l'ont lu (`useLinkToken`). Elles utilisent les écrans partagés de `src/components/auth/` et les appels de `src/utils/auth/client.ts`. Les textes d'interface sont en anglais.

### `GET /auth/2fa/setup` — Enrôlement de la double authentification

**Fichier** : `src/app/auth/2fa/setup/page.tsx`  
**Type** : Client Component  
**Auth** : Étape de connexion en cours (cookie `gl_mfa`, posé après un mot de passe valide)

**Description** : Première connexion d'un compte sans second facteur. Affiche le QR code et la clé à saisir (`/mfa/setup/start`), demande un premier code (`/mfa/setup/confirm`) ; la session s'ouvre à cette confirmation. Les 10 codes de secours (`RecoveryCodesPanel`) ne sont montrés qu'une fois : la page reste affichée jusqu'à ce qu'ils soient pris en compte, puis navigue vers `next`. Si l'étape a expiré ou si les essais sont épuisés, la page invite à se reconnecter.

### `GET /auth/forgot` — Mot de passe oublié

**Fichier** : `src/app/auth/forgot/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise

**Description** : Demande un lien de réinitialisation par e-mail. La réponse est la même pour tout le monde : elle ne dit pas si une adresse a un compte.

### `GET /auth/reset?token=…` — Nouveau mot de passe

**Fichier** : `src/app/auth/reset/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise (lien reçu par e-mail)

**Description** : Choix d'un nouveau mot de passe (12 à 128 caractères, contrôle d'interface : le serveur fait foi). L'API révoque toutes les sessions et n'en ouvre aucune : le visiteur se reconnecte avec son nouveau mot de passe. Un lien expiré ou déjà utilisé affiche un message avec un bouton pour en demander un nouveau (`/auth/forgot`).

### `GET /auth/invite?token=…` — Invitation

**Fichier** : `src/app/auth/invite/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise (lien reçu par e-mail)

**Description** : Acceptation d'une invitation : l'invité choisit son mot de passe, puis poursuit vers l'enrôlement de la double authentification ou vers l'étape du code, selon la réponse de l'API.

### `GET /auth/verify-email?token=…` — Confirmation de l'adresse

**Fichier** : `src/app/auth/verify-email/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise (lien reçu par e-mail)

**Description** : Confirme l'adresse e-mail du compte avec le jeton du lien. Rien n'est envoyé à l'ouverture de la page : seul le clic sur le bouton de confirmation confirme, pour qu'un scanner de courrier qui suit le lien ne confirme pas à la place du destinataire. Un lien mort propose de recevoir un nouveau lien.

### `GET /auth/refresh?next=…` — Renouvellement silencieux

**Fichier** : `src/app/auth/refresh/page.tsx`  
**Type** : Client Component  
**Auth** : Non requise

**Description** : Où le middleware envoie un visiteur dont le jeton d'accès a expiré mais dont l'indice `gl_session` est encore là. Affiche « Restoring your session… », appelle `POST /auth/refresh`, puis renvoie vers `next` par navigation complète. Si le renouvellement échoue, renvoie vers `/?next=…&reauth=1` (le formulaire de connexion) ; `reauth=1` évite que `/` renvoie ici en boucle. Voir [architecture.md](architecture.md), section Middleware.

### `GET /auth/callback` — Anciens liens

**Fichier** : `src/app/auth/callback/route.ts`  
**Type** : Route Handler  
**Auth** : Non requise

**Description** : Les anciens liens d'e-mail pointaient ici. Ils ne servent plus : la route répond `303` vers `/` (la session est ouverte par l'API, pas par un échange de code).

### `GET /auth/auth-code-error` — Lien expiré

**Fichier** : `src/app/auth/auth-code-error/page.tsx`  
**Type** : Server Component  
**Auth** : Non requise

**Description** : Page « This link has expired » avec un bouton pour demander un nouveau lien (`/auth/forgot`). Plus aucune route n'y renvoie : elle ne s'atteint que par son adresse.

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
- Sécurité (`SecuritySection`, un bloc chacun, dans `src/app/profile/security/`) : état de la double authentification et alerte quand il reste peu de codes de secours, changement de mot de passe, régénération des codes de secours, changement de téléphone (nouvelle clé TOTP, puis nouveaux codes de secours), appareils connectés (liste des sessions, révocation d'une session ou de toutes les autres). Les appels passent par les hooks de `src/hooks/useAccountSecurity.ts` ; les actions sensibles redemandent le mot de passe ou un code
- Détails de l'abonnement (`SubscriptionDetails`)
- Quota AI utilisé/restant (`QuotaDisplay`)
- Historique des connexions (`useLoginStats`)

---

## Routes de diagnostic

### `GET /diagnostic` — Diagnostic complet

**Fichier** : `src/app/diagnostic/page.tsx`  
**Type** : Client Component  
**Auth** : Requise (optionnel)

**Description** : Outil de diagnostic pour tester les connexions API et les fonctionnalités.

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
| Utilisateur non auth → `/dashboard` | Redirect vers `/?next=/dashboard` (login) |
| Jeton expiré mais indice `gl_session` présent → page protégée | Redirect vers `/auth/refresh?next=…`, puis retour sur la page |
| Utilisateur auth → `/` | Redirect vers `next` s'il est sûr, sinon `/dashboard` |
| Renouvellement refusé | `/?next=…&reauth=1` : le formulaire de connexion |
| Compte inactif | Redirect vers `/suspended` |
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
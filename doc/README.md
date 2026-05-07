# Documentation Frontend - GenoLens

Cette section contient la documentation technique détaillée du frontend de la plateforme GenoLens.

## 📑 Table des matières

- [Architecture](architecture.md)
- [Pages & Routes](pages-routes.md)
- [Composants](components.md)
- [Hooks personnalisés](hooks.md)
- [API Client](api-client.md)
- [Types TypeScript](types.md)
- [Styles & Thème](styles-theme.md)
- [Tests](testing.md)

## 🚀 Vue d'ensemble

Le frontend est une application **Next.js 16** (App Router) construite avec **TypeScript**. Il fournit un dashboard interactif pour l'analyse transcriptomique.

### Fonctionnalités principales

- **Dashboard** — Vue d'ensemble des projets, KPIs, accès rapide
- **Gestion de projets** — Création, édition, partage de projets
- **Explorateur de datasets** — Upload, visualisation et exploration de données
- **Analyses bioinformatiques** — DEG, GSEA, GO enrichment, clustering
- **Visualisations interactives** — Volcano plots, heatmaps, PCA/UMAP, radar charts
- **Assistant IA** — Chat avec Ollama pour l'interprétation biologique
- **Gestion des abonnements** — Checkout Stripe, portal client
- **Administration** — Gestion utilisateurs et projets (admin)

## 📂 Structure du projet

```
frontend/
├── public/                   # Fichiers statiques (logo, icons...)
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── admin/            # Pages admin (/admin/*)
│   │   ├── auth/             # Pages d'authentification (/auth/*)
│   │   ├── dashboard/        # Dashboard principal (/dashboard)
│   │   ├── diagnostic/       # Outils de diagnostic (/diagnostic)
│   │   ├── login/            # Page de connexion (/login)
│   │   ├── pricing/          # Page tarifaire (/pricing)
│   │   ├── profile/          # Profil utilisateur (/profile)
│   │   ├── projects/         # Pages projets (/projects/[id]/*)
│   │   ├── test-comparisons/ # Tests de comparaisons
│   │   ├── tools/            # Outils (/tools/*)
│   │   ├── layout.tsx        # Layout racine (auth, theme, query)
│   │   └── page.tsx          # Page d'accueil / login
│   ├── components/           # Composants React
│   │   ├── admin/            # Composants admin
│   │   ├── analysis/         # Widgets d'analyse (clustering, enrichment)
│   │   ├── analyses/         # Hub et résultats d'analyses
│   │   ├── heatmap/          # Visualisation heatmaps
│   │   ├── profile/          # Composants profil/subscription
│   │   ├── tools/            # Outils (GO browser, power analysis)
│   │   ├── ui/               # Composants UI de base (shadcn/ui)
│   │   └── wizard/           # Wizard d'analyse auto-service
│   ├── contexts/             # React Contexts (Theme)
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilitaires et configs
│   ├── types/                # Types TypeScript
│   └── utils/                # Fonctions utilitaires
├── .swc/                    # Cache SWC (Next.js)
├── next.config.ts           # Configuration Next.js
├── tsconfig.json            # Configuration TypeScript
├── eslint.config.mjs        # ESLint config
├── postcss.config.mjs       # PostCSS / Tailwind
└── package.json             # Dépendances
```

## 🔧 Technologies principales

| Technologie | Version | Usage |
|---|---|---|
| Next.js | 16.0.10 | Framework React (App Router) |
| React | 19.2.1 | UI library |
| TypeScript | 5.x | Typage statique |
| Tailwind CSS | 4.x | Styling utility-first |
| shadcn/ui | — | Composants Radix UI accessibles |
| TanStack Query | 5.90.12 | Data fetching & caching |
| Recharts | 3.6.0 | Graphiques (line, bar, scatter) |
| Plotly.js | 3.3.1 | Visualisations scientifiques avancées |
| D3.js | 7.9.0 | Graphes force-directed, UpSet, Venn |
| Supabase SSR | 0.8.0 | Auth côté serveur |
| Supabase JS | 2.88.0 | Auth client & storage |
| Axios | 1.13.2 | Client HTTP |
| Sentry | 8.x | Error tracking |
| Jest | 30.2.0 | Unit tests |
| Playwright | 1.58.2 | E2E tests |

## 📖 Documentation détaillée

Consultez les fichiers dans ce dossier pour des détails approfondis :

- **[Architecture](architecture.md)** — Architecture de l'application, patterns, flux de données
- **[Pages & Routes](pages-routes.md)** — Référence complète des routes et pages
- **[Composants](components.md)** — Inventaire et description des composants
- **[Hooks personnalisés](hooks.md)** — Hooks React pour la data fetching et les états
- **[API Client](api-client.md)** — Configuration et utilisation du client API
- **[Types TypeScript](types.md)** — Définitions de types partagées
- **[Styles & Thème](styles-theme.md)** — Design system, variables CSS, dark mode
- **[Tests](testing.md)** — Stratégie de tests (unitaires, E2E)

## 🏃 Développement

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
# → http://localhost:3000

# Build production
npm run build
npm start
# → http://localhost:3000

# Linter
npm run lint
```

## 🧪 Tests

```bash
# Unit tests (Jest)
npm test

# Tests en mode watch
npm run test:watch

# Rapport de couverture
npm run test:coverage

# E2E tests (Playwright)
npm run e2e

# E2E with headed browser
npm run e2e:headed

# Voir le rapport E2E
npm run e2e:report
```

## 🔗 Liens utiles

- [Next.js Docs](https://nextjs.org/docs) — Documentation officielle
- [shadcn/ui](https://ui.shadcn.com/) — Composants UI
- [TanStack Query](https://tanstack.com/query/latest) — Data fetching
- [Recharts](https://recharts.org/) — Graphiques React
- [Tailwind CSS v4](https://tailwindcss.com/docs) — Styling
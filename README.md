# Genolens Frontend

Modern, interactive dashboard for the Genolens bioinformatics platform.

## 🚀 Technologies

- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **Visualization**: Recharts, Plotly.js (via react-plotly.js)
- **Data Fetching**: React Query (TanStack Query)
- **Auth**: self-hosted, cookie-based session issued by the Genolens API, with mandatory two-factor (TOTP) authentication

## 🛠 Prerequisites

- **Node.js 18+**
- **npm** or **yarn** or **pnpm**
- Running instance of Genolens Backend

## 📦 Installation & Setup

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Environment Variables

Copy `.env.local.example` to `.env.local`. The variables that matter for a local
setup:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1
AUTH_JWKS_URL=http://localhost:8001/api/v1/auth/jwks.json
AUTH_ISSUER=http://localhost:8001
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3001
```

- `NEXT_PUBLIC_API_URL` is the backend API, with its version prefix.
- `AUTH_JWKS_URL` and `AUTH_ISSUER` are read at runtime by the Next server and the
  middleware to verify the session token (`gl_at` cookie) locally: they must match
  the API's public key set and its `iss` claim.
- `NEXT_PUBLIC_ADMIN_APP_URL` is the origin of the admin app, the only absolute URL
  a post-login `?next=` may point to. It is baked into the bundle at build time.

The backend sets the session cookies. Locally, with no cookie domain configured, they
belong to `localhost` and are shared between the ports 3000 (this app), 3001 (admin)
and 8001 (API). Signing in takes a password and then a 6-digit code from an
authenticator app; an account without a second factor is sent to enrol one.

### 3. Running Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## 📂 Project Structure

```
frontend/
├── public/               # Static assets
├── src/
│   ├── app/              # Next.js App Router pages & layouts
│   ├── components/       # Reusable React components
│   │   ├── admin/        # Admin-specific components
│   │   ├── analysis/     # Analysis widgets (clustering, enrichment, etc.)
│   │   └── ...
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries and configs
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Helper functions (api client, formatters)
└── ...
```

## 🎨 Visualization Components

Genolens frontend features several complex biological visualizations:
- **VolcanoPlot**: Interactive scatter plot for differential expression.
- **HeatmapPlot**: Expression heatmaps with clustering.
- **EnrichmentRadarPlot**: Radar charts for pathway analysis (Up/Down regulation).
- **PCAPlot / UMAPPlot**: Dimensionality reduction plots.

## 🚢 Building for Production

```bash
npm run build
npm start
```

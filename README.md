# Genolens Frontend

Modern, interactive dashboard for the Genolens bioinformatics platform.

## 🚀 Technologies

- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **Visualization**: Recharts, Plotly.js (via react-plotly.js)
- **Data Fetching**: React Query (TanStack Query)
- **Auth**: Supabase Auth helpers for Next.js

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

Create a `.env.local` file based on the example (or required variables):

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

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

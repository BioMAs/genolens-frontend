import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GenoLens — Transcriptomics Platform',
    short_name: 'GenoLens',
    description:
      'Advanced transcriptomics data visualization and analysis powered by AI',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f3f5fa',
    theme_color: '#5d5892',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

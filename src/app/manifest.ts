import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ScaleShift',
    short_name: 'ScaleShift',
    description: 'Track your macros and scan nutrition labels',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#6c5ce7',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

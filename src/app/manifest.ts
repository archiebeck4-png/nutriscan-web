import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ScaleShift',
    short_name: 'ScaleShift',
    description: 'Track your macros and scan nutrition labels',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f2f7',
    theme_color: '#007AFF',
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

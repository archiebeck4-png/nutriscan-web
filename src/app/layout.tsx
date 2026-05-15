import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientLayout from './client-layout';

export const metadata: Metadata = {
  title: 'ScaleShift',
  description: 'Track your macros and scan nutrition labels',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ScaleShift',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').then(function(reg) {
                  // Force an update check every time the app loads
                  reg.update();
                  // Reload the page once a new service worker takes control,
                  // so the user immediately sees the new version.
                  var hasReloaded = false;
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    if (hasReloaded) return;
                    hasReloaded = true;
                    window.location.reload();
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

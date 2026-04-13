import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

export const metadata: Metadata = {
  title: 'Radler – Kurier per Fahrrad',
  description: 'Kurier-Service per Fahrrad in Konstanz',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Radler',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2E7D32',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Google Fonts: Sora, DM Sans, JetBrains Mono */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">
        {children}
        {/* Google Maps einmalig im Root Layout laden */}
        <Script
          id="google-maps"
          src={`https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

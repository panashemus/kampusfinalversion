import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

// 1. Fixes Chrome Mobile Layout & Tab Bar Visibility
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Ensures content extends properly into mobile safe areas
  themeColor: '#000000',
};

// 2. Removes Bolt links and replaces them with official Kampus branding
export const metadata: Metadata = {
  title: 'KAMPUS — Verified Student Safety Network',
  description: 'Your verified student safety network for UB and BAC — campus radar, secure escrow trades, and peer-to-peer community support.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'KAMPUS — Verified Student Safety Network',
    description: 'Campus radar, secure escrow trades, and peer-to-peer community support for UB & BAC.',
    url: 'https://kampusbw.site',
    siteName: 'Kampus',
    images: [
      {
        url: 'https://kampusbw.site/og-image.png', // Uses your custom banner uploaded to /public
        width: 1200,
        height: 630,
        alt: 'Kampus Botswana',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KAMPUS — Verified Student Safety Network',
    description: 'Campus radar, secure escrow trades, and peer-to-peer community support for UB & BAC.',
    images: ['https://kampusbw.site/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-dvh bg-black text-white antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });
export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0B1611'};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.kampusbw.site'),
  title: 'KAMPUS — Verified Student Safety Network',
  description: 'Your verified student safety network for UB and BAC — campus radar, student listings, academic critique, and peer-to-peer community support.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: '332x390' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '332x390' }],
  },
  openGraph: {
    title: 'KAMPUS — Verified Student Safety Network',
    description: 'Campus radar, student listings, academic critique, and peer-to-peer community support for UB & BAC.',
    url: 'https://kampusbw.site',
    siteName: 'Kampus',
    images: [
      {
        url: '/images/ClipSnap_20260723201232.png',
        width: 332,
        height: 390,
        alt: 'Kampus Botswana',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'KAMPUS — Verified Student Safety Network',
    description: 'Campus radar, student listings, academic critique, and peer-to-peer community support for UB & BAC.',
    images: ['/images/ClipSnap_20260723201232.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-[100dvh] w-full overflow-hidden bg-black text-white antialiased flex flex-col`}>
        {children}
        <Toaster />

        {process.env.NEXT_PUBLIC_ANALYTICS_ENABLED==='true'&&<Script src="https://gc.zgo.at/count.js" data-goatcounter="https://kampus.goatcounter.com/count" strategy="afterInteractive"/>}
      </body>
    </html>
  );
}

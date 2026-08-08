import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import GlobalNotificationListener from '@/components/GlobalNotificationListener';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'KAMPUS — Verified Student Safety Network',
  description: 'Your verified student safety network for UB and BAC — campus radar, secure escrow trades, and peer-to-peer community support.',
  manifest: '/manifest.json',
  themeColor: '#000000',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  openGraph: {
    title: 'KAMPUS — Verified Student Safety Network',
    description: 'Campus radar, secure escrow trades, and peer-to-peer community support for UB & BAC.',
    url: 'https://kampusbw.site',
    siteName: 'Kampus',
    images: [
      {
        url: 'https://kampusbw.site/og-image.png',
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
      <body className={`${inter.className} h-[100dvh] w-full overflow-hidden bg-black text-white antialiased flex flex-col`}>
        {children}
        <Toaster />
        <GlobalNotificationListener />
      </body>
    </html>
  );
}

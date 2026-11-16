import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  icons: { icon: [{ url: '/images/rock-n-rolls/logo-160.webp', type: 'image/webp', sizes: '160x160' }], apple: [{ url: '/images/rock-n-rolls/logo.png', type: 'image/png', sizes: '583x583' }] },
};
export default function StoreLayout({ children }: { children: ReactNode }) { return children; }

import type { Metadata } from 'next';
import RockNRollsStorefront from '@/components/RockNRollsStorefront';

export const metadata: Metadata = {
  title: 'Rock ’n Rolls | Gaborone Bakes · KAMPUS Hustle Hub',
  description: 'Explore Rock ’n Rolls brownies, brookies, cinnamon rolls and celebration cakes in Gaborone. Browse the menu and enquire about future availability. Temporary hiatus until 26 November 2026; reopening must be confirmed.',
  alternates: { canonical: '/store/rock-n-rolls' },
  openGraph: { title: 'Rock ’n Rolls · A little sweet. A whole lot of soul.', description: 'Gaborone bakes, on KAMPUS Hustle Hub. Browse the menu and enquire about future dates. Availability must be confirmed.', url: '/store/rock-n-rolls', type: 'website', images: [{ url: '/images/rock-n-rolls/rolls-box.jpg', width: 960, height: 1280, alt: 'Rock ’n Rolls glazed cinnamon rolls' }] },
  twitter: { card: 'summary_large_image', title: 'Rock ’n Rolls · Gaborone Bakes', description: 'Brownies, rolls and celebration cakes. Enquire about future availability.', images: ['/images/rock-n-rolls/rolls-box.jpg'] },
};
export default function RockNRollsPage() { return <RockNRollsStorefront />; }

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RockNRollsStorefront from '@/components/RockNRollsStorefront';
import { PRODUCTS, STORE_PATH } from '@/lib/rock-n-rolls';

export const dynamicParams = false;
export function generateStaticParams() { return PRODUCTS.map(p => ({ product: p.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const { product: slug } = await params;
  const p = PRODUCTS.find(p => p.slug === slug);
  if (!p) return {};
  const image = p.image ? `/images/rock-n-rolls/${p.image}.jpg` : '/images/rock-n-rolls/logo.png';
  return { title: `${p.name} | Rock ’n Rolls · KAMPUS`, description: `${p.description} From P${Math.min(...p.variants.map(v => v.price))}. Enquire about future availability; reopening must be confirmed.`, alternates: { canonical: `${STORE_PATH}/${p.slug}` }, openGraph: { title: `${p.name} · Rock ’n Rolls`, description: p.description, url: `${STORE_PATH}/${p.slug}`, images: [image], type: 'website' }, twitter: { card: 'summary_large_image', title: `${p.name} · Rock ’n Rolls`, description: p.description, images: [image] } };
}
export default async function ProductPage({ params }: { params: Promise<{ product: string }> }) {
  const { product: slug } = await params;
  const p = PRODUCTS.find(p => p.slug === slug);
  if (!p) notFound();
  return <RockNRollsStorefront product={p} />;
}

export const STORE_PATH = '/store/rock-n-rolls';
export const WHATSAPP = '26776454533';
export const TIKTOK = 'https://www.tiktok.com/@_rocknrolls_';
export const AVAILABILITY = 'Temporary hiatus · no orders until 26 November 2026. Reopening and future dates must be confirmed directly.';
export const CONTACT_NOTE = 'Using the WhatsApp number in the newer TikTok bio: +267 76454533. The menu lists +267 77856035; preferred contact is awaiting confirmation.';
export type Category = 'Brownie boxes' | 'Cakes & cupcakes' | 'Rolls & muffins';
export type AddOn = { id: string; name: string; price: number | null };
export type Product = { slug: string; name: string; category: Category; description: string; note?: string; image?: string; variants: { name: string; price: number }[]; addOns: AddOn[] };
const brownieExtras: AddOn[] = [
  { id: 'chocolate-sauce', name: 'Chocolate sauce', price: 10 },
  { id: 'caramel-sauce', name: 'Caramel sauce', price: 10 },
  { id: 'oreos', name: 'Oreos', price: 10 },
  { id: 'chocolate-letters', name: 'Chocolate letters', price: 20 },
  { id: 'sprinkles', name: 'Sprinkles', price: 5 },
];
const cakeExtras: AddOn[] = [{ id: 'edible-print', name: 'Edible print', price: 40 }, { id: 'cake-topper', name: 'Cake topper', price: null }];
export const PRODUCTS: Product[] = [
  { slug: 'fudgy-brownies', name: 'Fudgy brownies', category: 'Brownie boxes', description: 'For the chocolate cravings. Choose your box, then make it yours with a little extra on top.', image: 'brownie-box', note: 'Photo shows an assortment of brownie styles. Ask about your preferred finish.', variants: [{ name: 'Box of 4', price: 90 }, { name: 'Box of 6', price: 130 }], addOns: brownieExtras },
  { slug: 'brookies', name: 'Brookies', category: 'Brownie boxes', description: 'Cookie meets brownie. A box for celebrations, thoughtful gifting or keeping all to yourself.', image: 'brookies', variants: [{ name: 'Box of 4', price: 120 }, { name: 'Box of 6', price: 160 }], addOns: brownieExtras },
  { slug: 'smores-brownies', name: 'S’mores brownies', category: 'Brownie boxes', description: 'The brownie box with a toasted marshmallow moment. Pick your size and enquire about a future date.', image: 'brownie-assortment', note: 'Assortment photo; s’mores brownies are the marshmallow-topped pieces.', variants: [{ name: 'Box of 4', price: 140 }, { name: 'Box of 6', price: 180 }], addOns: brownieExtras },
  { slug: 'cinnamon-rolls', name: 'Cinnamon rolls', category: 'Rolls & muffins', description: 'Pillow-soft swirls and a generous glaze. Sweet little reasons to share a box.', image: 'glazed-rolls', variants: [{ name: 'Box of 4', price: 130 }, { name: 'Box of 6', price: 150 }], addOns: [] },
  { slug: 'muffins', name: 'Muffins', category: 'Rolls & muffins', description: 'A little sweetness for the everyday. Ask which muffin flavours are available for your preferred date.', variants: [{ name: 'Box of 4', price: 50 }, { name: 'Box of 6', price: 70 }], addOns: [] },
  { slug: 'cupcakes', name: 'Cupcakes', category: 'Cakes & cupcakes', description: 'Six little celebrations. Choose from vanilla, chocolate, red velvet or salted caramel.', variants: [{ name: 'Box of 6 · Vanilla', price: 120 }, { name: 'Box of 6 · Chocolate', price: 120 }, { name: 'Box of 6 · Red velvet', price: 130 }, { name: 'Box of 6 · Salted caramel', price: 140 }], addOns: [] },
  { slug: 'bento-cakes', name: 'Bento cakes', category: 'Cakes & cupcakes', description: 'Small cake, big occasion. Go minimalist, pair your cake with two cupcakes, or get creative with a DIY bento.', variants: [{ name: 'Minimalist bento', price: 160 }, { name: 'Cake + 2 cupcakes', price: 220 }, { name: 'DIY bento', price: 180 }], addOns: [...cakeExtras, { id: 'bento-filling', name: 'Bento filling', price: 40 }] },
  { slug: 'sheet-cake', name: 'Sheet cake', category: 'Cakes & cupcakes', description: 'Something sweet for the whole celebration. A 12 × 9 inch sheet cake, with design and flavours to discuss directly.', variants: [{ name: '12 × 9 inches', price: 580 }], addOns: cakeExtras },
];
export const GALLERY = [
  { image: 'brownie-box', alt: 'A box of brownies with toasted marshmallow, cookie and Oreo toppings' },
  { image: 'brownie-assortment', alt: 'Rock ’n Rolls mixed brownie box with marshmallow-topped s’mores brownies' },
  { image: 'rolls-box', alt: 'Glazed cinnamon rolls inside a white window box' },
  { image: 'brookies', alt: 'Brookies decorated with white chocolate hearts and Happy B Day lettering' },
  { image: 'gift-box', alt: 'A pink window box of bakes wrapped with a red ribbon' },
  { image: 'rolls-pull', alt: 'A cinnamon roll lifted from a pan of glazed rolls' },
  { image: 'cake-slice', alt: 'A slice of iced cake on a white plate outdoors' },
  { image: 'glazed-rolls', alt: 'A close view of generous glaze on cinnamon rolls' },
  { image: 'bakes-collage', alt: 'Rock ’n Rolls photo collage showing cinnamon rolls and chocolate brownies' },
];
export type Selection = { slug: string; variant: number; extras: string[]; quantity: number };
export const selectionKey = (line: Selection) => `${line.slug}:${line.variant}:${[...line.extras].sort().join(',')}`;
export function productFor(line: Selection) { return PRODUCTS.find(p => p.slug === line.slug)!; }
export function linePrice(line: Selection) {
  const p = productFor(line);
  return (p.variants[line.variant].price + p.addOns.filter(a => line.extras.includes(a.id)).reduce((sum, a) => sum + (a.price ?? 0), 0)) * line.quantity;
}
// Only retain catalogue identifiers from local storage; never use stored prices or text.
export function readSelections(raw: string | null): Selection[] {
  try {
    const data: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(data)) return [];
    const lines: Selection[] = [];
    for (const value of data.slice(0, 40)) {
      if (!value || typeof value !== 'object') continue;
      const p = PRODUCTS.find(p => p.slug === value.slug);
      if (!p || !Number.isInteger(value.variant) || !p.variants[value.variant] || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 20 || !Array.isArray(value.extras)) continue;
      const extras = Array.from(new Set<string>(value.extras.filter((id: unknown): id is string => typeof id === 'string' && p.addOns.some(a => a.id === id)))).sort();
      const line = { slug: p.slug, variant: value.variant, quantity: value.quantity, extras };
      if (!lines.some(l => selectionKey(l) === selectionKey(line))) lines.push(line);
    }
    return lines;
  } catch { return []; }
}
export type EnquiryDetails = { name: string; date: string; delivery: string; notes: string };
export function buildEnquiry(lines: Selection[], details: EnquiryDetails) {
  const items = lines.map((line, i) => {
    const p = productFor(line);
    const extras = p.addOns.filter(a => line.extras.includes(a.id));
    return `${i + 1}. ${line.quantity} × ${p.name} — ${p.variants[line.variant].name}${extras.length ? '\n   Add-ons per box/cake: ' + extras.map(a => `${a.name} (${a.price === null ? 'price to confirm' : 'P' + a.price})`).join(', ') : ''}\n   Listed subtotal: P${linePrice(line)}${extras.some(a => a.price === null) ? ' + topper price to confirm' : ''}`;
  });
  return ['Hi Rock ’n Rolls! I found you on KAMPUS Hustle Hub.', 'This is an enquiry for a future order, not a confirmed booking. I have seen the temporary hiatus notice (no orders until 26 November 2026). Please confirm reopening and availability.',
    details.name.trim() ? 'Name: ' + details.name.trim().slice(0, 80) : '',
    'Preferred date: ' + (details.date || 'Please advise on future dates'),
    ...items,
    lines.length ? 'Listed items estimate: P' + lines.reduce((sum, line) => sum + linePrice(line), 0) + ' (excludes delivery and unpriced extras).' : 'I would like to ask about your bakes and future availability.',
    'Delivery preference: ' + details.delivery + '. Gaborone P40 / surrounding areas P50, subject to change; please confirm the final quote.',
    details.notes.trim() ? 'Notes / design / dietary questions: ' + details.notes.trim().slice(0, 600) : '',
    'Please confirm flavours, add-on pricing per box/cake, delivery, total and availability before accepting any order.'].filter(Boolean).join('\n\n');
}
export const whatsappLink = (message: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;

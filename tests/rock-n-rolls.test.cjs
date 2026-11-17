const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { PRODUCTS, GALLERY, AVAILABILITY, CONTACT_NOTE, linePrice, readSelections, buildEnquiry, whatsappLink } = require('../lib/rock-n-rolls.ts');

test('menu variants match the supplied price sheet transcription', () => {
  assert.deepEqual(PRODUCTS.map(p => [p.slug, p.variants.map(v => v.price)]), [
    ['fudgy-brownies', [90, 130]], ['brookies', [120, 160]], ['smores-brownies', [140, 180]], ['cinnamon-rolls', [130, 150]], ['cupcakes', [120, 120, 130, 140]], ['bento-cakes', [160, 220, 180]], ['sheet-cake', [580]],
  ]);
  assert.deepEqual(PRODUCTS[0].addOns.map(a => a.price), [10, 10, 10, 20, 5]);
  assert.equal(PRODUCTS.find(p => p.slug === 'sheet-cake').addOns.find(a => a.id === 'cake-topper').price, null);
  assert.ok(!PRODUCTS.find(p => p.slug === 'sheet-cake').addOns.some(a => a.id === 'bento-filling'));
});
test('quantities multiply the variant and chosen add-ons without inventing a topper price', () => {
  assert.equal(linePrice({ slug: 'fudgy-brownies', variant: 1, extras: ['oreos', 'chocolate-letters'], quantity: 2 }), 320);
  assert.equal(linePrice({ slug: 'bento-cakes', variant: 1, extras: ['bento-filling', 'cake-topper'], quantity: 2 }), 520);
});
test('corrupt and tampered saved selections cannot replace catalogue prices or create invalid items', () => {
  for (const raw of ['broken', '{}', 'null', '[null,1,"bad"]']) assert.deepEqual(readSelections(raw), []);
  const valid = { slug: 'brookies', variant: 1, quantity: 2, extras: ['oreos', 'oreos', 'fake', '<script>'], price: 1 };
  assert.deepEqual(readSelections(JSON.stringify([valid, valid, { ...valid, quantity: -1 }, { ...valid, quantity: 21 }, { ...valid, variant: '1' }, { ...valid, slug: 'fake' }])) , [{ slug: 'brookies', variant: 1, quantity: 2, extras: ['oreos'] }]);
});
test('WhatsApp message carries exact choices, delivery caveats, custom text and future availability', () => {
  const lines = [{ slug: 'bento-cakes', variant: 2, extras: ['bento-filling', 'cake-topper'], quantity: 2 }, { slug: 'fudgy-brownies', variant: 0, extras: ['oreos'], quantity: 1 }];
  const msg = buildEnquiry(lines, { name: 'A & B', date: '2026-12-02', delivery: 'Gaborone delivery · listed P40', notes: 'Text: Happy birthday! Pink & cream.' });
  assert.match(msg, /2 × Bento cakes — DIY bento/);
  assert.match(msg, /Cake topper \(price to confirm\)/);
  assert.match(msg, /Listed items estimate: P540/);
  assert.match(msg, /excludes delivery and unpriced extras/);
  assert.match(msg, /subject to change/);
  assert.match(msg, /not a confirmed booking/);
  assert.match(msg, /26 November 2026/);
  const url = new URL(whatsappLink(msg));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/26776454533');
  assert.equal(url.searchParams.get('text'), msg);
  assert.match(CONTACT_NOTE, /77856035/);
  assert.match(AVAILABILITY, /must be confirmed/);
});
test('all referenced photos exist, and every product image opens its exact image in the gallery', () => {
  for (const g of GALLERY) assert.ok(fs.statSync(`public/images/rock-n-rolls/${g.image}.jpg`).size > 10000);
  for (const p of PRODUCTS.filter(p => p.image)) assert.ok(GALLERY.some(g => g.image === p.image));
  const jpeg = fs.readFileSync('public/images/rock-n-rolls/brownie-box.jpg');
  assert.ok(jpeg.length > 50000);
});
test('storefront is discoverable by guests and members with no database order or checkout side effects', () => {
  for (const path of ['components/HustleHub.tsx', 'components/GuestPreview.tsx']) assert.match(fs.readFileSync(path, 'utf8'), /<RockNRollsHubCard/);
  const store = fs.readFileSync('components/RockNRollsStorefront.tsx', 'utf8');
  assert.doesNotMatch(store, /supabase|checkoutSession|createPayment|\.insert\(/);
  assert.match(store, /href="\/#hustle"/);
  assert.match(store, /acknowledged \? <a/);
});

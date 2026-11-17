'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, CakeSlice, Check, ChevronLeft, ChevronRight, Copy, MapPin, MessageCircle, Minus, Plus, Share2, ShoppingBag, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AVAILABILITY, CONTACT_NOTE, GALLERY, PRODUCTS, STORE_PATH, TIKTOK, buildEnquiry, linePrice, productFor, readSelections, selectionKey, whatsappLink, type Category, type Product, type Selection } from '@/lib/rock-n-rolls';
import s from './RockNRollsStorefront.module.css';

const STORAGE = 'kampus:rock-n-rolls:enquiry:v1';
const CATEGORIES: ('All bakes' | Category)[] = ['All bakes', 'Brownie boxes', 'Cakes & cupcakes', 'Cinnamon rolls'];
function Photo({ image, alt, priority = false, className = '', sizes = '(max-width: 640px) 50vw, 33vw' }: { image: string; alt: string; priority?: boolean; className?: string; sizes?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <span className={`${s.photo} ${loaded ? s.loaded : ''} ${className}`}>
    {!failed ? <picture><source type="image/webp" srcSet={`/images/rock-n-rolls/${image}-480.webp 480w, /images/rock-n-rolls/${image}-960.webp 960w`} sizes={sizes} /><Image src={`/images/rock-n-rolls/${image}.jpg`} alt={alt} fill sizes={sizes} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(true); }} /></picture> : <span className={s.photoError}>Photo unavailable. Please try reloading.</span>}
  </span>;
}
function CakeArt({ name }: { name: string }) {
  return <div className={s.cakeArt}><CakeSlice size={68} strokeWidth={1} aria-hidden="true" /><span>{name}</span><small>Made for your moment</small></div>;
}
function BrandMark({ footer = false }: { footer?: boolean }) {
  return <Link href={STORE_PATH} className={s.brand} aria-label="Rock ’n Rolls storefront home"><Image src="/images/rock-n-rolls/logo-320.webp" alt="" width={footer ? 80 : 60} height={footer ? 80 : 60} /><span className={s.wordmark}>rock ’n rolls<span>{footer ? 'FOR YOUR SWEET TOOTH' : 'GABORONE BAKES'}</span></span></Link>;
}
function ProductOptions({ product, onAdd }: { product: Product; onAdd: (line: Selection) => void }) {
  const [variant, setVariant] = useState(0);
  const [extras, setExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const line = { slug: product.slug, variant, extras, quantity };
  const hasUnpriced = product.addOns.some(a => extras.includes(a.id) && a.price === null);
  return <form className={s.options} onSubmit={e => { e.preventDefault(); onAdd(line); setAdded(true); }} onChange={() => setAdded(false)}>
    <fieldset><legend>01 / Choose your {product.slug === 'cupcakes' ? 'flavour' : 'size or style'}</legend><div className={s.variants}>{product.variants.map((v, i) => <label key={v.name} className={variant === i ? s.chosen : ''}><input type="radio" name="variant" checked={variant === i} onChange={() => setVariant(i)} /><span>{v.name}</span><strong>P{v.price}</strong></label>)}</div></fieldset>
    {product.addOns.length > 0 && <fieldset><legend>02 / A little extra?</legend><p className={s.small}>Listed per box/cake for this estimate. Confirm customisation pricing with the baker.</p><div className={s.extras}>{product.addOns.map(a => <label key={a.id}><input type="checkbox" checked={extras.includes(a.id)} onChange={e => setExtras(e.target.checked ? [...extras, a.id] : extras.filter(id => id !== a.id))} /><span>{a.name}</span><strong>{a.price === null ? 'Ask for price' : '+ P' + a.price}</strong></label>)}</div></fieldset>}
    <div className={s.quantityRow}><label htmlFor="box-quantity">Number of boxes / cakes</label><div className={s.stepper}><button type="button" aria-label="Decrease quantity" disabled={quantity === 1} onClick={() => { setQuantity(q => q - 1); setAdded(false); }}><Minus size={16} /></button><input id="box-quantity" aria-label="Quantity" type="number" min={1} max={20} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1))))} /><button type="button" aria-label="Increase quantity" disabled={quantity === 20} onClick={() => { setQuantity(q => q + 1); setAdded(false); }}><Plus size={16} /></button></div></div>
    <div className={s.priceRow}><span>Listed estimate</span><strong>P{linePrice(line)}{hasUnpriced ? ' + topper' : ''}</strong></div>
    <button className={s.primary} type="submit">{added ? <Check size={18} /> : <Plus size={18} />}{added ? 'Added to enquiry list' : 'Add to enquiry list'}<ArrowRight size={18} /></button>
    <p className={s.small} role="status">{added ? 'Your selection is ready. Open “Your enquiry” to review or keep exploring.' : 'Enquiry only. Availability, delivery and final price are confirmed by the baker.'}</p>
  </form>;
}

export default function RockNRollsStorefront({ product }: { product?: Product }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All bakes');
  const [lines, setLines] = useState<Selection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [magnified, setMagnified] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [details, setDetails] = useState({ name: '', date: '', delivery: 'Please discuss delivery / collection', notes: '' });
  const [acknowledged, setAcknowledged] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openEnquiry = () => { returnFocus.current = document.activeElement as HTMLElement; setEnquiryOpen(true); };
  const openPhoto = (index: number) => { returnFocus.current = document.activeElement as HTMLElement; setZoom(index); };
  const restoreFocus = (event: Event) => { event.preventDefault(); returnFocus.current?.focus(); };
  useEffect(() => {
    try { setLines(readSelections(localStorage.getItem(STORAGE))); setSaved(localStorage.getItem('kampus:rock-n-rolls:saved') === 'yes'); } catch { /* Browsing still works without storage. */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) { try { localStorage.setItem(STORAGE, JSON.stringify(lines)); } catch {} } }, [hydrated, lines]);
  useEffect(() => { setMagnified(false); }, [zoom]);
  const addLine = (line: Selection) => {
    setLines(current => {
      const match = current.find(l => selectionKey(l) === selectionKey(line));
      if (match) return current.map(l => l === match ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l);
      return current.length < 40 ? [...current, line] : current;
    });
  };
  const total = lines.reduce((sum, line) => sum + linePrice(line), 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const enquiry = buildEnquiry(lines, details);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Rock ’n Rolls on KAMPUS', url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setFeedback('Storefront link copied'); }
    } catch { setFeedback('Use your browser’s address bar to copy this storefront link.'); }
  };
  const save = () => { setSaved(!saved); try { localStorage.setItem('kampus:rock-n-rolls:saved', saved ? 'no' : 'yes'); } catch {} };
  const galleryIndex = product?.image ? GALLERY.findIndex(g => g.image === product.image) : -1;
  return <main className={s.store} id="rock-store">
    <header className={s.header}>
      <div className={s.utility}><Link href="/#hustle"><ArrowLeft size={15} /><strong>KAMPUS</strong><span>/ Hustle Hub</span></Link><div><button onClick={save} aria-label={saved ? 'Unsave Rock ’n Rolls' : 'Save Rock ’n Rolls'} aria-pressed={saved}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button><button onClick={share} aria-label="Share Rock ’n Rolls"><Share2 size={17} /></button></div></div>
      <div className={s.nav}><BrandMark /><nav aria-label="Rock ’n Rolls navigation"><Link href={`${STORE_PATH}#menu`}>The menu</Link><Link href={`${STORE_PATH}#gallery`}>Gallery</Link><Link href={`${STORE_PATH}#details`}>Good to know</Link></nav><button className={s.bag} onClick={openEnquiry} aria-label={`Your enquiry, ${count} items`}><ShoppingBag size={18} /><span>Your enquiry</span><b>{count}</b></button></div>
    </header>
    <div className={s.hiatus}><span className={s.dot} />Taking a little break. <strong>No orders until 26 November 2026.</strong><span>Future dates? Enquire first.</span></div>
    {feedback && <p className={s.feedback} role="status">{feedback}<button onClick={() => setFeedback('')} aria-label="Dismiss message">×</button></p>}
    {!product ? <>
      <section className={s.hero} aria-labelledby="store-title">
        <div className={s.heroCopy}><span className={s.eyebrow}>For all of your sweet tooth cravings</span><h1 id="store-title">A little sweet.<br />A whole lot<br /><em>of soul.</em></h1><p>Fudgy brownies, pillow-soft rolls and cakes for your kind of celebration. Meet Rock ’n Rolls, baked in Gaborone.</p><div className={s.actions}><a className={s.primary} href="#menu">Find your sweet spot <ArrowRight size={18} /></a><a href="#gallery" className={s.textLink}>Take a closer look <ZoomIn size={16} /></a></div><div className={s.heroFoot}><Image src="/images/rock-n-rolls/logo-320.webp" alt="Rock ’n Rolls logo" width={72} height={72} /><span>Small moments. Big cravings.<br /><strong>Made in Gaborone, Botswana.</strong></span></div></div>
        <div className={s.heroVisual}><Photo image="rolls-box" alt="A box of Rock ’n Rolls cinnamon rolls covered in glaze" priority sizes="(max-width: 760px) 100vw, 50vw" /><span className={s.stamp}>let the<br /><em>good times</em><br />roll.</span><div className={s.heroCaption}><span>THE CINNAMON ROLL MOMENT</span><Link href={`${STORE_PATH}/cinnamon-rolls`}>Box of 4 · P130 <ArrowRight size={18} /></Link></div></div>
      </section>
      <div className={s.ribbon} aria-hidden="true"><span>BROWNIES</span><i>✳</i><span>BROOKIES</span><i>✳</i><span>CINNAMON ROLLS</span><i>✳</i><span>CAKES & LITTLE CELEBRATIONS</span></div>
      <section id="menu" className={s.section} aria-labelledby="menu-title"><div className={s.sectionHeading}><div><span className={s.eyebrow}>THE CRAVINGS COLLECTION</span><h2 id="menu-title">Pick your <em>happy.</em></h2></div><p>Something chocolatey. Something swirly.<br />Something just for you.</p></div>
        <div className={s.filters} role="group" aria-label="Filter bakes">{CATEGORIES.map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className={s.products}>{PRODUCTS.filter(p => category === 'All bakes' || p.category === category).map((p, index) => <article className={s.card} key={p.slug}><Link href={`${STORE_PATH}/${p.slug}`} className={s.cardPhoto} aria-label={`Explore ${p.name}`}>{p.image ? <Photo image={p.image} alt={`${p.name}${p.note ? ' — assortment shown' : ''}`} /> : <CakeArt name={p.name} />}<span className={s.cardTag}>{p.category}</span><span className={s.cardArrow}><ArrowRight size={22} /></span></Link><div className={s.cardInfo}><div><span className={s.index}>{String(index + 1).padStart(2, '0')}</span><h3><Link href={`${STORE_PATH}/${p.slug}`}>{p.name}</Link></h3></div><p>From <strong>P{Math.min(...p.variants.map(v => v.price))}</strong></p></div><p className={s.cardNote}>{p.variants.map(v => `${v.name} · P${v.price}`).join(' / ')}</p></article>)}</div>
      </section>
      <section className={s.feature}><div className={s.featureImage}><Photo image="gift-box" alt="A ribbon-wrapped box of Rock ’n Rolls bakes, ready for gifting" sizes="(max-width:760px) 100vw, 45vw" /></div><div><span className={s.eyebrow}>SAY IT WITH SOMETHING SWEET</span><h2>For the birthdays.<br />The just-becauses.<br /><em>The you-deserve-its.</em></h2><p>Build a brownie box, choose a little cake, or ask about a personal touch. Tell the baker what you have in mind and confirm the details together.</p><Link className={s.lightButton} href={`${STORE_PATH}/bento-cakes`}>Explore celebration cakes <ArrowRight size={18} /></Link></div></section>
      <section id="gallery" className={s.section} aria-labelledby="gallery-title"><div className={s.sectionHeading}><div><span className={s.eyebrow}>STRAIGHT FROM THE BAKERY</span><h2 id="gallery-title">Feast your <em>eyes.</em></h2></div><p>Real bakes from Rock ’n Rolls.<br />Tap a photo to zoom in.</p></div><div className={s.gallery}>{GALLERY.map((g, i) => <button key={g.image} onClick={() => openPhoto(i)} aria-label={`Zoom: ${g.alt}`}><Photo image={g.image} alt={g.alt} sizes="(max-width:640px) 50vw, 25vw" /><span><ZoomIn size={19} /></span></button>)}</div><p className={s.small}>A taste of previous bakes. Designs shown are inspiration; flavours, custom details and availability are confirmed directly.</p></section>
    </> : <section className={`${s.section} ${s.productSection}`}>
      <Link href={`${STORE_PATH}#menu`} className={s.back}><ArrowLeft size={16} /> Back to the menu</Link><div className={s.productDetail}><div><div className={s.detailPhoto}>{product.image ? <><Photo image={product.image} alt={product.note || product.name} priority sizes="(max-width:760px) 100vw, 50vw" /><button className={s.zoomButton} onClick={() => openPhoto(galleryIndex >= 0 ? galleryIndex : 0)} aria-label="Zoom product photo"><ZoomIn size={20} /></button></> : <CakeArt name={product.name} />}</div>{product.note && <p className={s.small}>{product.note}</p>}{!product.image && <p className={s.small}>Discuss flavours and your design with the baker. Visit the gallery for examples of previous bakes.</p>}</div><div className={s.detailCopy}><span className={s.eyebrow}>{product.category}</span><h1>{product.name}</h1><p>{product.description}</p><ProductOptions key={product.slug} product={product} onAdd={addLine} /><Link className={s.textLink} href={`${STORE_PATH}#gallery`}>Explore the bakery gallery <ArrowRight size={16} /></Link></div></div><div className={s.related}><span className={s.eyebrow}>MORE TO FALL FOR</span><div>{PRODUCTS.filter(p => p.slug !== product.slug).slice(0, 3).map(p => <Link key={p.slug} href={`${STORE_PATH}/${p.slug}`}>{p.name}<span>From P{Math.min(...p.variants.map(v => v.price))} <ArrowRight size={16} /></span></Link>)}</div></div>
    </section>}
    <section id="details" className={`${s.section} ${s.details}`} aria-labelledby="details-title"><div><span className={s.eyebrow}>A FEW SWEET DETAILS</span><h2 id="details-title">Good to <em>know.</em></h2><p>Browse now, plan something lovely for later. Every enquiry goes directly to Rock ’n Rolls.</p></div><div className={s.faqs}><details open><summary>When can I order?</summary><p>{AVAILABILITY} Your list is a wishlist, not an accepted preorder. Please wait for the baker to confirm your date.</p></details><details><summary>Delivery & collection</summary><p>Gaborone delivery P40. Surrounding areas P50, subject to change. Confirm the area, fee and any collection arrangements directly. Delivery is excluded from item estimates.</p></details><details><summary>Personal touches & dietary questions</summary><p>Brownie extras: chocolate sauce, caramel sauce and Oreos P10 each; chocolate letters P20; sprinkles P5. Cake extras: edible print P40, bento filling P40, cake topper price on enquiry. Ask about ingredients, allergens and suitability before placing an order.</p></details><details><summary>How does my enquiry work?</summary><p>Choose a product, variant and any extras. Review your list, add a date and your notes, then open WhatsApp with a message ready for you to send. KAMPUS does not take payment or confirm orders.</p></details><details><summary>Which number should I use?</summary><p>{CONTACT_NOTE}</p><a href={TIKTOK} target="_blank" rel="noopener noreferrer">View @_rocknrolls_ on TikTok <ArrowRight size={14} /></a></details></div></section>
    <section className={s.location}><MapPin size={25} /><div><h3>Baked in Gaborone.</h3><p>Explore the general city area. Ask the baker for collection details.</p></div><Link href="/#radar?search=Gaborone%20Rock%20n%20Rolls">View city in Radar <ArrowRight size={17} /></Link></section>
    <footer className={s.footer}><BrandMark footer /><div><a href={TIKTOK} target="_blank" rel="noopener noreferrer">@_rocknrolls_ <ArrowRight size={15} /></a><Link href="/#hustle">Back to Hustle Hub <ArrowRight size={15} /></Link></div><p>Curated on KAMPUS · Prices from the supplied menu. All orders, availability and final quotes are handled directly by Rock ’n Rolls.</p><p>{CONTACT_NOTE}</p></footer>
    <div className={s.stickyEnquiry}><span><strong>{count ? `${count} ${count === 1 ? 'selection' : 'selections'} · P${total}` : 'Something sweet in mind?'}</strong><small>{count ? 'Items estimate · delivery & unpriced extras excluded' : 'Future dates are subject to confirmation'}</small></span><button className={s.primary} onClick={openEnquiry}><MessageCircle size={18} /><span>{count ? 'Review enquiry' : 'Enquire'}</span><ArrowRight size={17} /></button></div>
    <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}><DialogContent className={s.enquiryDialog} onCloseAutoFocus={restoreFocus}><DialogTitle className={s.dialogTitle}>Your sweet little list.</DialogTitle><DialogDescription className={s.dialogDescription}>An enquiry for future availability. Nothing is ordered or paid for here.</DialogDescription><div className={s.notice}>{AVAILABILITY}</div><div className={s.lines}>{lines.length === 0 ? <p>No bakes selected yet. Browse the menu or send a general enquiry below.</p> : lines.map((line, i) => { const p = productFor(line); return <div key={selectionKey(line)} className={s.line}><div><strong>{line.quantity} × {p.name}</strong><span>{p.variants[line.variant].name}</span><small>{p.addOns.filter(a => line.extras.includes(a.id)).map(a => `${a.name}${a.price === null ? ' (price to confirm)' : ''}`).join(', ') || 'No add-ons'}</small></div><div><strong>P{linePrice(line)}</strong><button onClick={() => setLines(current => current.filter((_, n) => n !== i))} aria-label={`Remove ${p.name}`}>Remove</button></div></div>; })}</div>{lines.length > 0 && <p className={s.listTotal}>Items estimate <strong>P{total}</strong><small>Excludes delivery and unpriced extras. Quantities capped at 20 per selection.</small></p>}
      <div className={s.enquiryFields}><label>Your name (optional)<input autoComplete="given-name" maxLength={80} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} /></label><label>Preferred future date (optional)<input type="date" min="2026-11-26" value={details.date} onInput={e => { const date = e.currentTarget.value; setDetails(current => ({ ...current, date })); }} onChange={e => setDetails(current => ({ ...current, date: e.target.value }))} /></label><label>Delivery preference<select value={details.delivery} onChange={e => setDetails({ ...details, delivery: e.target.value })}><option>Please discuss delivery / collection</option><option>Gaborone delivery · listed P40</option><option>Surrounding areas delivery · listed P50</option><option>Ask about collection</option></select></label><label>Design, flavours or dietary questions (optional)<textarea rows={3} maxLength={600} value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} /></label></div>
      <p className={s.contactNote}>{CONTACT_NOTE}</p><label className={s.acknowledge}><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />I understand the hiatus notice and that my enquiry needs confirmation.</label><details className={s.messagePreview}><summary>Preview WhatsApp message</summary><pre>{enquiry}</pre></details>{acknowledged ? <a className={s.primary} href={whatsappLink(enquiry)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} />Open WhatsApp enquiry <ArrowRight size={17} /></a> : <button className={s.primary} disabled>Read and acknowledge the notice above</button>}<button className={s.copyButton} onClick={async () => { try { await navigator.clipboard.writeText(enquiry); setFeedback('Enquiry message copied'); } catch { setFeedback('Expand “Preview WhatsApp message” to copy your enquiry.'); } }}><Copy size={15} />Copy enquiry text</button><p className={s.small}>Review the message in WhatsApp and send it when ready. No message is sent automatically.</p></DialogContent></Dialog>
    <Dialog open={zoom !== null} onOpenChange={open => { if (!open) setZoom(null); }}><DialogContent className={s.zoomDialog} onCloseAutoFocus={restoreFocus} onKeyDown={e => { if (e.key === 'ArrowRight') setZoom(i => i === null ? null : (i + 1) % GALLERY.length); if (e.key === 'ArrowLeft') setZoom(i => i === null ? null : (i + GALLERY.length - 1) % GALLERY.length); }}><DialogTitle className="sr-only">Bakery photo viewer</DialogTitle><DialogDescription className="sr-only">Use previous and next to browse. Toggle zoom for more detail. Press Escape to close.</DialogDescription>{zoom !== null && <><div className={`${s.zoomViewport} ${magnified ? s.magnified : ''}`}><Image src={`/images/rock-n-rolls/${GALLERY[zoom].image}.jpg`} alt={GALLERY[zoom].alt} width={960} height={1280} /></div><div className={s.zoomControls}><button aria-label="Previous photo" onClick={() => setZoom((zoom + GALLERY.length - 1) % GALLERY.length)}><ChevronLeft size={22} /></button><span>{zoom + 1} / {GALLERY.length}</span><button aria-label={magnified ? 'Zoom out' : 'Zoom in'} onClick={() => setMagnified(!magnified)}><ZoomIn size={20} /></button><button aria-label="Next photo" onClick={() => setZoom((zoom + 1) % GALLERY.length)}><ChevronRight size={22} /></button></div><p>{GALLERY[zoom].alt}</p></>}</DialogContent></Dialog>
  </main>;
}

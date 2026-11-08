'use client';
import Link from 'next/link';

import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowRight,Bookmark,CalendarDays,Check,ChevronDown,ChevronLeft,ChevronRight,Clock3,ExternalLink,Heart,Instagram,MapPin,MessageCircle,Send,ShieldCheck,Sparkles,X} from 'lucide-react';

type StyleTag='All'|'Pink'|'Chrome'|'Floral'|'Black'|'Square'|'Stiletto'|'Almond'|'French'|'Graphic';
type Look={name:string;tags:StyleTag[]};
const LOOKS:Look[]=[
 {name:'Pink shimmer and gilded tips',tags:['Pink','Stiletto']},
 {name:'Monochrome statement art',tags:['Black','Graphic','Square']},
 {name:'Burgundy glass manicure',tags:['Black','Square']},
 {name:'Colour-pop graphic nails',tags:['Graphic','Stiletto']},
 {name:'Azure gemstone accent',tags:['Chrome','Stiletto']},
 {name:'Silver spotted chrome',tags:['Chrome','Square']},
 {name:'Silver crystal statement',tags:['Chrome','Stiletto']},
 {name:'Modern pink graphic tips',tags:['Pink','Graphic','Stiletto']},
 {name:'Hot pink mirror shine',tags:['Pink','Square','Chrome']},
 {name:'Soft patterned French tips',tags:['French','Square']},
 {name:'Black outlined stilettos',tags:['Black','Stiletto','French']},
 {name:'Blue botanical details',tags:['Floral','Almond']},
 {name:'Classic white square tips',tags:['Square','French']},
 {name:'Champagne sculpted French',tags:['French','Stiletto']},
 {name:'Rose metallic cat-eye',tags:['Chrome','Stiletto']},
 {name:'Neutral floral detailing',tags:['Floral','French']},
 {name:'Glossy rose blush',tags:['Pink','Almond']},
 {name:'Colour-blocked playful art',tags:['Graphic','Square']},
 {name:'Pink floral French',tags:['Pink','Floral','Almond']},
 {name:'Burgundy pointed French',tags:['Black','French','Stiletto']},
 {name:'Delicate soft nude tips',tags:['French','Almond']},
 {name:'Plum satin chrome',tags:['Chrome','Almond']},
 {name:'Mulberry metallic finish',tags:['Chrome','Square']},
 {name:'Pink petal accents',tags:['Pink','Floral','Almond']},
];
const FILTERS:StyleTag[]=['All','Pink','Chrome','Floral','Black','Square','Stiletto','Almond','French','Graphic'];
const PHONE='26778348637';
const TIKTOK='https://www.tiktok.com/@hernailtech';
const RADAR='/#radar?search=Tlokweng%2C%20Metlhabeng';
const messageLink=(text:string)=>'https://wa.me/'+PHONE+'?text='+encodeURIComponent(text);
function pictureStyle(index:number):CSSProperties{
 const col=index%6,row=Math.floor(index/6);
 return {backgroundImage:"url('/images/her-nail-tech/lookbook.svg')",backgroundRepeat:'no-repeat',backgroundSize:'600% 400%',backgroundPosition:(col*20)+'% '+(row*100/3)+'%'};
}
const policies=[
 {name:'Late coming',text:'Please communicate as soon as possible if you are running late. A 10-minute grace period applies; after that, your appointment is automatically cancelled. No late fee is charged. A full set may take between 1 hour 30 minutes and 2 hours 30 minutes.'},
 {name:'Bookings & deposit',text:'A P30 deposit secures a confirmed appointment, is deducted from the final total and is non-refundable. No deposit means no booking. Check availability before paying.'},
 {name:'Extra guests',text:'Please communicate in advance if you plan to bring a guest. No children are allowed.'},
 {name:'Payment',text:'Once your date is confirmed, the posted deposit method is FNB PayToCell 73108066. Send your proof of payment through WhatsApp. Do not pay before the technician confirms availability.'},
];
function Photo({index,className='',onClick,label}:{index:number;className?:string;onClick?:()=>void;label?:string}){
 const style=pictureStyle(index);
 return <button type="button" onClick={onClick} aria-label={label||'Open '+LOOKS[index].name} className={'group relative isolate block overflow-hidden bg-[#201b22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white '+className}>
   <span aria-hidden="true" className="absolute inset-0 block bg-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.045] group-focus-visible:scale-[1.045]" style={style}/>
   <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-90 motion-safe:transition-opacity"/>
 </button>;
}
export default function HerNailTechStorefront(){
 const [filter,setFilter]=useState<StyleTag>('All');
 const [selected,setSelected]=useState<number|null>(null);
 const [saved,setSaved]=useState(false);
 const [name,setName]=useState('');
 const [date,setDate]=useState('');
 const [soakOff,setSoakOff]=useState(false);
 const [selectedDesign,setSelectedDesign]=useState<number|null>(null);
 const [accepted,setAccepted]=useState(false);
 const [openPolicies,setOpenPolicies]=useState<number[]>([]);
 const [copied,setCopied]=useState(false);
 const shown=useMemo(()=>LOOKS.map((look,index)=>({...look,index})).filter(x=>filter==='All'||x.tags.includes(filter)),[filter]);
 useEffect(()=>{try{setSaved(localStorage.getItem('kampus:save:her-nail-tech')==='yes');}catch{}},[]);
 useEffect(()=>{
  if(selected===null)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setSelected(null);if(e.key==='ArrowRight')setSelected(p=>p===null?p:(p+1)%LOOKS.length);if(e.key==='ArrowLeft')setSelected(p=>p===null?p:(p+LOOKS.length-1)%LOOKS.length);};
  window.addEventListener('keydown',onKey);const old=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{window.removeEventListener('keydown',onKey);document.body.style.overflow=old;};
 },[selected]);
 const save=()=>{const next=!saved;setSaved(next);try{localStorage.setItem('kampus:save:her-nail-tech',next?'yes':'no');}catch{}};
 const openBooking=(design:number|null=selectedDesign)=>{
  const intro='Hi HER NAIL TECH! I would like to enquire about an appointment.';
  const msg=[intro,name.trim()?'My name: '+name.trim():'My name: [your name]',date?'Preferred date: '+date:'Preferred date: [your date]',design!==null?'Design: '+LOOKS[design].name:'Design: [please describe / attach a photo]','Soak-off needed: '+(soakOff?'Yes':'No'),'Please let me know if this date is available before I send any deposit.'].join('\n');
  window.open(messageLink(msg),'_blank','noopener,noreferrer');
 };
 const share=async()=>{const url=window.location.href;try{if(navigator.share){await navigator.share({title:'HER NAIL TECH on KAMPUS',url});}else{await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),2500);}}catch{}};
 const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
 const button='inline-flex items-center justify-center gap-2 min-h-11 rounded-full px-5 text-sm font-semibold motion-safe:transition-all motion-safe:duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
 return <main className="min-h-[100dvh] bg-[#090909] text-[#f8f5f6] selection:bg-[#f0d6df] selection:text-black" style={{fontFamily:"Arial, Helvetica, sans-serif"}}>
  <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090909]/95 backdrop-blur-xl">
   <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
    <Link href="/#hustle" className="flex min-h-11 items-center gap-2 text-sm text-[#d9d0d4] hover:text-white"><ArrowLeft size={17}/> <span className="font-semibold">KAMPUS</span><span className="hidden text-[#8a8187] sm:inline">/ Hustle Hub</span></Link>
    <span className="text-[11px] font-bold uppercase tracking-[.22em] text-[#d9c4cf]">Featured studio</span>
    <div className="flex items-center gap-1"><button className="rounded-full p-3 hover:bg-white/10" onClick={save} aria-label={saved?'Remove from saved':'Save storefront'}><Bookmark size={18} fill={saved?'currentColor':'none'}/></button><button className="rounded-full p-3 hover:bg-white/10" onClick={share} aria-label="Share storefront">{copied?<Check size={18}/>:<ExternalLink size={18}/>}</button></div>
   </div>
  </header>
  <div className="mx-auto max-w-6xl px-3 pb-28 sm:px-7">
   <section className="relative mt-4 overflow-hidden rounded-[1.75rem] border border-[#62505a] bg-[radial-gradient(ellipse_at_92%_12%,#543b48_0%,transparent_50%),linear-gradient(120deg,#181215,#080808_70%)] p-5 shadow-[0_22px_65px_rgba(0,0,0,.5)] sm:p-9">
    <div className="pointer-events-none absolute -right-5 top-12 h-56 w-48 rotate-[-12deg] opacity-50 blur-[1px] sm:right-12 sm:h-72 sm:w-60"><span className="block h-full w-full rounded-3xl" style={pictureStyle(14)}/></div>
    <div className="relative z-10 max-w-3xl">
     <div className="flex items-start gap-4 sm:gap-6">
      <div role="img" aria-label="HER NAIL TECH official TikTok profile logo" className="h-20 w-20 shrink-0 rounded-full border border-[#d2b9c6]/60 bg-black shadow-[0_0_32px_rgba(233,201,216,.17)] sm:h-28 sm:w-28" style={{backgroundImage:"url('/images/her-nail-tech/logo.svg')",backgroundSize:'cover',backgroundPosition:'center'}}/>
      <div className="min-w-0">
       <p className="mb-1 text-[10px] uppercase tracking-[.2em] text-[#e4c8d5]">Independent nail studio · Tlokweng</p>
       <h1 className="font-serif text-3xl leading-tight tracking-[-.035em] sm:text-5xl">HER NAIL TECH <span className="text-[#eddae3]">♡</span></h1>
       <p className="mt-2 max-w-md font-serif text-[15px] italic leading-relaxed text-[#dfd0d7] sm:text-lg">Nails that make a statement. A lookbook of glossy finishes, delicate details and unapologetic nail art.</p>
      </div>
     </div>
     <div className="mt-5 flex flex-wrap gap-2">
      <Link href={RADAR} className="inline-flex items-center gap-1.5 rounded-full border border-[#d4bec8]/40 bg-black/35 px-3 py-2 text-xs hover:bg-white/10"><MapPin size={14}/> Tlokweng, Metlhabeng</Link>
      <span className="rounded-full border border-[#d4bec8]/40 bg-black/35 px-3 py-2 text-xs"><CalendarDays size={13} className="mr-1 inline"/> Book 1 week ahead</span>
      <span className="rounded-full border border-[#d4bec8]/40 bg-black/35 px-3 py-2 text-xs">P30 deposit after confirmation</span>
      <span className="rounded-full border border-[#d4bec8]/40 bg-black/35 px-3 py-2 text-xs">No walk-ins</span>
     </div>
     <div className="mt-6 flex flex-wrap gap-2">
      <button className={button+' bg-[#f7edf1] text-[#151015] hover:bg-white'} onClick={()=>jump('booking')}><MessageCircle size={17}/> Book on WhatsApp <ArrowRight size={16}/></button>
      <Link className={button+' border border-white/45 bg-black/40 hover:bg-white/10'} href={RADAR}><MapPin size={16}/> View location</Link>
      <button className={button+' border border-white/45 bg-black/40 hover:bg-white/10'} onClick={()=>jump('lookbook')}>Explore gallery <ArrowRight size={16}/></button>
     </div>
    </div>
   </section>
   <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#171317] px-2 py-4 text-center sm:px-6">
    <a href={TIKTOK} target="_blank" rel="noopener noreferrer" className="border-r border-white/15 hover:text-white"><span className="block text-base font-bold sm:text-xl">2,489</span><span className="mt-1 block text-[10px] text-[#bcb1b7] sm:text-xs">TikTok followers*</span></a>
    <a href={TIKTOK} target="_blank" rel="noopener noreferrer" className="border-r border-white/15 hover:text-white"><span className="block text-base font-bold sm:text-xl">102.6K</span><span className="mt-1 block text-[10px] text-[#bcb1b7] sm:text-xs">TikTok likes*</span></a>
    <div><span className="block text-base font-bold sm:text-xl">1 week</span><span className="mt-1 block text-[10px] text-[#bcb1b7] sm:text-xs">Advance booking</span></div>
   </div>
   <div className="mt-4 grid gap-5 lg:grid-cols-[1.08fr_.92fr] lg:items-start">
    <section id="lookbook" className="scroll-mt-24 rounded-3xl border border-white/10 bg-[#111013] p-4 sm:p-6">
     <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[.18em] text-[#cbabbc]">The nail edit</p><h2 className="mt-1 font-serif text-3xl italic sm:text-4xl">Lookbook <span className="text-[#d8b6c6]">✧</span></h2></div><span className="text-xs text-[#b4a9b0]">{shown.length} looks</span></div>
     <div role="group" aria-label="Filter nail looks" className="mb-4 mt-5 flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map(tag=><button key={tag} onClick={()=>setFilter(tag)} aria-pressed={filter===tag} className={'shrink-0 rounded-full border px-3 py-1.5 text-xs motion-safe:transition-colors '+(filter===tag?'border-[#f3dce6] bg-[#f3e6ed] text-[#171018]':'border-[#5f535c] bg-[#211c21] text-[#e9e2e6] hover:border-white')}>{tag}</button>)}
     </div>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {shown.map(({index,name})=><div key={index} className="relative overflow-hidden rounded-2xl border border-[#453b42] bg-[#201b22]">
       <Photo index={index} className="aspect-[120/136] w-full" label={'Open '+name} onClick={()=>setSelected(index)}/>
       <div className="flex min-h-12 items-center justify-between gap-2 px-2.5 py-2"><span className="line-clamp-2 text-[11px] text-[#f0e9ed]">{name}</span><button aria-label={'Book '+name} className="shrink-0 rounded-full border border-white/20 p-2 hover:bg-white/10" onClick={()=>{setSelectedDesign(index);jump('booking');}}><ArrowRight size={15}/></button></div>
      </div>)}
     </div>
     <p className="mt-4 text-[11px] leading-relaxed text-[#ac9fa6]">Design references from HER NAIL TECH’s shared TikTok portfolio. Photos are cropped from supplied screenshots; final availability and design details must be confirmed with the technician.</p>
     <div className="mt-5"><h3 className="font-serif text-2xl italic">Explore styles</h3><div className="mt-3 flex flex-wrap gap-2">{['Soft glam','Chrome & metallic','French tips','Floral detail','Graphic statements','Classic shapes'].map((label,i)=><button key={label} className="rounded-full border border-[#6b5762] px-3 py-2 text-xs text-[#e8d8e0] hover:bg-white/10" onClick={()=>setFilter((['Pink','Chrome','French','Floral','Graphic','Square'] as StyleTag[])[i])}>{label}</button>)}</div></div>
    </section>
    <div className="space-y-5">
     <section id="booking" className="scroll-mt-24 rounded-3xl border border-[#59434f] bg-[linear-gradient(155deg,#231921,#101013_65%)] p-5 sm:p-6">
      <p className="text-[11px] uppercase tracking-[.18em] text-[#ceadbe]">Appointments</p><h2 className="mt-1 font-serif text-3xl italic">Your next set starts here</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#c6b8c0]">Appointments fill quickly. Please enquire at least one week in advance. No walk-ins or last-minute bookings.</p>
      <div className="mt-5 space-y-4">
       <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2e6ec] font-bold text-black">1</span><div><h3 className="font-semibold">Choose a date and design</h3><p className="mt-1 text-sm text-[#bcb0b7]">WhatsApp your name, preferred date, desired design and whether you need a soak-off.</p></div></div>
       <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2e6ec] font-bold text-black">2</span><div><h3 className="font-semibold">Confirm before paying</h3><p className="mt-1 text-sm text-[#bcb0b7]">Wait for availability confirmation. Then send the P30 non-refundable deposit, deducted from your final total, and your proof of payment via WhatsApp.</p><p className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">Posted payment reference: <strong>FNB PayToCell 73108066</strong><br/>Deposit: <strong>P30, after confirmation only</strong></p></div></div>
       <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2e6ec] font-bold text-black">3</span><div><h3 className="font-semibold">Plan ahead</h3><p className="mt-1 text-sm text-[#bcb0b7]">A full set typically takes between 1 hour 30 minutes and 2 hours 30 minutes.</p></div></div>
       <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2e6ec] font-bold text-black">4</span><div><h3 className="font-semibold">Receive directions</h3><p className="mt-1 text-sm text-[#bcb0b7]">The technician sends the exact directions two days before your appointment.</p></div></div>
      </div>
      <form className="mt-6 space-y-3" onSubmit={e=>{e.preventDefault();if(accepted)openBooking();}}>
       <label className="block text-xs font-semibold text-[#e7d4dc]">Your name <input value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="Your name" className="mt-1 w-full rounded-xl border border-[#5c4d57] bg-black/40 p-3 text-sm text-white placeholder:text-[#8f8289] focus:border-white focus:outline-none"/></label>
       <label className="block text-xs font-semibold text-[#e7d4dc]">Preferred date <input value={date} onChange={e=>setDate(e.target.value)} type="date" min={new Date().toISOString().slice(0,10)} className="mt-1 w-full rounded-xl border border-[#5c4d57] bg-[#211a20] p-3 text-sm text-white focus:border-white focus:outline-none"/></label>
       <div className="text-xs text-[#e7d4dc]">Selected design: <span className="font-semibold text-white">{selectedDesign===null?'Ask for recommendations':LOOKS[selectedDesign].name}</span>{selectedDesign!==null&&<button className="ml-2 underline text-[#cba4b6]" type="button" onClick={()=>setSelectedDesign(null)}>Clear</button>}</div>
       <label className="flex items-center gap-3 text-sm text-[#e8d8e0]"><input type="checkbox" checked={soakOff} onChange={e=>setSoakOff(e.target.checked)} className="h-4 w-4 accent-[#d1adbd]"/> I need a soak-off</label>
       <label className="flex items-start gap-3 text-sm text-[#e8d8e0]"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[#d1adbd]"/> I’ve read the booking policies and understand the deposit is sent only after availability is confirmed.</label>
       <button disabled={!accepted} type="submit" className={button+' w-full bg-[#f7edf1] text-[#181017] disabled:cursor-not-allowed disabled:opacity-50'}><MessageCircle size={17}/> Enquire on WhatsApp <ArrowRight size={17}/></button>
       <p className="text-[11px] text-[#aca0a7]">This opens WhatsApp with a prefilled message. KAMPUS does not collect deposits or confirm appointments.</p>
      </form>
     </section>
     <section className="rounded-3xl border border-white/10 bg-[#171317] p-5 sm:p-6">
      <h2 className="font-serif text-3xl italic">Studio policies</h2><div className="mt-4 space-y-2">
       {policies.map((policy,index)=><div key={policy.name} className="rounded-xl border border-[#544751] bg-black/20">
        <button type="button" aria-expanded={openPolicies.includes(index)} onClick={()=>setOpenPolicies(v=>v.includes(index)?v.filter(x=>x!==index):[...v,index])} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-semibold hover:bg-white/5">{policy.name}<ChevronDown size={17} className={'motion-safe:transition-transform '+(openPolicies.includes(index)?'rotate-180':'')}/></button>
        {openPolicies.includes(index)&&<p className="border-t border-white/10 px-3 py-3 text-sm leading-relaxed text-[#c4b8c0]">{policy.text}</p>}
       </div>)}
      </div>
     </section>
     <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_90%_20%,#44313d,transparent_60%),#161216] p-5 sm:p-6">
      <p className="text-[11px] uppercase tracking-[.18em] text-[#cdaabf]">Find the studio</p><h2 className="mt-1 font-serif text-3xl italic">Tlokweng, Metlhabeng</h2><p className="mt-3 text-sm text-[#cfc1c9]">Explore the general area in Kampus Radar. Exact directions are sent by HER NAIL TECH two days before a confirmed booking.</p>
      <Link href={RADAR} className={button+' mt-4 border border-[#e9d7e0] bg-white/10 hover:bg-white/20'}><MapPin size={17}/> Open in Radar <ArrowRight size={15}/></Link>
     </section>
     <section className="rounded-3xl border border-white/10 bg-[#151215] p-5">
      <div className="flex gap-3"><ShieldCheck size={19} className="shrink-0 text-[#e5cbd7]"/><p className="text-xs leading-relaxed text-[#b9abb3]">Curated KAMPUS showcase based on HER NAIL TECH’s publicly shared information. Booking, availability, prices and payments are handled directly by the technician. This is not a verified owner-managed listing. Social counts are a snapshot from the supplied screenshots, not live totals.</p></div>
      <a href={TIKTOK} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#e9d5df] hover:underline"><Instagram size={17}/> See @hernailtech on TikTok <ExternalLink size={14}/></a>
     </section>
    </div>
   </div>
  </div>
  <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#66545f] bg-[#0c0b0d]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
   <div className="mx-auto flex max-w-6xl gap-2">
    <button className={button+' flex-1 bg-[#f4e9ef] px-3 text-[#181016]'} onClick={()=>jump('booking')}><MessageCircle size={18}/> Book <span className="hidden sm:inline">on WhatsApp</span></button>
    <Link className={button+' flex-1 border border-[#a996a0] bg-[#1e181d] px-3'} href={RADAR}><MapPin size={18}/> Location</Link>
    <button className={button+' border border-[#a996a0] bg-[#1e181d] px-4'} onClick={save} aria-label={saved?'Remove saved storefront':'Save storefront'}><Heart size={18} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save'}</button>
   </div>
  </div>
  {selected!==null&&<div role="dialog" aria-modal="true" aria-label={'Nail look '+LOOKS[selected].name} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-4">
   <div className="relative w-full max-w-lg"><div className="mb-3 flex items-center justify-between gap-4"><div><p className="text-[11px] uppercase tracking-widest text-[#d6b8c7]">Look {selected+1} of {LOOKS.length}</p><h2 className="font-serif text-xl">{LOOKS[selected].name}</h2></div><button className="rounded-full border border-white/30 p-3" onClick={()=>setSelected(null)} aria-label="Close gallery"><X size={20}/></button></div>
    <div className="relative overflow-hidden rounded-3xl bg-[#1a1419]"><div className="aspect-[120/136] w-full" role="img" aria-label={LOOKS[selected].name} style={pictureStyle(selected)}/><div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between"><button className="rounded-full bg-black/65 p-3" aria-label="Previous look" onClick={()=>setSelected((selected+LOOKS.length-1)%LOOKS.length)}><ChevronLeft size={22}/></button><button className="rounded-full bg-black/65 p-3" aria-label="Next look" onClick={()=>setSelected((selected+1)%LOOKS.length)}><ChevronRight size={22}/></button></div></div>
    <div className="mt-3 flex flex-wrap gap-2">{LOOKS[selected].tags.map(tag=><span className="rounded-full border border-[#6c5562] px-3 py-1 text-xs" key={tag}>{tag}</span>)}</div>
    <button className={button+' mt-4 w-full bg-[#f3e7ec] text-black'} onClick={()=>{const design=selected;setSelectedDesign(design);setSelected(null);window.setTimeout(()=>jump('booking'),50);}}><MessageCircle size={18}/> Enquire about this look</button>
   </div>
  </div>}
 </main>;
}

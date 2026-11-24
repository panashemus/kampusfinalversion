'use client';
import {useEffect,useRef,useState} from 'react';
import {authHeaders} from '@/lib/supabase';
import {Download,Share2,Loader2} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {buildStoryCard,canExportStory,type StoryCardInput} from '@/lib/cirkles-story-card';

async function renderCard(svg:string):Promise<Blob>{
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Could not create the card.'));image.src=url;});
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
  const context=canvas.getContext('2d');if(!context)throw Error('Image export is unavailable.');
  context.drawImage(image,0,0);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not save the image.')),'image/png'));
 }finally{URL.revokeObjectURL(url);}
}

export default function CirklesStoryCard({post,adminHint=false}:{post:StoryCardInput;adminHint?:boolean}){
 const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [promo,setPromo]=useState<{id:string;svg:string}|null>(null),[permission,setPermission]=useState(false),[requesting,setRequesting]=useState(false);
 const requestRef=useRef<AbortController|null>(null);
 const standardAllowed=open&&canExportStory(post);
 const adminEligible=adminHint&&post.moderationStatus==='approved'&&['campus','public'].includes(post.visibility);
 const needsPermission=!(post.visibility==='public'&&post.approved)&&!post.isOwner;
 const svg=open?(standardAllowed?buildStoryCard(post):promo?.id===post.id?promo.svg:''):'';
 const allowed=Boolean(svg);
 const onOpenChange=(next:boolean)=>{
  requestRef.current?.abort();requestRef.current=null;
  setPromo(null);setPermission(false);setRequesting(false);setNotice('');setOpen(next);
 };
 useEffect(()=>()=>requestRef.current?.abort(),[]);
 const requestPromo=async()=>{
  if(!adminEligible||needsPermission&&!permission)return;
  requestRef.current?.abort();
  const controller=new AbortController();requestRef.current=controller;setRequesting(true);setNotice('');
  try{
   const response=await fetch('/api/cirkles/promo-card',{method:'POST',headers:{'Content-Type':'application/json',...await authHeaders()},body:JSON.stringify({id:post.id,permissionConfirmed:permission}),signal:controller.signal});
   const body=await response.json();
   if(!response.ok||typeof body.svg!=='string')throw Error(body.error||'Promotional card unavailable.');
   if(!controller.signal.aborted)setPromo({id:post.id,svg:body.svg});
  }catch(error){if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Could not create promotional card.');}
  finally{if(!controller.signal.aborted)setRequesting(false);}
 };
 useEffect(()=>{
  setFile(null);setPreview('');setNotice('');
  if(!svg)return;
  let active=true,previewUrl='';
  renderCard(svg).then(blob=>{
   if(!active)return;
   previewUrl=URL.createObjectURL(blob);
   setFile(new File([blob],'kampus-cirkles.png',{type:'image/png'}));setPreview(previewUrl);
  }).catch(()=>{if(active)setNotice('Could not create the card. Close and try again.');});
  return()=>{active=false;if(previewUrl)URL.revokeObjectURL(previewUrl);};
 },[svg]);
 const share=async()=>{
  if(!file||!allowed)return;
  setBusy(true);setNotice('');
  try{
   if(typeof navigator.share!=='function'||!navigator.canShare?.({files:[file]})){
    setNotice('Use Save PNG to share this card from your device.');return;
   }
   await navigator.share({files:[file],title:'Kampus Cirkles'});setNotice('Card shared.');
  }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setNotice('Sharing is unavailable. Try Save PNG instead.');}
  finally{setBusy(false);}
 };
 return <Dialog open={open} onOpenChange={onOpenChange}>
  <DialogTrigger asChild><button type="button" aria-label="Share post card" title="Share post card" className="min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-full bg-midnight/50 text-pine hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pine"><Share2 size={19} strokeWidth={1.8}/></button></DialogTrigger>
  <DialogContent className="z-[1300] w-[calc(100%-1.5rem)] max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-surface border-pine/30 text-white p-4" overlayClassName="z-[1299]">
   <DialogTitle>Share post card</DialogTitle>
   <DialogDescription className="text-sage text-xs">{allowed?'A branded, text-only 1080 × 1920 card for stories and TikTok. No profile details or attachments are exported.':'Approved public posts and your own approved campus posts can be exported. Designated administrators can request permission-based promotional cards.'}</DialogDescription>
   {!allowed&&adminEligible&&<div className="space-y-3 rounded-xl border border-pine/30 p-3">
    <p className="text-xs font-bold text-pine">Admin promotional export</p>
    {needsPermission&&<label className="flex items-start gap-2 text-xs text-sage"><input type="checkbox" checked={permission} onChange={e=>setPermission(e.target.checked)} className="mt-0.5 shrink-0"/>I have permission from the author to share this post outside Kampus.</label>}
    <button type="button" disabled={requesting||needsPermission&&!permission} onClick={()=>void requestPromo()} className="min-h-11 w-full rounded-xl bg-pine font-bold text-midnight disabled:opacity-50">{requesting?'Preparing card…':'Generate promotional card'}</button>
   </div>}
   {allowed&&<>
    {post.visibility==='campus'&&<p className="text-xs text-pine">Sharing a campus-only post as an image makes its contents visible outside Kampus.</p>}
    {preview?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={preview} alt="Preview of your Kampus Cirkles sharing card" className="mx-auto block max-h-[53dvh] max-w-full rounded-xl border border-pine/20 object-contain"/>
      :!notice&&<div role="status" className="flex items-center justify-center gap-2 py-12 text-sage"><Loader2 className="animate-spin" size={18}/>Creating card…</div>}
    {file&&preview&&<div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={()=>void share()} disabled={busy} className="min-h-11 flex items-center justify-center gap-2 rounded-xl bg-pine font-bold text-midnight disabled:opacity-50"><Share2 size={17}/>Share</button>
      <a href={preview} download={file.name} className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-pine/40 font-semibold text-pine"><Download size={17}/>Save PNG</a>
    </div>}
   </>}
   {notice&&<p role="status" className="text-xs text-sage">{notice}</p>}
  </DialogContent>
 </Dialog>;
}

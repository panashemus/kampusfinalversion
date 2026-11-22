'use client';
import {useState} from 'react';import {Download} from 'lucide-react';
import {buildStoryCard,canExportStory,type StoryCardInput} from '@/lib/cirkles-story-card';
export default function CirklesStoryCard({post}:{post:StoryCardInput}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 if(!canExportStory(post))return null;
 const download=async()=>{setBusy(true);setNotice('');let url='';try{
  url=URL.createObjectURL(new Blob([buildStoryCard(post)],{type:'image/svg+xml;charset=utf-8'}));
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Could not create the card.'));image.src=url;});
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const context=canvas.getContext('2d');if(!context)throw Error('Image export is unavailable.');context.drawImage(image,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not save the image.')),'image/png'));
  const file=new File([blob],'kampus-cirkles-story.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Cirkles · TEZEmber'});setNotice('Story card shared.');}
  else{const imageUrl=URL.createObjectURL(blob);const a=document.createElement('a');a.href=imageUrl;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(imageUrl),1000);setNotice('Story card saved.');}
 }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setNotice(error instanceof Error?error.message:'Could not save the card.');}finally{if(url)URL.revokeObjectURL(url);setBusy(false);}};
 return <div><button type="button" disabled={busy} onClick={()=>void download()} className="min-h-11 inline-flex items-center gap-2 text-xs font-semibold text-pine disabled:opacity-40"><Download size={15}/>{busy?'Creating card…':'Share story card'}</button>{notice&&<p role="status" className="text-xs text-sage">{notice}</p>}</div>;
}

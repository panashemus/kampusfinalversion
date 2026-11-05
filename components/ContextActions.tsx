'use client';
import {useState} from 'react';
import {ACTIONS,actionEligibility,destinationHash,type ContentRef,type Destination} from '@/lib/interconnect';
import {supabase} from '@/lib/supabase';
export default function ContextActions({content,userId,onNavigate,onSignIn}:{content:ContentRef;userId?:string;onNavigate:(d:Destination)=>void;onSignIn?:(d:Destination)=>void}){
 const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 return <div className="space-y-2"><div className="flex flex-wrap gap-2">{ACTIONS.map(action=>{
 const status=actionEligibility(action,content,{id:userId});if(status==='unavailable')return null;
 return <button key={action.id} disabled={busy} className="foundation-action" onClick={async()=>{
 setNotice('');if(status==='sign-in'){onSignIn?.(action.route(content));return;}setBusy(true);
 try{if(action.id==='share'){await navigator.clipboard.writeText(`${location.origin}/${destinationHash(action.route(content))}`);setNotice('Public link copied. Recipients can only open content they are allowed to see.');}
 else if(action.id==='save'){const {error}=await supabase.from('saved_items').insert({user_id:userId,content_type:content.type==='listing'?'listing':'post',content_id:content.id});if(error&&error.code!=='23505')throw error;setNotice('Saved to your profile.');}
 else onNavigate(action.route(content));}catch{setNotice(action.fallback);}finally{setBusy(false);}
 }}>{action.label}</button>;
 })}</div>{notice&&<p role="status" className="text-sm text-sage">{notice}</p>}</div>;
}

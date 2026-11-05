'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {destinationHash} from '@/lib/interconnect';
import type {Profile} from '@/lib/types';
export default function StudentPreferences({profile}:{profile:Profile}){
 const [publicProfile,setPublicProfile]=useState(!!profile.public_profile);const [messages,setMessages]=useState(profile.allow_messages!==false);
 const [topics,setTopics]=useState<string[]>(profile.preferences?.topics||[]);const [institutionFirst,setInstitutionFirst]=useState(profile.preferences?.institutionFirst!==false);
 const [notice,setNotice]=useState('');const [saved,setSaved]=useState<{content_id:string;content_type:'post'|'listing';title:string;available:boolean}[]>([]);
 useEffect(()=>{let live=true;(async()=>{const {data,error}=await supabase.from('saved_items').select('content_id,content_type').order('created_at',{ascending:false}).limit(40);
 if(error){if(live)setNotice('Saved items are temporarily unavailable.');return;}
 const rows=data||[];const posts=rows.filter(r=>r.content_type==='post').map(r=>r.content_id);const listings=rows.filter(r=>r.content_type==='listing').map(r=>r.content_id);
 const [p,l]=await Promise.all([supabase.from('feed_preview').select('id,text').in('id',posts),supabase.from('listing_preview').select('id,title').in('id',listings).eq('status','active')]);
 if(live)setSaved(rows.map(r=>{const item=(r.content_type==='post'?p.data:l.data)?.find(i=>i.id===r.content_id);return {...r,content_type:r.content_type as 'post'|'listing',title:item?('text' in item?String(item.text):String(item.title)):'Content no longer available',available:!!item};}));})();return()=>{live=false;};},[profile.id]);
 const save=async()=>{const {error}=await supabase.from('profiles').update({public_profile:publicProfile,allow_messages:messages,preferences:{topics,institutionFirst}}).eq('id',profile.id);setNotice(error?'Preferences could not be saved.':'Preferences saved. Your choices can be changed anytime.');};
 return <section className="foundation-card w-full space-y-4 mb-5"><h2 className="font-bold">Your campus preferences</h2><p className="text-sage text-xs">Optional interests help order discovery without hiding other institutions.</p>
 <div className="flex flex-wrap gap-2">{['Academic','Textbooks','Housing','Tech','Beauty','General'].map(t=><button key={t} aria-pressed={topics.includes(t)} className={`foundation-action ${topics.includes(t)?'border-pine text-pine':''}`} onClick={()=>setTopics(topics.includes(t)?topics.filter(x=>x!==t):[...topics,t])}>{t}</button>)}</div>
 <label className="flex gap-3 text-sm"><input type="checkbox" checked={institutionFirst} onChange={e=>setInstitutionFirst(e.target.checked)}/>Prioritize my institution</label>
 <label className="flex gap-3 text-sm"><input type="checkbox" checked={publicProfile} onChange={e=>setPublicProfile(e.target.checked)}/>Allow guests to see my username, institution, avatar and verification badge</label>
 <label className="flex gap-3 text-sm"><input type="checkbox" checked={messages} onChange={e=>setMessages(e.target.checked)}/>Allow messages from verified students (blocked accounts are excluded)</label>
 <button className="foundation-primary" onClick={save}>Save preferences</button>{notice&&<p role="status" className="text-sage text-sm">{notice}</p>}
 <h3 className="font-semibold pt-4 border-t border-gray-800">Saved items</h3>{saved.length?saved.map(item=><div key={item.content_id} className="flex gap-3 justify-between items-start"><a className="text-sm text-pine min-h-11 break-words" href={item.available?destinationHash(item.content_type==='listing'?{module:'hustle',listing:item.content_id}:{module:'community',post:item.content_id}):undefined}>{item.title.slice(0,100)}</a><button className="foundation-action" onClick={async()=>{const {error}=await supabase.from('saved_items').delete().eq('content_id',item.content_id).eq('content_type',item.content_type);if(!error)setSaved(saved.filter(s=>s.content_id!==item.content_id));else setNotice('Could not remove saved item.');}}>Remove</button></div>):<p className="text-sm text-sage">Save a discussion or listing to return to it here.</p>}
 </section>;
}

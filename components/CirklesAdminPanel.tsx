'use client';
import {useCallback,useEffect,useState} from 'react';import {RefreshCw,ShieldCheck} from 'lucide-react';
import {supabase} from '@/lib/supabase';
type Log={id:string;matched_rule:string;matched_layer:string;content_type:string;created_at:string};
type Row={id:string;text:string;moderation_status:string;moderation_mode:string;circle_slug:string|null};
export default function CirklesAdminPanel(){
 const [logs,setLogs]=useState<Log[]>([]),[posts,setPosts]=useState<Row[]>([]),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{setNotice('');const [l,p]=await Promise.all([
  supabase.from('cirkles_moderation_logs').select('id,matched_rule,matched_layer,content_type,created_at').order('created_at',{ascending:false}).limit(100),
  supabase.from('feed_posts').select('id,text,moderation_status,moderation_mode,circle_slug').order('created_at',{ascending:false}).limit(30),
 ]);if(l.error||p.error){setNotice('Cirkles review could not load. Administrator access is checked by the server.');return;}setLogs(l.data||[]);setPosts(p.data||[]);},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const counts=logs.reduce<Record<string,number>>((acc,l)=>{acc[l.matched_rule]=(acc[l.matched_rule]||0)+1;return acc;},{});
 const change=async(id:string,status:string)=>{const {error}=await supabase.rpc('cirkles_admin_status',{source:id,new_status:status});if(error)setNotice('Moderation action failed. Check administrator access.');else await refresh();};
 return <section className="mt-5 rounded-2xl border border-pine/40 bg-ink p-4">
  <div className="flex items-center justify-between"><h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={18}/>Cirkles health</h3><button type="button" aria-label="Refresh Cirkles moderation" onClick={()=>void refresh()} className="min-h-11 px-3 text-pine"><RefreshCw size={17}/></button></div>
  <p className="text-xs text-sage mt-2">Latest {logs.length} blocked attempts · redacted logs retained for 30 days. Fallback means text checks ran without a semantic verdict.</p>
  <div className="flex flex-wrap gap-2 mt-3">{Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([rule,count])=><span className="rounded-full border border-gray-800 px-3 py-2 text-[10px] text-sage" key={rule}>{rule} · {count}</span>)}</div>
  {notice&&<p role="alert" className="text-xs text-pine mt-3">{notice}</p>}
  <details className="mt-4"><summary className="min-h-11 cursor-pointer text-sm text-pine">Review recent posts ({posts.length})</summary><div className="space-y-4 mt-2">{posts.map(p=><article key={p.id} className="border-t border-gray-800 pt-3"><p className="text-[10px] text-sage">{p.circle_slug||'Campus Q&A'} · {p.moderation_status} · {p.moderation_mode}</p><p className="mt-2 text-xs whitespace-pre-wrap break-words">{p.text}</p><div className="flex flex-wrap gap-2 mt-2">{['approved','flagged','blocked'].map(status=><button type="button" disabled={p.moderation_status===status} onClick={()=>void change(p.id,status)} key={status} className="min-h-11 rounded-xl border border-gray-800 px-3 text-xs text-pine disabled:opacity-40">{status==='approved'?'Restore / approve':status==='flagged'?'Flag':'Block'}</button>)}</div></article>)}</div></details>
 </section>;
}

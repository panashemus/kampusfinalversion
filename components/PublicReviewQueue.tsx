'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
export default function PublicReviewQueue(){
 const [rows,setRows]=useState<{id:string;table:'feed_posts'|'hustles';text:string}[]>([]);const [notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{const [p,h]=await Promise.all([supabase.from('feed_posts').select('id,text').eq('visibility','public').eq('public_approved',false).limit(30),supabase.from('hustles').select('id,title,description').eq('visibility','public').eq('public_approved',false).limit(30)]);
 if(!live)return;if(p.error||h.error){setNotice('Public review queue could not be loaded.');return;}
 setRows([...(p.data||[]).map(r=>({id:r.id,table:'feed_posts' as const,text:r.text})),...(h.data||[]).map(r=>({id:r.id,table:'hustles' as const,text:r.title+' — '+(r.description||'')}))]);})();return()=>{live=false;};},[]);
 return <section className="foundation-card m-4"><h2 className="font-semibold">Public discovery review</h2><p className="text-xs text-sage mt-2">Only owner-selected public submissions appear. Check the entire text for contact details, private coursework and sensitive information before approving.</p>{notice&&<p role="alert">{notice}</p>}{rows.length?rows.map(r=><article key={r.id} className="border-t border-gray-800 pt-4 mt-4"><p className="text-sm whitespace-pre-wrap break-words">{r.text}</p><button className="foundation-action mt-3" onClick={async()=>{const {error}=await supabase.from(r.table).update({public_approved:true}).eq('id',r.id);if(error)setNotice('Approval failed. Your administrator permission is checked by the database.');else setRows(rows.filter(x=>x.id!==r.id));}}>Approve for public preview</button></article>):<p className="text-sage text-sm mt-4">No pending public submissions.</p>}</section>;
}

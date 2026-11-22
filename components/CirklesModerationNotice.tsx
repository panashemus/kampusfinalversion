'use client';
import {ShieldCheck,WandSparkles} from 'lucide-react';
import {autoAnonymize,type ModerationResult} from '@/lib/moderation';
export default function CirklesModerationNotice({text,result,onChange}:{text:string;result:ModerationResult;onChange:(text:string)=>void}){
 if(result.allowed)return null;
 return <div role="status" className="rounded-xl border border-pine/40 bg-ink p-3 text-xs text-sage space-y-2">
  <p className="flex gap-2"><ShieldCheck size={16} className="shrink-0 text-pine"/>{result.suggestion}</p>
  {result.matches.length>0&&<><p className="break-words">Check: {result.matches.slice(0,4).map(m=>text.slice(m.start,m.end)).join(' · ')}</p>
  <button type="button" onClick={()=>onChange(autoAnonymize(text,result.matches))} className="min-h-11 inline-flex items-center gap-2 font-semibold text-pine"><WandSparkles size={15}/>Auto-Anonymize</button></>}
 </div>;
}

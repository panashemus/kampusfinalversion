'use client';
import {useEffect,useState} from 'react';
import {Bell,Mail} from 'lucide-react';
import {supabase} from '@/lib/supabase';
type Frequency='off'|'every'|'daily'|'weekly';
type Prefs={push_new_posts:boolean,email_frequency:Frequency,email_replies:boolean};
const initial:Prefs={push_new_posts:true,email_frequency:'off',email_replies:false};
export default function CirklesNotificationPreferences({userId}:{userId:string}){
 const [prefs,setPrefs]=useState<Prefs>(initial),[saved,setSaved]=useState<Prefs>(initial),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setReady(false);setMessage('');void(async()=>{try{const {data,error}=await supabase.from('cirkles_notification_preferences').select('push_new_posts,email_frequency,email_replies').eq('user_id',userId).maybeSingle();if(!active)return;if(error)throw error;const current=(data||initial) as Prefs;setPrefs(current);setSaved(current);setReady(true);}catch{if(active)setMessage('Notification settings are unavailable. Please try again later.');}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[userId]);
 const save=async()=>{setBusy(true);setMessage('');try{const {error}=await supabase.from('cirkles_notification_preferences').upsert({user_id:userId,...prefs},{onConflict:'user_id'});if(error)throw error;setSaved(prefs);setMessage('Your notification preferences have been saved.');}catch{setMessage('Could not save your choices. Please try again.');}finally{setBusy(false);}};
 return <section id="cirkles-notification-settings" aria-labelledby="cirkles-notification-title" className="w-full rounded-2xl border border-pine/25 bg-surface p-5 mt-4 scroll-mt-6">
  <div className="flex items-center gap-3 mb-2"><Bell className="text-pine w-5 h-5"/><h2 id="cirkles-notification-title" className="font-bold text-white">Stay in the Cirkle</h2></div>
  <p className="text-sage text-sm leading-relaxed mb-4">Choose how often Kampus brings you back into the conversation. Email alerts are optional and can be stopped anytime.</p>
  {loading?<p role="status" className="text-sage text-sm">Loading preferences…</p>:<fieldset disabled={!ready||busy} className="space-y-4">
   <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={prefs.push_new_posts} onChange={e=>setPrefs(p=>({...p,push_new_posts:e.target.checked}))} className="mt-1 h-5 w-5 accent-pine"/><span><strong className="block text-white">Every new Cirkles post on my device</strong><span className="text-sage">Requires device notification permission. Enable your device using the controls below.</span></span></label>
   <div className="border-t border-white/10 pt-4"><div className="flex gap-2 items-center mb-3"><Mail className="w-4 h-4 text-pine"/><span className="text-white font-semibold text-sm">Email updates</span></div>
   <div role="radiogroup" aria-label="Cirkles post email frequency" className="space-y-3">{([['off','Off'],['every','Every eligible new post'],['daily','Daily roundup'],['weekly','Weekly roundup']] as const).map(([value,label])=><label key={value} className="flex items-center gap-3 text-sm text-white"><input type="radio" name="cirkles-frequency" value={value} checked={prefs.email_frequency===value} onChange={()=>setPrefs(p=>({...p,email_frequency:value}))} className="w-4 h-4 accent-pine"/>{label}</label>)}</div></div>
   <label className="flex gap-3 text-sm text-white items-start"><input type="checkbox" checked={prefs.email_replies} onChange={e=>setPrefs(p=>({...p,email_replies:e.target.checked}))} className="mt-0.5 w-5 h-5 accent-pine"/>Email me when someone replies to my post</label>
   <p className="text-xs text-sage">Emails go to your verified student address. Content and identities stay inside Kampus. Delivery is subject to moderation, privacy and sending limits.</p>
   <button type="button" onClick={()=>void save()} disabled={busy||!ready||JSON.stringify(prefs)===JSON.stringify(saved)} className="w-full bg-pine text-midnight rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40">{busy?'Saving…':'Save preferences'}</button>
  </fieldset>}
  {message&&<p role="status" className="mt-3 text-sm text-sage">{message}</p>}
 </section>;
}

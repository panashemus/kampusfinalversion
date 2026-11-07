'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import ProfileReviews from './ProfileReviews';
import SecureImage from './SecureImage';
import { UserRound, ShieldCheck, GraduationCap, MessageCircle, ShieldBan, Flag } from 'lucide-react';
type DirectoryProfile={id:string;username:string;university:string|null;verified:boolean;allow_messages:boolean;avatar_url:string|null};
export default function PublicProfileModal({userId,username,onClose,onMessageUser}:{userId:string;username:string;onClose:()=>void;onMessageUser?:(id:string,name:string)=>void}){
 const [profile,setProfile]=useState<DirectoryProfile|null>(null);const [notice,setNotice]=useState('');const [blocked,setBlocked]=useState(false);const [self,setSelf]=useState(false);const [reporting,setReporting]=useState(false);const [reason,setReason]=useState('');
 useEffect(()=>{let live=true;(async()=>{
 const {data:{user}}=await supabase.auth.getUser();const {data,error}=await supabase.from('profile_directory').select('id,username,university,verified,allow_messages,avatar_url').eq('id',userId).maybeSingle();
 if(!live)return;setSelf(user?.id===userId);setProfile(data);if(error||!data)setNotice('This profile is unavailable.');
 if(user){const {data:b}=await supabase.from('user_blocks').select('blocked_id').eq('user_id',user.id).eq('blocked_id',userId).maybeSingle();if(live)setBlocked(!!b);}
 })();return()=>{live=false;};},[userId]);
 const toggle=async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user)return;
 const {error}=blocked?await supabase.from('user_blocks').delete().eq('user_id',user.id).eq('blocked_id',userId):await supabase.from('user_blocks').insert({user_id:user.id,blocked_id:userId});
 if(error)setNotice('Your block preference could not be saved.');else{setBlocked(!blocked);setNotice(blocked?'Account unblocked.':'Account blocked. New messages are disabled in both directions.');}};
 return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
  <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-surface p-0 text-white">
    <DialogTitle className="sr-only">{profile?.username || username || 'Student profile'}</DialogTitle>
    <div className="relative overflow-hidden bg-gradient-to-br from-[#234b36] via-[#153126] to-[#0c1c16] px-5 pb-6 pt-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border border-pine/15 bg-pine/5" />
      <div className="relative flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-midnight shadow-xl">
          {profile?.avatar_url ? <SecureImage src={profile.avatar_url} alt="Student avatar" className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9 text-sage" aria-hidden="true" />}
        </div>
        <h2 className="mt-4 max-w-full break-words text-2xl font-black tracking-tight text-white">@{profile?.username || username || 'student'}</h2>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs font-semibold text-[#c6d6c9]">
          <ShieldCheck className="h-4 w-4 text-pine" aria-hidden="true" />
          {profile?.verified ? 'Verified student' : 'Community profile'}
        </span>
        {profile?.university && <p className="mt-3 flex items-center gap-1.5 text-sm text-[#c6d6c9]"><GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />{profile.university}</p>}
      </div>
    </div>
    <div className="space-y-4 px-5 pb-6 sm:px-6">
      <DialogDescription className="text-xs leading-relaxed text-sage">Student-shared profile details only. Private contact information and academic work remain protected.</DialogDescription>
      {profile && <>
        {onMessageUser && !self && <button className="foundation-primary flex w-full items-center justify-center gap-2" disabled={blocked || !profile.allow_messages} onClick={() => onMessageUser(userId, profile.username)}><MessageCircle className="h-4 w-4" aria-hidden="true" />Message student</button>}
        {!self && <div className="flex flex-wrap gap-2">
          <button className="foundation-action flex min-h-10 items-center gap-2" onClick={toggle}><ShieldBan className="h-4 w-4" aria-hidden="true" />{blocked ? 'Unblock account' : 'Block account'}</button>
          <button className="foundation-action flex min-h-10 items-center gap-2" onClick={() => setReporting(!reporting)}><Flag className="h-4 w-4" aria-hidden="true" />Report</button>
        </div>}
        {reporting && <div className="rounded-xl border border-white/10 bg-midnight/60 p-3"><label className="text-sm">Reason<textarea className="foundation-input mt-2" minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><button className="foundation-action mt-2" disabled={reason.trim().length < 10} onClick={async () => { const { error } = await supabase.from('user_reports').insert({ target_id: userId, reason: reason.trim() }); setNotice(error ? 'Report could not be submitted.' : 'Report submitted to moderators.'); if (!error) { setReporting(false); setReason(''); } }}>Submit report</button></div>}
        <div className="border-t border-white/10 pt-4"><ProfileReviews targetUserId={userId} /></div>
      </>}
      {notice && <p role="status" className="text-xs text-sage">{notice}</p>}
    </div>
  </DialogContent>
 </Dialog>;
}

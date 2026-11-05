'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import ProfileReviews from './ProfileReviews';
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
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="bg-surface text-white border-gray-700 max-h-[85dvh] overflow-y-auto"><DialogTitle>{profile?.username||username||'Student profile'}</DialogTitle><DialogDescription className="text-sage">Only permitted student profile information is shown here.</DialogDescription>
 {profile&&<><p className="text-sage text-sm">{profile.university}</p><p className="text-pine text-xs">{profile.verified?'Verified student':'Verification pending'}</p>
 {onMessageUser&&!self&&<button className="foundation-primary" disabled={blocked||!profile.allow_messages} onClick={()=>onMessageUser(userId,profile.username)}>Message student</button>}
 {!self&&<button className="foundation-action" onClick={toggle}>{blocked?'Unblock account':'Block account'}</button>}
 {!self&&<button className="foundation-action" onClick={()=>setReporting(!reporting)}>Report account</button>}
 {reporting&&<div><label className="text-sm">Reason<textarea className="foundation-input mt-2" minLength={10} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="foundation-action mt-2" disabled={reason.trim().length<10} onClick={async()=>{const {error}=await supabase.from('user_reports').insert({target_id:userId,reason:reason.trim()});setNotice(error?'Report could not be submitted.':'Report submitted to moderators.');if(!error){setReporting(false);setReason('');}}}>Submit report</button></div>}
 <ProfileReviews targetUserId={userId}/></>}{notice&&<p role="status" className="text-sm text-sage">{notice}</p>}
 </DialogContent></Dialog>;
}

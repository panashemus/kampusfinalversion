'use client';
import {useCallback,useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import {supabase,isSupabaseConfigured} from '@/lib/supabase';
import {loadMyProfile} from '@/lib/profile';
import {parseDestination,destinationHash,safeReturnDestination,type Destination} from '@/lib/interconnect';
import type {Profile} from '@/lib/types';
import GuestPreview from '@/components/GuestPreview';
import AuthScreen from '@/components/AuthScreen';
const MemberApp=dynamic(()=>import('@/components/MemberApp'),{loading:()=> <p className="p-8 text-sage" role="status">Opening your campus…</p>});
export default function Home(){
 const [profile,setProfile]=useState<Profile|null>(null);
 const [destination,setDestination]=useState<Destination>({module:'discover'});
 const [checking,setChecking]=useState(true);const [error,setError]=useState('');
 const navigate=useCallback((next:Destination)=>{const hash=destinationHash(next);if(window.location.hash!==hash)window.history.pushState(null,'',hash);setDestination(next);},[]);
 const resume=useCallback((p:Profile)=>{
  setProfile(p);setError('');
  const pending=sessionStorage.getItem('kampus:return');sessionStorage.removeItem('kampus:return');
  const current=parseDestination(window.location.hash);
  navigate(pending?parseDestination(safeReturnDestination(pending)):current.module==='auth'||current.module==='discover'?{module:'community'}:current);
 },[navigate]);
 useEffect(()=>{
  const read=()=>setDestination(parseDestination(window.location.hash));read();
  const returnQuery=new URL(window.location.href).searchParams.get('returnTo');
  if(returnQuery)sessionStorage.setItem('kampus:return',safeReturnDestination(returnQuery));
  window.addEventListener('popstate',read);window.addEventListener('hashchange',read);
  let mounted=true;let generation=0;
  const load=async()=>{const version=++generation;try{
   const {data:{session}}=await supabase.auth.getSession();
   const p=session?await loadMyProfile():null;
   if(!mounted||version!==generation)return;
   if(p)resume(p);else setProfile(null);
  }catch(e){if(mounted)setError(e instanceof Error?e.message:'Session could not be checked.');}
  finally{if(mounted)setChecking(false);}};
  if(isSupabaseConfigured)void load();else setChecking(false);
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
   if(event==='SIGNED_OUT'){generation++;setProfile(null);setChecking(false);}
   else if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(()=>{if(mounted)void load();},0);
  });
  return()=>{mounted=false;generation++;subscription.unsubscribe();window.removeEventListener('popstate',read);window.removeEventListener('hashchange',read);};
 },[resume]);
 const requestAuth=(next:Destination=destination)=>{
  sessionStorage.setItem('kampus:return',safeReturnDestination(destinationHash(next)));navigate({module:'auth'});
 };
 if(checking)return <div className="bg-midnight text-sage min-h-screen grid place-content-center" role="status">Opening Kampus…</div>;
 if(destination.module==='auth')return <AuthScreen onVerified={resume} onExplore={()=>navigate(parseDestination(safeReturnDestination(sessionStorage.getItem('kampus:return'))))}/>;
 if(profile)return <MemberApp key={profile.id} initialProfile={profile} destination={destination} onNavigate={navigate} onDisconnect={()=>{setProfile(null);navigate({module:'discover'});}}/>;
 return <GuestPreview destination={destination} onNavigate={navigate} onSignIn={requestAuth} sessionError={error}/>;
}

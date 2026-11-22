'use client';
import {useState,useEffect} from 'react';import CommunityHub from '@/components/CommunityHub';import BottomNav from '@/components/BottomNav';import CirklesLogo from '@/components/CirklesLogo';
import type {Profile} from '@/lib/types';import {parseDestination,type Destination} from '@/lib/interconnect';
const profile:Profile={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid',username:'LocalStudent',university:'University of Botswana',avatar_url:null,verified:true,email_verified:true,is_admin:false,is_premium:false,subscribed_until:null,sentinel_points:0,ewallet_number:''};
export default function CirklesPreview(){
 const [destination,setDestination]=useState<Destination>({module:'community'});const [search,setSearch]=useState('');
 useEffect(()=>{const read=()=>setDestination(parseDestination(window.location.hash));window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);},[]);
 return <main className="fixed inset-0 bg-midnight text-white flex justify-center"><div className="relative w-full max-w-[900px] h-full flex flex-col">
  <p className="shrink-0 bg-pine p-1 text-midnight text-center text-[10px]">LOCAL CIRKLES TEST · synthetic accounts and content only</p>
  <header className="shrink-0 border-b border-gray-800 p-3 flex gap-3 items-center"><CirklesLogo variant="nav" size={25} className="text-pine"/><strong>Cirkles</strong><label className="sr-only" htmlFor="preview-search">Search Cirkles</label><input id="preview-search" placeholder="Search Cirkles" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 bg-surface border border-gray-800 rounded-xl p-2 text-xs"/></header>
  <CommunityHub profile={profile} searchQuery={search} selectedPostId={destination.post} onMessageUser={()=>{}} onNavigate={setDestination}/>
  <BottomNav active="community" onChange={()=>{}}/>
 </div></main>;
}

'use client';
import {useState} from 'react';
import KampusLogo from '@/components/KampusLogo';
import {ArrowLeft} from 'lucide-react';
import {supabase,isSupabaseConfigured} from '@/lib/supabase';
import {loadMyProfile} from '@/lib/profile';
import type {Profile} from '@/lib/types';
const domains=['ub.ac.bw','mopipi.ub.bw','student.ub.ac.bw','bac.ac.bw','thuto.bac.ac.bw','bsbs.ac.bw','biust.ac.bw','student.biust.ac.bw','botho.ac.bw','student.botho.ac.bw','buan.ac.bw','student.buan.ac.bw'];
export default function AuthScreen({onVerified,onExplore}:{onVerified:(p:Profile)=>void;onExplore?:()=>void}){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [course,setCourse]=useState('');
 const [signup,setSignup]=useState(false);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setNotice('');setBusy(true);
 try{
 if(!isSupabaseConfigured)throw new Error('Sign-in is temporarily unavailable. You can keep exploring the preview.');
 const clean=email.trim().toLowerCase();
 if(signup&&!domains.includes(clean.split('@')[1]))throw new Error('Use your university email to register as a current student. Everyone can explore the public preview.');
 if(signup){const next=sessionStorage.getItem('kampus:return')||'#community';const redirect=new URL('/',location.origin);redirect.searchParams.set('returnTo',next);
 const {data,error}=await supabase.auth.signUp({email:clean,password,options:{emailRedirectTo:redirect.href,data:{course_code:course.trim().slice(0,120)}}});
 if(error)throw error;if(!data.session){setNotice('Check your university inbox to confirm your email, then sign in. Your original destination is saved.');return;}
 }else{const {error}=await supabase.auth.signInWithPassword({email:clean,password});if(error)throw error;}
 const p=await loadMyProfile();if(!p)throw new Error('Please confirm your email before signing in.');onVerified(p);
 }catch(e){setError(e instanceof Error?e.message:'Sign-in failed. Please try again.');}finally{setBusy(false);}};
 return <main className="min-h-[100dvh] w-full bg-midnight text-white overflow-y-auto grid place-items-center p-5">
 <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-surface p-7 space-y-6">
 <button onClick={onExplore} className="min-h-11 flex items-center gap-2 text-sage text-sm"><ArrowLeft size={18}/>Back to exploring</button>
 <KampusLogo className="h-16 w-auto"/><div><h1 className="text-3xl font-black">Your campus. Connected.</h1><p className="text-sage mt-2">{signup?'Join with your university email.':'Welcome back to Kampus.'}</p></div>
 <form onSubmit={submit} className="space-y-4">
 <label className="block text-sm">Email<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="foundation-input mt-2"/></label>
 {signup&&<label className="block text-sm">Course or programme <span className="text-sage">(optional)</span><input maxLength={120} value={course} onChange={e=>setCourse(e.target.value)} className="foundation-input mt-2"/></label>}
 <label className="block text-sm">Password<input autoComplete={signup?'new-password':'current-password'} type="password" required minLength={signup?8:6} value={password} onChange={e=>setPassword(e.target.value)} className="foundation-input mt-2"/></label>
 {error&&<p role="alert" className="text-red-300 text-sm">{error}</p>}{notice&&<p role="status" className="text-pine text-sm">{notice}</p>}
 <button disabled={busy} className="foundation-primary w-full">{busy?'Please wait…':signup?'Create student account':'Sign in'}</button>
 </form><button className="min-h-11 text-sage text-sm underline" onClick={()=>{setSignup(!signup);setError('');setNotice('');}}>{signup?'Already registered? Sign in':'New to Kampus? Create an account'}</button>
 <p className="text-xs text-sage">You will return to the content you were exploring. Posting, messaging and private information require an eligible student account.</p>
 </div></main>;
}

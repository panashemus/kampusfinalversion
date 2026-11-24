import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Job={id:string,user_id:string,kind:'post'|'reply'|'digest',post_ids:string[],actor_id:string|null,consent_version:string,attempts:number};
const origin='https://www.kampusbw.site';
function authorized(provided:string|null,secret:string|undefined){
 if(!provided||!secret||secret.length<32)return false;
 const a=Buffer.from(provided),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);
}
function makeAdmin(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Database unavailable');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
type Admin=ReturnType<typeof makeAdmin>;
async function blocked(admin:Admin,a:string,b:string){
 const {count,error}=await admin.from('user_blocks').select('user_id',{count:'exact',head:true}).or(`and(user_id.eq.${a},blocked_id.eq.${b}),and(user_id.eq.${b},blocked_id.eq.${a})`);
 if(error)throw error;return Boolean(count);
}
async function deliver(admin:Admin,job:Job,key:string){
 const finish=async(status:string,provider_id?:string)=>{const {error}=await admin.from('cirkles_email_jobs').update({status,...(provider_id?{provider_id}:{})}).eq('id',job.id).eq('attempts',job.attempts).eq('status','processing');if(error)throw error;};
 try{
  const [{data:prefs,error:pe},{data:member,error:me},{data:auth,error:ae}]=await Promise.all([
   admin.from('cirkles_notification_preferences').select('email_frequency,email_replies,email_version,unsubscribe_token').eq('user_id',job.user_id).maybeSingle(),
   admin.from('profiles').select('verified,email_verified').eq('id',job.user_id).maybeSingle(),
   admin.auth.admin.getUserById(job.user_id)
  ]);
  if(pe||me||ae)throw Error('Eligibility lookup failed');
  const user=auth?.user;
  if(!prefs||prefs.email_version!==job.consent_version||!member?.verified||!member.email_verified||!user?.email_confirmed_at||!user.email||!uuid.test(prefs.unsubscribe_token))return await finish('skipped');
  if((job.kind==='post'&&prefs.email_frequency!=='every')||(job.kind==='digest'&&!['daily','weekly'].includes(prefs.email_frequency))||(job.kind==='reply'&&!prefs.email_replies))return await finish('skipped');
  if(!job.post_ids.length||!job.post_ids.every(x=>uuid.test(x))||!uuid.test(job.user_id))return await finish('skipped');
  if(job.actor_id&&(!uuid.test(job.actor_id)||job.actor_id===job.user_id||await blocked(admin,job.user_id,job.actor_id)))return await finish('skipped');
  const {data:posts,error}=await admin.from('feed_posts').select('id,user_id,visibility,public_approved,moderation_status').in('id',job.post_ids);
  if(error)throw error;
  let selected:string|null=null;
  for(const p of posts||[]){
   if(p.moderation_status!=='approved'||!(p.visibility==='campus'||(p.visibility==='public'&&p.public_approved)))continue;
   if(job.kind==='reply'&&p.user_id!==job.user_id)continue;
   if(job.kind!=='reply'&&(p.user_id===job.user_id||await blocked(admin,job.user_id,p.user_id)))continue;
   selected=p.id;break;
  }
  if(!selected)return await finish('skipped');
  // Generic text only: no student-authored material, names, or anonymous identities.
  const subject=job.kind==='reply'?'Someone replied to your Cirkles post':job.kind==='digest'?'Your Kampus Cirkles roundup':'New post in Kampus Cirkles';
  const intro=job.kind==='reply'?'A new reply is waiting for you.':job.kind==='digest'?'There are new conversations to explore.':'A new campus conversation is waiting for you.';
  const link=job.kind==='digest'?origin+'/#community':origin+'/?returnTo='+encodeURIComponent('#community?post='+selected)+'#auth';
  const unsub=origin+'/api/cirkles/notifications/unsubscribe?token='+prefs.unsubscribe_token;
  const html=`<!doctype html><html lang="en"><body style="margin:0;background:#0b1611;color:#f0f3e9;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px"><p style="font-size:28px;font-weight:bold;color:#ffde68">kampus.</p><p style="font-size:12px;letter-spacing:2px;color:#a2b6a8">CIRKLES</p><h1 style="font-size:27px">${subject}</h1><p style="line-height:1.6">${intro} Come be part of it.</p><p><a href="${link}" style="display:inline-block;background:#ffde68;color:#0b1611;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Open Cirkles</a></p><p style="color:#a2b6a8;font-size:13px;line-height:1.6">You opted into Cirkles email alerts. Change preferences in your Kampus profile or <a href="${unsub}" style="color:#ffde68">unsubscribe from Cirkles emails</a>.</p></div></body></html>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'cirkles/'+job.id},body:JSON.stringify({from:'Kampus Cirkles <updates@kampusbw.site>',to:[user.email],subject,html,text:subject+'\n'+intro+'\n'+link+'\nUnsubscribe: '+unsub,headers:{'List-Unsubscribe':'<'+unsub+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}),signal:AbortSignal.timeout(7000)});
  if(response.ok){const result=await response.json() as {id?:string};return await finish('sent',result.id);}
  if(response.status===429||response.status>=500){return await finish(job.attempts>=4?'failed':'pending');}
  // Permanent provider errors should not be retried; account-level Resend suppressions handle hard bounces and complaints.
  return await finish('failed');
 }catch{await finish(job.attempts>=4?'failed':'pending');}
}
export async function POST(req:Request){
 if(!authorized(req.headers.get('x-kampus-push-secret'),process.env.KAMPUS_PUSH_DISPATCH_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 const key=process.env.RESEND_API_KEY;if(!key)return NextResponse.json({error:'Email not configured'},{status:503});
 try{
  const admin=makeAdmin();const {data,error}=await admin.rpc('claim_cirkles_email_jobs');if(error)throw error;
  const jobs=(data||[]) as Job[];
  // Two parallel deliveries at most; preserve headroom for the shared provider rate limit.
  for(let i=0;i<jobs.length;i+=2){await Promise.all(jobs.slice(i,i+2).map(job=>deliver(admin,job,key)));if(i+2<jobs.length)await new Promise(resolve=>setTimeout(resolve,600));}
  return NextResponse.json({processed:jobs.length},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Email dispatch unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildWebPushRequest, deriveVapidPublicKey } from '@/lib/webpush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const ALLOWED = (host:string) => host==='fcm.googleapis.com' || host==='fcm-xm.googleapis.com' ||
  host==='updates.push.services.mozilla.com' || host==='push.services.mozilla.com' ||
  host==='web.push.apple.com' || host.endsWith('.push.apple.com') ||
  host.endsWith('.notify.windows.com') || host.endsWith('.wns.windows.com');

function authorized(provided:string|null, secret:string | undefined) {
 if (!secret || !provided || secret.length<32 || provided.length!==secret.length) return false;
 return timingSafeEqual(Buffer.from(provided),Buffer.from(secret));
}

export async function POST(req:Request) {
 if (!authorized(req.headers.get('x-kampus-push-secret'),process.env.KAMPUS_PUSH_DISPATCH_SECRET))
  return NextResponse.json({error:'Unauthorized'}, {status:401,headers:{'Cache-Control':'no-store'}});
 try {
  const payload=await req.json() as {notification_id?:unknown};
  if (typeof payload.notification_id!=='string' || !UUID.test(payload.notification_id))
   return NextResponse.json({error:'Invalid notification reference'},{status:400});
  const apiUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT;
  if (!apiUrl||!key||!privateKey||!subject) return NextResponse.json({error:'Push service not configured'},{status:503});
  const admin=createClient(apiUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:notice,error:noticeError}=await admin.from('notifications')
    .select('id,user_id,type,reference_id,created_at').eq('id',payload.notification_id).maybeSingle();
  if(noticeError)throw noticeError;
  if(!notice||!['post','comment','message'].includes(notice.type))
   return NextResponse.json({skipped:'Not an eligible notification'});
  if(Date.now()-Date.parse(notice.created_at)>24*60*60*1000)
   return NextResponse.json({skipped:'Expired notification'});

  const {data:member}=await admin.from('profiles').select('verified,email_verified')
    .eq('id',notice.user_id).maybeSingle();
  if(!member?.verified||!member.email_verified)
   return NextResponse.json({skipped:'Recipient not eligible'});

  let title='KAMPUS',body='Open KAMPUS to see what is new.',url='/';
  if(notice.type==='message'){
   title='New KAMPUS message';body='You have a new message. Open KAMPUS to read it.';url='/#chat';
  } else {
   const ref=notice.reference_id;
   if(!ref||!UUID.test(ref))return NextResponse.json({skipped:'Invalid source'});
   const {data:post,error:postError}=await admin.from('feed_posts')
    .select('id,user_id,visibility,public_approved,is_anonymous').eq('id',ref).maybeSingle();
   if(postError)throw postError;
   if(!post || (post.visibility!=='campus' && !(post.visibility==='public'&&post.public_approved)))
    return NextResponse.json({skipped:'Post is not viewable'});
   url='/#community?post='+post.id;
   if(notice.type==='post'){
    if(post.user_id===notice.user_id)return NextResponse.json({skipped:'Own post'});
    title=post.is_anonymous?'New anonymous confession':'New campus question';
    body=post.is_anonymous?'A student shared a confession. Join the conversation.':'A student asked a question. Join the conversation.';
   }else{
    if(post.user_id!==notice.user_id)return NextResponse.json({skipped:'Not the post owner'});
    title='New reply on Campus Feed';
    body=post.is_anonymous?'Someone replied to your anonymous confession.':'Someone replied to your question.';
   }
  }

  const {data:devices,error:deviceError}=await admin.from('push_subscriptions')
   .select('id,endpoint,keys_p256dh,keys_auth').eq('user_id',notice.user_id).limit(10);
  if(deviceError)throw deviceError;
  if(!devices?.length)return NextResponse.json({skipped:'Notifications not enabled'});
  const publicKey=deriveVapidPublicKey(privateKey);
  let delivered=0,skipped=0,failed=0;
  for(const device of devices){
   let host='';
   try { const parsed=new URL(device.endpoint);if(parsed.protocol!=='https:') {skipped++;continue;}host=parsed.hostname; }
   catch {skipped++;continue;}
   if(!ALLOWED(host)){skipped++;continue;}
   const {data:claim,error:claimError}=await admin.from('push_delivery_claims')
    .insert({notification_id:notice.id,subscription_id:device.id}).select('notification_id').maybeSingle();
   if(claimError){
    if(claimError.code==='23505'){skipped++;continue;}
    throw claimError;
   }
   if(!claim){skipped++;continue;}
   try {
    const push=buildWebPushRequest(device,{title,body,url,tag:'kampus-'+notice.type+'-'+notice.id},
      {publicKey,privateKey,subject});
    const response=await fetch(push.url,{method:'POST',headers:push.headers,body:new Uint8Array(push.body),signal:AbortSignal.timeout(8500)});
    if(response.ok){delivered++;continue;}
    if(response.status===404||response.status===410){
     await admin.from('push_subscriptions').delete().eq('id',device.id).eq('user_id',notice.user_id);
     skipped++;continue;
    }
    failed++;
   }catch{failed++;}
   // Do not treat a failed provider request as delivered; allow a safe manual retry.
   await admin.from('push_delivery_claims').delete().eq('notification_id',notice.id).eq('subscription_id',device.id);
  }
  return NextResponse.json({accepted:delivered,skipped,failed},{headers:{'Cache-Control':'no-store'}});
 }catch(err){
  console.error('KAMPUS push dispatch failure',err instanceof Error?err.message:'Unknown error');
  return NextResponse.json({error:'Push dispatch failed'},{status:500});
 }
}

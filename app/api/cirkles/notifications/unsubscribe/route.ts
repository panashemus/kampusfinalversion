import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'no-store','Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
function page(body:string,status=200){return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kampus email preferences</title><body style="background:#0b1611;color:#f0f3e9;font:18px system-ui;padding:32px;max-width:540px;margin:auto"><h1 style="color:#ffde68">kampus.</h1>'+body+'</body></html>',{status,headers});}
export function GET(req:Request){
 const token=new URL(req.url).searchParams.get('token')||'';
 if(!uuid.test(token))return page('<p>This unsubscribe link is invalid.</p>',400);
 // GET is a confirmation screen, so email link scanners cannot unsubscribe students.
 return page('<h2>Stop Cirkles emails?</h2><p>Device notifications and your Kampus account will not be affected.</p><form method="post" action="?token='+token+'"><button type="submit" style="background:#ffde68;color:#0b1611;border:0;padding:14px;border-radius:8px;font:inherit">Unsubscribe</button></form>');
}
export async function POST(req:Request){
 const token=new URL(req.url).searchParams.get('token')||'';
 if(!uuid.test(token))return page('<p>This unsubscribe link is invalid.</p>',400);
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return page('<p>Temporarily unavailable. Please try again.</p>',503);
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.from('cirkles_notification_preferences').update({email_frequency:'off',email_replies:false}).eq('unsubscribe_token',token);
  if(error)throw error;
  return page('<h2>Email alerts stopped</h2><p>If this link is current, Cirkles email notifications are now off. You can change preferences in your Kampus profile.</p><a style="color:#ffde68" href="https://www.kampusbw.site/#profile">Return to Kampus</a>');
 }catch{return page('<p>Temporarily unavailable. Please try again.</p>',503);}
}

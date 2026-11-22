import {createClient} from '@supabase/supabase-js';
import {boundedJson,requireUser,HttpError,errorResponse} from './auth';
import {moderateText,MODERATION_MESSAGE,type ModerationMatch} from '../moderation';
import {CIRKLES,CIRKLE_PROMPTS,CLASSIC_CATEGORIES} from '../cirkles';
import {classifyCirkles} from './cirkles-ai';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type SubmissionKind='post'|'comment';
export function validateCirklesSubmission(raw:unknown,kind:SubmissionKind,userId:string){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new HttpError(400,'Invalid submission.');const p=raw as Record<string,unknown>;
 if(typeof p.text!=='string'||p.text.trim().length<(kind==='post'?5:2)||p.text.length>(kind==='post'?4000:2000))throw new HttpError(400,kind==='post'?'Write 5–4000 characters.':'Write 2–2000 characters.');
 if(kind==='comment'){if(typeof p.post_id!=='string'||!uuid.test(p.post_id))throw new HttpError(400,'Choose an available post.');return {text:p.text.trim(),post_id:p.post_id};}
 const circle=p.circle_slug==null?null:p.circle_slug;
 if(circle!==null&&!CIRKLES.some(c=>c.slug===circle))throw new HttpError(400,'Choose an available Cirkle.');
 if(typeof p.category!=='string'||!(CLASSIC_CATEGORIES as readonly string[]).includes(p.category))throw new HttpError(400,'Choose a campus category.');
 if(!['question','confession'].includes(String(p.post_kind)))throw new HttpError(400,'Choose a named question or an anonymous drop.');
 if(!['campus','public'].includes(String(p.visibility)))throw new HttpError(400,'Choose campus or public visibility.');
 if(p.story_prompt!=null&&!(CIRKLE_PROMPTS as readonly unknown[]).includes(p.story_prompt))throw new HttpError(400,'Choose an available story prompt.');
 const images=p.images==null?[]:p.images;
 if(!Array.isArray(images)||images.length>4||images.some(v=>typeof v!=='string'||v.length>1200))throw new HttpError(400,'Attach up to four images.');
 const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
 for(const value of images){let parsed:URL;try{parsed=new URL(value);}catch{throw new HttpError(400,'Reattach your images.');}
  const prefix='/storage/v1/object/public/post_media/'+userId+'/';
  if(parsed.origin!==origin||!parsed.pathname.startsWith(prefix)||parsed.search||parsed.hash||decodeURIComponent(parsed.pathname).includes('..'))throw new HttpError(403,'Only your own uploaded images may be attached.');
 }
 return {text:p.text.trim(),category:p.category,post_kind:circle==='confessions'?'confession':p.post_kind,visibility:p.visibility,circle_slug:circle,story_prompt:circle?p.story_prompt||null:null,images};
}

export async function submitCirkles(req:Request,kind:SubmissionKind){
 try{
  const {db,user}=await requireUser(req);
  const {data:member,error:membershipError}=await db.rpc('is_kampus_member');
  if(membershipError||!member||!user.email_confirmed_at)throw new HttpError(403,'Confirm your student email before posting.');
  const payload=validateCirklesSubmission(await boundedJson(req,18000),kind,user.id);
  if(kind==='comment'){
   const {data:parent,error}=await db.from('feed_preview').select('id,moderation_status').eq('id',(payload as {post_id:string}).post_id).maybeSingle();
   if(error||!parent||parent.moderation_status==='blocked')throw new HttpError(404,'This post is unavailable. Your draft has been kept.');
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new HttpError(503,'Posting is temporarily unavailable. Your draft has been kept.');
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:reserved,error:budgetError}=await admin.rpc('cirkles_reserve_attempt',{actor:user.id,kind});
  if(budgetError)throw new HttpError(503,'Posting controls are temporarily unavailable. Keep your draft and retry.');
  if(!reserved)throw new HttpError(429,'A little breathing room — wait a few seconds before trying again. Your draft is safe.');
  let result=moderateText(payload.text);let mode='deterministic';
  if(result.allowed){
   const {data:aiBudget}=await admin.rpc('cirkles_reserve_ai');
   const semantic=aiBudget?await classifyCirkles(payload.text):{verdict:null,mode:'deterministic_fallback'};mode=semantic.mode;
   if(semantic.verdict&&!semantic.verdict.allowed){
    const phrase=semantic.verdict.flagged_phrase;const start=phrase?payload.text.indexOf(phrase):-1;
    const matches:ModerationMatch[]=start>=0?[{start,end:start+phrase!.length,layer:'semantic',rule:semantic.verdict.category}]:[];
    result={allowed:false,matches,suggestion:MODERATION_MESSAGE};
   }
  }
  if(!result.allowed){
   const first=result.matches[0];
   // No raw story, rejected phrase, author name or contact detail is retained.
   await admin.from('cirkles_moderation_logs').insert({user_id:user.id,content_type:kind,matched_layer:first?.layer||'semantic',matched_rule:first?.rule||'semantic_rejection',sanitized_snippet:'[submission redacted]'});
   return Response.json({error:MODERATION_MESSAGE,matches:result.matches},{status:422,headers:{'Cache-Control':'no-store'}});
  }
  const {data:id,error}=await admin.rpc('cirkles_submit',{actor:user.id,kind,payload,review_mode:mode});
  if(error){if(error.message.includes('Duplicate'))throw new HttpError(409,'That drop was already posted. Check the feed before trying again.');throw new HttpError(503,'Your post could not be saved. Your draft has been kept.');}
  return Response.json({id},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error);}
}

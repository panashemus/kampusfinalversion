import {requireUser,boundedJson,errorResponse,HttpError} from '@/lib/server/auth';
import {buildStoryCard,canExportStory} from '@/lib/cirkles-story-card';
import {UUID} from '@/lib/interconnect';

export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const {db,user}=await requireUser(req);
  const designated=process.env.CIRKLES_PROMO_ADMIN_EMAIL?.trim().toLowerCase();
  if(!designated||!user.email_confirmed_at||user.email?.toLowerCase()!==designated)throw new HttpError(403,'Promotional exports are restricted to the designated administrator.');
  const {data:admin,error:adminError}=await db.rpc('is_kampus_admin');
  if(adminError||admin!==true)throw new HttpError(403,'Promotional exports require administrator permission.');
  const raw=await boundedJson(req,1024);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new HttpError(400,'Choose a post.');
  const {id,permissionConfirmed}=raw as Record<string,unknown>;
  if(typeof id!=='string'||!UUID.test(id))throw new HttpError(400,'Choose a valid post.');
  const {data:post,error}=await db.from('feed_preview').select('id,text,category,circle_slug,visibility,public_approved,is_owner,is_anonymous,moderation_status').eq('id',id).maybeSingle();
  if(error||!post)throw new HttpError(404,'Post unavailable.');
  if(post.moderation_status!=='approved'||!['campus','public'].includes(post.visibility))throw new HttpError(403,'Private, flagged and blocked posts cannot be exported.');
  if(!(post.visibility==='public'&&post.public_approved)&&!post.is_owner&&permissionConfirmed!==true)throw new HttpError(403,'Obtain the author’s permission before promoting a post outside its intended audience.');
  // Use only moderated text from the existing RLS-filtered projection; never include identity or media.
  const card={id:post.id,text:post.text,circle:post.circle_slug||'',category:post.category,visibility:'public',approved:true,anonymous:Boolean(post.is_anonymous),moderationStatus:post.moderation_status};
  if(!canExportStory(card))throw new HttpError(422,'This post contains text that cannot safely be exported.');
  return Response.json({svg:buildStoryCard(card)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error);}
}

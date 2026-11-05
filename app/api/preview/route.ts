import {serverSupabase,HttpError,errorResponse} from '@/lib/server/auth';
import {UUID} from '@/lib/interconnect';
export const dynamic='force-dynamic';
const fields={posts:'id,category,text,upvotes,created_at,is_anonymous,visibility,public_approved,institution,user_id,author_name',comments:'id,post_id,text,created_at,is_anonymous,author_name',listings:'id,seller_id,seller_name,title,price,category,description,created_at,status,visibility,public_approved,institution',profiles:'id,username,university,verified'} as const;
const tables={posts:'feed_preview',comments:'comment_preview',listings:'public_listings',profiles:'profile_directory'} as const;
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams;const kind=params.get('kind')||'posts';
 if(!(kind in tables))throw new HttpError(400,'Unknown preview type.');const type=kind as keyof typeof tables;
 const id=params.get('id');if(id&&!UUID.test(id))throw new HttpError(400,'Invalid content reference.');
 if((type==='comments'||type==='profiles')&&!id)throw new HttpError(400,'A content reference is required.');
 const offset=Number(params.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>1000)throw new HttpError(400,'Invalid page.');
 let query=serverSupabase().from(tables[type]).select(fields[type]);if(id)query=query.eq(type==='comments'?'post_id':'id',id);
 if(type==='posts'||type==='listings'){
 query=query.eq('visibility','public').eq('public_approved',true);const search=params.get('search')?.trim().slice(0,100);
 if(search)query=query.ilike(type==='posts'?'text':'title',`%${search.replace(/[\\%_]/g,'\\$&')}%`);
 const institution=params.get('institution');if(institution)query=query.eq('institution',institution.slice(0,100));
 }
 if(type!=='profiles')query=query.order('created_at',{ascending:type==='comments'});
 const {data,error}=await query.range(offset,offset+20);if(error)throw new HttpError(503,'Public content is temporarily unavailable. Please try again.');
 return Response.json({items:data?.slice(0,20)||[],hasMore:(data?.length||0)>20},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error);}}

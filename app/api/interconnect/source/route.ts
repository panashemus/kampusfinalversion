import {requireUser,HttpError,errorResponse} from '@/lib/server/auth';
import {UUID} from '@/lib/interconnect';
export async function GET(request:Request){try{
 const {db}=await requireUser(request);const id=new URL(request.url).searchParams.get('post');
 if(!id||!UUID.test(id))throw new HttpError(400,'Invalid discussion reference.');
 const {data,error}=await db.from('feed_preview').select('id,text,category,visibility').eq('id',id).maybeSingle();
 if(error)throw new HttpError(503,'Discussion could not be loaded.');if(!data)throw new HttpError(404,'This discussion is no longer available to you.');
 if(data.category!=='Academic')throw new HttpError(400,'Select an academic question to explore with Kritic.');
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error);}}

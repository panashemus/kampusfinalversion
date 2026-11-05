import { createClient } from '@supabase/supabase-js';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function serverSupabase(token?:string) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new HttpError(503,'Kampus is temporarily unable to connect. Please try again later.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:token?{Authorization:`Bearer ${token}`}:{}}});
}
export async function requireUser(request:Request) {
 const match=/^Bearer (\S+)$/.exec(request.headers.get('authorization')||'');if(!match)throw new HttpError(401,'Sign in to continue.');
 const db=serverSupabase(match[1]);const {data,error}=await db.auth.getUser(match[1]);
 if(error||!data.user)throw new HttpError(401,'Your session expired. Please sign in again.');return {db,user:data.user};
}
export async function boundedJson(request:Request,maxBytes=65536):Promise<unknown> {
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'Send JSON content.');
 if(Number(request.headers.get('content-length')||0)>maxBytes)throw new HttpError(413,'Request is too large.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Request body is required.');let size=0;const chunks:Uint8Array[]=[];
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'Request is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'Invalid JSON.');}
 }finally{reader.releaseLock();}
}
export function errorResponse(error:unknown){return Response.json({error:error instanceof HttpError?error.message:'Kampus could not complete this request. Please try again.'},{status:error instanceof HttpError?error.status:500,headers:{'Cache-Control':'no-store'}});}

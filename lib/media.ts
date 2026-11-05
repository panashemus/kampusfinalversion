import {supabase} from './supabase';
/** Storage URLs are source references; only render signed URLs after RLS checks. */
export async function resolveMediaUrls(urls:string[]):Promise<string[]>{
 const resolved=await Promise.all(urls.slice(0,8).map(async raw=>{
 try{const url=new URL(raw);const base=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!base||url.origin!==new URL(base).origin)return null;
 const match=/\/storage\/v1\/object\/public\/(post_media|avatars)\/(.+)/.exec(url.pathname);if(!match)return null;
 const path=decodeURIComponent(match[2]);const {data,error}=await supabase.storage.from(match[1]).createSignedUrl(path,300);
 return error?null:data?.signedUrl||null;}catch{return null;}
 }));return resolved.filter((url):url is string=>!!url);
}

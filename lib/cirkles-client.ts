import {authHeaders} from './supabase';
import type {ModerationMatch} from './moderation';
export class CirklesSubmissionError extends Error{constructor(message:string,public matches:ModerationMatch[]=[]){super(message);}}
export async function publishCirkles(kind:'posts'|'comments',payload:Record<string,unknown>){
 const response=await fetch('/api/cirkles/'+kind,{method:'POST',headers:{'Content-Type':'application/json',...await authHeaders()},body:JSON.stringify(payload)});
 const body=await response.json();if(!response.ok)throw new CirklesSubmissionError(body.error||'Could not save. Your draft is still here.',Array.isArray(body.matches)?body.matches:[]);
 if(typeof body.id!=='string')throw new CirklesSubmissionError('Could not confirm the save. Keep your draft and check the feed.');return body.id as string;
}

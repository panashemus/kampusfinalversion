import {supabase} from './supabase';
import {UUID} from './interconnect';
import type {Conversation,Message} from './types';
export function participantKey(a:string,b:string):string{return [a,b].sort().join('::');}
export async function getOrCreateConversation(myId:string,peerId:string,_peerUsername:string,listingId?:string):Promise<Conversation>{
 if(!UUID.test(myId)||!UUID.test(peerId)||listingId&&!UUID.test(listingId))throw new Error('Invalid conversation reference.');
 const {data,error}=await supabase.rpc('open_conversation',{peer:peerId,listing:listingId||null});
 if(error||!data)throw new Error('This conversation is unavailable. Check verification, message preferences, blocking, or listing availability.');
 return (Array.isArray(data)?data[0]:data) as Conversation;
}
export async function fetchConversations(myId:string):Promise<Conversation[]>{
 const {data,error}=await supabase.from('conversations').select('*').or(`participant_a.eq.${myId},participant_b.eq.${myId}`).order('last_message_at',{ascending:false,nullsFirst:false}).limit(50);
 if(error)throw new Error('Your inbox could not be loaded.');return data as Conversation[];
}
export async function fetchMessages(conversationId:string,before?:string):Promise<Message[]>{
 let query=supabase.from('messages').select('id,conversation_id,sender_id,text,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(50);
 if(before)query=query.lt('created_at',before);const {data,error}=await query;
 if(error)throw new Error('Messages could not be loaded.');return (data as Message[]).reverse();
}
export async function sendMessage(conversationId:string,senderId:string,text:string):Promise<Message|null>{
 if(!text.trim()||text.length>4000)return null;
 const {data,error}=await supabase.from('messages').insert({conversation_id:conversationId,sender_id:senderId,text:text.trim()}).select().single();
 return error?null:data as Message;
}

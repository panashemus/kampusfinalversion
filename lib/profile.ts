import {supabase} from './supabase';
import type {Profile} from './types';
export async function loadMyProfile():Promise<Profile|null>{
 const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return null;
 const {error:syncError}=await supabase.rpc('sync_my_verification');if(syncError)throw new Error('Account verification could not be checked. Please try again.');
 const {data,error:profileError}=await supabase.from('profiles').select('*').eq('id',user.id).single();
 if(profileError||!data)throw new Error('Your student profile is not ready. Please try again.');return data as Profile;
}

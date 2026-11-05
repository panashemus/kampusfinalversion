import { createClient } from '@supabase/supabase-js';
export const isSupabaseConfigured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Real Auth shape; unconfigured operations fail rather than pretending to save.
export const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'unconfigured-local-preview',
 {auth:{persistSession:isSupabaseConfigured,autoRefreshToken:isSupabaseConfigured,detectSessionInUrl:isSupabaseConfigured}});
export async function authHeaders():Promise<Record<string,string>>{
 const {data:{session}}=await supabase.auth.getSession();
 return session?{Authorization:`Bearer ${session.access_token}`} : {};
}

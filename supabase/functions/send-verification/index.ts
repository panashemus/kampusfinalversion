import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Retired insecure transport. Existing UI already uses auth.resend/verifyOtp.
Deno.serve(()=>new Response(JSON.stringify({error:"Use native Supabase Auth confirmation."}),{status:410,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}}));

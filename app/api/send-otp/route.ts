// Native Supabase Auth owns confirmation, token generation and resend limits.
export async function POST(){return Response.json({error:'Use the confirmation email from Supabase Auth. You can resend it from the verification screen.'},{status:410});}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action } = body;

    // ---- action: send-code ----
    // Generates a 6-digit OTP, stores it on the user's profile row, and emails
    // it via Resend from onboarding@resend.dev.
    if (action === "send-code") {
      const userId = body.userId as string;
      const email = body.email as string;
      if (!userId || !email) {
        return json({ error: "Missing userId or email" }, 400);
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));

      // Store the code + expiry on the profile row.
      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          verification_code: code,
          verification_code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .eq("id", userId);
      if (upErr) return json({ error: upErr.message }, 500);

      // Send the email via Resend.
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "Resend key not configured" }, 500);

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "verify@kampusbw.site",
          to: email,
          subject: "Your Kampus Verification Code",
          html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#0B1611;padding:32px 0;margin:0"><div style="max-width:420px;margin:0 auto;background:#111C17;border:1px solid #1f3a2c;border-radius:16px;padding:32px"><h1 style="color:#fff;font-size:20px;margin:0 0 8px">Kampus Verification</h1><p style="color:#8aa39a;font-size:14px;line-height:1.5">Use the 6-digit code below to verify your student email. It expires in 10 minutes.</p><div style="margin:24px 0;text-align:center"><span style="display:inline-block;letter-spacing:8px;font-size:36px;font-weight:800;color:#FFDE4D;background:#0B1611;border:1px solid #1f3a2c;border-radius:12px;padding:16px 24px">${code}</span></div><p style="color:#8aa39a;font-size:12px">If you didn't request this code, you can ignore this email.</p></div></body></html>`,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        return json({ error: `Resend failed: ${errText}` }, 502);
      }

      return json({ ok: true });
    }

    // ---- action: verify-code ----
    // Checks the submitted code against the stored code + expiry, and flips
    // email_verified to true on success.
    if (action === "verify-code") {
      const userId = body.userId as string;
      const code = String(body.code).trim();
      if (!userId || !code) {
        return json({ error: "Missing userId or code" }, 400);
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("verification_code, verification_code_expires_at, email_verified, email")
        .eq("id", userId)
        .maybeSingle();
      if (pErr) return json({ error: pErr.message }, 500);
      if (!profile) return json({ error: "Profile not found" }, 404);

      if (profile.email_verified) return json({ ok: true, alreadyVerified: true });

      const expiresAt = profile.verification_code_expires_at
        ? new Date(profile.verification_code_expires_at).getTime()
        : 0;
      if (Date.now() > expiresAt) {
        return json({ error: "Code expired. Request a new one." }, 410);
      }
      if (profile.verification_code !== code) {
        return json({ error: "Incorrect code." }, 400);
      }

      const isAdminEmail = [
        'musungwa60@gmail.com',
        'chrisvandium@gmail.com',
        'chris.karter1629@gmail.com',
      ].includes((profile as { email?: string }).email ?? '');

      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          email_verified: true,
          verification_code: null,
          verification_code_expires_at: null,
          ...(isAdminEmail ? { is_admin: true } : {}),
        })
        .eq("id", userId);
      if (upErr) return json({ error: upErr.message }, 500);

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

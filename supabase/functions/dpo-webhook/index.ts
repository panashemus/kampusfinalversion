import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userId, dpoResult } = await req.json();

    if (!userId || typeof dpoResult !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing userId or dpoResult" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // '000' is DPO's success code.
    if (dpoResult !== "000") {
      return new Response(
        JSON.stringify({ ok: true, updated: false, reason: "DPO result not success" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extend the user's subscription by 30 days from the later of now or the
    // current expiry, so renewals stack instead of truncating.
    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("subscribed_until")
      .eq("id", userId)
      .maybeSingle();

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const current = profile?.subscribed_until ? new Date(profile.subscribed_until) : now;
    const base = current > now ? current : now;
    const newExpiry = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ subscribed_until: newExpiry.toISOString() })
      .eq("id", userId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, updated: true, subscribed_until: newExpiry.toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

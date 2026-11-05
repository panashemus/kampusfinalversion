import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Permanently refuse new payment claims while KAMPUS is free.
Deno.serve(() => new Response(JSON.stringify({ error: "Payment processing is disabled." }), {
  status: 410,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }
}));

# Kritic emergency reliability hotfix — 17 November 2026

## Incident
Vercel Production logs confirmed `gemini-4-hydrogen` timeouts and HTTP 503 errors, plus repeated HTTP 503 errors on `gemini-3.6-flash` and intermittent 503/timeouts on `gemini-3.5-flash-lite`. The old Hydrogen-first flow could take nearly a minute and fail. The database's request-quota refund RPC rejected server-side releases due to an unreliable role-claim guard.

## Current default routing
- **Short conversational questions:** `gemini-3.5-flash-lite`, then `gemini-2.5-flash-lite`, then `gemini-3.8-flash`. Use shorter per-model timeouts, low thinking and constrained response length.
- **Substantial tasks and attachments:** `gemini-3.8-flash`, then `gemini-2.5-flash`, then `gemini-3.5-flash-lite`. Keep Botswana-specific rubric and BQA context, with larger response budgets but bounded request time.
- Google's older 2.5 models may not be available to new projects. Provider 404/429/503 will fall through, not get mistaken for actual student feedback. No guaranteed availability during upstream outages.
- **Hydrogen** remains a selectable model ID, but is not the default during the ongoing instability. Argon and Carbon remain disabled unless explicitly opted into paid API use. No OpenAI API calls, and never use the key pasted into chat.
- **Extra evidence-inventory model pass is OFF by default.** Enable only with `KRITIC_EVIDENCE_PASS_ENABLED=true` after monitoring latency, billing and reliability.
- **Provider-status FAQs** are answered locally without consuming a quota reservation, with accurate statements about adaptive routing.

## Technical safeguards
- Gemini 2.5 models use `thinkingBudget` rather than unsupported `thinkingLevel`. 
- Server-side Supabase auth and student course requirement remain mandatory for academic review; document uploads and clean-up unchanged.
- On provider failure, return a clear error, do not fabricate a critique, and attempt a backend-only quota refund.
- Supabase migration `kritic_secure_refund_grants_20261117` removed the optional JWT-claim guard while preserving EXECUTE **only** for `service_role` (both `anon` and `authenticated` forbidden). Two historically failed requests for the owner's authenticated account were refunded after verifying logs and usage counts, reducing today's used count from 3 to 1.
- Production keys are server-side. `KRITIC_PRIMARY_MODEL` may override the first model, but not whitelist restrictions. The legacy `KRITIC_MODEL` environment setting is retained in Vercel but no longer drives the adaptive default. The override should remain **unset**.

## Validation
Run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` before deployment. Verify preview and production routes. Observe server logs for 502s, upstream 503s, failed refund attempts, and actual latency over time. Unit tests with mock fetch validate routing logic, **not** live Google availability; a real API smoke test was deliberately not made without verifying the Google project's billing state.

## Rollback
If the new route fails, restore the previous commit or set an approved `KRITIC_PRIMARY_MODEL` and redeploy. Never silently enable a paid model.

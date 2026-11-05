# KAMPUS foundation audit — 5 November 2026

Baseline: `3945681` on `main`. Development branch: `feature/kampus-2-foundation`.

## Architecture confirmed from source

Next.js 13.5.1 App Router, React 18.2, strict TypeScript 5.2, Tailwind 3, Radix UI, Leaflet, Supabase JS. One large client page switches modules using URL fragments. Three Next API handlers and two Supabase Edge Functions. Netlify build configuration is tracked; API error copy also mentions Vercel, so the actual hosting environment is unverified. No automated tests or CI are present. Supabase migrations cover only part of the application schema.

Feed, marketplace, profiles, chat, safety, notifications, moderation and payments query Supabase directly. Kritic calls Gemini from a Next handler, discovers models on every request and retries multiple models. Academic history is stored in browser localStorage and undocumented Supabase tables. Most lists use `select('*')` without pagination. Realtime subscriptions generally clean up but notification delivery is duplicated.

## Confirmed findings and severity

| Severity | Finding | Evidence / consequence |
|---|---|---|
| Critical | Browser can write profile authority fields | AuthScreen sets verified/admin flags; owner UPDATE has no column restrictions; fallback INSERT allows anonymous writes. Privileges must come from trusted auth state. |
| Critical | Legacy verification endpoint accepts arbitrary user ID and recipient | Service role can issue a victim's OTP to another mailbox, then assign administrator status by hardcoded email. Replace with native Supabase Auth. |
| Critical | Public SOS access | Original migration grants anonymous SELECT/INSERT/UPDATE for precise locations and enriched identities. |
| Critical | Payment authentication absent | DPO webhook trusts caller-supplied success; Kritic SMS branch trusts caller text. Subscription UI grants paid flags before verification. Financial changes require separate approval; release blocker. |
| High | AI and email API abuse | No authenticated identity, request budget, input bounds or server quota. Provider errors returned to browsers. |
| High | Private upload leakage | Kritic uploads academic images to public `post_media` as a background side effect. Historical objects need review. |
| High | Committed credential | `.env.local` tracks a non-placeholder VAPID private key. Remove from current tree, add prevention, require owner-approved rotation; do not print value or rewrite history. |
| High | Confession identity leakage | UI hides authors but raw feed rows include `user_id`, author name and user-namespaced media URLs. |
| High | Location privacy | Radar watches GPS on mount, publishes paid users' coordinates, reads other users' locations, and implements ghost mode on the client. Defer person-to-person sharing. |
| High | Chat authorization gaps | Participant UPDATE can change membership; no blocking/consent checks; get-or-create races; no listing reference. |
| High | Vulnerable framework/dependencies | Registry audit of resolved baseline: 4 critical, 19 high, 20 moderate, 4 low advisories. These are dependency findings, not confirmed exploited paths. |
| High | Schema drift | Code references tables/columns absent from all tracked migrations, including Kritic, escrow, notifications, votes, reviews, settings and location features. Live RLS unknown. |
| Medium | False success/error states | Mock Supabase client has incompatible auth shape; failures can leave loading forever or pretend saves succeeded. |
| Medium | Guest history implementation unsafe | Commit `c80b074` manufactured a verified guest profile; no database guest boundary. |
| Medium | UX/accessibility | Forced auth and Kritic redirect, disabled zoom, tiny controls, mobile-only desktop shell, fragmented styling, no explicit source-return workflow. |

Secret scan: 292 historical blobs scanned for common token/private-key formats; no additional matches. Separate environment-key inspection identified the VAPID key. Pattern scans cannot prove absence of every secret.

## Reuse and planned implementation

Keep the existing modules, visual palette, auth provider and specialized tables. Add opt-in public visibility and moderation approval, safe projections, a real guest shell, deterministic typed action registry, URL source references, server-revalidated Feed→Kritic and listing→Chat flows, participant-only saved references, messaging blocks/preferences, and optional institution/topic preferences. No automatic publication, anonymous AI calls or Circles launch.

Harden nonfinancial authority and privacy first. Keep all current content campus-only by default. Protect private endpoints/storage at the database boundary. Isolate risky financial remediation in an approval-required proposal. Do not apply migrations, rotate keys, perform transactions, send student messages, deploy, or merge.

## Potential breaking changes and rollout gates

Application and migration must ship together after staging verification. Profile authority and verification will use Auth confirmation plus trusted grants; clients can no longer self-verify or assign admin. Legacy OTP transport is retired. Raw feed access is restricted so all member browsing must use safe projections. Existing content is not automatically made public. Person-location discovery is deferred. Framework upgrade requires host compatibility checks. Financial handlers and legacy media remain explicit release blockers until reviewed.

## Verification strategy

Capture baseline typecheck/build/dependency audit. Add Node unit tests for actions, routing and validation; isolated PostgreSQL-compatible tests for roles, public projections, anonymity, profiles, chat blocking and quotas; local HTTP tests for protected APIs and failure states. Exercise guest discovery, registration return path, Kritic sample and mobile navigation in the available browser. Use synthetic fixtures only. Record precisely which tests rely on mocked services and which require staging credentials. Compare production build route sizes where available.

## References

[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next security advisory](https://nextjs.org/blog/security-update-2025-12-11), [Gemini model documentation](https://aistudio.google.com/docs/models). Live landing at https://www.kampusbw.site/ showed mandatory sign-in during this audit.

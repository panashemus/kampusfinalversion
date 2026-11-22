# Cirkles / TEZEmber implementation and release plan

## Discovery and scope
Existing community data: 32 posts, 45 comments and 80 votes at discovery. Preserve every existing row, category, identity/privacy choice, public approval, image reference and notification destination. Keep the `community` route. The existing safe views suppress anonymous identity; preserve that projection exactly when appending Cirkles fields. Existing direct browser inserts/edits are a moderation bypass and will become server-only for new content. Votes, deletion and reads remain available.

Use the reference's three rounded outer arcs plus a complete concentric inner circle. Use current palette for navigation/badges and restrained icy gradients for the explicitly requested brand variant. No raster asset or paid service is necessary.

## Implementation
1. Pure name/doxxing engine with source-span tracking, normalization, contextual collisions, bounded fuzzy/censor matching and an editable anonymization helper. Curate 500+ distinct given names, surnames and nicknames; document sources and limits without scraping student identities.
2. Authenticated authoritative post/comment endpoints. Verify confirmed membership; check parent access through the user's session; moderate text/prompts; permit only owned image paths. Service-only atomic insert/rate/duplicate RPCs. Revoke direct text insertion/update so DevTools cannot bypass moderation. Legacy content remains approved and unchanged. Database enforcement is independent of user-editable metadata.
3. Existing Gemini key, dynamically discovered allowlisted Flash model, strict JSON validation, 3.5-second total timeout, deterministic fallback. Never store rejected raw text or provider output in logs. Record rule codes and a redacted template only. No claim of infallible detection. Coded harassment and image-based identifiers remain explicit limitations; do not imply text moderation scans photos.
4. Unified Cirkles + classic feed, server-side circle/category filters before pagination, prompt chips, named/anonymous modes, preserved interactions and drafts. Latest/Trending sorting, privacy-aware story-card export (only already-public approved Cirkles posts), and founder log/review controls. Avoid extra reaction tables; existing upvotes already serve the low-friction engagement need.
5. Additive, idempotent migration: Cirkles metadata/indexes, admin-only log view, server-only budget/duplicate state; no updates/deletes of legacy posts/comments/votes. Moderation status changes by admins must preserve public-review status unless intentionally changed. No synthetic production content, accounts or broadcast tests.

## Gates and rollout
Run 30+ adversarial and 15+ benign moderation tests, semantic classifier timeout/malformed/injection tests, isolated database role/atomicity/idempotence/legacy preservation checks, existing app tests, types, lint and build. Browser fixtures cover 375/390/430px, legacy interactions, rejected draft recovery, anonymity and story cards; fixtures never ship as production content. Verify preview, then apply migration during the short code-rollout window (older open pages must refresh to use the new submission endpoints; raw writes are deliberately denied), verify counts and access rules, merge/deploy and check live aliases/runtime.

Rollback: previous application deployment plus a compatible maintenance message if needed; retain additive data. Do not restore unmoderated browser writes as a shortcut. Disable creation temporarily if authoritative submission has a production failure. Never erase student data or moderation history to roll back.

## Limits
Name filters cannot be bulletproof or infer every identity from context. Ambiguous words and out-of-corpus names need measured tuning. AI availability is best effort and deterministic fallback is deliberately used rather than blocking all posting during outages. No new paid provider or paid model is enabled. Detailed test and deployment evidence will be recorded in the delivery report.

## Validation checkpoint
188 app tests pass, including the moderation corpus/bypass suite and semantic/classifier/authority/export checks; 13 isolated database scenarios pass, including a second migration application. Browser → real Next endpoints → isolated Postgres passed with labelled synthetic sessions. Preview secrets are scoped correctly: public Supabase configuration exists in preview, while the existing Gemini and service-role keys remain production-only. No production secret was copied into previews. Public preview rendering is therefore a separate gate from the local authenticated submission test.

Concurrent main-branch Feed/Radar fixes were merged before release. Latest remains the strict chronological default; Cirkles adds only the explicit Trending alternative. The compact Radar controls and unified action toolbar are preserved.

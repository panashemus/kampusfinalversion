# Kritic — Gemini 4 routing and bounded evidence review (November 2026)

## Safety and pricing policy
- **Default primary: `gemini-4-hydrogen`** using the existing server-only `GEMINI_API_KEY`. The exact API model ID is documented by Google.
- **Automatic fallbacks: `gemini-3.6-flash`, then `gemini-3.5-flash-lite`.** The existing production `KRITIC_MODEL` is attempted immediately after Hydrogen when it is on the approved list. No unexpected or deprecated model IDs are accepted.
- **`gemini-4-argon` and `gemini-4-carbon` are paid API models and are disabled.** Only an explicit operator action setting `KRITIC_PAID_MODELS_ENABLED=I_ACCEPT_PAID_API_CHARGES` *and* selecting a paid `KRITIC_PRIMARY_MODEL` can enable them. Do not do this on the current no-new-charges plan.
- ChatGPT Plus does not include OpenAI API usage. The user pasted an OpenAI API key in chat: **do not reuse or persist that key**. Its owner should revoke it in OpenAI's key-management console and create a new key only if paid API usage is explicitly desired later.
- Google AI Studio/API free-tier access depends on the Google project, billing state, geographic eligibility and rate limits. If a Gemini API key is attached to paid billing, even models with a free-tier offering may incur paid API usage. Confirm the actual billing tier before promising zero charges.
- Model/provider keys must never be stored in the repository, `NEXT_PUBLIC_*` variables, client JavaScript, logs, or students' uploaded documents.
- Preserve private Supabase Storage, authenticated users, email-verification and course requirements, quota reservation/refund, upload cleanup and existing API request limits. One user request reserves one Kritic quota unit regardless of bounded provider fallback.

## Adaptive evidence-first workflow
- A substantial draft (>=750 prompt characters) or coursework upload qualifies for a two-stage review. Short questions, greetings and requests near the 60-second function deadline use a single model pass.
- Stage 1: an 8-second bounded Hydrogen evidence inventory checks what materials and rubric exist, pinpoints observable gaps and notes uncertainty. This is **not internal chain-of-thought**; it is a short working evidence summary, subject to verification.
- Stage 2: a fresh response verifies the inventory against original materials, marks unsupported claims as unknown, and produces a student-executable review with rubric-led priorities. If stage 1 fails, the regular response still proceeds.
- On rejection, timeouts, blocked access, provider errors, empty responses, thought-only responses or inadequate exam responses, attempt the next explicitly approved model. A shared absolute deadline caps the entire provider workflow, rather than looping indefinitely.
- Respect Botswana context and BQA boundaries: do not claim official BQA grades, lecturer expectations, fake citations or guaranteed scores. Academically honest learning support means critique, concrete revisions and practice, not invented evidence.
- Logs contain only limited provider status codes and model IDs; never student text or credential values.

## Configuration
| Name | Purpose | Current recommended value |
| --- | --- | --- |
| `GEMINI_API_KEY` | Existing private server key | Leave unchanged; only in Vercel Production |
| `KRITIC_PRIMARY_MODEL` | Optional override of first model | Unset (defaults to `gemini-4-hydrogen`) |
| `KRITIC_MODEL` | Compatibility setting / first approved backup | Existing working `gemini-3.6-flash` |
| `KRITIC_PAID_MODELS_ENABLED` | Explicit paid-model opt-in | **Unset** |

## Verification and rollout
Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` on a feature branch, then deploy a preview. Check public unauthorized requests return their existing auth errors, without exposing any model key or user content.
The synthetic provider smoke script `pnpm test:kritic:live` only runs on an explicitly permitted environment holding a **verified non-billable** Google key. Do not run it against an unknown-billing key. Mocks and build checks validate the fallback algorithm but cannot prove actual live Gemini 4 entitlement.
Rollback by setting `KRITIC_PRIMARY_MODEL=gemini-3.6-flash` and redeploying the approved revision or reverting the commit if necessary.

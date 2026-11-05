# KAMPUS 2.0 — Free-mode source handoff

This is the **combined repository source**, not only Codex's changed files. It is built from the pre-2.0 production backup and the Codex 2.0 changed-source export, then modified to pause monetization. Your official logo and original layouts are included.

## What's free / what's paused

- Student accounts, Campus Feed, student marketplace listing creation, messaging and ordinary features have no subscription or listing fee. Seller-chosen item/service prices remain displayed; that is not a KAMPUS charge.
- Kritic's former single-prompt paywall and paid activation route are removed. **Server limits remain: at most 5 requests per verified account per UTC day and 100 requests globally per UTC day**, subject to successful application of the 20261105181039 SQL migration and available AI credentials.
- The new SMS/payment reference activation code is removed; DPO webhook and seller payment-confirmation route return HTTP 410. The old subscription, payment and escrow checkouts/components are removed from the active UI.
- **New escrow transactions are paused.** Historical payment/escrow rows and any funds owed must still be reconciled. Public-location safety/privacy requirements still apply; person-to-person location sharing is still deferred.
- A new SQL migration (`20261105181102_free_mode_finance_pause.sql`) blocks changes to paid entitlements and creation of new payment/escrow records, and restricts client writes to profiles. It also removes a lingering old subscription gate from hazard reports.

## IMPORTANT: pushing to GitHub is NOT sufficient for safe production release

1. Preserve an independent database backup and review any active escrow/payment obligations. Never assume an old payment record proves bank settlement.
2. Apply the 2.0 Supabase migrations in timestamp order, **including** `supabase/migrations/20261105181102_free_mode_finance_pause.sql`, ideally in staging first. The newer migration depends on functions created by earlier migrations. Database migrations are **not** automatically applied just by pushing to Vercel.
3. Separately deploy the modified Supabase Edge Function `dpo-webhook` or remove/disable its public deployment. GitHub/Vercel does **not** update deployed Supabase Edge Functions automatically. Disable payment requests at any bank/payment provider too, if applicable.
4. Configure existing legitimate Supabase/Gemini environment variables in Vercel. They are intentionally excluded from this ZIP. Rotate credentials previously exposed in Git history; deleting a tracked `.env.local` does not revoke those secrets.
5. Install dependencies from the lockfile and run `pnpm build`, `pnpm typecheck`, `pnpm test` and a staging smoke test before promoting to `main`. Check auth, listing creation, Kritic 429 rate limiting, and that financial operations fail closed. Confirm migrations and the Edge Function are actually deployed.
6. For a GitHub transfer, **copy the extracted contents over a fresh clone of `panashemus/kampusfinalversion`**, preserving paths. Read `KAMPUS_2_0_FREE_File_Manifest.md` for required deletions. Uploading the ZIP as a single GitHub repository file will not deploy the website. A GitHub Desktop commit/push is the least error-prone way to handle deletions.

## Verification actually performed here

- 14 focused Node tests passed (9 existing interconnect tests + 5 new free-mode source checks).
- Global TypeScript parser reported no syntax errors in application TS/TSX files.
- A full Next.js build and resolved typecheck **were not possible** in the available offline workspace because project dependencies (`next`, React types, and `@electric-sql/pglite`) were not installed. The SQL migration and live Supabase schema were **not** executed or independently validated. **Do not treat this package as release-verified until the steps above pass.**

Source provenance: Codex commit `662669801b2c68d430b0ffaf6ac4dccc93c357b8` was local only in the supplied export; base source commit `39456810ae381c3af475c64e1cbf18489172fdae`. These are identifiers from supplied artifacts, **not** new GitHub commits. No GitHub push or deployment was performed as part of this handoff.


## Production migration status (5 November 2026)
The four 2.0 migrations were applied to the KAMPUS Supabase project through its connected migration API, with production history versions `20261105181025`, `20261105181039`, `20261105181052`, and `20261105181102` respectively. Their filenames in this repository match those recorded versions to avoid accidentally rerunning them. The old DPO Edge Function was not present in the deployed-function listing; no historical payment or escrow records were deleted.

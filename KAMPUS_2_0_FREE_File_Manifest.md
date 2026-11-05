# KAMPUS 2.0 Free Mode — File Manifest

Compared to the supplied `KAMPUS_Pre_2.0_Production_Backup.zip`.

**Use the FULL project ZIP for the simplest migration.** This changed-files ZIP is an overlay only, not a standalone website.

**Important:** copying files or committing them to GitHub will NOT apply Supabase SQL migrations or redeploy existing Supabase Edge Functions. Financial paths must remain disabled until the backend is updated. Existing escrow obligations are retained.

**Counts:** 28 created, 31 replaced, 5 deleted, 80 unchanged versus pre-2.0.

## Files to CREATE

- `app/api/interconnect/source/route.ts`
- `app/api/preview/route.ts`
- `components/ContextActions.tsx`
- `components/GuestPreview.tsx`
- `components/KampusLogo.tsx`
- `components/MemberApp.tsx`
- `components/PublicReviewQueue.tsx`
- `components/SecureImage.tsx`
- `components/StudentPreferences.tsx`
- `docs/FOUNDATION-AUDIT.md`
- `docs/ORIGINAL_CODEX_2_0_Manifest.md`
- `lib/interconnect.ts`
- `lib/kritic-validation.ts`
- `lib/media-upload.ts`
- `lib/media.ts`
- `lib/profile.ts`
- `lib/server/auth.ts`
- `pnpm-lock.yaml`
- `public/apple-touch-icon.png`
- `public/favicon.png`
- `supabase/migrations/20261105000100_foundation_privacy.sql`
- `supabase/migrations/20261105000200_interconnect.sql`
- `supabase/migrations/20261105000300_media_and_moderation.sql`
- `supabase/migrations/20261105000400_free_mode_finance_pause.sql`
- `tests/database.mjs`
- `tests/free-mode.test.cjs`
- `tests/interconnect.test.cjs`
- `tests/mock-supabase.mjs`
- `KAMPUS_2_0_FREE_File_Manifest.md` (this file)

## Files to REPLACE

- `.gitignore`
- `README.md`
- `app/api/kritic-audit/route.ts`
- `app/api/notify-seller/route.ts`
- `app/api/send-otp/route.ts`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `components/AdminDashboard.tsx`
- `components/AuthScreen.tsx`
- `components/BottomNav.tsx`
- `components/ChatInbox.tsx`
- `components/ChatRoom.tsx`
- `components/CommunityHub.tsx`
- `components/HustleHub.tsx`
- `components/ImageUploader.tsx`
- `components/KampusKritic.tsx`
- `components/LegalModal.tsx`
- `components/Lightbox.tsx`
- `components/ProfileScreen.tsx`
- `components/PublicProfileModal.tsx`
- `components/RadarMap.tsx`
- `lib/chat.ts`
- `lib/supabase.ts`
- `lib/types.ts`
- `next.config.js`
- `package.json`
- `public/manifest.json`
- `supabase/functions/dpo-webhook/index.ts`
- `supabase/functions/send-verification/index.ts`
- `tailwind.config.ts`

## Files to DELETE from the old checkout

- `components/EscrowVault.tsx`
- `components/PaymentModal.tsx`
- `components/SubscriptionModal.tsx`
- `lib/payment.ts`
- `package-lock.json`

## Notes

- Preserve all legitimate environment variables in your deployment settings; never upload `.env` files, secrets, or provider credentials.
- Seller-defined listing prices are intentionally kept: KAMPUS is free to use, but user merchandise is not necessarily free.
- Previous payments and escrow records must remain in the database; deletion of old UI source files does **not** delete database data.
- New policy/migration `supabase/migrations/20261105000400_free_mode_finance_pause.sql` has not been executed here.
- The updated `supabase/functions/dpo-webhook/index.ts` must be deployed to Supabase separately; GitHub upload alone leaves the old deployed webhook live.
- Do not push to a production-linked `main` branch before focused build/database verification, migration deployment, webhook disablement, and review of unsettled financial records.

# KAMPUS 2.0 changed-source manifest

Local saved commit: `662669801b2c68d430b0ffaf6ac4dccc93c357b8`
Base production source commit: `39456810ae381c3af475c64e1cbf18489172fdae`
Status: NOT PUSHED. No deployment of this commit was initiated or confirmed.

Release blocker retained from prior findings: the SMS verification branch and DPO webhook accept unverified payment claims, and client code can grant paid privileges. Payment/escrow release remains blocked under the user's security restriction. Production database migrations have not been applied.

This ZIP contains complete files, relative to the repository root, for every create/replace below, plus the exact original logo. Apply deletions separately. It is a changed-source archive, not a standalone repository. Existing unrelated files are not included or overwritten by this archive itself.

Secrets, local environment files, Git history, dependencies and build output are excluded. The deleted `.env.local` is listed only; no contents are included. Previously tracked private credentials still require owner rotation.

No additional test suite, audit, or browser verification was performed for this save. The earlier production build failed before a Tailwind fix; the fix and final branding have not been build-tested.

| Action | Repository path |
| --- | --- |
| DELETE | `.env.local` |
| REPLACE | `.gitignore` |
| CREATE | `app/api/interconnect/source/route.ts` |
| REPLACE | `app/api/kritic-audit/route.ts` |
| CREATE | `app/api/preview/route.ts` |
| REPLACE | `app/api/send-otp/route.ts` |
| REPLACE | `app/globals.css` |
| REPLACE | `app/layout.tsx` |
| REPLACE | `app/page.tsx` |
| REPLACE | `components/AdminDashboard.tsx` |
| REPLACE | `components/AuthScreen.tsx` |
| REPLACE | `components/BottomNav.tsx` |
| REPLACE | `components/ChatInbox.tsx` |
| REPLACE | `components/ChatRoom.tsx` |
| REPLACE | `components/CommunityHub.tsx` |
| CREATE | `components/ContextActions.tsx` |
| CREATE | `components/GuestPreview.tsx` |
| REPLACE | `components/HustleHub.tsx` |
| REPLACE | `components/ImageUploader.tsx` |
| REPLACE | `components/KampusKritic.tsx` |
| CREATE | `components/KampusLogo.tsx` |
| REPLACE | `components/Lightbox.tsx` |
| CREATE | `components/MemberApp.tsx` |
| REPLACE | `components/ProfileScreen.tsx` |
| REPLACE | `components/PublicProfileModal.tsx` |
| CREATE | `components/PublicReviewQueue.tsx` |
| REPLACE | `components/RadarMap.tsx` |
| CREATE | `components/SecureImage.tsx` |
| CREATE | `components/StudentPreferences.tsx` |
| CREATE | `docs/FOUNDATION-AUDIT.md` |
| REPLACE | `lib/chat.ts` |
| CREATE | `lib/interconnect.ts` |
| CREATE | `lib/kritic-validation.ts` |
| CREATE | `lib/media.ts` |
| REPLACE | `lib/payment.ts` |
| CREATE | `lib/profile.ts` |
| CREATE | `lib/server/auth.ts` |
| REPLACE | `lib/supabase.ts` |
| REPLACE | `lib/types.ts` |
| REPLACE | `next.config.js` |
| DELETE | `package-lock.json` |
| REPLACE | `package.json` |
| CREATE | `pnpm-lock.yaml` |
| CREATE | `public/apple-touch-icon.png` |
| CREATE | `public/favicon.png` |
| REPLACE | `public/manifest.json` |
| REPLACE | `supabase/functions/send-verification/index.ts` |
| CREATE | `supabase/migrations/20261105000100_foundation_privacy.sql` |
| CREATE | `supabase/migrations/20261105000200_interconnect.sql` |
| CREATE | `supabase/migrations/20261105000300_media_and_moderation.sql` |
| REPLACE | `tailwind.config.ts` |
| CREATE | `tests/database.mjs` |
| CREATE | `tests/interconnect.test.cjs` |
| CREATE | `tests/mock-supabase.mjs` |
| REPLACE (identical supporting asset) | `public/images/ClipSnap_20260723201232.png` |

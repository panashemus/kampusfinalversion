---
name: kampus-ui
description: Use for KAMPUS React/Next.js design, responsive layouts, profiles, Feed, Hustle Hub, authentication forms, preferences, accessibility and mobile experience.
---

# KAMPUS frontend quality
Adapted from ECC frontend-patterns and TypeScript guidelines.

## Design
- Work with Next.js App Router, current React components, Tailwind utilities and existing Radix primitives.
- Keep a polished, coherent KAMPUS visual language: dark green, midnight, gold accents, clear typography, restrained borders and generous space.
- Prioritize mobile: 320px to 430px viewports, safe areas, no fixed-position elements obscuring content; also test desktop.
- Make buttons large enough to tap and forms usable by keyboard and screen readers. Use semantic labels, focus styles, sensible loading/error states.
- Prefer accessible Lucide icons over decorative emoji. **Do not alter students' post, chat, comment or listing text**.

## Functional integrity
- Preserve visibility rules for guest, public, campus-only, private and anonymous content.
- For setting saves, persist to Supabase first; only then show success/collapse or update local profile. Surface errors with an accessible status.
- Keep async effects guarded against stale responses, clean up realtime subscriptions, and avoid infinite re-fetch loops.
- Do not use fake counters, dummy reviews, placeholder businesses or invented achievement badges to beautify profiles.
- Use safe responsive sizing, text wrapping and empty/error/loading states. Avoid unnecessary dependencies.
- Client-only hiding is never a substitute for server authorization or RLS.

## Acceptance checks
- Validate primary happy path and failure path; include refresh/revisit behavior.
- Check long usernames and course names, missing avatars, no listings, zero notifications and partially completed profiles.
- Verify modal closing, keyboard navigation, focus and small-screen overflow.
- Add regression tests where practical. Report untested device/browser combinations explicitly.

---
name: kampus-security
description: Use whenever KAMPUS work touches Supabase, authentication, row-level security, API handlers, payments, email, push notifications, storage, sensitive data or untrusted inputs.
---

# KAMPUS security review
Adapted from ECC security-review and common security rules, specialized for this repository.

## Before changes
1. Read affected API routes, RLS policies/migrations, authorization helpers and existing tests.
2. Identify actor, resource, action, trust boundary and the narrowest authorization rule.
3. Check schema against deployed state before proposing SQL; SQL file presence does not prove a migration is applied.
4. Follow current vendor documentation for Supabase, Vercel, Resend and web push where behavior may change.

## Required checks
- Never expose, inspect unnecessarily, print or copy .env.local, production secrets, tokens or credentials. A tracked historical VAPID key needs owner-led rotation and removal; see the foundation audit.
- Never make authorization depend only on local UI state, user-editable JWT metadata, email text fields or client-assigned verified/admin flags.
- Ensure Postgres RLS, column privileges, secure views and protected Storage URLs align; check access as anon, member, other member and admin.
- Ensure anonymous confession author IDs cannot leak via API fields, file paths, search, comments, notifications, error messages or previews.
- Validate and bound input and uploads server-side. Rate-limit Kritic, public endpoints, notifications and email actions. Do not permit mass push without explicit administrator authorization and appropriate opt-in.
- Use parameterized queries or Supabase query builders, never interpolate untrusted SQL identifiers or values.
- Do not expose student coursework, private chats, contact details, exact safety locations or real-time student positioning.
- Keep retired financial routes disabled. Changes to payment/escrow flows require a separate security and reconciliation plan.

## Security evidence
Describe the tests performed, including negative authorization cases and any gaps. Never report a security audit as passed based only on a successful build. Prioritize critical exposures and distinguish historical findings from confirmed current behavior.

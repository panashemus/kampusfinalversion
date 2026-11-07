---
name: kampus-verify
description: Use after any KAMPUS code change and before a PR or authorized production release. Verify the build, types, lint, tests, security, diff and actual target behavior without claiming checks that were not run.
---

# KAMPUS verification loop
Adapted from ECC's verification-loop skill for this Next.js/Supabase repository.

## Run in this order
1. **Scope:** inspect `git diff` and changed files; ensure no unexpected DB migrations, secrets, fake accounts, notification broadcasts or content publication.
2. **Tests:** run focused regression tests first, then `pnpm run test`. For database authorization changes use `pnpm run test:db` only against a safe isolated test database.
3. **Types:** `pnpm run typecheck`.
4. **Lint:** `pnpm run lint`. Record warnings rather than mislabelling them as errors.
5. **Build:** `pnpm run build`. Fix compilation/type errors before release.
6. **Security review:** auth, RLS, untrusted input, privacy, redirects, storage, push/email abuse, secrets and explicit authorization for production mutations.
7. **Target acceptance:** if authorized to deploy, verify Vercel build succeeded at the expected commit, aliases point to the new READY deployment and relevant functionality has been smoke-tested. A Vercel READY result alone does not prove feature behavior.

Do not invent an 80% coverage measurement: the current test runner does not necessarily generate coverage. Report the actual measured figure if available and any lack of coverage tooling.

## Report format
- Changes made / commit:
- Tests: PASS / FAIL / NOT RUN, evidence:
- Types:
- Lint:
- Build:
- Security/secret review:
- Production deployment: READY / ERROR / NOT DEPLOYED, expected commit:
- Functional acceptance: VERIFIED / FAILED / NOT TESTED:
- Remaining risks and next action:

Do not claim success before tool results support it. If a required test environment isn't accessible, mark the gate **NOT RUN**, not PASS.

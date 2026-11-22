# Social Radar video parity — 2026-11-22

Source: `social_radar_promo.mp4`, SHA-256 `93a5ec4f2cba86c7ac592a1fe08c08547ecb1ec338ab64b46ea2738783364897`. The Downloads copy and original production output match. Inspected decoded frames every 0.5 seconds across all 24 seconds and the accompanying production script; the MP4 is authoritative.

## Feature inventory and implementation plan

| Video time | Demonstration/promise | Existing implementation → work in this release |
| --- | --- | --- |
| 0–8.4s | Initialled campus pins; temporary “Library session until 5” status | Already implemented; retain existing map/design and 80-character status. Ceramic scenery is illustration, not a 3D navigation requirement. |
| 8.4–12.6s | Explicit opt-in, off by default; selected accepted friend T; 30 min/1 hour/3 hours; Company welcome | Already implemented with server authorization. Make pins approximate before storage, disclose precision and status risks; protect late permission callbacks. |
| 8.4–12.6s | Updates while Radar is open; hidden after five minutes stale | Existing time bounds and foreground write checks → also stop the browser watcher when hidden, refresh permissions on return, and clear cached peer locations while hidden. |
| 12.6–15.8s | Join me filter and invitation pin | Existing filter affects only list → apply same filter to map pins. |
| 15.8–17.6s | Friend card, freshness, status, Company welcome, sharing end time, Ask to join in chat | Already present → retain and clarify approximate pin. |
| 17.6–19.8s | Private chat with authored request, Sent / waiting for reply; never automatic acceptance | Existing chat sends manually → provide editable join-request draft and invitation explanation. No automatic messages or meeting acceptance; sent state reflects actual save. |
| 19.8–24s | Tokens meet; “A new Radar is coming”, URL, opt-in/foreground disclaimer | Illustrative outcome and promo launch wording. No promised meeting, route, ETA, arrival detection, background tracking, crowds or guaranteed instant updates. |

Privacy hardening: selected-friend removal/block must erase that recipient's consent, including blocks made elsewhere in Kampus; reconnecting must not restore the old selected permission. All-friends mode continues to mean all currently accepted friends, as labelled.

Risk: location authorization and lifecycle changes. Preserve SOS/hazards/places, other chat entry points, membership checks, RPC-only tables, expiry deletion and existing app design. No production test accounts, messages, posts or location fixtures.

Acceptance: focused executable lifecycle/filter/draft tests; isolated database tests with negative roles, rounding, reconnect/block/expiry cases; full app tests/types/lint/build; mobile and desktop browser fixtures; protected preview and staged production smoke checks; apply additive migration, verify live privileges and cleanup, then promote tested production build.

Rollback: restore previous Vercel production deployment; retain privacy-reducing migration. If sharing needs disabling, revoke authenticated execution on start/update/snapshot RPCs while preserving stop. Migration retains tables and existing sharing deadlines; no location history or backup of precise coordinates is created.

## Release evidence

Implementation validation: 92 app tests and 15 isolated Radar database scenarios passed; types and production build passed; lint has zero errors and two existing warnings in unrelated components. Eleven local browser checks passed at 320/390/1280 pixels, including selected consent, permission denial/recovery, map filtering, stop/watcher cleanup, editable invitation draft, failure/retry, confirmed send and Escape dismissal. Browser map tiles were deliberately intercepted; screenshots establish controls/layout, not tile-service availability.

Live inspection before migration confirmed RPC-only Radar tables (no anon/authenticated raw SELECT), membership checks backed by confirmed Auth users, and a healthy every-minute expiry job. Existing project-wide advisors include legacy projection views, helper-function grants, an extension placement warning and disabled leaked-password protection; this release does not silently rewrite unrelated access models.

Rollout is tracked in [PR #12](https://github.com/panashemus/kampusfinalversion/pull/12); deployment and migration outcomes belong in the accompanying delivery report. Genuine multi-account production acceptance, real device GPS/permission behavior, background suspension by mobile operating systems and actual meetings remain unverified. Synthetic fixture results are not production-account results. A roughly 100 m grid reduces coordinate precision; it is not anonymity and a status note may disclose a meeting place.

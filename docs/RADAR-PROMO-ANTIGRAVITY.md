# Antigravity production brief — Social Radar

Create the promo film only. The Radar redesign has already been implemented on the local `feature/social-radar` branch. Do not refactor or replace the application. Inspect `docs/SOCIAL-RADAR.md`, `components/RadarMap.tsx`, `components/RadarSocial.tsx`, and the supplied screenshots before making interface claims.

RELEASE STATUS: local implementation, not deployed. Confirm deployment before describing it as available now. If the feature is still in review, end with “A new Radar is coming.” Never represent local fixtures as actual students or real campus activity.

## The product story

Kampus Radar helps Botswana students connect with accepted friends around campus. The signature interaction is a temporary invitation: someone shares “Library session until 5” with “Company welcome” enabled. A friend sees the pin, taps it and chooses “Ask to join in chat.” The existing private chat opens so they can arrange meeting.

Implemented features you may showcase:
- Requests by exact Kampus username; the recipient accepts.
- Initials profile pins for accepted friends who are actively sharing with the viewer.
- Explicit location sharing, off by default.
- 30-minute, 1-hour or 3-hour sharing.
- All accepted friends or selected friends.
- Short status text, optionally “Company welcome.”
- “Join me” filter for open invitations.
- Pin cards showing update freshness and sharing end time.
- “Ask to join in chat” or “Message friend.” This opens messaging; it is not an automatic join acceptance.
- Stop sharing, remove friend, block and unblock.
- Campus/place navigation. Existing hazard and SOS functionality remains separate.

Location updates while Radar is open. Positions hide after five minutes without an update. Do not promise background tracking, guaranteed meetings, instant updates, automatic arrival detection, public crowd counts, routes, ETA or live avatar animation. There are no illustrated character avatars in this implementation: pins use initials.

## Creative task

Make a surprising 20–25 second vertical 3D film about the moment two students realise they could meet. No people, talking mascot, laptop scene, AI tabs, deadline clock or generic floating-phone presentation. Avoid the typography and composition of the previous Kampus films.

Use an original visual metaphor: two small sculptural campus tokens keep passing close to one another without connecting. A temporary invitation gives their paths a reason to meet. Explore a tactile world of translucent acrylic, ceramic or layered paper relief. Choose one coherent art direction and execute it beautifully. Strong lighting, deliberate camera movement, material detail and expressive object motion matter more than filling the screen with text.

Suggested story:
1. A visually striking near-miss between two tokens on a miniature campus.
2. One token pauses at a library. “Library session until 5” unfolds beside it.
3. A clear opt-in choice: “Selected friends · 1 hour.” Company welcome is enabled.
4. The other token discovers the “Join me” invitation.
5. A brief, readable view of the actual action: “Ask to join in chat.” A message is sent, not automatically accepted.
6. End on the feeling of a possible connection and kampusbw.site. Use launch wording appropriate to release status.

Ground interface details in the actual redesigned UI/screenshots. Any miniature geography or people must be visibly illustrative. Avoid fake response-time comparisons and invented popularity numbers.

## Audio and copy

Write a concise original script around: “You can be on the same campus and still keep missing each other.” Let the visuals explain the feature. Use a natural, expressive voice if needed, preferably American; intimate and conversational. Build an original soundscape with near-miss swishes, a warm invitation cue and crisp message taps. Give the ending breathing room. Keep on-screen copy sparse and accessible; no subtitle backgrounds.

## Delivery

1080×1920, 30 fps, H.264 MP4 with AAC audio and fast-start metadata. Save in a new `outputs/social_radar_promo/` folder. Preserve prior assets and videos. Deliver the video, editable source, script, audio and contact sheet. Inspect actual exported frames and audio before presenting it. Do not deploy the app, apply migrations or publish the promo as part of this film task.

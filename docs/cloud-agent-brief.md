# Haiku & Hue — implementation brief

**A feeling. Three lines. A little color.**

A daily haiku studio that turns your moods and inspiration into poetry and matching artwork, with approval-first social publishing. The private collection is **The Haiku Almanac**. `@haikuandhue` is a suggested handle, not a verified available account.

This brief preserves the implementation request supplied to the cloud agent. It is the product target, **not a claim that every feature below has shipped**. The README documents delivered behavior, validation, and deferred integrations. No production deployment or merge is authorized by this brief.

## First useful release

Complete a private, persistent flow:

1. Today's mixed feelings and optional permitted inspiration.
2. Independent poem and background batches.
3. Select any existing poem/background combination and edit it.
4. Render and review exact final assets, captions, and alt text.
5. Explicitly approve the exact export or an eligible supported publication.
6. Download and complete manual sharing, or track a genuinely confirmed API publication.
7. Retain versions, exports, and outcomes privately in The Haiku Almanac.

Preparation may be automated; approval may not. Silence never approves. The studio must remain genuinely useful without paid AI or social credentials. Demo, procedural rendering, hosted generation, manual handoff, and confirmed publication must be distinguishable.

## Architecture and privacy

- Next.js, TypeScript, Tailwind; PostgreSQL and Prisma migrations.
- A modular monolith with a separate container-suitable durable PostgreSQL queue worker, not long-running browser requests.
- Private local-development media storage and an S3-compatible adapter; deterministic SVG and Sharp output.
- Authentication and server-side owner scoping for private records, actions, previews, downloads, and approvals.
- Generation must not receive social credentials, dispatch publications, or mint approvals. A shared repository does not justify shared privileged database access.
- Server-side provider credentials; least privilege, encrypted social tokens if introduced, disconnect/data deletion. Never request secrets in chat.
- Separate private journal notes and interpretations from input explicitly permitted for hosted AI or public captions.
- Treat imported notes, image text, and model output as data, never authorization or publishing instructions.
- No public media buckets. Any future provider-retrieval URLs must be limited to approved assets and processing windows.
- Local-only mode must disable hosted processing, not merely claim privacy.

## Creative journal interface

Warm paper, ink, elegant readable typography, generous space, calm mood accents, mobile layouts, keyboard-accessible controls, and meaningful empty/error/loading/partial states.

- **Today:** check-in, guidance, independent generation controls, two sample galleries, composition editor.
- **Review:** exact assets and destination metadata, explicit approval, cancellation, expiry, schedule eligibility, truthful outcomes.
- **Almanac:** private dates, revisions, compositions, exports, and publication outcomes.
- **Settings:** explicit saved daily defaults, IANA timezone, reminders/preparation/cutoff, budgets, AI disclosure, account capabilities, global publishing pause.

## Check-in and daily scheduling

Capture multiple feelings and intensity, optional inspiration, visual style, emotional direction (reflect, gently lift, playfully contrast), themes, palettes, and exclusions. Accept mixed feelings without diagnosis or forced cheerfulness. Support owned/licensed photos when the secure upload path is implemented; never imply a generated abstraction is a photo.

Retain owner/local date and timezone, and store actual instants in UTC. Prepare only when today's input exists; otherwise remind and wait. An explicitly enabled neutral-theme mode may prepare a draft, never approve it. Saved defaults are applied to scheduled preparation; experimentation does not silently replace them.

Deduplicate owner/day work across restarts, DST transitions, and timezone changes. Expired unapproved work stops but remains archived. Never copy yesterday's mood, build a missed-day posting backlog, or move an approved publication outside its window.

## Independent samples — core requirement

- Separate **New haikus** and **New artworks** counts, default three each.
- Counts affect the next batch, not the size of saved galleries. Either may be zero; zero plus zero is rejected with an explanation.
- Five poems and two backgrounds must yield five independent poems and only two backgrounds, with ten possible pairings. Recommend at most three; permit any combination.
- Count/guidance/selection changes do not initiate paid calls. Show requested counts, configurable limits, estimated generation cost, and available budget before submission. Reject unsupported requests, never silently downsize.
- Persist per-output state and partial successes, report exact missing outputs and retry cost, and do not replay completed outputs.
- Generation, storage/hosting, and social API subscription expenses are separate. Do not invent provider prices.

## Guidance, editing, and revisions

Poem guidance: tone, literal/abstract imagery, emphasized themes/words, avoided motifs/words. Artwork guidance: medium, palette, warmth, brightness, subject, composition, and negative space. Provide close/explore variation, next-batch or selected-component scope, freeform instructions, resets, effective guidance, and conflict reporting. Bias is guidance, not a guaranteed numerical result.

Directly edit each line. Enforce line, whole-poem, artwork, and layout locks in application logic, not only prompts. Surface contradictions before generation. Poem-only regeneration preserves artwork/layout, and artwork-only regeneration preserves the poem. Never overwrite manual edits or automatically apply generated alternatives.

Persist immutable versions and ancestry, comparison, and undo/redo. Typography, placement, crop, and contrast preview without AI. Distinguish free layout edits, paid regeneration, and provider-supported AI editing. A fixed demo cannot pretend to perform tailored refinements. Include an explicit **Save as my daily defaults** action.

## Text and image generation

Build a compact creative brief from permitted imagery, tone, colors, and exclusions. Structured poem output has three lines, public caption suggestion, visual tags, background brief, private interpretation, model identity, and prompt version.

Default to English 5–7–5 with an optional freer form. Use pronunciation/syllable checks, expose uncertainty, and allow an explicit owner override. Model-reported syllable counts are not authoritative. Compare recent poems for repetition without claiming global originality.

Without model credentials, provide clearly labeled fixed demonstration poems. Procedural gradients, paper textures, and subtle shapes are real rendered artwork, not AI-generated photographs. Keep backgrounds text-free and render poetry separately with escaped deterministic SVG, reliable fonts, safe margins, readable contrast, and Sharp. Deliver real square and portrait image downloads. Recombination/export never calls a text model.

Editable captions and alt text accompany the final poem. Optional image models and later FFmpeg vertical loops are separate future features. A future video must keep the whole poem readable, default to silence, and use licensed audio only after explicit preview.

## Exact approval boundary

Before approval, render every destination-specific final asset. Review must identify final media, caption, alt text, account ID, visibility/interaction settings, UTC publish instant with local timezone, retry window, and expiry. Only genuinely supported API paths may offer **Approve and publish now** or **Approve and schedule**.

An immutable approval manifest binds the exact candidate revision, asset hashes, text, destination accounts/settings, schedule/window/expiry, actor, and approval time. Covered changes require new approval and block stale dispatch. Generating unused alternatives does not invalidate a composition; applying them does.

Approval is an authenticated explicit action, never a GET or notification-link side effect. Support cancellation/rejection, expiry, and global pause. At dispatch atomically recheck authorization, active approval, manifest/assets, current composition, pause/cancellation, and time window. Transactional state transitions and unique approval/account keys prevent independent concurrent submissions.

Cancellation is effective before submission starts. Once a provider may have accepted content, do not promise recall or cross-platform rollback. Ambiguous acceptance must reconcile or become **unknown**, never trigger a blind repost.

## Social capabilities and outcomes

Use official APIs or authorized services only; no browser login automation or social passwords. Adapters expose validation, upload, publication, and status capabilities, account/format/permission constraints, and whether reconciliation is possible. A connected account is not proof of format eligibility.

Select the first actual connector after owner preference and account eligibility are established. Without external credentials, deliver manual export and adapter foundations, document the blocker, and do not invent successful publication.

Keep planned, awaiting-access, connected, blocked, and manual-only account states honest. Keep exported, manual handoff, queued, uploaded, published, failed, and unknown outcomes separate. Save provider IDs/permalinks only when confirmed. One destination's failure must not replay another's success. Retry transient failures with bounded backoff within the approved window, respecting provider guidance and idempotency.

See the integration access notes below for official references and verification limitations.

## Persistence model

CreativeDefaults; DailyEntry; GenerationRequest with per-output progress; HaikuRevision; ArtworkRevision; CandidateRevision; immutable private Asset with hash/dimensions/provenance/license; SocialConnection; immutable Approval manifest; per-destination Publication; and journal-free AuditEvent.

All private entities belong to an owner. Samples, versions, current selection, and outcomes survive reloads and worker restarts.

## Demonstration material

These are fixed examples, not proof that AI interpreted a journal entry.

Reflective / tired / quietly hopeful; private inspiration: “Rain at my window, cold tea, and permission to slow down.”

| Poem | Caption | Artwork direction, not a supplied photograph |
| --- | --- | --- |
| A gray morning waits / Rain taps softly on the glass / I let the world slow | Today, enough can be quiet. | Slate-blue rainy-window abstraction, pale light, lettering space |
| Cold tea by the sill / Clouds drift through the pale gray dawn / My hands rest at last | Leaving a little room for rest. | Ceramic-teacup inspiration, cream/taupe cloudy daylight |
| Rain beads on the leaves / A small bird shakes off the night / Warm light finds my hands | Not a brighter day yet. Just a little warmth. | Sage leaves, restrained gold, ink-watercolor inspiration |

Another example: hopeful / determined; “I planted herbs this morning and finally started a project I had been avoiding.”

“Light spills through the leaves / Small green shoots split the hard ground / I start where I stand.” Caption: “A small beginning is still a beginning.” Artwork direction: green shoots, dark soil, early sunlight.

Alt-text example: “Rain trails down a blue-gray window. The poem reads: A gray morning waits / Rain taps softly on the glass / I let the world slow.”

Creative-control example: “Give me five haikus and two watercolor backgrounds. Make the poems quietly hopeful, avoid mentioning rain, and use muted greens. Keep the first line of my selected poem.” A demo provider must report any unsupported instruction honestly.

## Acceptance and delivery

Automate meaningful tests for owner authorization including media/approvals; independent 5+2, zero-count, reduced-count preservation and partial batches; free guidance/recombination/export; enforced locks/conflicts; persisted manual edits/history/undo; no automatic alternative selection; explicit defaults; rendered final text/layout; exact approval invalidation; unused alternatives; pause/cancel/expiry/silence; duplicate/concurrent jobs; local-date/DST behavior; missing-mood reminders; ambiguous timeouts; independent outcomes; honest demo/manual/blocked/unknown/published states.

Deliver migrations, seed examples, secret-free environment template, local dependency/web/worker instructions, actual validation results, and explicit external-only tests not run. Do not present planned functionality as completed or claim live provider verification without evidence.

## Integration access notes — 2026-09-07

No social account preference, account authorization, app approval, API subscription, or publishing credentials were supplied. No real publication is claimed. Downloading approved media or opening another app is a manual handoff, not a successful post.

Direct retrieval of the requested Meta, TikTok, LinkedIn, and YouTube documentation failed in this cloud environment because their hostnames were unavailable. Search results were consulted but are not an eligibility audit; some returned stale or conflicting details. No pricing or permission claim below should be treated as a verified grant of access.

Official Bluesky and Mastodon documentation was retrieved through their official GitHub documentation repositories:

- [Bluesky: creating a post](https://github.com/bluesky-social/bsky-docs/blob/main/docs/tutorials/creating-a-post.mdx), inspected at file SHA `183099504d2ee339eddf3e7d6b2f28435f59f2b8`: posts are records; images are separately uploaded blobs with alt text and referenced in the post. The inspected version specifies up to four images and two megabytes per image. Limits must be checked again before implementation.
- [Bluesky: OAuth client implementation](https://github.com/bluesky-social/bsky-docs/blob/main/docs/advanced-guides/oauth-client.md), retrieved at file SHA `fbf54e82fba9609b5d6083713fada6b922fc8073`. OAuth guidance exists; do not assume app passwords are the only connection method.
- [Mastodon: statuses](https://github.com/mastodon/documentation/blob/main/content/en/methods/statuses.md), inspected at file SHA `94efb95109e40386cec60a8c0d45ead74174964b`: `POST /api/v1/statuses` uses user authorization and `write:statuses`; media attachment IDs and visibility are supplied to the request. `Idempotency-Key` is supported, with keys stored for up to one hour. This finite retention period does not justify indefinitely replaying ambiguous requests.

These checks establish API building blocks, not account connectivity, tested upload, or production eligibility. No live upload/publish/reconciliation was performed.

### Destination access checklist

| Destination | Required discovery before enabling API publication | Current external boundary |
| --- | --- | --- |
| Instagram | Professional account eligibility, current login/API variant, publishing scopes, app access, account identity, image constraints | Manual export; image feed first, Reels later |
| Facebook | Authorized Page and Page publishing access; not unattended personal-profile posting | Manual export |
| Threads | Authorized account, current Threads publishing permissions and media flow; a publishing API exists | Manual export |
| X | Current user-context write/media permissions, account limits and API pricing checked with the owner | Manual export; no assumed subscription or quoted price |
| Bluesky | Owner chooses account; supported OAuth authorization; image upload limits, record identity and ambiguous-outcome reconciliation verified | Candidate first connector, not connected |
| Mastodon | Owner chooses instance/account; OAuth scopes, instance media/text limits, visibility, upload/status behavior and finite idempotency verified | Candidate first connector, not connected |
| LinkedIn | Member versus organization identity, appropriate permissions and organization role; media upload and Posts API access | Manual export |
| Pinterest | Authorized account/board and current Pin/media permissions/access | Manual export |
| TikTok | Product/use-case eligibility, authorized integration, required account preview, consent, privacy and interaction controls | Manual completion; a developer/team-only private upload utility is not a Direct Post eligibility workaround |
| YouTube | Real video pipeline, OAuth upload authorization, project restrictions and required privacy controls | Later video only; still-image export is not a Short or Community API upload |

An application audit is not a workaround for a use case excluded by TikTok's published Direct Post guidance. Keep that destination manual-only unless a genuinely eligible product/integration is confirmed.

### Official starting points

- [Instagram content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Facebook Pages publishing](https://developers.facebook.com/docs/pages-api/posts/)
- [Threads publishing](https://developers.facebook.com/documentation/threads/posts)
- [X developer platform](https://docs.x.com/)
- [Bluesky post creation](https://docs.bsky.app/docs/tutorials/creating-a-post)
- [Mastodon statuses](https://docs.joinmastodon.org/methods/statuses/)
- [Mastodon media](https://docs.joinmastodon.org/methods/media/)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [Pinterest API](https://developers.pinterest.com/docs/api/v5/)
- [TikTok content posting getting started](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [TikTok content sharing guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines/)
- [YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert)

### First live connector acceptance gate

1. Confirm owner preference, target account/instance and current use-case eligibility outside chat; provision credentials using a secret manager/environment, not a commit.
2. Implement official authorization with least privilege, encrypted token storage, expiry/reconnect, disconnect and data deletion.
3. Validate account/media capabilities before presenting approval. Render the exact supported media format first; do not silently crop or rewrite a previously approved post.
4. Bind account, settings, caption, alt text, media hashes, UTC schedule/timezone and retry expiry to the immutable manifest.
5. Use a publication-only secret/DB boundary. Atomically recheck approval, current composition, owner, pause/cancel/expiry and asset identity before a single submission claim.
6. Verify upload separately from publication. Save remote ID and permalink only after confirmation.
7. Exercise transient failure, expired credentials, rate limiting, concurrent jobs, restart, cancellation races and ambiguous acceptance. Reconcile before retry; when reconciliation is unsupported, stop at unknown for owner review.
8. Prove a failed destination cannot replay successful destinations. Do not promise recall once submission may have reached the provider.

Until these gates pass, keep the connector disabled and continue to provide usable approved downloads, captions, alt text, and clearly labeled Finish in app links.

### Other external-only checks

Hosted text generation needs an explicitly selected provider, configured server-side credentials, informed permission for the exact minimized input, configured budget estimates, and a real request test. A demo poem is not a live-provider test. Hosted email needs verified delivery configuration; a development inbox/log is not proof of email delivery. S3-compatible storage needs private bucket credentials and a storage round-trip test. None of these dependencies is necessary to claim success for a local, procedural, manual-export workflow.

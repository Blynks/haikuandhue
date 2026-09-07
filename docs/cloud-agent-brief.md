# Haiku & Hue: cloud agent implementation brief

**Tagline:** *A feeling. Three lines. A little color.*

**Repository description:** A daily haiku studio that turns your moods and inspiration into poetry and matching artwork, with approval-first social publishing.

## Mission and delivery expectations

Build a working MVP of **Haiku & Hue**, a private, personal creative studio. Turn the owner's daily feelings and inspiration into original haikus paired with fitting backgrounds. Automate preparation, but never publish without explicit final approval of the exact post.

This document consolidates the agreed product design, jumpstart, implementation plan, and subsequent creative-control requirements. In particular, sample counts are independently adjustable, not fixed at three.

Inspect the repository and its instructions first; reuse existing conventions. At handoff, the repository contains a short README and this brief, not an existing application. Implement runnable, persistent functionality, not just mockups or a new plan.

Prioritize a complete creative workflow before expanding social integrations:

**Daily inspiration -> independent poem/artwork samples -> editing and pairing -> final review -> explicit approval -> export or supported publishing -> private archive.**

Keep the application useful without AI or social credentials. Label demo content, manual handoffs, unavailable integrations, and live publishing unmistakably. Do not claim an integration works until its authorized end-to-end path exists.

## Architecture

Use a modular monolith with a separate worker process, not a collection of microservices.

| Component | Starting choice |
|---|---|
| Web application | Next.js, TypeScript, Tailwind CSS |
| Persistence | PostgreSQL and Prisma, including migrations |
| Durable jobs | PostgreSQL-backed queue, such as pg-boss |
| Media storage | Private S3-compatible storage with a documented local development option |
| Image rendering | Deterministic SVG layout composited with Sharp |
| Text generation | Configurable provider interface with server-side credentials |
| Background generation | Procedural templates first; optional image-provider adapter |
| Notifications | Email-first provider interface with an explicit development mode |
| Video, in a later stage | FFmpeg in a container worker |
| Publishing | Capability-aware adapters for official APIs or authorized services |

Include authentication from the first usable version. Enforce ownership on private records and media, not just page navigation. Keep generation and publishing responsibilities separate; generation must not be able to read social credentials or dispatch posts. A shared codebase must not imply shared access to secrets.

Use a worker suitable for long-running media processing and durable scheduling. Do not rely on a web request remaining open to complete generation, rendering, or publishing.

## Experience and visual identity

Create a calm, polished, mobile-friendly creative journal, not a generic analytics dashboard. Use warm paper tones, ink-colored text, elegant typography, generous spacing, and mood-inspired accent colors. Include accessible controls, readable artwork, and meaningful loading, empty, partial-success, and error states.

| Screen | Purpose |
|---|---|
| Today | Daily check-in, generation controls, sample galleries, composition editor |
| Review | Exact destination-specific previews, approval, scheduling, cancellation, outcomes |
| Almanac | Private calendar and archive of entries, revisions, exports, and publication outcomes |
| Settings | Daily defaults, timezone, budgets, provider disclosure, account connections, global publishing pause |

Use **The Haiku Almanac** as the archive's collection name. The suggested account handle is `@haikuandhue`; availability has not been confirmed.

## Daily check-in and preparation

Capture multiple feelings, intensity, inspiration text, visual style, and emotional direction: reflect my mood, gently lift it, or contrast it playfully. Support optional themes, palettes, exclusions, and a photo the owner has rights to use.

Support mixed emotions. Do not diagnose feelings or automatically turn sadness into cheerful content. Separate private inspiration and internal interpretations from material permitted in public captions.

Save the entry against the owner's local calendar date. Let the owner configure an IANA timezone, daily reminder or generation time, and draft cutoff. Store scheduled instants in UTC while retaining the timezone.

If today's input exists, daily preparation may generate drafts using saved defaults. Otherwise remind the owner and wait. Do not infer today's mood from yesterday's entry. An optional, explicitly enabled neutral-theme mode may prepare drafts, never approve them.

Unapproved drafts leave the daily queue at the cutoff but remain in the private archive. Silence never means approval. Missing days must not create a posting backlog. Deduplicate daily jobs by owner and local date, including daylight-saving transitions and timezone changes.

## Sample counts and creative controls: required in the MVP

Place separate **New haikus** and **New artworks** quantity controls beside Generate, defaulting to three of each. Counts describe the next batch; decreasing them never deletes existing samples.

Allow either count to be zero, so the owner can generate only poems or only artwork. Disable a zero-and-zero request with an explanation. Store each component independently; five poems and two artworks allow ten pairings without generating ten backgrounds. Recommend up to three pairings when both components are available, and permit any saved poem/artwork combination.

Changing quantities, guidance, or selection must not itself start a paid model call. Before submission, show the requested quantities, applicable provider or budget limits, and estimated cost. Never silently reduce a request. Persist per-output progress; preserve successful samples when part of a batch fails and identify missing outputs and retry costs.

| Target | Controls |
|---|---|
| Haiku | Tone, literal versus abstract imagery, themes or words to emphasize, motifs or words to avoid |
| Artwork | Medium, palette, warmth, brightness, subject, composition, negative space for text |
| Variation | Stay close to a selected sample or explore a different direction |
| Scope | Selected poem, selected artwork, or the next batch |
| Freeform guidance | For example: "Keep the first line, make the ending less wistful, and warm the background." |

Use understandable sliders, chips, swatches, short instruction fields, and reset controls. Treat creative bias as guidance, not a guaranteed numerical outcome. Show the effective instructions and surface conflicts with locks or poetic form before generation.

Support direct line editing; line-level and whole-poem locks; artwork locks; and layout locks. Enforce locked content in application logic, not merely in prompts. A poem-only regeneration must preserve artwork and layout. An artwork-only regeneration must preserve the poem.

Never overwrite hand edits or automatically replace the selected composition with a generated alternative. Save immutable revisions, provide side-by-side comparison, and support undo/redo. Preview typography, cropping, placement, and contrast edits immediately without an AI call. Clearly distinguish free layout changes, paid AI edits, and full regeneration; expose AI editing only when the configured provider supports it.

Let the owner explicitly **Save as my daily defaults**. Current-day experimentation must not silently change future scheduled generation.

## Creative pipeline and rendering

Create a compact brief from the permitted context: imagery, tone, palette, guidance, and exclusions. Treat notes, uploaded image text, and model output as data, never as instructions authorized to operate accounts or approve posts.

Generate structured poem candidates with three lines, a suggested public caption, visual tags, a background brief, and a private interpretation. Record provider and prompt versions. Default to English 5-7-5, with an optional freer haiku mode.

Use a pronunciation dictionary and syllable checks, flag ambiguous words, and allow explicit user overrides. Do not treat a model's claimed syllable count as authoritative. Check repetition against recent posts without claiming guaranteed global originality.

Without model credentials, provide clearly labeled demo samples rather than pretending they are newly AI-generated or tailored to every instruction. Keep unsupported demo refinements explicit.

Start with attractive text-free gradients, paper textures, and subtle shapes. Support owned or appropriately licensed photos. Put generated artwork behind an interchangeable provider interface; do not require a paid image provider for the MVP.

Render poem text separately from its background with deterministic SVG and Sharp. Never ask an image model to draw the poem. Preserve spelling and three line breaks; provide contrast overlays, safe margins, typography choices, crop controls, and placement controls.

Export square and portrait images as real downloadable files. Render pairing previews on demand rather than eagerly generating every combination. Include the poem in accessibility text and make public captions and alt text editable.

For later video destinations, use FFmpeg to create a short, calm vertical loop with the complete poem readable throughout. Default to silence. Add audio only with appropriate rights and an explicit preview.

## Approval is a hard publishing boundary

Review must show the final image or video, caption, alt text, exact destination account, visibility and interaction settings, schedule, timezone, retry window, and expiration for each destination.

Offer **Approve and publish now** and **Approve and schedule** only for supported publishing paths. One explicit action may approve the displayed destination set. Manual export must be presented as a handoff, not an automatic publication.

Persist an immutable approval manifest containing the exact candidate revision, rendered asset hashes, captions, accessibility text, destinations and account IDs, relevant settings, schedule, retry window, expiration, approver, and approval time.

Any change to a covered field requires fresh approval and prevents dispatch of the outdated scheduled version. Merely generating alternatives does not alter or invalidate an unchanged approved selection. Applying an alternative to that post does.

Render all platform-specific media before approval. Never rewrite captions, change accounts, crop assets, or generate a video after approval without creating a new reviewable revision. Explain that platform-side transcoding can affect appearance.

Support rejection, expiration, cancellation, and a global publishing pause. Approval requires an authenticated explicit action, never a GET request or a notification link that a scanner can activate.

At dispatch, recheck the immutable manifest, asset identity, authorization, cancellation, pause state, and allowed time window. Use transactional state transitions and unique publication keys to prevent concurrent jobs from independently submitting the same publication. Cancellation must be effective until submission begins; after provider acceptance, do not promise recall or cross-platform rollback.

## Publishing coverage and honest capability states

Define capability-aware adapters with operations such as validation, upload, publish, and status reconciliation. Represent unsupported operations, required media formats, account eligibility, and reconciliation limitations explicitly.

Use only official APIs or authorized publishing services. Never automate browser logins or collect social account passwords. Recheck current API requirements, pricing, permissions, and access during implementation; this table is a planning map, not a completed integration audit.

| Destination | Planned route and constraints |
|---|---|
| Instagram | Square/portrait images and later Reels; professional accounts and required publishing permissions |
| Facebook | Page images/video; do not promise unattended publishing to personal profiles |
| Threads | Image/text adapter after confirming permissions, media support, and app access |
| X | Image/text after confirming current API access, media permissions, and pricing |
| Bluesky | Candidate early text-and-image connector; verify authentication and upload requirements |
| Mastodon | Instance-aware image/text connector with instance-specific capabilities and limits |
| LinkedIn | Image posts; member and organization permissions differ |
| Pinterest | Image Pins with authorized board selection and appropriate API access |
| TikTok | Eligible approved publishing integration or manual completion; do not assume a private personal utility qualifies for Direct Post |
| YouTube Shorts | Later vertical-video upload route; not a still-image or assumed Community-post endpoint |

TikTok's documented Direct Post guidelines exclude utilities limited to the developer's or team's own accounts; applying for an audit alone is not a solution. Any eligible integration must preserve required account previews, consent, visibility, and interaction controls.

Show truthful connector states such as planned, awaiting access, connected, blocked, and manual-only. A connected account is not automatically eligible for every format.

Choose the first live text-and-image connector after confirming the owner's destination and viable credentials/access. Do not block the useful creative MVP on external app reviews. Implement that connector end to end before expanding; if credentials are unavailable, document the blocked external step and keep manual sharing functional.

For unsupported or unavailable automation, provide approved media download, caption/alt-text copying, and an appropriate "Finish in app" handoff. Exported, handed off, queued, uploaded, published, failed, and unknown outcomes must not be conflated.

## Reliability, privacy, and spending

Track each destination independently. A failure on one must never replay another destination's successful post. Store remote IDs and permalinks when confirmed.

Retry transient errors with bounded backoff and rate-limit guidance only within the approved window. Reuse provider idempotency keys where available. After a timeout that may have followed provider acceptance, reconcile status before retrying. If reconciliation is unavailable, mark the outcome unknown for human review rather than blindly reposting.

Expired credentials, changed platform requirements, and missed windows must block the affected publication and surface an actionable message. Never silently move the post to another account or publish yesterday's mood late.

Keep raw journal notes and internal interpretations out of public captions, analytics, and routine logs. Disclose and minimize private context sent to hosted AI; do not describe hosted generation as local. If on-device-only notes are required, use a genuinely local provider or disable hosted processing for them.

Keep media private, including drafts and originals. If a platform needs a fetchable URL, expose only approved media through scoped, time-limited access or temporary delivery objects for the necessary processing window. Encrypt social tokens, use least-privilege scopes, and support disconnection and private-data deletion.

Use visible generation/regeneration budgets and explicit cost estimates. Reusing artwork and recombining existing samples must not trigger paid generation. Track image/text generation, hosting/storage, and social API/service subscriptions as separate cost categories; do not invent provider prices.

## Persistent records

Model ownership and relationships explicitly. These are conceptual records, not a requirement to use identical table names.

| Record | Required purpose |
|---|---|
| CreativeDefaults | Saved sample counts, guidance, visual preferences, daily settings |
| DailyEntry | Owner, local date, mood, private inspiration, privacy choices, daily overrides |
| GenerationRequest | Requested/completed counts, guidance snapshot, scope, locks, estimates, per-output status |
| HaikuRevision | Three lines, ancestry, locks, generation request, provider/prompt metadata |
| ArtworkRevision | Source asset, ancestry, provenance, edit parameters, generation request |
| CandidateRevision | Selected poem/artwork revisions, layout, captions, alt text, ancestry |
| Asset | Immutable private location, content hash, dimensions, provenance/license |
| SocialConnection | Owner, provider/account IDs, granted scopes, encrypted credential reference |
| Approval | Immutable manifest, approver/time, expiration, cancellation state |
| Publication | Approval, destination, schedule, attempts, status, remote ID, permalink |
| AuditEvent | Approval, cancellation, and publishing transitions without private journal contents |

Enforce a unique publication per approval and destination account. Preserve revisions and completed samples across reloads and worker restarts.

## Implementation stages

1. Establish the application, authentication, database/migrations, private storage, development configuration, and four main screens. Discover launch-platform access early without holding up creative work.
2. Implement persistent daily check-in, independent generation counts, demo/live text adapters, procedural backgrounds, guidance, budgets, and per-output progress.
3. Complete the revision-aware editor: direct edits, locks, selective regeneration, comparison, undo/redo, mix-and-match, deterministic previews, and square/portrait export.
4. Implement exact final review, immutable approvals, invalidation, cancellation, expiration, pause, and truthful manual sharing.
5. Add durable daily preparation, reminders, saved defaults, scheduling, timezone handling, and the private Almanac.
6. Implement the first eligible connector, independent publication jobs, safe retries/reconciliation, reconnect states, and outcome tracking.
7. Expand connectors, optional image generation, and vertical video only after the core loop works. Keep incomplete capabilities visibly unavailable.

## Acceptance criteria

- Authentication and ownership protect journal records, drafts, media, and approval actions.
- Requests such as five poems and two artworks produce those independent counts, or show the exact shortfall while preserving successful outputs.
- Poems-only and artwork-only requests do not regenerate the zero-count component. Zero-and-zero cannot be submitted.
- Reducing counts does not delete prior work. Changing guidance alone incurs no generation cost.
- Locks and manual edits survive selective regeneration. Conflicting edits are surfaced before generation rather than silently ignoring locks.
- Alternative versions remain available without overwriting the selection. Undo/redo and comparison preserve prior work.
- Existing poems/artwork can be recombined and exported without a model call.
- Saved daily defaults apply to scheduled generation; unsaved current-day adjustments do not change future defaults.
- Downloaded images match the reviewed poem, artwork, crop, typography, and line breaks.
- No response, an expired approval, a global pause, or a cancellation before submission prevents dispatch.
- Editing any covered post field requires new approval; generating unused alternatives leaves an unchanged approved post intact.
- Duplicate/concurrent scheduler runs and worker restarts do not independently submit the same publication.
- Daylight-saving and timezone changes do not create extra daily sessions or a backlog.
- Missing today's input prompts a reminder, not reuse of yesterday's feelings.
- An ambiguous provider timeout does not cause a blind repost, and one failed destination does not replay successful destinations.
- Demo, manual, blocked, unknown, and confirmed-published states remain visibly distinct.

Add appropriate automated coverage for these invariants, including negative approval/authorization paths and durable job behavior. Use the project's established testing conventions where available.

## Seed examples

These are sample poems and art directions, not pre-rendered assets or proof of live AI generation. Use them for a clearly labeled demo and onboarding.

**Seed:** Reflective, tired, quietly hopeful. "Rain at my window, cold tea, and permission to slow down."

| Poem, with line breaks shown as `/` | Artwork direction | Public caption |
|---|---|---|
| A gray morning waits / Rain taps softly on the glass / I let the world slow | Slate-blue watercolor window, rain trails, pale light, empty space for lettering | Today, enough can be quiet. |
| Cold tea by the sill / Clouds drift through the pale gray dawn / My hands rest at last | Ceramic teacup on a wooden sill, cloudy daylight, cream and taupe | Leaving a little room for rest. |
| Rain beads on the leaves / A small bird shakes off the night / Warm light finds my hands | Ink-and-watercolor garden, wet leaves, sage green, restrained gold | Not a brighter day yet. Just a little warmth. |

Example accessibility text: "Rain trails down a blue-gray window. The poem reads: A gray morning waits / Rain taps softly on the glass / I let the world slow."

**Different day:** Hopeful and determined. "I planted herbs this morning and finally started a project I had been avoiding."

> Light spills through the leaves  
> Small green shoots split the hard ground  
> I start where I stand

Artwork: new green shoots in dark soil, early sunlight, clear space above for the poem. Caption: "A small beginning is still a beginning."

Example refinement: "Give me five haikus and two watercolor backgrounds. Make the poems quietly hopeful, avoid mentioning rain, and use muted greens. Keep the first line of my selected poem."

## Handoff requirements

Deliver a runnable application with authentication, migrations, labeled seed data, a secret-free `.env.example`, and instructions for starting the web app, database/storage dependencies, and worker. Document provider setup and what works locally without external credentials.

Explain which features are functional, demo-only, planned, or blocked on platform access. Document the approval boundary, deployment secret separation, job handling, privacy assumptions, and known limitations. Do not claim live publishing or scheduled notifications have succeeded without evidence from those integrations.

## Official references to recheck during implementation

- [Instagram content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [TikTok content sharing guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines/)
- [YouTube video upload endpoint](https://developers.google.com/youtube/v3/docs/videos/insert)

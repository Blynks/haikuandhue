# Haiku & Hue

**A feeling. Three lines. A little color.**

A private, single-owner daily creative studio with a durable **Haiku Almanac**. This is a working, manual-first MVP—not a social autoposter.

## What works

- Authenticated check-in with mixed feelings, intensity, private journal, separately permitted inspiration, and explicit saved defaults.
- Independent new-haiku / new-artwork counts (default 3 / 3, including zero for either component). **5 poems + 2 artworks creates 2 reusable backgrounds, not 10 images.** Existing samples are never deleted or automatically applied.
- PostgreSQL outbox and **pg-boss** jobs processed by a separate, restricted draft worker. Per-output progress, persistent partial successes, explicit shortfall requests, conservative budget reservations and no blind retry of ambiguous paid calls.
- Fixed, clearly labeled demo poems with no AI credentials needed; genuine local procedural gradient/paper/rain-window artwork. Optional server-side, OpenAI-compatible live text adapter with a configured HTTPS host allowlist.
- Three-line editing; server-enforced line/poem/art/layout locks; immutable revisions; persisted undo/redo; instant free typography, placement, crop and contrast controls.
- **Exact square (1080×1080) and portrait (1080×1350) PNGs rendered before approval.** Authenticated approval binds final asset hashes, immutable revision, caption, alt text, manual destination, visibility, release instant, timezone, window and actor.
- Explicit release / download / copy-caption / copy-alt / manual-handoff workflow. Cancelling, changing a covered revision, expiry or global pause blocks further release/download. Previously downloaded files cannot be recalled.
- Private filesystem or private S3-compatible media; owner-scoped media and export endpoints; private archive and metadata-only audit events.
- Local-time daily draft scheduling, unique owner/date keys through restart/DST/timezone changes, today's input only, no yesterday-mood backlog, and explicit neutral-theme opt-in. Missing-input reminders use a **persisted private inbox** (or labeled development stdout), not pretend email.

## What is deliberately not live

No social credentials exist and **no social API publishes anything**. “Exported” means files released for private download; “manual-handoff” is owner-reported and does **not** mean published. Platform links simply open another app. The `SocialAdapter` interface defines validation/upload/publish/status and reconciliation capabilities, but its active registry is empty. Pick a preferred, eligible account before implementing a real connector.

Demo poems are fixed examples, **not personalized or refined by a model**. Procedural artwork is not a photograph, AI watercolor or image-model interpretation of freeform instructions. Owned-photo upload, image-model editing, video, audio, email delivery, deletion UI and full-archive export are not implemented. Freeform live text guidance is a bias, not a guarantee. A small English pronunciation dictionary flags unknown words; explicit meter override is supported.

## Run locally

Requirements: **Node.js 22.12+**, npm, PostgreSQL 16+, and DejaVu fonts (Linux: `fonts-dejavu-core`). Docker Compose can supply PostgreSQL. No paid service is required.

```bash
npm ci
cp .env.example .env
```

Edit `.env`:

1. Set a strong `POSTGRES_PASSWORD`.
2. Set `DATABASE_URL` to your administrator/web PostgreSQL connection string, including URL-encoded credentials, database `haiku`, host `localhost`, port `5432`.
3. Set `WORKER_DATABASE_URL` to the same database with **a distinct `haiku_worker` login and password**. Do not use the administrator connection.
4. Set `APP_ORIGIN` to your exact browser origin (`http://localhost:3000` locally). `COOKIE_SECURE=false` is only for local HTTP. Use HTTPS and secure cookies for remote access.

```bash
docker compose up -d db
npm run db:generate
npm run db:migrate
# Set WORKER_PASSWORD in your shell for this command; never commit it.
npm run queue:setup
# Set OWNER_EMAIL and OWNER_PASSWORD (12+ characters) in your shell.
npm run owner:create
# Optional, explicit and non-destructive: seeds today's fixed demo examples.
npm run seed:demo
```

`queue:setup` runs with the migration administrator. It provisions pg-boss and `haiku_worker`; it sets the role's login password only when `WORKER_PASSWORD` is provided. Alternatively set its login/password through your database administrator. The worker **refuses to start** if its role can insert approvals.

In separate terminals:

```bash
npm run dev
npm run worker
```

Open `http://localhost:3000`, sign in, save a check-in, explicitly create samples, select one poem and one artwork, save your composition, render its final review, approve the export, and release the downloads. A pending batch needs the worker process; browser refresh/polling does not execute paid work.

### Production-shaped containers (not a deployment)

The Dockerfile includes Node, Prisma, Sharp and local DejaVu fonts. It runs as an unprivileged OS user. `compose.yml` defines PostgreSQL plus optional `web` / `worker` services and durable database/media volumes.

For container-to-container connections, use host **`db`**, not `localhost`, in both database URLs. Run migrations/queue setup and owner creation against that database first (for example `docker compose --profile app run --rm web npm run db:migrate`, followed by `queue:setup` with the provisioning credential). Then:

```bash
docker compose --profile app up --build -d
```

The local HTTP example needs `COOKIE_SECURE=false`. Before exposing the service, provide HTTPS/reverse proxy, exact `APP_ORIGIN`, secure cookies, a non-superuser web database role, restricted network access, secret management, encrypted storage and backups. **This repository does not deploy or merge anything.** Do not mount `.env` or social secrets into the worker; Compose passes only explicit fields.

### Private storage

Default: `MEDIA_DRIVER=local`, `MEDIA_LOCAL_PATH=./data/media`. Keep that directory outside `public/`, writable only by the application and worker; back it up with PostgreSQL. Files use random immutable keys and content hashes, and are served only after owner authentication.

For S3-compatible storage set `MEDIA_DRIVER=s3`, `S3_ENDPOINT` (optional for AWS), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` on **both web and worker**. Configure the bucket to deny public access, no public ACLs, and least-privilege GetObject/PutObject on the application prefix/bucket. The adapter never produces a public object URL. The checked-in Compose configuration intentionally uses a shared local volume; adapt its explicit storage environment for S3. S3 is implemented but requires your real endpoint to verify deployment.

### Optional live text

Set `TEXT_PROVIDER=live`, `TEXT_API_URL` to a trusted HTTPS chat-completions endpoint, `TEXT_API_ALLOWED_HOST` to exactly its hostname, `TEXT_API_KEY`, `TEXT_MODEL`, and your conservative per-output `TEXT_COST_CENTS`. Set the same text configuration on web and worker. Requests use structured JSON output, no redirects, a timeout and bounded accepted responses. Endpoint, model and credentials are operator-controlled—not model or browser inputs. Only feelings, intensity, permitted inspiration and creative guidance enter the brief; **never private notes**. Save Settings with local-only mode off to opt in. Switching local-only back on blocks queued remote calls as well.

Art stays procedural. Live generation is not an editing oracle; it saves new alternatives and enforces locked lines. Reservations conservatively count submitted estimates against the local-day budget, including failed/unknown requests. They are not exact provider billing or refunds; check your provider account before retrying ambiguous outcomes. No paid generation occurs on guidance changes, previews, formatting, export or archive browsing.

## Architecture and safety boundaries

| Area | Location |
| --- | --- |
| Next.js / TypeScript / Tailwind screens | `src/app`, `src/components/studio.tsx` |
| Domain validation, locks, meter, local dates | `src/lib/domain.ts` |
| Owner-scoped transactional application actions | `src/lib/studio.ts` |
| Scrypt authentication, hashed sessions, origin checks | `src/lib/auth.ts` |
| Private media, SHA-256 / canonical manifests | `src/lib/media.ts` |
| Escaped SVG and deterministic Sharp PNG render | `src/lib/render.ts` |
| Demo / optional live text; no social secrets | `src/lib/providers.ts` |
| Durable independent outputs / daily scheduling | `src/lib/jobs.ts`, `src/worker.ts` |
| Planned social contract, no active connector | `src/lib/social.ts` |
| Prisma schema / checked-in SQL migrations | `prisma/` |
| Restricted worker provisioning | `scripts/worker-role.sql`, `scripts/setup-queue.ts` |

Every browser action requires authentication and an exact same-origin POST. GETs never approve or publish. Session cookies are HttpOnly/SameSite Strict (Secure in production), tokens are hashed at rest, and login attempts are database-rate-limited. Journal text, model text, secrets and tokens are not logged. The server serializes owner mutations with PostgreSQL transaction advisory locks; approvals/destination records and generation requests have unique idempotency keys. Output workers claim jobs with compare-and-swap. The worker DB role cannot read `privateNotes`, users, sessions or social token references; cannot mutate selected compositions; and cannot insert approvals/publications.

Approval manifests use canonical JSON hashing to survive PostgreSQL JSONB key ordering. Before dispatch/download, the transaction rechecks owner, actor, selection, cancel/pause/window/expiry, manifest and stored file hashes. Each manual release transitions once. Unknown paid responses are terminal for automatic processing; future real social connectors must reconcile possible acceptance before retrying, and must never replay other successful destinations.

This is a private single-owner app, not a multi-tenant hosting service or end-to-end encrypted vault. The database administrator and host operator remain trusted. Use an isolated test database and protect production backups. Newly generated alternatives do not cancel approvals; saving/reselecting a covered composition does. Schedule form edits are not applied until rendering a fresh review; the rendered manifest is what approval covers.

## Validation

```bash
npm run lint
npm run build
npm run test
```

Without `TEST_DATABASE_URL`, the unit/render tests run and the PostgreSQL suite is explicitly skipped. For the full suite, use a **dedicated migrated test database**, run `queue:setup` on it, and set:

- `TEST_DATABASE_URL`: test administrator connection
- `TEST_WORKER_DATABASE_URL`: the restricted `haiku_worker` connection for the same database

Then `npm run test` runs real PostgreSQL + pg-boss integration tests, including cross-owner media/approval denial, 5+2 generation, zero counts, locks and manual preservation, persisted undo/redo, exact rendering/approval, unused-alternative validity, cancellation/pause/expiry, duplicate claims, DST/timezones/reminders, unknown responses, privacy rechecks, and database-role denial. Test owners and test media are cleaned up; use a separate database anyway. Do not point these tests at production.

For an actual browser smoke test, run web + worker with a seeded dedicated test owner, set `E2E_EMAIL` and `E2E_PASSWORD`, then `npm run test:e2e`. It creates samples and a manual export on that test owner. Set `PLAYWRIGHT_EXECUTABLE_PATH` to an installed Chromium, or install the browser with Playwright. Screenshots and browser working files stay in ignored project-local directories. The test checks desktop/mobile layout, free count changes, real queued outputs, exact PNG downloads, cancellation and unauthorized media.

Dependency versions are lockfile-pinned. The `deepmerge-ts` 8.0.2 override fixes the Prisma config transitive advisory (GHSA-ggr8-5vv4-36mx); migration/client generation, tests and production build validate compatibility.

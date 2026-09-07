# Haiku & Hue

**A feeling. Three lines. A little color.** Haiku & Hue is a private creative studio that turns a daily mood check-in into original haikus paired with calm procedural artwork.

## What works in this MVP

- Private password gate for journal data.
- Today, Review, Almanac, and Settings screens with mobile-friendly paper-and-ink styling.
- Daily check-in with multiple feelings, intensity, inspiration, visual style, and emotional direction.
- Demo-mode text model adapter that generates three labeled sample haikus when no model credentials are configured.
- Three procedural SVG backgrounds per check-in, plus nine poem/background mixable combinations.
- Syllable estimates are shown as uncertain metadata instead of claiming perfect 5-7-5 accuracy.
- Editing poems, captions, alt text, and typography invalidates approval and returns a revision to draft.
- Approval creates an immutable revision snapshot with exact assets, caption, settings, destinations, visibility, and schedule.
- PostgreSQL-backed Prisma models and durable queue records for daily generation and scheduled publishing.
- Worker process that tracks each destination independently and avoids duplicate jobs with unique queue keys.
- Manual export works now: download square or portrait PNGs rendered by Sharp and copy captions/alt text.

## Demo-only or awaiting integration

- Text generation uses sample content unless `TEXT_MODEL_API_KEY` and a non-demo provider are configured behind the server-side adapter.
- Social platform publishing is capability-aware but not connected. Instagram, Facebook Pages, Threads, X, Bluesky, Mastodon, LinkedIn, Pinterest, and YouTube Shorts are planned; TikTok is marked blocked for this private utility. The app does not use browser automation and does not claim TikTok Direct Post support.
- Publishing credentials are intentionally separate from generation credentials and should be provided through a future credential vault integration.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill local values:
   ```bash
   cp .env.example .env
   ```
3. Start PostgreSQL and set `DATABASE_URL` in `.env`.
4. Apply the schema and seed example data:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
5. Run the app and worker in separate terminals:
   ```bash
   npm run dev
   npm run worker
   ```
6. Open http://localhost:3000 and sign in. If no password hash is configured, the development password is `demo`.

## Useful commands

- `npm run test` - focused unit tests for generation, syllable flags, backgrounds, and publishing capability states.
- `npm run lint` - Next.js/TypeScript linting.
- `npm run build` - generate Prisma client and build the Next.js app.
- `npm run worker -- --once` - process one due queue job for local verification.

## Privacy and safety notes

Journal check-ins are separate from public captions. Missing today's mood input displays a reminder; the app never reuses yesterday's feelings for generation. Publishing requires an approved immutable revision, and each destination has independent delivery state so potentially published requests are not blindly retried.

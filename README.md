# Commute — a personal, offline-first news reader

Pulls RSS from a curated set of sources, scores each story for personal and
business relevance with Claude, and serves a ranked feed that's cached for
offline reading before your commute.

## How it fits together

- `sources.json` — the RSS feeds it reads. Starting list of ~17 across UK,
  international, and PE/business/leisure trade press. Add your own Substacks
  as `https://<name>.substack.com/feed`.
- `profile.json` — plain-language description of what counts as "for you"
  vs "business-relevant". Edit this any time; it feeds straight into the
  scoring prompt, no code changes needed.
- `scripts/build-feed.mjs` — fetches every source, dedupes stories reported
  by multiple outlets, scores each with Claude, writes `data/feed.json`.
- `.github/workflows/update-feed.yml` — runs that script on a schedule and
  commits the refreshed feed, so it's already updated before you open the
  app.
- `index.html` / `styles.css` / `app.js` — the reader itself. Two tabs,
  "For you" and "Business", sorted by relevance score.
- `service-worker.js` — caches the app and the last-fetched feed so it's
  fully readable with no signal.

## One-time setup

1. **Create the repo.** Push this folder to a new GitHub repo (or reuse
   your GCSE trainer repo's pattern — same GitHub Pages + Actions setup).

2. **Add your Anthropic API key as a secret.** Repo Settings → Secrets and
   variables → Actions → New repository secret → name it
   `ANTHROPIC_API_KEY`.

3. **Enable GitHub Pages.** Settings → Pages → Deploy from branch → `main`
   → `/ (root)`.

4. **Check your sources.** Locally: `npm install` then
   `npm run check-sources` — some RSS endpoints move or get retired, so
   expect to prune or swap a couple. FT's free RSS in particular sometimes
   throttles; drop it if it's consistently failing.

5. **Generate the first feed** so the site isn't empty on first load:
   `ANTHROPIC_API_KEY=sk-... npm run build-feed`, then commit
   `data/feed.json`.

6. **Adjust the schedule.** `.github/workflows/update-feed.yml` runs at
   05:30 and 16:00 UTC on weekdays — set these to ~30–60 minutes before
   your actual commute times, in UTC.

## Using it day to day

Open the site once while on wifi (e.g. at your desk before you leave) so
the service worker caches the latest feed — after that it reads fully
offline. "Add to Home Screen" from your phone's browser makes it launch
like an app.

## Natural next steps, once the MVP feels right

- A "why this matters" one-line note on high-scoring business stories
  (cheap to add: ask Claude for it in the same scoring call).
- Source-diversity nudges so one prolific outlet doesn't dominate "For you".
- A muted/starred list so the ranking learns from what you actually open.
- Push notification for a single 90+ business score story, rather than
  waiting for the next scheduled refresh.

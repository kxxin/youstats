# YouStats

Personal YouTube analytics: watch time, subscriptions, channel growth and live-stream alerts, built on your own data.

> Status: **Stage 4 — live-stream alerts**. See the [roadmap](#roadmap).

## Features (planned)

| Stage | Feature                                               | Data source                                                 |
| ----- | ----------------------------------------------------- | ----------------------------------------------------------- |
| 1     | Watch-time and most-viewed-channel insights           | Google Takeout `watch-history.json` (parsed in the browser) |
| 2     | Subscriptions with subscribed-since dates             | YouTube Data API `subscriptions.list` (Google sign-in)      |
| 3     | Channel tracker: subscriber growth and archive search | Daily `channels.list` snapshots, uploads playlist           |
| 4     | Live-stream alerts (web push, Discord)                | YouTube WebSub push feed + `videos.list`                    |
| 5     | Live transcript (stretch goal)                        | In-browser Whisper on tab audio                             |

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres + auth) from Stage 2
- Hosted on [Vercel](https://vercel.com); scheduled jobs on GitHub Actions
- Vitest, ESLint and Prettier; CI runs on every push and pull request

## Getting started

Requires Node.js 22 or later.

```bash
npm install
cp .env.example .env.local   # fill in values as each stage needs them
npm run dev                  # http://localhost:3000
```

| Script              | What it does         |
| ------------------- | -------------------- |
| `npm run dev`       | Start the dev server |
| `npm run build`     | Production build     |
| `npm run lint`      | ESLint               |
| `npm run typecheck` | TypeScript, no emit  |
| `npm test`          | Unit tests (Vitest)  |
| `npm run format`    | Format with Prettier |

Regenerate the demo data with `node scripts/make-sample.mjs`.

## Roadmap

- [x] Stage 0 — Foundation: repo, CI, landing page, Vercel deploy
- [x] Stage 1 — Takeout analytics (`/insights`)
- [x] Stage 2 — Google sign-in, subscriptions (`/subscriptions`), Drive import, live/archive split
- [x] Stage 3 — Channel tracker + archive search (`/channels`, daily GitHub Action)
- [x] Stage 4 — Live-stream alerts (`/live`, web push + Discord)
- [ ] Stage 5 — Live transcript (stretch goal)

## Stage 2 setup

See [`docs/setup-stage2.md`](docs/setup-stage2.md) for the Google Cloud, Supabase and Vercel steps, [`docs/setup-stage3.md`](docs/setup-stage3.md) for the daily job, and [`docs/setup-stage4.md`](docs/setup-stage4.md) for alerts.

## Limitations

- The YouTube Data API does not expose watch history, so watch time is **estimated** from Takeout timestamps and video lengths.
- Subscriber growth history starts on the day a channel is added to the tracker.
- Channel membership periods are not available to viewers through the API.

## Privacy

Takeout files are parsed in your browser and never uploaded. Takeout exports are git-ignored.

## Disclaimer

Not affiliated with or endorsed by YouTube or Google.

# Stage 4 setup — live-stream alerts

About 10 minutes.

## 1. Database

Supabase → **SQL Editor** → paste the contents of `supabase/migrations/0004_stage4.sql` → **Run**.

## 2. Keys

In the `youstats` folder:

```powershell
npx web-push generate-vapid-keys
```

Make one more random string for `WEBSUB_SECRET` (same PowerShell one-liner as `CRON_SECRET` in Stage 3).

## 3. Vercel environment variables

| Name                           | Type   | Value                                       |
| ------------------------------ | ------ | ------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`         | Config | `https://youstats-xi.vercel.app`            |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Config | the **Public Key** from step 2              |
| `VAPID_PRIVATE_KEY`            | Secret | the **Private Key** from step 2             |
| `VAPID_SUBJECT`                | Secret | `mailto:` + your email                      |
| `WEBSUB_SECRET`                | Secret | random string                               |
| `ALERT_TIMEZONE`               | Config | `Asia/Kuala_Lumpur` (optional; the default) |

Then redeploy.

## 4. Turn it on

1. Commit and push. The new GitHub Action **Live stream check** runs every 5 minutes using the same `CRON_SECRET` and `YOUSTATS_URL` as Stage 3.
2. Open `/live`:
   - **Send alerts to** → **Turn on for this device** (allow notifications), and/or paste a Discord webhook URL → **Save**.
   - **Send test alert** — you should get it within seconds.
   - **Alert me when…** → switch on **Live** / **Scheduled** / **Uploads** per channel. The status changes from "Connecting to YouTube…" to "Listening for updates" once YouTube confirms (usually under a minute; refresh the page).

## How it works

- YouTube pushes new and scheduled videos to `/api/websub` (WebSub). That sends **Scheduled** and **Uploads** alerts, and **Live** alerts for streams started without a schedule.
- YouTube doesn't push the moment a scheduled stream starts, so `/api/cron/live` re-checks due streams every 5 minutes. GitHub can delay scheduled runs by several minutes. For faster alerts, point a free external cron (e.g. cron-job.org, every 1–2 min) at `POST /api/cron/live` with the header `Authorization: Bearer <CRON_SECRET>`.
- The daily job renews the YouTube subscriptions (they expire after about 10 days) and re-reads each channel's RSS feed as a safety net.

## Notes

- iPhone: web push only works after **Share → Add to Home Screen** and opening the site from there.
- Each alert kind is sent at most once per video.

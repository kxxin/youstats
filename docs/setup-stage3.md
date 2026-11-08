# Stage 3 setup

About 5 minutes.

## 1. Database

Supabase → **SQL Editor** → paste and run `supabase/migrations/0003_stage3.sql`.

## 2. Cron secret

Make a long random string, e.g. in PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

- Vercel → **Settings → Environment Variables**: add `CRON_SECRET` (Secret) with that value, then redeploy.
- GitHub → repo → **Settings → Secrets and variables → Actions**
  - **Secrets** tab → `CRON_SECRET` = the same value
  - **Variables** tab → `YOUSTATS_URL` = `https://youstats-xi.vercel.app` (no trailing slash)

## 3. Try it

1. Open `/channels`, paste a channel link or `@handle` → **Track channel**. The newest ~300 uploads are indexed straight away.
2. GitHub → **Actions → Daily channel sync → Run workflow** to test the job. It should finish green and print a JSON summary.
3. After that it runs every day at 00:41 Malaysia time: one stats snapshot per channel, new uploads, and up to 2,000 more archive videos per channel until the whole archive is indexed.

## Quota

Each channel costs about 1 unit for the snapshot plus 2 units per 50 videos indexed. The free limit is 10,000 units a day, so a big backfill (e.g. 10,000 videos ≈ 400 units) is fine.

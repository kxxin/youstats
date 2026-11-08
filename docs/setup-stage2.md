# Stage 2 setup

About 20 minutes. You need: your Vercel URL (e.g. `https://youstats-xxxx.vercel.app`).

## 1. Scheduled Takeout to Google Drive

1. Open <https://takeout.google.com> → **Deselect all**.
2. Tick **YouTube and YouTube Music**.
3. **All YouTube data included** → keep only **history**.
4. **Multiple formats** → set **history** to **JSON**.
5. **Next step** → Destination **Add to Drive**, Frequency **Export every 2 months for 1 year**, type `.zip`.
6. **Create export**. The first export arrives in your Drive's `Takeout` folder within hours.

## 2. Supabase project

1. <https://supabase.com> → **New project** (region: Southeast Asia (Singapore)).
2. **SQL Editor** → paste and run `supabase/migrations/0001_stage2.sql`.
3. **Project Settings → API Keys**: copy the **URL**, the **publishable** key and a **secret** key.
4. **Authentication → URL Configuration**
   - Site URL: your Vercel URL
   - Redirect URLs: `https://<your-vercel-url>/auth/callback` and `http://localhost:3000/auth/callback`

## 3. Google Cloud project

1. <https://console.cloud.google.com> → new project **YouStats**.
2. **APIs & Services → Library** → enable **YouTube Data API v3** and **Google Drive API**.
3. **Google Auth Platform** (OAuth consent screen)
   - Branding: app name YouStats, your email.
   - Audience: **External**, add your Gmail as a **test user**.
   - Data access: add scopes `.../auth/youtube.readonly` and `.../auth/drive.readonly`.
4. **Clients → Create client → Web application**
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (shown in Supabase → Authentication → Providers → Google).
   - Copy the **Client ID** and **Client secret**.
5. **Credentials → Create credentials → API key** → restrict it to **YouTube Data API v3**.

> **Testing mode note:** Google expires refresh tokens for apps in Testing after 7 days, so you will need to sign in again weekly. To avoid that, set the app's publishing status to **In production** (no verification needed for your own use; you will see an "unverified app" screen once — click Advanced → Continue).

## 4. Connect Google to Supabase

Supabase → **Authentication → Sign In / Providers → Google** → enable, paste the Client ID and secret, save.

## 5. Vercel environment variables

Vercel → project → **Settings → Environment Variables** (Production and Preview):

| Name                                   | Value               |
| -------------------------------------- | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase URL        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key     |
| `SUPABASE_SECRET_KEY`                  | secret key          |
| `GOOGLE_CLIENT_ID`                     | OAuth client ID     |
| `GOOGLE_CLIENT_SECRET`                 | OAuth client secret |
| `YOUTUBE_API_KEY`                      | API key             |
| `ALLOWED_EMAILS`                       | your Gmail address  |

Then **Deployments → Redeploy** (public `NEXT_PUBLIC_*` values are baked in at build time).

## 6. Check it

1. Open the site → **Sign in with Google** → approve both permissions.
2. `/subscriptions` lists your channels with dates.
3. `/insights` → **Import latest Takeout from Google Drive**, then the Videos / Live / Archive split appears.

For local development, copy `.env.example` to `.env.local` with the same values.

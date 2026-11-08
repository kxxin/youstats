import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

export class NeedsReauthError extends Error {
  constructor() {
    super("Google access expired. Sign in again.");
  }
}

/** Store the Google refresh token captured at sign-in. */
export async function saveRefreshToken(userId: string, refreshToken: string) {
  const { error } = await createAdminClient().from("google_tokens").upsert({
    user_id: userId,
    refresh_token: refreshToken,
    access_token: null,
    expires_at: null,
  });
  if (error) throw error;
}

/** A valid Google access token for the user, refreshed when needed. */
export async function getGoogleAccessToken(
  userId: string,
): Promise<{ token: string; expiresAt: string }> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("google_tokens")
    .select("refresh_token, access_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NeedsReauthError();

  if (
    data.access_token &&
    data.expires_at &&
    Date.parse(data.expires_at) - Date.now() > 60_000
  ) {
    return { token: data.access_token, expiresAt: data.expires_at };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new NeedsReauthError();
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
  await db
    .from("google_tokens")
    .update({ access_token: json.access_token, expires_at: expiresAt })
    .eq("user_id", userId);
  return { token: json.access_token, expiresAt };
}

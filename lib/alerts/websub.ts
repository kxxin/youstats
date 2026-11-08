import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { topicFor } from "./feed";

const HUB = "https://pubsubhubbub.appspot.com/subscribe";
const LEASE_SECONDS = 10 * 24 * 3600;

/** Per-channel HMAC secret derived from WEBSUB_SECRET. */
export const secretFor = (channelId: string) =>
  createHmac("sha256", env("WEBSUB_SECRET")).update(channelId).digest("hex");

export function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);
  if (!url)
    throw new Error("Set NEXT_PUBLIC_SITE_URL to your site's https URL.");
  return url.replace(/\/$/, "");
}

/** Check the hub's X-Hub-Signature (sha1= or sha256=) over the raw body. */
export function verifySignature(
  channelId: string,
  body: string,
  header: string | null,
) {
  if (!header) return false;
  const [algo, sig] = header.split("=");
  if (!sig || (algo !== "sha1" && algo !== "sha256")) return false;
  const expected = createHmac(algo, secretFor(channelId))
    .update(body)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Ask the hub to (un)subscribe; the hub then calls GET /api/websub to verify. */
export async function requestSubscription(
  db: SupabaseClient,
  channelId: string,
  mode: "subscribe" | "unsubscribe",
) {
  const callback = `${siteUrl()}/api/websub?channel=${channelId}`;
  const body = new URLSearchParams({
    "hub.callback": callback,
    "hub.topic": topicFor(channelId),
    "hub.mode": mode,
    "hub.verify": "async",
    "hub.lease_seconds": String(LEASE_SECONDS),
    ...(mode === "subscribe" ? { "hub.secret": secretFor(channelId) } : {}),
  });
  const res = await fetch(HUB, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (res.status !== 202 && res.status !== 204) {
    throw new Error(
      `WebSub ${mode} failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const { error } = await db.from("websub_subscriptions").upsert({
    channel_id: channelId,
    status: mode === "subscribe" ? "pending" : "unsubscribed",
    requested_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Channels any user wants alerts for. */
export async function alertChannelIds(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db
    .from("tracked_channels")
    .select("channel_id")
    .or("alert_live.eq.true,alert_scheduled.eq.true,alert_uploads.eq.true");
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.channel_id as string))];
}

/** Subscribe/renew where needed and unsubscribe channels nobody wants. */
export async function reconcileSubscriptions(db: SupabaseClient) {
  const wanted = new Set(await alertChannelIds(db));
  const { data, error } = await db
    .from("websub_subscriptions")
    .select("channel_id, status, lease_expires_at, requested_at");
  if (error) throw error;
  const existing = new Map(
    (data ?? []).map((r) => [r.channel_id as string, r]),
  );
  const soon = Date.now() + 2 * 24 * 3600 * 1000;
  const done: Record<string, string> = {};

  for (const id of wanted) {
    const s = existing.get(id);
    const expires = s?.lease_expires_at ? Date.parse(s.lease_expires_at) : 0;
    const recentlyRequested =
      s?.requested_at && Date.now() - Date.parse(s.requested_at) < 3600 * 1000;
    if (
      !s ||
      s.status === "unsubscribed" ||
      (expires < soon && !recentlyRequested)
    ) {
      await requestSubscription(db, id, "subscribe");
      done[id] = "subscribe";
    }
  }
  for (const [id, s] of existing) {
    if (!wanted.has(id) && s.status !== "unsubscribed") {
      await requestSubscription(db, id, "unsubscribe");
      done[id] = "unsubscribe";
    }
  }
  return done;
}

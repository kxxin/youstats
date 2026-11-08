import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails } from "web-push";
import type { AlertMessage } from "./decide";

let vapidReady: boolean | null = null;
function setupVapid() {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  vapidReady = !!(pub && priv);
  if (vapidReady) setVapidDetails(subject, pub!, priv!);
  return vapidReady;
}

export async function sendDiscord(webhookUrl: string, msg: AlertMessage) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "YouStats",
      embeds: [
        {
          title: msg.title,
          description: `[${msg.body}](${msg.url})`,
          url: msg.url,
          color: 0x0d9488,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Discord webhook failed (${res.status})`);
}

/** Send to every push subscription of the user; removes dead subscriptions. */
export async function sendPush(
  db: SupabaseClient,
  userId: string,
  msg: AlertMessage,
) {
  if (!setupVapid()) return { sent: 0, skipped: "VAPID keys not configured" };
  const { data, error } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  let sent = 0;
  for (const s of data ?? []) {
    try {
      await sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg),
        { TTL: 3600, urgency: "high" },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("[push] failed", code, e);
      }
    }
  }
  return { sent };
}

/** Deliver one alert to a user over every channel they configured. */
export async function deliver(
  db: SupabaseClient,
  userId: string,
  msg: AlertMessage,
) {
  const results: string[] = [];
  const { data } = await db
    .from("alert_settings")
    .select("discord_webhook_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.discord_webhook_url) {
    try {
      await sendDiscord(data.discord_webhook_url, msg);
      results.push("discord");
    } catch (e) {
      results.push(
        `discord error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  const push = await sendPush(db, userId, msg);
  if (push.sent) results.push(`push x${push.sent}`);
  return results;
}

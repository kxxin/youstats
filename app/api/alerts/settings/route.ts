import { NextResponse, type NextRequest } from "next/server";
import { handleError, jsonError, requireUser } from "@/lib/api";
import type { AlertSettings } from "@/lib/alerts/types";
import { createAdminClient } from "@/lib/supabase/server";

const DISCORD =
  /^https:\/\/(?:canary\.|ptb\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const mask = (url: string) => url.replace(/\/[\w-]+$/, "/••••••");

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const db = createAdminClient();
    const [s, p] = await Promise.all([
      db
        .from("alert_settings")
        .select("discord_webhook_url")
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      db
        .from("push_subscriptions")
        .select("endpoint", { count: "exact", head: true })
        .eq("user_id", auth.user.id),
    ]);
    if (s.error) throw s.error;
    const body: AlertSettings = {
      discordWebhook: s.data?.discord_webhook_url
        ? mask(s.data.discord_webhook_url)
        : null,
      pushDevices: p.count ?? 0,
      pushConfigured:
        !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        !!process.env.VAPID_PRIVATE_KEY,
    };
    return NextResponse.json(body, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Save or clear the Discord webhook: { discordWebhookUrl: string | null } */
export async function PUT(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    discordWebhookUrl?: unknown;
  };
  const url =
    typeof body.discordWebhookUrl === "string"
      ? body.discordWebhookUrl.trim()
      : null;
  if (url && !DISCORD.test(url)) {
    return jsonError(400, "That doesn't look like a Discord webhook URL.");
  }
  try {
    const { error } = await createAdminClient()
      .from("alert_settings")
      .upsert({
        user_id: auth.user.id,
        discord_webhook_url: url || null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { seedFromRss } from "@/lib/alerts/process";
import type { AlertChannel } from "@/lib/alerts/types";
import { requestSubscription } from "@/lib/alerts/websub";
import { handleError, jsonError, requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

interface Row {
  channel_id: string;
  alert_live: boolean;
  alert_scheduled: boolean;
  alert_uploads: boolean;
  channels: { title: string; thumbnail: string | null } | null;
}

/** Tracked channels with their alert switches and WebSub status. */
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("tracked_channels")
      .select(
        "channel_id, alert_live, alert_scheduled, alert_uploads, channels(title, thumbnail)",
      )
      .eq("user_id", auth.user.id)
      .order("added_at");
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    const { data: subs } = await db
      .from("websub_subscriptions")
      .select("channel_id, status")
      .in(
        "channel_id",
        rows.map((r) => r.channel_id),
      );
    const status = new Map(
      (subs ?? []).map((s) => [s.channel_id as string, s.status as string]),
    );
    const channels: AlertChannel[] = rows.map((r) => ({
      channelId: r.channel_id,
      title: r.channels?.title ?? r.channel_id,
      thumbnail: r.channels?.thumbnail ?? null,
      live: r.alert_live,
      scheduled: r.alert_scheduled,
      uploads: r.alert_uploads,
      websub: status.get(r.channel_id) ?? null,
    }));
    return NextResponse.json(
      { channels },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

/** Change alert switches: { channelId, live?, scheduled?, uploads? } */
export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.channelId !== "string")
    return jsonError(400, "Missing channelId.");
  const patch: Record<string, boolean> = {};
  if (typeof b.live === "boolean") patch.alert_live = b.live;
  if (typeof b.scheduled === "boolean") patch.alert_scheduled = b.scheduled;
  if (typeof b.uploads === "boolean") patch.alert_uploads = b.uploads;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("tracked_channels")
      .update(patch)
      .eq("user_id", auth.user.id)
      .eq("channel_id", b.channelId)
      .select("alert_live, alert_scheduled, alert_uploads")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError(404, "Not tracked.");

    const anyOn = data.alert_live || data.alert_scheduled || data.alert_uploads;
    let note: string | null = null;
    if (anyOn) {
      const { data: sub } = await db
        .from("websub_subscriptions")
        .select("status")
        .eq("channel_id", b.channelId)
        .maybeSingle();
      if (!sub || sub.status === "unsubscribed") {
        await requestSubscription(db, b.channelId, "subscribe");
        // Catch streams that were already scheduled before alerts were on.
        await seedFromRss(db, b.channelId).catch((e) => {
          note = `Couldn't check recent videos: ${e instanceof Error ? e.message : String(e)}`;
        });
      }
    }
    // Unsubscribing from the hub happens in the daily job once nobody needs the channel.
    return NextResponse.json({ ok: true, note });
  } catch (e) {
    return handleError(e);
  }
}

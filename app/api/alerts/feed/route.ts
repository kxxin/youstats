import { NextResponse } from "next/server";
import type { LiveEvent } from "@/lib/alerts/types";
import { handleError, requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

/** Live now, upcoming and recent events for the user's tracked channels. */
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const db = createAdminClient();
    const { data: tracked, error } = await db
      .from("tracked_channels")
      .select("channel_id")
      .eq("user_id", auth.user.id);
    if (error) throw error;
    const ids = (tracked ?? []).map((r) => r.channel_id as string);
    if (!ids.length)
      return NextResponse.json({ live: [], upcoming: [], recent: [] });

    const cols =
      "video_id, channel_id, title, status, scheduled_start, actual_start, actual_end, first_seen_at, channels(title, thumbnail)";
    const [live, upcoming, recent] = await Promise.all([
      db
        .from("live_events")
        .select(cols)
        .in("channel_id", ids)
        .eq("status", "live")
        .order("actual_start", { ascending: false }),
      db
        .from("live_events")
        .select(cols)
        .in("channel_id", ids)
        .eq("status", "upcoming")
        .gte(
          "scheduled_start",
          new Date(Date.now() - 6 * 3600_000).toISOString(),
        )
        .order("scheduled_start")
        .limit(30),
      db
        .from("live_events")
        .select(cols)
        .in("channel_id", ids)
        .in("status", ["ended", "video"])
        .order("first_seen_at", { ascending: false })
        .limit(20),
    ]);
    for (const r of [live, upcoming, recent]) if (r.error) throw r.error;
    return NextResponse.json(
      {
        live: live.data as unknown as LiveEvent[],
        upcoming: upcoming.data as unknown as LiveEvent[],
        recent: recent.data as unknown as LiveEvent[],
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

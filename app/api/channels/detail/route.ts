import { NextResponse, type NextRequest } from "next/server";
import { handleError, jsonError, requireUser } from "@/lib/api";
import { userTracks } from "@/lib/channels/access";
import type { ChannelDetail, Snapshot } from "@/lib/channels/types";
import { createAdminClient } from "@/lib/supabase/server";

/** One tracked channel: info, full snapshot history, archive index status. */
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError(400, "Missing id.");
  try {
    const db = createAdminClient();
    if (!(await userTracks(db, auth.user.id, id)))
      return jsonError(404, "Not tracked.");

    const [ch, snaps, all, streams] = await Promise.all([
      db.from("channels").select("*").eq("channel_id", id).single(),
      db
        .from("channel_snapshots")
        .select("taken_on, subscribers, hidden_subscribers, views, videos")
        .eq("channel_id", id)
        .order("taken_on"),
      db
        .from("channel_videos")
        .select("video_id", { count: "exact", head: true })
        .eq("channel_id", id),
      db
        .from("channel_videos")
        .select("video_id", { count: "exact", head: true })
        .eq("channel_id", id)
        .eq("was_live", true),
    ]);
    for (const r of [ch, snaps, all, streams]) if (r.error) throw r.error;

    const c = ch.data as {
      title: string;
      handle: string | null;
      thumbnail: string | null;
      published_at: string | null;
      backfill_done: boolean;
      last_synced_at: string | null;
    };
    const detail: ChannelDetail = {
      channelId: id,
      title: c.title,
      handle: c.handle,
      thumbnail: c.thumbnail,
      publishedAt: c.published_at,
      snapshots: (snaps.data ?? []) as Snapshot[],
      indexed: {
        videos: all.count ?? 0,
        streams: streams.count ?? 0,
        complete: c.backfill_done,
        lastSyncedAt: c.last_synced_at,
      },
    };
    return NextResponse.json(detail, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return handleError(e);
  }
}

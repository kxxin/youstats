import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { ytGet } from "@/lib/youtube/api";
import {
  alertsToSend,
  buildMessage,
  statusFromApi,
  type AlertKind,
  type LiveStatus,
} from "./decide";
import { deliver } from "./deliver";

interface VideoItem {
  id: string;
  snippet?: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    liveBroadcastContent?: string;
  };
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
  };
}

interface EventRow {
  video_id: string;
  channel_id: string;
  title: string;
  status: LiveStatus;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  notified_scheduled_at: string | null;
  notified_live_at: string | null;
  notified_upload_at: string | null;
}

const FLAG: Record<AlertKind, string> = {
  live: "alert_live",
  scheduled: "alert_scheduled",
  upload: "alert_uploads",
};
const NOTIFIED: Record<AlertKind, keyof EventRow> = {
  live: "notified_live_at",
  scheduled: "notified_scheduled_at",
  upload: "notified_upload_at",
};

/**
 * Refresh the given videos from the API, store their live state, and send
 * any alerts that are due. Safe to call repeatedly: each alert kind is sent
 * at most once per video.
 */
export async function processVideos(
  db: SupabaseClient,
  videoIds: readonly string[],
) {
  const ids = [...new Set(videoIds)];
  const log: { videoId: string; status: LiveStatus; alerts: string[] }[] = [];
  if (!ids.length) return log;

  const items = new Map<string, VideoItem>();
  for (let i = 0; i < ids.length; i += 50) {
    const res = await ytGet<{ items: VideoItem[] }>(
      "videos",
      {
        part: "snippet,liveStreamingDetails",
        id: ids.slice(i, i + 50).join(","),
      },
      { apiKey: env("YOUTUBE_API_KEY") },
    );
    for (const it of res.items) items.set(it.id, it);
  }

  const { data: prevRows, error } = await db
    .from("live_events")
    .select("*")
    .in("video_id", ids);
  if (error) throw error;
  const prev = new Map(
    ((prevRows ?? []) as EventRow[]).map((r) => [r.video_id, r]),
  );

  for (const id of ids) {
    const item = items.get(id) ?? null;
    const old = prev.get(id);
    const channelId = item?.snippet?.channelId ?? old?.channel_id;
    if (!channelId) continue;

    const { data: ch } = await db
      .from("channels")
      .select("title")
      .eq("channel_id", channelId)
      .maybeSingle();
    if (!ch) continue; // not a channel we track

    const status = statusFromApi(item);
    const live = item?.liveStreamingDetails;
    const row: EventRow = {
      video_id: id,
      channel_id: channelId,
      title: item?.snippet?.title ?? old?.title ?? "",
      status,
      scheduled_start: live?.scheduledStartTime ?? old?.scheduled_start ?? null,
      actual_start: live?.actualStartTime ?? old?.actual_start ?? null,
      actual_end: live?.actualEndTime ?? old?.actual_end ?? null,
      notified_scheduled_at: old?.notified_scheduled_at ?? null,
      notified_live_at: old?.notified_live_at ?? null,
      notified_upload_at: old?.notified_upload_at ?? null,
    };

    // 1) Save the video's state. The notified_* columns are left out so a
    //    concurrent run can never reset them.
    const { error: e3 } = await db.from("live_events").upsert({
      video_id: row.video_id,
      channel_id: row.channel_id,
      title: row.title,
      status: row.status,
      scheduled_start: row.scheduled_start,
      actual_start: row.actual_start,
      actual_end: row.actual_end,
      updated_at: new Date().toISOString(),
    });
    if (e3) throw e3;

    const kinds = alertsToSend({
      ...row,
      published_at: item?.snippet?.publishedAt ?? null,
    });
    const sent: string[] = [];
    for (const kind of kinds) {
      // 2) Claim the alert atomically: only the run that flips the column
      //    from null sends it. WebSub pushes, the 5-minute check and RSS
      //    seeding can overlap, so this is what prevents duplicates.
      const { data: claimed, error: e4 } = await db
        .from("live_events")
        .update({ [NOTIFIED[kind]]: new Date().toISOString() })
        .eq("video_id", id)
        .is(NOTIFIED[kind], null)
        .select("video_id");
      if (e4) throw e4;
      if (!claimed?.length) continue;

      const { data: users, error: e2 } = await db
        .from("tracked_channels")
        .select("user_id")
        .eq("channel_id", channelId)
        .eq(FLAG[kind], true);
      if (e2) throw e2;
      const msg = buildMessage(
        kind,
        { videoId: id, title: row.title, scheduledStart: row.scheduled_start },
        (ch.title as string) ?? item?.snippet?.channelTitle ?? "A channel",
        process.env.ALERT_TIMEZONE ?? "Asia/Kuala_Lumpur",
      );
      for (const u of users ?? []) {
        const r = await deliver(db, u.user_id as string, msg);
        sent.push(`${kind} → ${r.join(", ") || "no delivery configured"}`);
      }
    }

    log.push({ videoId: id, status, alerts: sent });
  }
  return log;
}

/** Videos to re-check: streams due to start soon or still live. */
export async function videosToPoll(db: SupabaseClient) {
  const now = Date.now();
  const from = new Date(now - 6 * 3600_000).toISOString();
  const to = new Date(now + 10 * 60_000).toISOString();
  const [upcoming, live] = await Promise.all([
    db
      .from("live_events")
      .select("video_id")
      .eq("status", "upcoming")
      .gte("scheduled_start", from)
      .lte("scheduled_start", to),
    db.from("live_events").select("video_id").eq("status", "live"),
  ]);
  if (upcoming.error) throw upcoming.error;
  if (live.error) throw live.error;
  return [...(upcoming.data ?? []), ...(live.data ?? [])].map(
    (r) => r.video_id as string,
  );
}

/**
 * Read a channel's public RSS feed (latest ~15 uploads, no API quota) and
 * process those videos. Used when alerts are switched on and as a daily
 * safety net in case a WebSub push was missed.
 */
export async function seedFromRss(db: SupabaseClient, channelId: string) {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`RSS fetch failed (${res.status})`);
  const { parseFeed } = await import("./feed");
  const ids = parseFeed(await res.text()).map((e) => e.videoId);
  return processVideos(db, ids);
}

import { NextResponse, type NextRequest } from "next/server";
import { handleError, jsonError, requireUser } from "@/lib/api";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { ytGet } from "@/lib/youtube/api";
import { parseIsoDuration } from "@/lib/youtube/classify";
import type { VideoMeta } from "@/lib/youtube/types";

const MAX_IDS = 1000;
const ID_RE = /^[\w-]{11}$/;
const LIVE_REFRESH_MS = 60 * 60_000;

interface Row {
  video_id: string;
  title: string | null;
  channel_id: string | null;
  duration_sec: number | null;
  live_start: string | null;
  live_end: string | null;
  was_live: boolean;
  missing: boolean;
  fetched_at: string;
}

interface VideosResponse {
  items: {
    id: string;
    snippet?: {
      title: string;
      channelId: string;
      liveBroadcastContent?: string;
    };
    contentDetails?: { duration?: string };
    liveStreamingDetails?: {
      actualStartTime?: string;
      actualEndTime?: string;
      scheduledStartTime?: string;
    };
  }[];
}

const toMeta = (r: Row): VideoMeta => ({
  videoId: r.video_id,
  title: r.title,
  channelId: r.channel_id,
  durationSec: r.duration_sec,
  liveStart: r.live_start,
  liveEnd: r.live_end,
  wasLive: r.was_live,
  missing: r.missing,
});

/** Metadata for up to 1000 video ids, served from the Postgres cache when possible. */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  let ids: string[];
  try {
    const body = (await request.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids)
      ? [
          ...new Set(
            body.ids.filter(
              (x): x is string => typeof x === "string" && ID_RE.test(x),
            ),
          ),
        ]
      : [];
  } catch {
    return jsonError(400, "Body must be JSON: { ids: string[] }");
  }
  if (ids.length > MAX_IDS)
    return jsonError(400, `At most ${MAX_IDS} ids per request.`);

  try {
    const db = createAdminClient();
    const cached = new Map<string, Row>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db
        .from("video_meta")
        .select("*")
        .in("video_id", ids.slice(i, i + 200));
      if (error) throw error;
      for (const r of (data ?? []) as Row[]) cached.set(r.video_id, r);
    }

    const stale = (r: Row) =>
      r.was_live &&
      !r.live_end &&
      Date.now() - Date.parse(r.fetched_at) > LIVE_REFRESH_MS;
    const toFetch = ids.filter(
      (id) => !cached.has(id) || stale(cached.get(id)!),
    );

    const apiKey = env("YOUTUBE_API_KEY");
    const batches: string[][] = [];
    for (let i = 0; i < toFetch.length; i += 50)
      batches.push(toFetch.slice(i, i + 50));

    const fresh: Row[] = [];
    for (let i = 0; i < batches.length; i += 5) {
      const results = await Promise.all(
        batches.slice(i, i + 5).map((b) =>
          ytGet<VideosResponse>(
            "videos",
            {
              part: "snippet,contentDetails,liveStreamingDetails",
              id: b.join(","),
              maxResults: "50",
            },
            { apiKey },
          ).then((res) => ({ b, res })),
        ),
      );
      const now = new Date().toISOString();
      for (const { b, res } of results) {
        const found = new Map(res.items.map((it) => [it.id, it]));
        for (const id of b) {
          const it = found.get(id);
          const live = it?.liveStreamingDetails;
          fresh.push({
            video_id: id,
            title: it?.snippet?.title ?? null,
            channel_id: it?.snippet?.channelId ?? null,
            duration_sec: parseIsoDuration(it?.contentDetails?.duration),
            live_start:
              live?.actualStartTime ?? live?.scheduledStartTime ?? null,
            live_end: live?.actualEndTime ?? null,
            was_live: !!live,
            missing: !it,
            fetched_at: now,
          });
        }
      }
    }
    if (fresh.length) {
      const { error } = await db.from("video_meta").upsert(fresh);
      if (error) throw error;
      for (const r of fresh) cached.set(r.video_id, r);
    }

    const videos = ids
      .map((id) => cached.get(id))
      .filter((r): r is Row => !!r)
      .map(toMeta);
    return NextResponse.json({ videos, fetched: toFetch.length });
  } catch (e) {
    return handleError(e);
  }
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { ytGet } from "@/lib/youtube/api";
import { parseIsoDuration } from "@/lib/youtube/classify";
import type { ChannelRef } from "./parse-input";

interface ChannelItem {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    publishedAt: string;
    thumbnails?: { default?: { url: string }; medium?: { url: string } };
  };
  statistics: {
    subscriberCount?: string;
    hiddenSubscriberCount: boolean;
    viewCount?: string;
    videoCount?: string;
  };
  contentDetails: { relatedPlaylists: { uploads?: string } };
}

interface PlaylistPage {
  nextPageToken?: string;
  items: {
    snippet: { title: string; description: string; publishedAt: string };
    contentDetails: { videoId: string; videoPublishedAt?: string };
  }[];
}

interface VideosPage {
  items: {
    id: string;
    contentDetails?: { duration?: string };
    liveStreamingDetails?: object;
  }[];
}

const key = () => ({ apiKey: env("YOUTUBE_API_KEY") });
const today = () => new Date().toISOString().slice(0, 10);

/** Look up one channel from whatever the user pasted (1–2 quota units). */
export async function lookupChannel(
  ref: ChannelRef,
): Promise<ChannelItem | null> {
  let params: Record<string, string>;
  if (ref.kind === "video") {
    const v = await ytGet<{ items: { snippet: { channelId: string } }[] }>(
      "videos",
      { part: "snippet", id: ref.value },
      key(),
    );
    const channelId = v.items.at(0)?.snippet.channelId;
    if (!channelId) return null;
    params = { id: channelId };
  } else if (ref.kind === "id") params = { id: ref.value };
  else if (ref.kind === "handle") params = { forHandle: ref.value };
  else params = { forUsername: ref.value };

  const res = await ytGet<{ items?: ChannelItem[] }>(
    "channels",
    { part: "snippet,statistics,contentDetails", ...params },
    key(),
  );
  return res.items?.at(0) ?? null;
}

/** Fetch many channels by id, 50 per call. */
export async function fetchChannels(
  ids: readonly string[],
): Promise<ChannelItem[]> {
  const out: ChannelItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const res = await ytGet<{ items?: ChannelItem[] }>(
      "channels",
      {
        part: "snippet,statistics,contentDetails",
        id: ids.slice(i, i + 50).join(","),
        maxResults: "50",
      },
      key(),
    );
    out.push(...(res.items ?? []));
  }
  return out;
}

/** Upsert channel info and today's snapshot. */
export async function saveChannel(db: SupabaseClient, c: ChannelItem) {
  const { error: e1 } = await db.from("channels").upsert(
    {
      channel_id: c.id,
      title: c.snippet.title,
      handle: c.snippet.customUrl ?? null,
      thumbnail:
        c.snippet.thumbnails?.medium?.url ??
        c.snippet.thumbnails?.default?.url ??
        null,
      uploads_playlist_id: c.contentDetails.relatedPlaylists.uploads ?? null,
      published_at: c.snippet.publishedAt,
    },
    { onConflict: "channel_id", ignoreDuplicates: false },
  );
  if (e1) throw e1;
  const num = (s?: string) => (s === undefined ? null : Number(s));
  const { error: e2 } = await db.from("channel_snapshots").upsert({
    channel_id: c.id,
    taken_on: today(),
    subscribers: c.statistics.hiddenSubscriberCount
      ? null
      : num(c.statistics.subscriberCount),
    hidden_subscribers: c.statistics.hiddenSubscriberCount,
    views: num(c.statistics.viewCount),
    videos: num(c.statistics.videoCount),
  });
  if (e2) throw e2;
}

interface SyncState {
  channel_id: string;
  uploads_playlist_id: string | null;
  backfill_page_token: string | null;
  backfill_done: boolean;
  last_synced_at: string | null;
}

/** Fetch one page of uploads with lengths and live flags (2 quota units). */
async function fetchUploadsPage(playlistId: string, pageToken?: string) {
  const page = await ytGet<PlaylistPage>(
    "playlistItems",
    {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    },
    key(),
  );
  // Private and deleted entries have no videoPublishedAt.
  const items = page.items.filter((it) => it.contentDetails.videoPublishedAt);
  const details = new Map<string, VideosPage["items"][number]>();
  if (items.length) {
    const v = await ytGet<VideosPage>(
      "videos",
      {
        part: "contentDetails,liveStreamingDetails",
        id: items.map((it) => it.contentDetails.videoId).join(","),
        maxResults: "50",
      },
      key(),
    );
    for (const d of v.items) details.set(d.id, d);
  }
  return {
    next: page.nextPageToken ?? null,
    rows: items.map((it) => {
      const d = details.get(it.contentDetails.videoId);
      return {
        video_id: it.contentDetails.videoId,
        title: it.snippet.title,
        description: it.snippet.description ?? "",
        published_at:
          it.contentDetails.videoPublishedAt ?? it.snippet.publishedAt,
        duration_sec: parseIsoDuration(d?.contentDetails?.duration),
        was_live: !!d?.liveStreamingDetails,
      };
    }),
  };
}

/**
 * Index a channel's uploads. New uploads first (newest pages until a known
 * video), then continue the archive backfill. `maxPages` bounds the work per
 * run; the daily job picks up where it left off.
 */
export async function syncUploads(
  db: SupabaseClient,
  channelId: string,
  maxPages = 20,
) {
  const { data, error } = await db
    .from("channels")
    .select(
      "channel_id, uploads_playlist_id, backfill_page_token, backfill_done, last_synced_at",
    )
    .eq("channel_id", channelId)
    .single();
  if (error) throw error;
  const ch = data as SyncState;
  if (!ch.uploads_playlist_id) return { added: 0 };

  let pages = 0;
  let added = 0;
  const store = async (
    rows: Awaited<ReturnType<typeof fetchUploadsPage>>["rows"],
  ) => {
    if (!rows.length) return;
    const { error } = await db
      .from("channel_videos")
      .upsert(rows.map((r) => ({ ...r, channel_id: channelId })));
    if (error) throw error;
    added += rows.length;
  };

  let backfillToken = ch.backfill_page_token;
  let backfillDone = ch.backfill_done;

  if (!ch.last_synced_at) {
    // First run: start the archive from the newest upload.
    let token: string | undefined;
    do {
      const page = await fetchUploadsPage(ch.uploads_playlist_id, token);
      await store(page.rows);
      token = page.next ?? undefined;
      pages++;
    } while (token && pages < maxPages);
    backfillToken = token ?? null;
    backfillDone = !token;
  } else {
    // Catch up on new uploads until we reach one we already have.
    let token: string | undefined;
    for (let i = 0; i < 5; i++) {
      const page = await fetchUploadsPage(ch.uploads_playlist_id, token);
      pages++;
      const ids = page.rows.map((r) => r.video_id);
      const { data: known } = ids.length
        ? await db.from("channel_videos").select("video_id").in("video_id", ids)
        : { data: [] };
      await store(page.rows);
      if ((known?.length ?? 0) > 0 || !page.next) break;
      token = page.next;
    }
    // Continue the archive backfill.
    while (!backfillDone && backfillToken && pages < maxPages) {
      const page = await fetchUploadsPage(
        ch.uploads_playlist_id,
        backfillToken,
      );
      await store(page.rows);
      pages++;
      backfillToken = page.next;
      backfillDone = !page.next;
    }
    if (!backfillToken) backfillDone = true;
  }

  const { error: e2 } = await db
    .from("channels")
    .update({
      backfill_page_token: backfillToken,
      backfill_done: backfillDone,
      last_synced_at: new Date().toISOString(),
    })
    .eq("channel_id", channelId);
  if (e2) throw e2;
  return { added, pages, backfillDone };
}

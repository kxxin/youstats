export type Product = "youtube" | "music";

export interface WatchEvent {
  /** When the view started (Takeout records the start, not the end). */
  time: Date;
  videoId: string | null;
  title: string;
  channelName: string | null;
  channelId: string | null;
  channelUrl: string | null;
  videoUrl: string | null;
  product: Product;
}

export interface ParseResult {
  events: WatchEvent[];
  skipped: { ads: number; invalid: number; nonWatch: number };
}

interface RawSubtitle {
  name?: unknown;
  url?: unknown;
}

interface RawItem {
  header?: unknown;
  title?: unknown;
  titleUrl?: unknown;
  subtitles?: unknown;
  time?: unknown;
  details?: unknown;
}

const WATCH_PREFIX = /^Watched\s+/;

export function videoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

export function channelIdFromUrl(url: string): string | null {
  const m = /\/channel\/(UC[\w-]{22})/.exec(url);
  return m ? m[1] : null;
}

function isAd(item: RawItem): boolean {
  return (
    Array.isArray(item.details) &&
    item.details.some(
      (d: { name?: unknown }) =>
        typeof d?.name === "string" && d.name.includes("Google Ads"),
    )
  );
}

/**
 * Parse Google Takeout `watch-history.json` (YouTube and YouTube Music).
 * Ads, search entries and malformed rows are skipped and counted.
 */
export function parseWatchHistory(input: unknown): ParseResult {
  if (!Array.isArray(input)) {
    throw new TypeError(
      "Expected a JSON array. Export watch history as JSON, not HTML.",
    );
  }

  const events: WatchEvent[] = [];
  const skipped = { ads: 0, invalid: 0, nonWatch: 0 };

  for (const raw of input as RawItem[]) {
    if (!raw || typeof raw !== "object") {
      skipped.invalid++;
      continue;
    }
    if (isAd(raw)) {
      skipped.ads++;
      continue;
    }
    const time = typeof raw.time === "string" ? new Date(raw.time) : null;
    if (!time || Number.isNaN(time.getTime()) || typeof raw.title !== "string") {
      skipped.invalid++;
      continue;
    }
    const videoUrl = typeof raw.titleUrl === "string" ? raw.titleUrl : null;
    if (videoUrl && !videoUrl.includes("watch?v=") && !videoUrl.includes("youtu.be/")) {
      skipped.nonWatch++;
      continue;
    }

    const sub = Array.isArray(raw.subtitles)
      ? (raw.subtitles[0] as RawSubtitle | undefined)
      : undefined;
    const channelName = typeof sub?.name === "string" ? sub.name : null;
    const channelUrl = typeof sub?.url === "string" ? sub.url : null;

    events.push({
      time,
      videoId: videoUrl ? videoIdFromUrl(videoUrl) : null,
      title: raw.title.replace(WATCH_PREFIX, ""),
      channelName,
      channelId: channelUrl ? channelIdFromUrl(channelUrl) : null,
      channelUrl,
      videoUrl,
      product: raw.header === "YouTube Music" ? "music" : "youtube",
    });
  }

  events.sort((a, b) => a.time.getTime() - b.time.getTime());
  return { events, skipped };
}

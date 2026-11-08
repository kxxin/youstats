import type { WatchEvent } from "./parse";

export interface EstimateOptions {
  /** A gap longer than this ends a viewing session (seconds). */
  sessionGapSeconds: number;
  /** Time credited to the last view of a session (seconds). */
  sessionTailSeconds: number;
}

export const DEFAULT_ESTIMATE: EstimateOptions = {
  sessionGapSeconds: 30 * 60,
  sessionTailSeconds: 8 * 60,
};

/**
 * Estimate seconds watched per event. Takeout only records when a view
 * started, so each view is credited the gap until the next view, unless that
 * gap is longer than `sessionGapSeconds`, in which case it gets
 * `sessionTailSeconds`. Events must be sorted by time ascending.
 */
export function estimateDurations(
  events: readonly WatchEvent[],
  opts: EstimateOptions = DEFAULT_ESTIMATE,
): number[] {
  return events.map((e, i) => {
    const next = events.at(i + 1);
    if (!next) return opts.sessionTailSeconds;
    const gap = (next.time.getTime() - e.time.getTime()) / 1000;
    return gap > 0 && gap <= opts.sessionGapSeconds
      ? gap
      : opts.sessionTailSeconds;
  });
}

export interface Summary {
  views: number;
  uniqueVideos: number;
  uniqueChannels: number;
  activeDays: number;
  estimatedSeconds: number;
  first: Date | null;
  last: Date | null;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function summarize(
  events: readonly WatchEvent[],
  durations: readonly number[],
): Summary {
  const videos = new Set<string>();
  const channels = new Set<string>();
  const days = new Set<string>();
  let estimatedSeconds = 0;
  events.forEach((e, i) => {
    if (e.videoId) videos.add(e.videoId);
    const ch = e.channelId ?? e.channelName;
    if (ch) channels.add(ch);
    days.add(dayKey(e.time));
    estimatedSeconds += durations.at(i) ?? 0;
  });
  return {
    views: events.length,
    uniqueVideos: videos.size,
    uniqueChannels: channels.size,
    activeDays: days.size,
    estimatedSeconds,
    first: events.at(0)?.time ?? null,
    last: events.at(-1)?.time ?? null,
  };
}

export interface Bucket {
  key: string;
  start: Date;
  views: number;
  seconds: number;
}

/** Views per local day or month, with empty buckets filled in. */
export function viewsOverTime(
  events: readonly WatchEvent[],
  durations: readonly number[],
  unit: "day" | "month",
): Bucket[] {
  const first = events.at(0);
  const last = events.at(-1);
  if (!first || !last) return [];
  const keyOf = unit === "day" ? dayKey : monthKey;

  const counts = new Map<string, { views: number; seconds: number }>();
  events.forEach((e, i) => {
    const k = keyOf(e.time);
    const c = counts.get(k) ?? { views: 0, seconds: 0 };
    c.views++;
    c.seconds += durations.at(i) ?? 0;
    counts.set(k, c);
  });

  const out: Bucket[] = [];
  const cursor =
    unit === "day"
      ? new Date(first.time.getFullYear(), first.time.getMonth(), first.time.getDate())
      : new Date(first.time.getFullYear(), first.time.getMonth(), 1);
  const end = keyOf(last.time);
  for (;;) {
    const k = keyOf(cursor);
    const c = counts.get(k);
    out.push({ key: k, start: new Date(cursor), views: c?.views ?? 0, seconds: c?.seconds ?? 0 });
    if (k === end) break;
    if (unit === "day") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** 7 x 24 grid of view counts: rows Monday..Sunday, columns hour 0..23 (local time). */
export function weekHourGrid(events: readonly WatchEvent[]): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const e of events) {
    const row = (e.time.getDay() + 6) % 7;
    const r = grid.at(row);
    if (r) r[e.time.getHours()] = (r.at(e.time.getHours()) ?? 0) + 1;
  }
  return grid;
}

export interface ChannelStat {
  key: string;
  name: string;
  url: string | null;
  views: number;
  seconds: number;
}

export function topChannels(
  events: readonly WatchEvent[],
  durations: readonly number[],
  limit = 10,
): ChannelStat[] {
  const map = new Map<string, ChannelStat>();
  events.forEach((e, i) => {
    if (!e.channelName) return;
    const key = e.channelId ?? e.channelName;
    const s = map.get(key) ?? { key, name: e.channelName, url: e.channelUrl, views: 0, seconds: 0 };
    s.views++;
    s.seconds += durations.at(i) ?? 0;
    s.name = e.channelName; // keep the most recent name
    map.set(key, s);
  });
  return [...map.values()]
    .sort((a, b) => b.views - a.views || b.seconds - a.seconds)
    .slice(0, limit);
}

export interface VideoStat {
  videoId: string;
  title: string;
  channelName: string | null;
  url: string | null;
  views: number;
}

export function mostRewatched(events: readonly WatchEvent[], limit = 5): VideoStat[] {
  const map = new Map<string, VideoStat>();
  for (const e of events) {
    if (!e.videoId) continue;
    const s = map.get(e.videoId) ?? {
      videoId: e.videoId,
      title: e.title,
      channelName: e.channelName,
      url: e.videoUrl,
      views: 0,
    };
    s.views++;
    map.set(e.videoId, s);
  }
  return [...map.values()]
    .filter((v) => v.views > 1)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

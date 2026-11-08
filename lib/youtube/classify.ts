import type { VideoMeta } from "./types";

/** Parse an ISO 8601 duration such as PT1H2M3S or P1DT2H into seconds. */
export function parseIsoDuration(
  iso: string | null | undefined,
): number | null {
  if (!iso) return null;
  const m =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86_400 +
    Number(h ?? 0) * 3_600 +
    Number(min ?? 0) * 60 +
    Number(s ?? 0)
  );
}

export type ViewKind = "video" | "live" | "archive" | "unknown";

/**
 * Classify one view: "live" if it started while the broadcast was on air,
 * "archive" if the video was a stream but the view came after it ended,
 * otherwise "video". "unknown" when there is no metadata.
 */
export function classifyView(
  viewedAt: Date,
  meta: VideoMeta | undefined,
): ViewKind {
  if (!meta || meta.missing) return "unknown";
  if (!meta.wasLive || !meta.liveStart) return "video";
  const t = viewedAt.getTime();
  const start = Date.parse(meta.liveStart);
  const end = meta.liveEnd ? Date.parse(meta.liveEnd) : Infinity;
  // Allow a few minutes of slack: Takeout timestamps and stream start can drift.
  return t >= start - 10 * 60_000 && t <= end ? "live" : "archive";
}

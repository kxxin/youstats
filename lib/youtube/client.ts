import type { Subscription, VideoMeta } from "./types";

async function readJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const res = await fetch("/api/youtube/subscriptions", { cache: "no-store" });
  return (await readJson<{ subscriptions: Subscription[] }>(res)).subscriptions;
}

/** Fetch metadata for many video ids in chunks, reporting progress. */
export async function fetchVideoMeta(
  ids: readonly string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, VideoMeta>> {
  const out = new Map<string, VideoMeta>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 1000) {
    const res = await fetch("/api/youtube/videos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: unique.slice(i, i + 1000) }),
    });
    const { videos } = await readJson<{ videos: VideoMeta[] }>(res);
    for (const v of videos) out.set(v.videoId, v);
    onProgress?.(Math.min(i + 1000, unique.length), unique.length);
  }
  return out;
}

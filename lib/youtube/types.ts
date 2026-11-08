export interface Subscription {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  subscribedAt: string;
}

export interface VideoMeta {
  videoId: string;
  title: string | null;
  channelId: string | null;
  durationSec: number | null;
  liveStart: string | null;
  liveEnd: string | null;
  /** True when the video was (or is) a live broadcast. */
  wasLive: boolean;
  /** Video no longer available from the API. */
  missing: boolean;
}

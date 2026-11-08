export interface Snapshot {
  taken_on: string;
  subscribers: number | null;
  hidden_subscribers: boolean;
  views: number | null;
  videos: number | null;
}

export interface TrackedChannel {
  channelId: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  addedAt: string;
  latest: Snapshot | null;
  /** Subscriber change over the last 7 / 30 days, null when not enough history. */
  change7: number | null;
  change30: number | null;
}

export interface ChannelDetail {
  channelId: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  snapshots: Snapshot[];
  indexed: {
    videos: number;
    streams: number;
    complete: boolean;
    lastSyncedAt: string | null;
  };
}

export interface ArchiveVideo {
  video_id: string;
  title: string;
  published_at: string;
  duration_sec: number | null;
  was_live: boolean;
}

export interface AlertChannel {
  channelId: string;
  title: string;
  thumbnail: string | null;
  live: boolean;
  scheduled: boolean;
  uploads: boolean;
  websub: string | null;
}

export interface AlertSettings {
  discordWebhook: string | null;
  pushDevices: number;
  pushConfigured: boolean;
}

export interface LiveEvent {
  video_id: string;
  channel_id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  first_seen_at: string;
  channels: { title: string; thumbnail: string | null } | null;
}

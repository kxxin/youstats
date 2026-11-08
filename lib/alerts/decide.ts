export type LiveStatus = "upcoming" | "live" | "ended" | "video" | "gone";
export type AlertKind = "scheduled" | "live" | "upload";

export interface VideoState {
  status: LiveStatus;
  notified_scheduled_at: string | null;
  notified_live_at: string | null;
  notified_upload_at: string | null;
  first_seen_at?: string | null;
  published_at?: string | null;
}

/** Status from a videos.list item. */
export function statusFromApi(
  item: {
    snippet?: { liveBroadcastContent?: string };
    liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string };
  } | null,
): LiveStatus {
  if (!item) return "gone";
  const live = item.liveStreamingDetails;
  const lbc = item.snippet?.liveBroadcastContent;
  if (lbc === "live") return "live";
  if (lbc === "upcoming") return "upcoming";
  if (live?.actualEndTime) return "ended";
  if (live?.actualStartTime) return "live";
  return "video";
}

/**
 * Which alerts to send for a video, at most one of each kind ever.
 * Uploads are only announced when fresh (published within `freshHours`),
 * so a title edit on an old video doesn't trigger an alert.
 */
export function alertsToSend(
  v: VideoState,
  now = Date.now(),
  freshHours = 24,
): AlertKind[] {
  const out: AlertKind[] = [];
  if (v.status === "upcoming" && !v.notified_scheduled_at)
    out.push("scheduled");
  if (v.status === "live" && !v.notified_live_at) out.push("live");
  if (v.status === "video" && !v.notified_upload_at) {
    const published = v.published_at ? Date.parse(v.published_at) : NaN;
    if (Number.isFinite(published) && now - published < freshHours * 3_600_000)
      out.push("upload");
  }
  return out;
}

export interface AlertMessage {
  title: string;
  body: string;
  url: string;
}

export function buildMessage(
  kind: AlertKind,
  video: { videoId: string; title: string; scheduledStart?: string | null },
  channelTitle: string,
  timeZone = "Asia/Kuala_Lumpur",
): AlertMessage {
  const url = `https://www.youtube.com/watch?v=${video.videoId}`;
  if (kind === "live")
    return { title: `🔴 ${channelTitle} is live`, body: video.title, url };
  if (kind === "scheduled") {
    const when = video.scheduledStart
      ? new Intl.DateTimeFormat("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZone,
          timeZoneName: "short",
        }).format(new Date(video.scheduledStart))
      : "soon";
    return {
      title: `🗓️ ${channelTitle} scheduled a stream`,
      body: `${video.title} — ${when}`,
      url,
    };
  }
  return { title: `▶️ New video from ${channelTitle}`, body: video.title, url };
}

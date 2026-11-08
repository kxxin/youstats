/** One entry from a YouTube channel Atom feed pushed by WebSub. */
export interface FeedEntry {
  videoId: string;
  channelId: string;
  title: string;
  published: string | null;
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decodeXml(m[1].trim()) : null;
};

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Parse new/updated entries. Deleted entries (<at:deleted-entry>) are ignored. */
export function parseFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = m[1];
    const videoId = tag(body, "yt:videoId");
    const channelId = tag(body, "yt:channelId");
    if (!videoId || !channelId) continue;
    out.push({
      videoId,
      channelId,
      title: tag(body, "title") ?? "",
      published: tag(body, "published"),
    });
  }
  return out;
}

/** The channel id in a WebSub topic URL. */
export function channelIdFromTopic(topic: string | null): string | null {
  if (!topic) return null;
  try {
    return new URL(topic).searchParams.get("channel_id");
  } catch {
    return null;
  }
}

export const topicFor = (channelId: string) =>
  `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;

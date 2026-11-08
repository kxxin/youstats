export type ChannelRef =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string }
  | { kind: "video"; value: string };

const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_ID = /^[\w-]{11}$/;

/**
 * Understand what the user pasted: a channel URL, @handle, channel ID, or a
 * video URL (we then use that video's channel). Returns null if unrecognised.
 */
export function parseChannelInput(raw: string): ChannelRef | null {
  const input = raw.trim();
  if (!input) return null;
  if (CHANNEL_ID.test(input)) return { kind: "id", value: input };
  if (/^@[\w.-]{3,30}$/.test(input)) return { kind: "handle", value: input };

  let url: URL | null = null;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    url = null;
  }
  const host = url?.hostname.replace(/^(www|m|music)\./, "");
  if (url && (host === "youtube.com" || host === "youtu.be")) {
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return VIDEO_ID.test(id) ? { kind: "video", value: id } : null;
    }
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID.test(v)) return { kind: "video", value: v };
    const [first, second] = url.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    if (!first) return null;
    if (first.startsWith("@")) return { kind: "handle", value: first };
    if (first === "channel" && second && CHANNEL_ID.test(second))
      return { kind: "id", value: second };
    if (first === "user" && second) return { kind: "username", value: second };
    if (first === "c" && second) return { kind: "handle", value: `@${second}` };
    if (
      (first === "shorts" || first === "live") &&
      second &&
      VIDEO_ID.test(second)
    )
      return { kind: "video", value: second };
    return null;
  }
  if (/^[\w.-]{3,30}$/.test(input))
    return { kind: "handle", value: `@${input}` };
  return null;
}

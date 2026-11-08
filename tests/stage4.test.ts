import { describe, expect, it } from "vitest";
import {
  alertsToSend,
  buildMessage,
  statusFromApi,
  type VideoState,
} from "@/lib/alerts/decide";
import { channelIdFromTopic, parseFeed, topicFor } from "@/lib/alerts/feed";

const FEED = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <link rel="hub" href="https://pubsubhubbub.appspot.com"/>
  <title>YouTube video feed</title>
  <entry>
    <id>yt:video:abcdefghijk</id>
    <yt:videoId>abcdefghijk</yt:videoId>
    <yt:channelId>UCaaaaaaaaaaaaaaaaaaaaaa</yt:channelId>
    <title>Karaoke &amp; chill 【歌枠】</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
    <published>2026-11-08T10:00:00+00:00</published>
    <updated>2026-11-08T10:00:05+00:00</updated>
  </entry>
</feed>`;

const DELETED = `<feed xmlns:at="http://purl.org/atompub/tombstones/1.0"><at:deleted-entry ref="yt:video:zzzzzzzzzzz" when="2026-11-08T10:00:00+00:00"></at:deleted-entry></feed>`;

describe("WebSub feed", () => {
  it("parses entries and decodes entities", () => {
    expect(parseFeed(FEED)).toEqual([
      {
        videoId: "abcdefghijk",
        channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
        title: "Karaoke & chill 【歌枠】",
        published: "2026-11-08T10:00:00+00:00",
      },
    ]);
  });
  it("ignores deletions", () => {
    expect(parseFeed(DELETED)).toEqual([]);
  });
  it("round-trips the topic url", () => {
    expect(channelIdFromTopic(topicFor("UCaaaaaaaaaaaaaaaaaaaaaa"))).toBe(
      "UCaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(channelIdFromTopic("not a url")).toBeNull();
  });
});

describe("statusFromApi", () => {
  it("maps API fields", () => {
    expect(statusFromApi(null)).toBe("gone");
    expect(
      statusFromApi({
        snippet: { liveBroadcastContent: "upcoming" },
        liveStreamingDetails: {},
      }),
    ).toBe("upcoming");
    expect(statusFromApi({ snippet: { liveBroadcastContent: "live" } })).toBe(
      "live",
    );
    expect(
      statusFromApi({
        snippet: { liveBroadcastContent: "none" },
        liveStreamingDetails: { actualStartTime: "x", actualEndTime: "y" },
      }),
    ).toBe("ended");
    expect(statusFromApi({ snippet: { liveBroadcastContent: "none" } })).toBe(
      "video",
    );
  });
});

describe("alertsToSend", () => {
  const base: VideoState = {
    status: "upcoming",
    notified_scheduled_at: null,
    notified_live_at: null,
    notified_upload_at: null,
  };
  const now = Date.parse("2026-11-08T12:00:00Z");

  it("sends each kind once", () => {
    expect(alertsToSend(base, now)).toEqual(["scheduled"]);
    expect(alertsToSend({ ...base, notified_scheduled_at: "x" }, now)).toEqual(
      [],
    );
    expect(
      alertsToSend(
        { ...base, status: "live", notified_scheduled_at: "x" },
        now,
      ),
    ).toEqual(["live"]);
    expect(
      alertsToSend({ ...base, status: "live", notified_live_at: "x" }, now),
    ).toEqual([]);
    expect(alertsToSend({ ...base, status: "ended" }, now)).toEqual([]);
  });

  it("announces only fresh uploads", () => {
    const fresh = {
      ...base,
      status: "video" as const,
      published_at: "2026-11-08T11:00:00Z",
    };
    expect(alertsToSend(fresh, now)).toEqual(["upload"]);
    expect(
      alertsToSend({ ...fresh, published_at: "2026-11-01T11:00:00Z" }, now),
    ).toEqual([]);
    expect(alertsToSend({ ...fresh, notified_upload_at: "x" }, now)).toEqual(
      [],
    );
  });
});

describe("buildMessage", () => {
  it("formats scheduled time in the given zone", () => {
    const m = buildMessage(
      "scheduled",
      {
        videoId: "abcdefghijk",
        title: "Karaoke",
        scheduledStart: "2026-11-08T12:00:00Z",
      },
      "Some Channel",
      "Asia/Kuala_Lumpur",
    );
    expect(m.title).toContain("Some Channel");
    expect(m.body).toContain("20:00");
    expect(m.url).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  });
});

describe("WebSub signature", () => {
  it("accepts the hub's HMAC and rejects tampering", async () => {
    process.env.WEBSUB_SECRET = "test-secret";
    const { createHmac } = await import("node:crypto");
    const { secretFor, verifySignature } = await import("@/lib/alerts/websub");
    const ch = "UCaaaaaaaaaaaaaaaaaaaaaa";
    const sig = createHmac("sha1", secretFor(ch)).update(FEED).digest("hex");
    expect(verifySignature(ch, FEED, `sha1=${sig}`)).toBe(true);
    expect(verifySignature(ch, FEED + " ", `sha1=${sig}`)).toBe(false);
    expect(
      verifySignature("UCbbbbbbbbbbbbbbbbbbbbbb", FEED, `sha1=${sig}`),
    ).toBe(false);
    expect(verifySignature(ch, FEED, null)).toBe(false);
  });
});

describe("buildMessage without a start time", () => {
  it("omits the time instead of saying soon", () => {
    const m = buildMessage(
      "scheduled",
      { videoId: "abcdefghijk", title: "Premiere" },
      "Ch",
    );
    expect(m.body).toBe("Premiere");
  });
});

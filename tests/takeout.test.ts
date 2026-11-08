import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  channelIdFromUrl,
  parseWatchHistory,
  videoIdFromUrl,
} from "@/lib/takeout/parse";
import {
  estimateDurations,
  mostRewatched,
  summarize,
  topChannels,
  viewsOverTime,
  weekHourGrid,
} from "@/lib/takeout/stats";

const raw = JSON.parse(
  readFileSync(
    new URL("./fixtures/watch-history.sample.json", import.meta.url),
    "utf8",
  ),
);

describe("parseWatchHistory", () => {
  const { events, skipped } = parseWatchHistory(raw);

  it("keeps watches and counts skipped rows", () => {
    expect(events).toHaveLength(4);
    expect(skipped).toEqual({ ads: 1, invalid: 1, nonWatch: 1 });
  });

  it("strips the Watched prefix and reads ids", () => {
    const first = events.at(0)!;
    expect(first.title).toBe("Building a tiny compiler");
    expect(first.videoId).toBe("aaaaaaaaaaa");
    expect(first.channelId).toBe("UCaaaaaaaaaaaaaaaaaaaaaa");
    expect(first.product).toBe("youtube");
  });

  it("marks YouTube Music and keeps removed videos without a channel", () => {
    expect(events.at(2)!.product).toBe("music");
    expect(events.at(3)!.videoId).toBeNull();
    expect(events.at(3)!.channelName).toBeNull();
  });

  it("rejects non-array input", () => {
    expect(() => parseWatchHistory({})).toThrow(TypeError);
  });
});

describe("url helpers", () => {
  it("handles youtu.be and bad urls", () => {
    expect(videoIdFromUrl("https://youtu.be/xyz12345678")).toBe("xyz12345678");
    expect(videoIdFromUrl("not a url")).toBeNull();
    expect(channelIdFromUrl("https://www.youtube.com/@handle")).toBeNull();
  });
});

describe("stats", () => {
  const { events } = parseWatchHistory(raw);
  const d = estimateDurations(events, {
    sessionGapSeconds: 1800,
    sessionTailSeconds: 480,
  });

  it("credits short gaps and caps long ones", () => {
    expect(d).toEqual([600, 480, 480, 480]);
  });

  it("summarizes", () => {
    const s = summarize(events, d);
    expect(s.views).toBe(4);
    expect(s.uniqueVideos).toBe(2);
    expect(s.uniqueChannels).toBe(2);
    expect(s.estimatedSeconds).toBe(2040);
  });

  it("fills empty months", () => {
    const b = viewsOverTime(events, d, "month");
    expect(b.map((x) => x.views)).toEqual([3, 1]);
  });

  it("builds a 7 x 24 grid with every view", () => {
    const g = weekHourGrid(events);
    expect(g).toHaveLength(7);
    expect(g.flat().reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("ranks channels and rewatches", () => {
    const top = topChannels(events, d);
    expect(top.at(0)).toMatchObject({
      name: "Example Code Lab",
      views: 2,
      seconds: 1080,
    });
    expect(mostRewatched(events).at(0)).toMatchObject({
      videoId: "aaaaaaaaaaa",
      views: 2,
    });
  });
});

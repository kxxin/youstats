import { describe, expect, it } from "vitest";
import { isWatchHistoryPath, pickLatestArchiveSet } from "@/lib/takeout/drive";
import { classifyView, parseIsoDuration } from "@/lib/youtube/classify";
import type { VideoMeta } from "@/lib/youtube/types";
import { estimateDurations } from "@/lib/takeout/stats";
import type { WatchEvent } from "@/lib/takeout/parse";

describe("parseIsoDuration", () => {
  it("parses common forms", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P1DT2H")).toBe(93600);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("nope")).toBeNull();
    expect(parseIsoDuration(null)).toBeNull();
  });
});

const meta = (over: Partial<VideoMeta>): VideoMeta => ({
  videoId: "aaaaaaaaaaa",
  title: null,
  channelId: null,
  durationSec: 600,
  liveStart: null,
  liveEnd: null,
  wasLive: false,
  missing: false,
  ...over,
});

describe("classifyView", () => {
  const stream = meta({
    wasLive: true,
    liveStart: "2026-11-01T12:00:00Z",
    liveEnd: "2026-11-01T14:00:00Z",
  });
  it("splits live, archive and video", () => {
    expect(classifyView(new Date("2026-11-01T13:00:00Z"), stream)).toBe("live");
    expect(classifyView(new Date("2026-11-01T11:55:00Z"), stream)).toBe("live");
    expect(classifyView(new Date("2026-11-02T09:00:00Z"), stream)).toBe(
      "archive",
    );
    expect(classifyView(new Date("2026-11-02T09:00:00Z"), meta({}))).toBe(
      "video",
    );
    expect(classifyView(new Date(), undefined)).toBe("unknown");
    expect(classifyView(new Date(), meta({ missing: true }))).toBe("unknown");
  });
  it("treats an ongoing stream as live", () => {
    const ongoing = meta({
      wasLive: true,
      liveStart: "2026-11-08T00:00:00Z",
      liveEnd: null,
    });
    expect(classifyView(new Date("2026-11-08T05:00:00Z"), ongoing)).toBe(
      "live",
    );
  });
});

describe("estimateDurations with known lengths", () => {
  const ev = (iso: string) => ({ time: new Date(iso) }) as WatchEvent;
  const events = [
    ev("2026-11-01T10:00:00Z"),
    ev("2026-11-01T10:20:00Z"),
    ev("2026-11-01T12:00:00Z"),
  ];
  it("caps by video length", () => {
    const opts = { sessionGapSeconds: 1800, sessionTailSeconds: 480 };
    expect(estimateDurations(events, opts, [300, 7200, 120])).toEqual([
      300, 1800, 120,
    ]);
    expect(estimateDurations(events, opts, [null, null, null])).toEqual([
      1200, 480, 480,
    ]);
  });
});

describe("Drive helpers", () => {
  it("picks every part of the newest export", () => {
    const f = (name: string) => ({ id: name, name, createdTime: "" });
    const picked = pickLatestArchiveSet([
      f("takeout-20260901T010000Z-001.zip"),
      f("takeout-20261101T010000Z-002.zip"),
      f("takeout-20261101T010000Z-001.zip"),
      f("holiday.zip"),
      f("Takeout"),
    ]);
    expect(picked.map((p) => p.name)).toEqual([
      "takeout-20261101T010000Z-001.zip",
      "takeout-20261101T010000Z-002.zip",
    ]);
    expect(pickLatestArchiveSet([f("x.zip")])).toEqual([]);
    // Scheduled exports add an extra number segment
    expect(
      pickLatestArchiveSet([
        f("takeout-20261108T051500Z-1-001.zip"),
        f("takeout-20261108T051500Z-1-002.zip"),
        f("takeout-20261108T051500Z-1-001.tgz"),
      ]).map((p) => p.name),
    ).toEqual([
      "takeout-20261108T051500Z-1-001.zip",
      "takeout-20261108T051500Z-1-002.zip",
    ]);
  });
  it("finds watch-history.json in any language layout", () => {
    expect(
      isWatchHistoryPath(
        "Takeout/YouTube and YouTube Music/history/watch-history.json",
      ),
    ).toBe(true);
    expect(
      isWatchHistoryPath(
        "Takeout/YouTube dan YouTube Music/sejarah/watch-history.json",
      ),
    ).toBe(true);
    expect(
      isWatchHistoryPath("Takeout/YouTube/history/search-history.json"),
    ).toBe(false);
  });
});

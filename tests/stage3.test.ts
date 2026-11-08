import { describe, expect, it } from "vitest";
import { subscriberChange } from "@/lib/channels/growth";
import { parseChannelInput } from "@/lib/channels/parse-input";
import type { Snapshot } from "@/lib/channels/types";

const ID = "UCaaaaaaaaaaaaaaaaaaaaaa";

describe("parseChannelInput", () => {
  it.each([
    [ID, { kind: "id", value: ID }],
    [`https://www.youtube.com/channel/${ID}/videos`, { kind: "id", value: ID }],
    ["@SomeCreator", { kind: "handle", value: "@SomeCreator" }],
    [
      "https://youtube.com/@SomeCreator/streams",
      { kind: "handle", value: "@SomeCreator" },
    ],
    ["youtube.com/@SomeCreator", { kind: "handle", value: "@SomeCreator" }],
    [
      "https://m.youtube.com/user/oldname",
      { kind: "username", value: "oldname" },
    ],
    [
      "https://www.youtube.com/watch?v=abcdefghijk&t=5",
      { kind: "video", value: "abcdefghijk" },
    ],
    ["https://youtu.be/abcdefghijk", { kind: "video", value: "abcdefghijk" }],
    [
      "https://www.youtube.com/live/abcdefghijk",
      { kind: "video", value: "abcdefghijk" },
    ],
    ["SomeCreator", { kind: "handle", value: "@SomeCreator" }],
  ])("parses %s", (input, expected) => {
    expect(parseChannelInput(input)).toEqual(expected);
  });

  it("rejects junk", () => {
    expect(parseChannelInput("")).toBeNull();
    expect(parseChannelInput("https://example.com/@x")).toBeNull();
    expect(parseChannelInput("not a channel at all")).toBeNull();
  });
});

describe("subscriberChange", () => {
  const s = (taken_on: string, subscribers: number | null): Snapshot => ({
    taken_on,
    subscribers,
    hidden_subscribers: subscribers === null,
    views: null,
    videos: null,
  });
  const snaps = [
    s("2026-10-01", 1000),
    s("2026-10-25", 1100),
    s("2026-11-01", 1150),
    s("2026-11-08", 1200),
  ];
  it("compares with the newest snapshot at least N days old", () => {
    expect(subscriberChange(snaps, 7)).toBe(50);
    expect(subscriberChange(snaps, 30)).toBe(200);
  });
  it("returns null without enough history or with hidden counts", () => {
    expect(subscriberChange(snaps, 60)).toBeNull();
    expect(subscriberChange([s("2026-11-08", null)], 7)).toBeNull();
  });
});

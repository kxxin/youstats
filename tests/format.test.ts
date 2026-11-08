import { describe, expect, it } from "vitest";
import { formatDuration, formatSpan } from "@/lib/format";

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(59.9)).toBe("59s");
  });

  it("shows minutes, hours and days", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(3_725)).toBe("1h 2m");
    expect(formatDuration(90_000)).toBe("1d 1h");
  });

  it("rejects invalid input", () => {
    expect(() => formatDuration(-1)).toThrow(RangeError);
    expect(() => formatDuration(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatSpan", () => {
  it("counts whole calendar months", () => {
    expect(formatSpan(new Date(2019, 2, 12), new Date(2026, 10, 8))).toBe(
      "7y 7m",
    );
    expect(formatSpan(new Date(2026, 0, 31), new Date(2026, 2, 1))).toBe("1m");
    expect(formatSpan(new Date(2026, 10, 1), new Date(2026, 10, 8))).toBe("7d");
    expect(formatSpan(new Date(2025, 10, 8), new Date(2026, 10, 8))).toBe("1y");
  });
});

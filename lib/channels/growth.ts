import type { Snapshot } from "./types";

/**
 * Subscriber change between the latest snapshot and the newest snapshot at
 * least `days` older. Null when history is too short or counts are hidden.
 */
export function subscriberChange(
  snaps: readonly Snapshot[],
  days: number,
): number | null {
  const sorted = [...snaps]
    .filter((s) => s.subscribers !== null)
    .sort((a, b) => a.taken_on.localeCompare(b.taken_on));
  const latest = sorted.at(-1);
  if (!latest) return null;
  const cutoff = Date.parse(latest.taken_on) - days * 864e5;
  const base = sorted.filter((s) => Date.parse(s.taken_on) <= cutoff).at(-1);
  if (!base || base.subscribers === null || latest.subscribers === null)
    return null;
  return latest.subscribers - base.subscribers;
}

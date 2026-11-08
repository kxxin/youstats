/**
 * Format a duration in seconds as a short human string, e.g. 3725 -> "1h 2m".
 * Seconds are shown only for durations under one minute.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    throw new RangeError("totalSeconds must be a non-negative finite number");
  }
  const s = Math.floor(totalSeconds);
  if (s < 60) return `${s}s`;

  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

/** Calendar span between two dates as "7y 8m", "3m" or "12d". */
export function formatSpan(from: Date, to: Date = new Date()): string {
  if (to < from) return "0d";
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months--;
  if (months < 1) {
    const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
    return `${days}d`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y}y` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
}

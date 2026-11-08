/** Server-only environment access with clear errors when a value is missing. */
export function env(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return v;
}

/** Comma-separated allow-list of Google account emails (personal-only app). */
export function isAllowedEmail(email: string | undefined | null): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return !!email && list.includes(email.toLowerCase());
}

import "server-only";

const BASE = "https://www.googleapis.com/youtube/v3";

export async function ytGet<T>(
  path: string,
  params: Record<string, string>,
  auth: { accessToken: string } | { apiKey: string },
): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if ("apiKey" in auth) url.searchParams.set("key", auth.apiKey);
  else headers.authorization = `Bearer ${auth.accessToken}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `YouTube API ${path} failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

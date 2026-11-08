import { unzip, type Unzipped } from "fflate";

export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

/** Takeout names archives like takeout-20261108T051500Z-001.zip (split into numbered parts). */
const TAKEOUT_RE = /^takeout-(\d{8}T\d{6}Z)-\d+\.zip$/i;

/** All parts of the newest Takeout export, or [] if none. */
export function pickLatestArchiveSet(files: readonly DriveFile[]): DriveFile[] {
  let latest: string | null = null;
  for (const f of files) {
    const stamp = TAKEOUT_RE.exec(f.name)?.[1];
    if (stamp && (!latest || stamp > latest)) latest = stamp;
  }
  if (!latest) return [];
  return files
    .filter((f) => TAKEOUT_RE.exec(f.name)?.[1] === latest)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True for the watch-history JSON in any Takeout language layout. */
export function isWatchHistoryPath(path: string): boolean {
  return /(^|\/)watch-history\.json$/i.test(path);
}

export async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch("/api/google/token", { cache: "no-store" });
  const json = (await res.json()) as { accessToken?: string; error?: string };
  if (!res.ok || !json.accessToken) throw new Error(json.error ?? "Could not get Google access.");
  return json.accessToken;
}

async function driveFetch(token: string, url: string) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Drive request failed (${res.status}).`);
  return res;
}

export async function listTakeoutArchives(token: string): Promise<DriveFile[]> {
  const q = "name contains 'takeout-' and mimeType = 'application/zip' and trashed = false";
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("orderBy", "createdTime desc");
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("fields", "files(id,name,createdTime,size)");
  const json = (await (await driveFetch(token, url.toString())).json()) as { files: DriveFile[] };
  return json.files;
}

const unzipAsync = (data: Uint8Array) =>
  new Promise<Unzipped>((resolve, reject) =>
    unzip(data, { filter: (f) => isWatchHistoryPath(f.name) }, (err, out) =>
      err ? reject(err) : resolve(out),
    ),
  );

/**
 * Download the newest Takeout export from Drive (in the browser) and return
 * the watch-history.json text. Nothing passes through the YouStats server.
 */
export async function loadLatestWatchHistoryFromDrive(
  onStatus: (msg: string) => void,
): Promise<{ text: string; archive: DriveFile }> {
  onStatus("Connecting to Google Drive…");
  const token = await getGoogleAccessToken();
  const parts = pickLatestArchiveSet(await listTakeoutArchives(token));
  const first = parts.at(0);
  if (!first) throw new Error("No Takeout export found in your Google Drive yet.");

  for (const [i, part] of parts.entries()) {
    onStatus(`Downloading ${part.name} (${i + 1}/${parts.length})…`);
    const buf = new Uint8Array(
      await (await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${part.id}?alt=media`)).arrayBuffer(),
    );
    onStatus("Unzipping…");
    const files = await unzipAsync(buf);
    const entry = Object.values(files).at(0);
    if (entry) return { text: new TextDecoder().decode(entry), archive: first };
  }
  throw new Error(
    "The newest Takeout export has no watch-history.json. Make sure history is included and set to JSON.",
  );
}

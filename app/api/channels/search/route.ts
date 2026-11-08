import { NextResponse, type NextRequest } from "next/server";
import { handleError, jsonError, requireUser } from "@/lib/api";
import { userTracks } from "@/lib/channels/access";
import type { ArchiveVideo } from "@/lib/channels/types";
import { createAdminClient } from "@/lib/supabase/server";

const PAGE = 30;
const COLS = "video_id, title, published_at, duration_sec, was_live";

/**
 * Search a tracked channel's archive: ?id=UC…&q=words&type=all|videos|streams&page=0
 * Full-text search on title + description, falling back to a title substring
 * match (useful for languages without spaces, e.g. Japanese).
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const sp = new URL(request.url).searchParams;
  const id = sp.get("id");
  const q = (sp.get("q") ?? "").trim().slice(0, 200);
  const type = sp.get("type") ?? "all";
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  if (!id) return jsonError(400, "Missing id.");

  try {
    const db = createAdminClient();
    if (!(await userTracks(db, auth.user.id, id)))
      return jsonError(404, "Not tracked.");

    const base = () => {
      let query = db
        .from("channel_videos")
        .select(COLS, { count: "exact" })
        .eq("channel_id", id);
      if (type === "videos") query = query.eq("was_live", false);
      if (type === "streams") query = query.eq("was_live", true);
      return query;
    };
    const range = [page * PAGE, page * PAGE + PAGE - 1] as const;

    let res = q
      ? await base()
          .textSearch("search", q, { type: "websearch", config: "simple" })
          .order("published_at", { ascending: false })
          .range(...range)
      : await base()
          .order("published_at", { ascending: false })
          .range(...range);
    if (res.error) throw res.error;

    let mode: "fulltext" | "substring" | "latest" = q ? "fulltext" : "latest";
    if (q && (res.count ?? 0) === 0) {
      const escaped = q.replace(/[%_\\]/g, (m) => `\\${m}`);
      res = await base()
        .ilike("title", `%${escaped}%`)
        .order("published_at", { ascending: false })
        .range(...range);
      if (res.error) throw res.error;
      mode = "substring";
    }

    return NextResponse.json({
      videos: (res.data ?? []) as ArchiveVideo[],
      total: res.count ?? 0,
      page,
      pageSize: PAGE,
      mode,
    });
  } catch (e) {
    return handleError(e);
  }
}

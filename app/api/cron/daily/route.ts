import { NextResponse, type NextRequest } from "next/server";
import { handleError, jsonError } from "@/lib/api";
import { env } from "@/lib/env";
import { fetchChannels, saveChannel, syncUploads } from "@/lib/channels/sync";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * Daily job (called by GitHub Actions): snapshot every tracked channel and
 * index new uploads / continue archive backfills.
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env("CRON_SECRET")}`) {
    return jsonError(401, "Unauthorized");
  }
  const started = Date.now();
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("tracked_channels")
      .select("channel_id");
    if (error) throw error;
    const ids = [...new Set((data ?? []).map((r) => r.channel_id as string))];

    const items = await fetchChannels(ids);
    for (const c of items) await saveChannel(db, c);

    const results: Record<string, unknown> = {};
    for (const id of ids) {
      // Leave headroom under the 300 s limit; tomorrow's run continues.
      if (Date.now() - started > 240_000) {
        results[id] = "skipped (time budget)";
        continue;
      }
      try {
        results[id] = await syncUploads(db, id, 40);
      } catch (e) {
        results[id] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    return NextResponse.json({
      snapshots: items.length,
      channels: ids.length,
      results,
      seconds: Math.round((Date.now() - started) / 1000),
    });
  } catch (e) {
    return handleError(e);
  }
}

// Handy for a manual check in the browser: reports config only, does no work.
export async function GET() {
  return NextResponse.json({ ok: true, configured: !!process.env.CRON_SECRET });
}

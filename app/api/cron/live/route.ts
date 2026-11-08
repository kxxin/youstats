import { NextResponse, type NextRequest } from "next/server";
import { processVideos, videosToPoll } from "@/lib/alerts/process";
import { handleError, jsonError } from "@/lib/api";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Every ~5 minutes (GitHub Actions or an external cron): re-check scheduled
 * streams that are due and streams still live. WebSub does not announce the
 * moment a scheduled stream starts, so this is what sends "is live" alerts.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env("CRON_SECRET")}`) {
    return jsonError(401, "Unauthorized");
  }
  try {
    const db = createAdminClient();
    const ids = await videosToPoll(db);
    const log = await processVideos(db, ids);
    return NextResponse.json({ checked: ids.length, log });
  } catch (e) {
    return handleError(e);
  }
}

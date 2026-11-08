import { NextResponse, type NextRequest } from "next/server";
import { channelIdFromTopic, parseFeed } from "@/lib/alerts/feed";
import { processVideos } from "@/lib/alerts/process";
import { verifySignature } from "@/lib/alerts/websub";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Hub verification: echo the challenge for channels we asked about. */
export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("hub.mode");
  const challenge = sp.get("hub.challenge");
  const channelId = sp.get("channel");
  const topicChannel = channelIdFromTopic(sp.get("hub.topic"));
  if (!challenge || !channelId || topicChannel !== channelId) {
    return new NextResponse("bad request", { status: 400 });
  }

  const db = createAdminClient();
  const { data } = await db
    .from("websub_subscriptions")
    .select("status")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (!data) return new NextResponse("unknown topic", { status: 404 });

  if (mode === "subscribe") {
    const lease = Number(sp.get("hub.lease_seconds") ?? 0);
    await db
      .from("websub_subscriptions")
      .update({
        status: "active",
        lease_expires_at: lease
          ? new Date(Date.now() + lease * 1000).toISOString()
          : null,
      })
      .eq("channel_id", channelId);
  } else if (mode === "unsubscribe") {
    await db
      .from("websub_subscriptions")
      .update({ status: "unsubscribed" })
      .eq("channel_id", channelId);
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

/** Feed notification from the hub (new or updated video). */
export async function POST(request: NextRequest) {
  const channelId = new URL(request.url).searchParams.get("channel");
  const body = await request.text();
  // Always 2xx after this point for valid requests so the hub doesn't retry forever.
  if (
    !channelId ||
    !verifySignature(channelId, body, request.headers.get("x-hub-signature"))
  ) {
    return new NextResponse("invalid signature", { status: 403 });
  }
  try {
    const db = createAdminClient();
    const entries = parseFeed(body).filter((e) => e.channelId === channelId);
    await db
      .from("websub_subscriptions")
      .update({ last_notification_at: new Date().toISOString() })
      .eq("channel_id", channelId);
    const log = await processVideos(
      db,
      entries.map((e) => e.videoId),
    );
    console.log("[websub]", channelId, JSON.stringify(log));
  } catch (e) {
    console.error("[websub] processing failed", e);
  }
  return new NextResponse(null, { status: 204 });
}

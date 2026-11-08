import { NextResponse, type NextRequest } from "next/server";
import { handleError, jsonError, requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

interface Sub {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/** Save this browser's push subscription. Body: PushSubscription.toJSON() */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const sub = (await request.json().catch(() => ({}))) as Sub;
  if (
    typeof sub.endpoint !== "string" ||
    !sub.endpoint.startsWith("https://") ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string"
  ) {
    return jsonError(400, "Invalid push subscription.");
  }
  try {
    const { error } = await createAdminClient()
      .from("push_subscriptions")
      .upsert({
        endpoint: sub.endpoint,
        user_id: auth.user.id,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

/** Remove a push subscription: { endpoint } */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { endpoint } = (await request.json().catch(() => ({}))) as {
    endpoint?: unknown;
  };
  if (typeof endpoint !== "string") return jsonError(400, "Missing endpoint.");
  try {
    const { error } = await createAdminClient()
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", auth.user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

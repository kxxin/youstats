import { NextResponse } from "next/server";
import { deliver } from "@/lib/alerts/deliver";
import { handleError, requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

/** Send a test alert to every delivery method the user set up. */
export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const results = await deliver(createAdminClient(), auth.user.id, {
      title: "🔔 YouStats test alert",
      body: "Alerts are working.",
      url: "https://www.youtube.com/",
    });
    return NextResponse.json({ results });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { saveRefreshToken } from "@/lib/google/token";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const dest = new URL(next?.startsWith("/") ? next : "/", url.origin);
  if (!code)
    return NextResponse.redirect(new URL("/?auth=missing_code", url.origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(new URL("/?auth=failed", url.origin));
  }
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/?auth=not_allowed", url.origin));
  }
  if (data.session.provider_refresh_token) {
    await saveRefreshToken(data.user.id, data.session.provider_refresh_token);
  }
  return NextResponse.redirect(dest);
}

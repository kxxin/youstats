import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { saveRefreshToken } from "@/lib/google/token";
import { createClient } from "@/lib/supabase/server";

/** Finishes Google sign-in. Every failure redirects home with a reason instead of a 500. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(reason)}`, url.origin),
    );

  const oauthError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (oauthError) return fail(oauthError);
  const code = url.searchParams.get("code");
  if (!code) return fail("missing_code");
  const next = url.searchParams.get("next");
  const dest = new URL(next?.startsWith("/") ? next : "/", url.origin);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session)
      return fail(`exchange_failed: ${error?.message ?? "no session"}`);

    if (!isAllowedEmail(data.user?.email)) {
      await supabase.auth.signOut();
      return fail("not_allowed");
    }
    if (data.session.provider_refresh_token) {
      try {
        await saveRefreshToken(
          data.user.id,
          data.session.provider_refresh_token,
        );
      } catch (e) {
        console.error("[auth/callback] saving Google token failed:", e);
        return fail(
          `token_store_failed: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
        );
      }
    } else {
      console.warn("[auth/callback] Google returned no refresh token");
    }
    return NextResponse.redirect(dest);
  } catch (e) {
    console.error("[auth/callback] failed:", e);
    return fail(
      `callback_failed: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
    );
  }
}

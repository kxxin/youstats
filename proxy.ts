import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on navigation. Auth problems must
 * never take the whole site down, so any failure here is logged and the
 * request continues signed out.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet, headers) {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet)
            response.cookies.set(name, value, options);
          for (const [k, v] of Object.entries(headers))
            response.headers.set(k, v);
        },
      },
    });
    await supabase.auth.getClaims();
  } catch (e) {
    console.error("[proxy] Supabase session refresh failed:", e);
    return NextResponse.next({ request });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:json|png|svg|ico)$).*)",
  ],
};

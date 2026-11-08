import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Supabase client bound to the request's auth cookies (route handlers). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(toSet) {
          for (const { name, value, options } of toSet)
            cookieStore.set(name, value, options);
        },
      },
    },
  );
}

/** Privileged client for server-only tables (tokens, caches). Never expose to the browser. */
export function createAdminClient() {
  return createPlainClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** The signed-in user's id and email, or null. Verifies the JWT. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
  };
}

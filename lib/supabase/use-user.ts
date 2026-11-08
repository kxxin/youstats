"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { GOOGLE_SCOPES_CLIENT } from "@/lib/google/scopes";
import { createClient, supabaseConfigured } from "./client";

/** Current Supabase user in the browser; `undefined` while loading. */
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(
    supabaseConfigured ? undefined : null,
  );
  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

export async function signInWithGoogle(next = window.location.pathname) {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: GOOGLE_SCOPES_CLIENT,
      // Needed to receive a Google refresh token for server-side API calls.
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}

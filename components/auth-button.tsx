"use client";

import { supabaseConfigured } from "@/lib/supabase/client";
import { signInWithGoogle, useUser } from "@/lib/supabase/use-user";

export function AuthButton() {
  const user = useUser();
  if (!supabaseConfigured || user === undefined) return null;
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => signInWithGoogle()}
        className="border-border hover:bg-card rounded-lg border px-3 py-1.5"
      >
        Sign in with Google
      </button>
    );
  }
  return (
    <form
      action="/auth/signout"
      method="post"
      className="flex items-center gap-3"
    >
      <span className="text-muted hidden truncate sm:inline">{user.email}</span>
      <button
        type="submit"
        className="text-muted hover:text-foreground underline underline-offset-4"
      >
        Sign out
      </button>
    </form>
  );
}

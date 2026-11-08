import "server-only";
import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { NeedsReauthError } from "@/lib/google/token";
import { getUser } from "@/lib/supabase/server";

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Signed-in, allow-listed user or a 401/403 response. */
export async function requireUser() {
  const user = await getUser();
  if (!user)
    return { response: jsonError(401, "Sign in first.", "signed_out") };
  if (!isAllowedEmail(user.email))
    return { response: jsonError(403, "This account is not allowed.") };
  return { user };
}

export function handleError(e: unknown) {
  if (e instanceof NeedsReauthError) return jsonError(401, e.message, "reauth");
  console.error(e);
  return jsonError(500, e instanceof Error ? e.message : "Unexpected error");
}

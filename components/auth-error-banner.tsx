"use client";

import { useSearchParams } from "next/navigation";

const HINTS: Record<string, string> = {
  not_allowed: "This Google account isn't in ALLOWED_EMAILS.",
  missing_code: "Google didn't return a sign-in code. Check the redirect URLs.",
};

/** Shows why sign-in failed, from the ?auth_error= query the callback adds. */
export function AuthErrorBanner() {
  const reason = useSearchParams().get("auth_error");
  if (!reason) return null;
  const key = reason.split(":")[0];
  return (
    <div
      role="alert"
      className="border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      <div className="mx-auto max-w-5xl sm:px-4">
        Sign-in failed: {HINTS[key] ?? reason}
      </div>
    </div>
  );
}

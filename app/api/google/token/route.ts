import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { getGoogleAccessToken } from "@/lib/google/token";

/** Short-lived Google access token for the browser (Drive download stays client-side). */
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const { token, expiresAt } = await getGoogleAccessToken(auth.user.id);
    return NextResponse.json(
      { accessToken: token, expiresAt },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

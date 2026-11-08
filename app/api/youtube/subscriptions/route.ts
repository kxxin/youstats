import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { getGoogleAccessToken } from "@/lib/google/token";
import { ytGet } from "@/lib/youtube/api";
import type { Subscription } from "@/lib/youtube/types";

interface SubsPage {
  nextPageToken?: string;
  items: {
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      resourceId: { channelId: string };
      thumbnails?: { default?: { url: string } };
    };
  }[];
}

/** All of the user's subscriptions with the date each one started (1 quota unit per 50). */
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const { token } = await getGoogleAccessToken(auth.user.id);
    const out: Subscription[] = [];
    let pageToken: string | undefined;
    do {
      const page: SubsPage = await ytGet<SubsPage>(
        "subscriptions",
        {
          part: "snippet",
          mine: "true",
          maxResults: "50",
          order: "alphabetical",
          ...(pageToken ? { pageToken } : {}),
        },
        { accessToken: token },
      );
      for (const it of page.items) {
        out.push({
          channelId: it.snippet.resourceId.channelId,
          title: it.snippet.title,
          description: it.snippet.description,
          thumbnail: it.snippet.thumbnails?.default?.url ?? null,
          subscribedAt: it.snippet.publishedAt,
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken && out.length < 5000);
    return NextResponse.json(
      { subscriptions: out },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

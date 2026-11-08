import { NextResponse, type NextRequest } from "next/server";
import { handleError, jsonError, requireUser } from "@/lib/api";
import { subscriberChange } from "@/lib/channels/growth";
import { parseChannelInput } from "@/lib/channels/parse-input";
import { lookupChannel, saveChannel, syncUploads } from "@/lib/channels/sync";
import type { Snapshot, TrackedChannel } from "@/lib/channels/types";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 120;

interface Row {
  channel_id: string;
  added_at: string;
  channels: {
    title: string;
    handle: string | null;
    thumbnail: string | null;
  } | null;
}

/** The user's tracked channels with their latest stats. */
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("tracked_channels")
      .select("channel_id, added_at, channels(title, handle, thumbnail)")
      .eq("user_id", auth.user.id)
      .order("added_at");
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    const ids = rows.map((r) => r.channel_id);

    const since = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
    const snaps = new Map<string, Snapshot[]>();
    if (ids.length) {
      const { data: s, error: e2 } = await db
        .from("channel_snapshots")
        .select(
          "channel_id, taken_on, subscribers, hidden_subscribers, views, videos",
        )
        .in("channel_id", ids)
        .gte("taken_on", since);
      if (e2) throw e2;
      for (const r of (s ?? []) as (Snapshot & { channel_id: string })[]) {
        const list = snaps.get(r.channel_id) ?? [];
        list.push(r);
        snaps.set(r.channel_id, list);
      }
    }

    const channels: TrackedChannel[] = rows.map((r) => {
      const list = (snaps.get(r.channel_id) ?? []).sort((a, b) =>
        a.taken_on.localeCompare(b.taken_on),
      );
      return {
        channelId: r.channel_id,
        title: r.channels?.title ?? r.channel_id,
        handle: r.channels?.handle ?? null,
        thumbnail: r.channels?.thumbnail ?? null,
        addedAt: r.added_at,
        latest: list.at(-1) ?? null,
        change7: subscriberChange(list, 7),
        change30: subscriberChange(list, 30),
      };
    });
    return NextResponse.json(
      { channels },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

/** Track a channel from a URL, @handle, channel ID or video URL. */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { input?: unknown };
  const ref =
    typeof body.input === "string" ? parseChannelInput(body.input) : null;
  if (!ref)
    return jsonError(
      400,
      "Paste a channel link, @handle, channel ID or video link.",
    );

  try {
    const item = await lookupChannel(ref);
    if (!item) return jsonError(404, "Couldn't find that channel.");
    const db = createAdminClient();
    await saveChannel(db, item);
    const { error } = await db
      .from("tracked_channels")
      .upsert(
        { user_id: auth.user.id, channel_id: item.id },
        { ignoreDuplicates: true },
      );
    if (error) throw error;
    // Index the newest uploads now; the daily job finishes the archive.
    const sync = await syncUploads(db, item.id, 6);
    return NextResponse.json({
      channelId: item.id,
      title: item.snippet.title,
      sync,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Stop tracking a channel (?id=UC...). Its shared data stays cached. */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError(400, "Missing id.");
  try {
    const { error } = await createAdminClient()
      .from("tracked_channels")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("channel_id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

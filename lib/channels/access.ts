import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function userTracks(
  db: SupabaseClient,
  userId: string,
  channelId: string,
) {
  const { data, error } = await db
    .from("tracked_channels")
    .select("channel_id")
    .eq("user_id", userId)
    .eq("channel_id", channelId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

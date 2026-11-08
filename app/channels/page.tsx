import type { Metadata } from "next";
import { Suspense } from "react";
import { ChannelsClient } from "./channels-client";

export const metadata: Metadata = {
  title: "Channels — YouStats",
  description:
    "Track subscriber growth and search the full archive of any YouTube channel.",
};

export default function ChannelsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
      <Suspense fallback={<p className="text-muted text-sm">Loading…</p>}>
        <ChannelsClient />
      </Suspense>
    </main>
  );
}

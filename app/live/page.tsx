import type { Metadata } from "next";
import { LiveClient } from "./live-client";

export const metadata: Metadata = {
  title: "Live — YouStats",
  description:
    "Live streams from channels you track, and alerts by web push or Discord.",
};

export default function LivePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Live
      </h1>
      <p className="text-muted mt-3 max-w-2xl leading-relaxed">
        Streams from channels you track, and alerts when they schedule or start
        one.
      </p>
      <LiveClient />
    </main>
  );
}

import type { Metadata } from "next";
import { InsightsClient } from "./insights-client";

export const metadata: Metadata = {
  title: "Watch-time insights — YouStats",
  description:
    "Upload your Google Takeout watch history and see when and what you watch. Parsed in your browser.",
};

export default function InsightsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Watch-time insights
      </h1>
      <p className="text-muted mt-3 max-w-2xl leading-relaxed">
        Upload <code className="font-mono text-sm">watch-history.json</code>{" "}
        from Google Takeout. The file is read in your browser and never leaves
        your device.
      </p>
      <InsightsClient />
    </main>
  );
}

import type { Metadata } from "next";
import { SubscriptionsClient } from "./subscriptions-client";

export const metadata: Metadata = {
  title: "Subscriptions — YouStats",
  description:
    "Every channel you follow and how long you have been subscribed.",
};

export default function SubscriptionsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Subscriptions
      </h1>
      <p className="text-muted mt-3 max-w-2xl leading-relaxed">
        Every channel you follow, when you subscribed, and your channel
        memberships.
      </p>
      <SubscriptionsClient />
    </main>
  );
}

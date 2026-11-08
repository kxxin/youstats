import Link from "next/link";

const features = [
  {
    stage: 1,
    title: "Watch-time insights",
    body: "Upload your Google Takeout watch history to see when you watch, how much, and which channels you return to most. Parsed in your browser.",
  },
  {
    stage: 2,
    title: "Subscriptions timeline",
    body: "Sign in with Google to see every channel you follow and how long you have been subscribed.",
  },
  {
    stage: 3,
    title: "Channel tracker",
    body: "Daily snapshots of subscriber and view counts, plus full-text search across a channel's uploads.",
  },
  {
    stage: 4,
    title: "Live-stream alerts",
    body: "Get a web push or Discord message when a channel you track schedules or starts a live stream.",
  },
  {
    stage: 5,
    title: "Live transcript",
    body: "Stretch goal: transcribe a live stream's tab audio in the browser with Whisper.",
  },
] as const;

const CURRENT_STAGE = 3;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-8 sm:py-24">
      <header className="max-w-2xl">
        <p className="text-accent font-mono text-sm tracking-wide">
          YouStats · personal YouTube analytics
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Understand how you really use YouTube.
        </h1>
        <p className="text-muted mt-5 text-lg leading-relaxed">
          Watch time, subscriptions, channel growth and live alerts — in one
          dashboard built on your own data.
        </p>
        <p className="border-border bg-card text-muted mt-8 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
          <span className="bg-accent size-2 rounded-full" aria-hidden />
          In development — Stage {CURRENT_STAGE} of 5
        </p>
        <div className="mt-6">
          <Link
            href="/insights"
            className="bg-accent inline-block rounded-lg px-4 py-2 text-sm font-medium text-white dark:text-black"
          >
            Analyse your watch history →
          </Link>
        </div>
      </header>

      <section aria-labelledby="roadmap" className="mt-16">
        <h2 id="roadmap" className="text-muted text-sm font-medium">
          Roadmap
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li
              key={f.stage}
              className="border-border bg-card rounded-xl border p-5"
            >
              <span className="text-accent font-mono text-xs">
                Stage {f.stage}
              </span>
              <h3 className="mt-2 font-semibold">{f.title}</h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                {f.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-muted mt-auto pt-16 text-xs">
        Not affiliated with or endorsed by YouTube or Google. Data comes from
        your own Google Takeout export and the YouTube Data API.
      </footer>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";
import type {
  ArchiveVideo,
  ChannelDetail,
  Snapshot,
  TrackedChannel,
} from "@/lib/channels/types";
import { supabaseConfigured } from "@/lib/supabase/client";
import { signInWithGoogle, useUser } from "@/lib/supabase/use-user";

const nf = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const axisFmt = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumSignificantDigits: 4,
});

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function ChannelsClient() {
  const user = useUser();
  const selected = useSearchParams().get("c");

  if (!supabaseConfigured) {
    return (
      <p className="text-muted text-sm">
        Sign-in isn&apos;t configured on this deployment.
      </p>
    );
  }
  if (user === undefined) return <p className="text-muted text-sm">Loading…</p>;
  if (!user) {
    return (
      <>
        <Heading />
        <div className="border-border bg-card mt-8 rounded-xl border p-6">
          <p className="font-medium">Sign in to track channels</p>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="bg-accent mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white dark:text-black"
          >
            Sign in with Google
          </button>
        </div>
      </>
    );
  }
  return selected ? <ChannelView id={selected} /> : <ChannelList />;
}

function Heading() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Channels
      </h1>
      <p className="text-muted mt-3 max-w-2xl leading-relaxed">
        Track subscriber growth and search a channel&apos;s full archive. Stats
        are saved once a day, so growth history starts the day you add a
        channel.
      </p>
    </>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return (
    <span className="tabular-nums">
      {sign}
      {compact.format(Math.abs(value))}
    </span>
  );
}

function ChannelList() {
  const [channels, setChannels] = useState<TrackedChannel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");

  const load = () =>
    api<{ channels: TrackedChannel[] }>("/api/channels")
      .then((r) => setChannels(r.channels))
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await api("/api/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      setInput("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add channel.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    await api(`/api/channels?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch((e: Error) => setError(e.message));
    await load();
  }

  return (
    <>
      <Heading />
      <form onSubmit={add} className="mt-8 flex flex-wrap gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Channel link, @handle or video link"
          aria-label="Channel to track"
          className="border-border bg-card min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={adding}
          className="bg-accent rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-black"
        >
          {adding ? "Adding and indexing…" : "Track channel"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {channels === null ? (
        <p className="text-muted mt-8 text-sm">Loading…</p>
      ) : channels.length === 0 ? (
        <p className="text-muted mt-8 text-sm">No channels tracked yet.</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {channels.map((c) => (
            <li
              key={c.channelId}
              className="border-border bg-card rounded-xl border p-4"
            >
              <div className="flex items-center gap-3">
                {c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbnail}
                    alt=""
                    className="size-10 shrink-0 rounded-full"
                  />
                ) : (
                  <span className="bg-grid size-10 shrink-0 rounded-full" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/channels?c=${c.channelId}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  <span className="text-muted block truncate text-xs">
                    {c.handle}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => remove(c.channelId)}
                  className="text-muted hover:text-foreground text-xs underline underline-offset-4"
                >
                  Untrack
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted text-xs">Subscribers</dt>
                  <dd className="font-semibold tabular-nums">
                    {c.latest?.hidden_subscribers
                      ? "Hidden"
                      : c.latest?.subscribers != null
                        ? compact.format(c.latest.subscribers)
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">7 days</dt>
                  <dd>
                    <Delta value={c.change7} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">30 days</dt>
                  <dd>
                    <Delta value={c.change30} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ChannelView({ id }: { id: string }) {
  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ChannelDetail>(`/api/channels/detail?id=${encodeURIComponent(id)}`)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  return (
    <>
      <Link href="/channels" className="text-accent text-sm">
        ← All channels
      </Link>
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {!detail && !error && <p className="text-muted mt-6 text-sm">Loading…</p>}
      {detail && <ChannelDetailView d={detail} />}
    </>
  );
}

function ChannelDetailView({ d }: { d: ChannelDetail }) {
  const latest = d.snapshots.at(-1);
  return (
    <>
      <div className="mt-4 flex items-center gap-4">
        {d.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.thumbnail} alt="" className="size-14 rounded-full" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {d.title}
          </h1>
          <a
            href={`https://www.youtube.com/channel/${d.channelId}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted text-sm hover:underline"
          >
            {d.handle ?? d.channelId} ↗
          </a>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Subscribers"
          value={
            latest?.hidden_subscribers
              ? "Hidden"
              : latest?.subscribers != null
                ? nf.format(latest.subscribers)
                : "—"
          }
        />
        <Tile
          label="Total views"
          value={latest?.views != null ? compact.format(latest.views) : "—"}
        />
        <Tile
          label="Videos"
          value={latest?.videos != null ? nf.format(latest.videos) : "—"}
        />
        <Tile
          label="Indexed for search"
          value={nf.format(d.indexed.videos)}
          note={
            d.indexed.complete
              ? `full archive · ${nf.format(d.indexed.streams)} streams`
              : "older uploads are added daily"
          }
        />
      </dl>

      <section className="border-border bg-card mt-4 rounded-xl border p-5">
        <h2 className="font-semibold">Subscriber growth</h2>
        <p className="text-muted mt-0.5 text-xs">
          One point per day. YouTube rounds public counts (e.g. 1.23M), so small
          changes on big channels show as steps.
        </p>
        <div className="mt-4">
          <GrowthChart snapshots={d.snapshots} />
        </div>
      </section>

      <ArchiveSearch channelId={d.channelId} />
    </>
  );
}

function GrowthChart({ snapshots }: { snapshots: Snapshot[] }) {
  const pts = snapshots.filter((s) => s.subscribers !== null) as (Snapshot & {
    subscribers: number;
  })[];
  const [hover, setHover] = useState<number | null>(null);

  if (pts.length < 2) {
    return (
      <p className="text-muted text-sm">
        The chart appears after the second daily snapshot
        {pts.length === 1
          ? ` (first: ${dateFmt.format(new Date(pts[0].taken_on))}).`
          : "."}
      </p>
    );
  }

  const values = pts.map((p) => p.subscribers);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  lo -= pad;
  hi += pad;
  const W = 1000;
  const H = 200;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const d = pts
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.subscribers).toFixed(1)}`,
    )
    .join("");
  const h = hover === null ? null : pts.at(hover);

  return (
    <div className="flex gap-2">
      <div className="text-muted flex h-[200px] flex-col justify-between text-right text-xs tabular-nums">
        <span>{axisFmt.format(hi)}</span>
        <span>{axisFmt.format((hi + lo) / 2)}</span>
        <span>{axisFmt.format(lo)}</span>
      </div>
      <div className="flex-1">
        <div
          className="relative h-[200px]"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const f = (e.clientX - r.left) / r.width;
            setHover(
              Math.max(
                0,
                Math.min(pts.length - 1, Math.round(f * (pts.length - 1))),
              ),
            );
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-label="Subscriber count over time"
            role="img"
          >
            {[0, H / 2, H].map((gy) => (
              <line
                key={gy}
                x1={0}
                x2={W}
                y1={gy}
                y2={gy}
                className="stroke-grid"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path
              d={d}
              fill="none"
              className="stroke-chart"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={0}
                y2={H}
                className="stroke-muted"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {h && hover !== null && (
            <>
              <span
                className="bg-chart ring-card pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                style={{
                  left: `${(x(hover) / W) * 100}%`,
                  top: `${(y(h.subscribers) / H) * 100}%`,
                }}
              />
              <div
                className="border-border bg-card pointer-events-none absolute top-1 z-10 rounded-lg border px-3 py-2 text-xs shadow-sm"
                style={
                  hover / (pts.length - 1) > 0.6
                    ? { right: `${(1 - x(hover) / W) * 100 + 1}%` }
                    : { left: `${(x(hover) / W) * 100 + 1}%` }
                }
              >
                <p className="font-medium">
                  {dateFmt.format(new Date(h.taken_on))}
                </p>
                <p className="text-muted tabular-nums">
                  {nf.format(h.subscribers)} subscribers
                </p>
              </div>
            </>
          )}
        </div>
        <div className="text-muted mt-2 flex justify-between text-xs">
          <span>{dateFmt.format(new Date(pts[0].taken_on))}</span>
          <span>{dateFmt.format(new Date(pts[pts.length - 1].taken_on))}</span>
        </div>
      </div>
    </div>
  );
}

type ArchiveType = "all" | "videos" | "streams";

function ArchiveSearch({ channelId }: { channelId: string }) {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [type, setType] = useState<ArchiveType>("all");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<{
    videos: ArchiveVideo[];
    total: number;
    pageSize: number;
    mode: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      id: channelId,
      q: submitted,
      type,
      page: String(page),
    });
    let cancelled = false;
    api<{
      videos: ArchiveVideo[];
      total: number;
      pageSize: number;
      mode: string;
    }>(`/api/channels/search?${params}`)
      .then((r) => {
        if (!cancelled) setRes(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, submitted, type, page]);

  const pages = res ? Math.ceil(res.total / res.pageSize) : 0;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">Archive search</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSubmitted(q);
        }}
        className="mt-3 flex flex-wrap gap-3"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Search titles and descriptions, e.g. minecraft -shorts or "karaoke"'
          aria-label="Search the archive"
          className="border-border bg-card min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <div
          role="radiogroup"
          aria-label="Type"
          className="border-border bg-card inline-flex rounded-lg border p-0.5"
        >
          {(
            [
              ["all", "All"],
              ["videos", "Videos"],
              ["streams", "Streams"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={type === id}
              onClick={() => {
                setPage(0);
                setType(id);
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                type === id ? "bg-accent-soft font-medium" : "text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {res && (
        <>
          <p className="text-muted mt-3 text-xs">
            {nf.format(res.total)} {res.total === 1 ? "result" : "results"}
            {res.mode === "substring" && " (title match)"} · newest first
          </p>
          <ul className="border-border bg-card divide-border mt-2 divide-y rounded-xl border">
            {res.videos.map((v) => (
              <li
                key={v.video_id}
                className="flex items-start gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={`https://www.youtube.com/watch?v=${v.video_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {v.title}
                  </a>
                  <span className="text-muted block text-xs">
                    {dateFmt.format(new Date(v.published_at))}
                    {v.duration_sec
                      ? ` · ${formatDuration(v.duration_sec)}`
                      : ""}
                  </span>
                </div>
                {v.was_live && (
                  <span className="bg-accent-soft shrink-0 rounded-full px-2 py-0.5 text-xs">
                    Stream
                  </span>
                )}
              </li>
            ))}
            {res.videos.length === 0 && (
              <li className="text-muted px-4 py-3 text-sm">No videos match.</li>
            )}
          </ul>
          {pages > 1 && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="border-border rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                Newer
              </button>
              <span className="text-muted tabular-nums">
                Page {page + 1} of {pages}
              </span>
              <button
                type="button"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="border-border rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                Older
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
      {note && <dd className="text-muted mt-0.5 text-xs">{note}</dd>}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { formatSpan } from "@/lib/format";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { signInWithGoogle, useUser } from "@/lib/supabase/use-user";
import { fetchSubscriptions } from "@/lib/youtube/client";
import type { Subscription } from "@/lib/youtube/types";

const nf = new Intl.NumberFormat("en");
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
type Sort = "oldest" | "newest" | "az";

export function SubscriptionsClient() {
  const user = useUser();

  if (!supabaseConfigured) {
    return (
      <p className="text-muted mt-8 text-sm">
        Sign-in isn&apos;t configured on this deployment yet (Supabase
        environment variables are missing).
      </p>
    );
  }
  if (user === undefined)
    return <p className="text-muted mt-8 text-sm">Loading…</p>;
  if (!user) {
    return (
      <div className="border-border bg-card mt-8 rounded-xl border p-6">
        <p className="font-medium">Sign in to see your subscriptions</p>
        <p className="text-muted mt-1 text-sm">
          YouStats asks for read-only access to YouTube (subscriptions) and
          Google Drive (to import scheduled Takeout exports).
        </p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="bg-accent mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white dark:text-black"
        >
          Sign in with Google
        </button>
      </div>
    );
  }
  return (
    <>
      <SubscriptionList />
      <Memberships />
    </>
  );
}

function SubscriptionList() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("oldest");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    fetchSubscriptions()
      .then(setSubs)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load."),
      );
  }, []);

  const stats = useMemo(() => {
    if (!subs?.length) return null;
    const sorted = [...subs].sort((a, b) =>
      a.subscribedAt.localeCompare(b.subscribedAt),
    );
    const yearAgo = now - 365 * 864e5;
    const perYear = new Map<number, number>();
    for (const s of subs) {
      const y = new Date(s.subscribedAt).getFullYear();
      perYear.set(y, (perYear.get(y) ?? 0) + 1);
    }
    const years = [...perYear.entries()].sort((a, b) => a[0] - b[0]);
    return {
      oldest: sorted.at(0)!,
      lastYear: subs.filter((s) => Date.parse(s.subscribedAt) > yearAgo).length,
      years,
      maxYear: Math.max(...years.map(([, n]) => n)),
    };
  }, [subs, now]);

  const shown = useMemo(() => {
    if (!subs) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? subs.filter((s) => s.title.toLowerCase().includes(q))
      : [...subs];
    return list.sort((a, b) =>
      sort === "az"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.subscribedAt.localeCompare(b.subscribedAt)
          : b.subscribedAt.localeCompare(a.subscribedAt),
    );
  }, [subs, query, sort]);

  if (error) {
    return (
      <div className="mt-8 text-sm">
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="text-accent mt-2 underline underline-offset-4"
        >
          Sign in again
        </button>
      </div>
    );
  }
  if (!subs)
    return <p className="text-muted mt-8 text-sm">Loading subscriptions…</p>;
  if (!stats)
    return (
      <p className="text-muted mt-8 text-sm">You have no subscriptions.</p>
    );

  return (
    <section className="mt-8">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Channels subscribed" value={nf.format(subs.length)} />
        <Tile
          label="Longest subscription"
          value={formatSpan(new Date(stats.oldest.subscribedAt))}
          note={stats.oldest.title}
        />
        <Tile
          label="Added in the last 12 months"
          value={nf.format(stats.lastYear)}
        />
      </dl>

      <div className="border-border bg-card mt-4 rounded-xl border p-5">
        <h2 className="font-semibold">New subscriptions per year</h2>
        <ol className="mt-4 space-y-1.5">
          {stats.years.map(([year, n]) => (
            <li
              key={year}
              className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3 text-sm"
            >
              <span className="text-muted tabular-nums">{year}</span>
              <div className="h-2">
                <div
                  className="bg-chart h-full rounded-r-[4px]"
                  style={{ width: `${(n / stats.maxYear) * 100}%` }}
                />
              </div>
              <span className="text-muted text-right text-xs tabular-nums">
                {nf.format(n)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels"
          aria-label="Search channels"
          className="border-border bg-card min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort"
          className="border-border bg-card rounded-lg border px-3 py-2 text-sm"
        >
          <option value="oldest">Longest subscribed</option>
          <option value="newest">Newest first</option>
          <option value="az">A–Z</option>
        </select>
      </div>

      <ul className="border-border bg-card divide-border mt-3 divide-y rounded-xl border">
        {shown.map((s) => (
          <li key={s.channelId} className="flex items-center gap-3 px-4 py-3">
            {s.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.thumbnail}
                alt=""
                className="size-9 shrink-0 rounded-full"
              />
            ) : (
              <span className="bg-grid size-9 shrink-0 rounded-full" />
            )}
            <div className="min-w-0 flex-1">
              <a
                href={`https://www.youtube.com/channel/${s.channelId}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-medium hover:underline"
              >
                {s.title}
              </a>
              <span className="text-muted text-xs">
                since {dateFmt.format(new Date(s.subscribedAt))}
              </span>
            </div>
            <span className="text-muted shrink-0 text-sm tabular-nums">
              {formatSpan(new Date(s.subscribedAt))}
            </span>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="text-muted px-4 py-3 text-sm">No matches.</li>
        )}
      </ul>
    </section>
  );
}

interface Membership {
  id: string;
  channel_name: string;
  channel_url: string | null;
  tier: string | null;
  started_on: string;
  ended_on: string | null;
}

function Memberships() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const { data, error } = await supabase
      .from("memberships")
      .select("id, channel_name, channel_url, tier, started_on, ended_on")
      .order("started_on", { ascending: true });
    if (error) setError(error.message);
    else setItems(data as Membership[]);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(form: FormData) {
    setSaving(true);
    setError(null);
    const str = (k: string) => {
      const v = String(form.get(k) ?? "").trim();
      return v || null;
    };
    const { error } = await supabase.from("memberships").insert({
      channel_name: str("channel_name"),
      channel_url: str("channel_url"),
      tier: str("tier"),
      started_on: str("started_on"),
      ended_on: str("ended_on"),
    });
    setSaving(false);
    if (error) setError(error.message);
    else await refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("memberships").delete().eq("id", id);
    if (error) setError(error.message);
    else await refresh();
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">Memberships</h2>
      <p className="text-muted mt-1 text-sm">
        YouTube doesn&apos;t share your channel memberships with apps, so add
        them here.
      </p>

      {items && items.length > 0 && (
        <ul className="border-border bg-card divide-border mt-4 divide-y rounded-xl border">
          {items.map((m) => {
            const start = new Date(`${m.started_on}T00:00:00`);
            const end = m.ended_on
              ? new Date(`${m.ended_on}T00:00:00`)
              : new Date();
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  {m.channel_url ? (
                    <a
                      href={m.channel_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {m.channel_name}
                    </a>
                  ) : (
                    <span className="font-medium">{m.channel_name}</span>
                  )}
                  {m.tier && <span className="text-muted"> · {m.tier}</span>}
                  <span className="text-muted block text-xs">
                    {dateFmt.format(start)} –{" "}
                    {m.ended_on ? dateFmt.format(end) : "now"}
                  </span>
                </div>
                <span className="tabular-nums">{formatSpan(start, end)}</span>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="text-muted hover:text-foreground text-xs underline underline-offset-4"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        action={add}
        className="border-border bg-card mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
      >
        <Field label="Channel name" name="channel_name" required />
        <Field label="Channel URL (optional)" name="channel_url" type="url" />
        <Field label="Tier (optional)" name="tier" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Started" name="started_on" type="date" required />
          <Field label="Ended (blank = active)" name="ended_on" type="date" />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-black"
          >
            {saving ? "Saving…" : "Add membership"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-muted flex flex-col gap-1 text-xs">
      {props.label}
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        className="border-border bg-background text-foreground rounded-lg border px-3 py-2 text-sm"
      />
    </label>
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
      {note && <dd className="text-muted mt-0.5 truncate text-xs">{note}</dd>}
    </div>
  );
}

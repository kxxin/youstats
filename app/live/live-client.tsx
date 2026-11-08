"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  currentPushSubscription,
  disablePush,
  enablePush,
  pushSupported,
} from "@/lib/alerts/push-client";
import type {
  AlertChannel,
  AlertSettings,
  LiveEvent,
} from "@/lib/alerts/types";
import { supabaseConfigured } from "@/lib/supabase/client";
import { signInWithGoogle, useUser } from "@/lib/supabase/use-user";

const timeFmt = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relative(iso: string) {
  const diff = Date.parse(iso) - Date.now();
  const mins = Math.round(diff / 60_000);
  if (Math.abs(mins) < 60) return rel.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rel.format(hours, "hour");
  return rel.format(Math.round(hours / 24), "day");
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function LiveClient() {
  const user = useUser();
  if (!supabaseConfigured) {
    return (
      <p className="text-muted mt-8 text-sm">
        Sign-in isn&apos;t configured on this deployment.
      </p>
    );
  }
  if (user === undefined)
    return <p className="text-muted mt-8 text-sm">Loading…</p>;
  if (!user) {
    return (
      <div className="border-border bg-card mt-8 rounded-xl border p-6">
        <p className="font-medium">Sign in to get live alerts</p>
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
      <Feed />
      <div className="mt-10 grid gap-6 lg:grid-cols-5">
        <AlertChannels />
        <Delivery />
      </div>
    </>
  );
}

function Feed() {
  const [feed, setFeed] = useState<{
    live: LiveEvent[];
    upcoming: LiveEvent[];
    recent: LiveEvent[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api<{ live: LiveEvent[]; upcoming: LiveEvent[]; recent: LiveEvent[] }>(
        "/api/alerts/feed",
      )
        .then(setFeed)
        .catch((e: Error) => setError(e.message));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (error)
    return (
      <p role="alert" className="mt-8 text-sm text-red-700 dark:text-red-400">
        {error}
      </p>
    );
  if (!feed) return <p className="text-muted mt-8 text-sm">Loading…</p>;

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      <EventList
        title="Live now"
        empty="Nobody you track is live."
        events={feed.live}
        meta={(e) =>
          e.actual_start ? `started ${relative(e.actual_start)}` : "live"
        }
        badge
      />
      <EventList
        title="Upcoming"
        empty="No scheduled streams."
        events={feed.upcoming}
        meta={(e) =>
          e.scheduled_start
            ? `${timeFmt.format(new Date(e.scheduled_start))} · ${relative(e.scheduled_start)}`
            : "scheduled"
        }
      />
      <div className="md:col-span-2">
        <EventList
          title="Recent"
          empty="Nothing yet. Events appear here once alerts are on for a channel."
          events={feed.recent}
          meta={(e) =>
            e.status === "ended" && e.actual_end
              ? `stream ended ${relative(e.actual_end)}`
              : `seen ${relative(e.first_seen_at)}`
          }
        />
      </div>
    </div>
  );
}

function EventList(props: {
  title: string;
  empty: string;
  events: LiveEvent[];
  meta: (e: LiveEvent) => string;
  badge?: boolean;
}) {
  return (
    <section className="border-border bg-card rounded-xl border p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        {props.badge && props.events.length > 0 && (
          <span className="size-2 rounded-full bg-red-600" aria-hidden />
        )}
        {props.title}
      </h2>
      {props.events.length === 0 ? (
        <p className="text-muted mt-3 text-sm">{props.empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {props.events.map((e) => (
            <li key={e.video_id} className="flex gap-3 text-sm">
              {e.channels?.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.channels.thumbnail}
                  alt=""
                  className="size-8 shrink-0 rounded-full"
                />
              ) : (
                <span className="bg-grid size-8 shrink-0 rounded-full" />
              )}
              <div className="min-w-0">
                <a
                  href={`https://www.youtube.com/watch?v=${e.video_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-2 hover:underline"
                >
                  {e.title}
                </a>
                <span className="text-muted block text-xs">
                  {e.channels?.title} · {props.meta(e)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Flag = "live" | "scheduled" | "uploads";
const FLAGS: { id: Flag; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "scheduled", label: "Scheduled" },
  { id: "uploads", label: "Uploads" },
];

function AlertChannels() {
  const [channels, setChannels] = useState<AlertChannel[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ channels: AlertChannel[] }>("/api/alerts/channels")
        .then((r) => setChannels(r.channels))
        .catch((e: Error) => setNote(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(c: AlertChannel, flag: Flag) {
    const next = !c[flag];
    setChannels(
      (list) =>
        list?.map((x) =>
          x.channelId === c.channelId ? { ...x, [flag]: next } : x,
        ) ?? null,
    );
    try {
      const r = await api<{ note: string | null }>("/api/alerts/channels", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId: c.channelId, [flag]: next }),
      });
      setNote(r.note);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed to save.");
    }
    load();
  }

  return (
    <section className="lg:col-span-3">
      <h2 className="text-xl font-semibold">Alert me when…</h2>
      <p className="text-muted mt-1 text-sm">
        Live = a stream starts · Scheduled = a stream is announced · Uploads = a
        new video.
      </p>
      {channels === null ? (
        <p className="text-muted mt-4 text-sm">Loading…</p>
      ) : channels.length === 0 ? (
        <p className="text-muted mt-4 text-sm">
          Track a channel on the{" "}
          <Link
            href="/channels"
            className="text-accent underline underline-offset-4"
          >
            Channels
          </Link>{" "}
          page first.
        </p>
      ) : (
        <ul className="border-border bg-card divide-border mt-4 divide-y rounded-xl border">
          {channels.map((c) => (
            <li
              key={c.channelId}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {c.title}
                </span>
                {(c.live || c.scheduled || c.uploads) && (
                  <span className="text-muted text-xs">
                    {c.websub === "active"
                      ? "Listening for updates"
                      : c.websub === "pending"
                        ? "Connecting to YouTube…"
                        : "Not connected yet"}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {FLAGS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="switch"
                    aria-checked={c[f.id]}
                    aria-label={`${f.label} alerts for ${c.title}`}
                    onClick={() => toggle(c, f.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      c[f.id]
                        ? "border-accent bg-accent-soft font-medium"
                        : "border-border text-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-muted mt-2 text-xs">{note}</p>}
    </section>
  );
}

function Delivery() {
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [onThisDevice, setOnThisDevice] = useState<boolean | null>(null);
  const [webhook, setWebhook] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSettings(await api<AlertSettings>("/api/alerts/settings"));
      setOnThisDevice(!!(await currentPushSubscription()));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load settings.");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
  }, [load]);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await action();
      if (r) setMsg(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      load();
    }
  }

  return (
    <section className="lg:col-span-2">
      <h2 className="text-xl font-semibold">Send alerts to</h2>
      <div className="border-border bg-card mt-4 space-y-5 rounded-xl border p-4 text-sm">
        <div>
          <p className="font-medium">Browser notifications</p>
          <p className="text-muted mt-0.5 text-xs">
            {settings
              ? `${settings.pushDevices} device${settings.pushDevices === 1 ? "" : "s"} registered`
              : "…"}
            {settings &&
              !settings.pushConfigured &&
              " · not configured on the server"}
          </p>
          {pushSupported() ? (
            <button
              type="button"
              disabled={busy || onThisDevice === null}
              onClick={() =>
                run(async () => {
                  if (onThisDevice) {
                    await disablePush();
                    return "Turned off on this device.";
                  }
                  await enablePush();
                  return "Turned on for this device.";
                })
              }
              className="border-border mt-2 rounded-lg border px-3 py-1.5 disabled:opacity-60"
            >
              {onThisDevice
                ? "Turn off on this device"
                : "Turn on for this device"}
            </button>
          ) : (
            <p className="text-muted mt-2 text-xs">
              Not supported in this browser. On iPhone, add the site to your
              Home Screen first.
            </p>
          )}
        </div>

        <div>
          <p className="font-medium">Discord</p>
          <p className="text-muted mt-0.5 text-xs">
            {settings?.discordWebhook
              ? `Webhook ${settings.discordWebhook}`
              : "Not set"}
          </p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("/api/alerts/settings", {
                  method: "PUT",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ discordWebhookUrl: webhook || null }),
                });
                setWebhook("");
                return webhook
                  ? "Discord webhook saved."
                  : "Discord webhook removed.";
              });
            }}
          >
            <input
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              aria-label="Discord webhook URL"
              className="border-border bg-background min-w-0 flex-1 rounded-lg border px-3 py-1.5"
            />
            <button
              type="submit"
              disabled={busy}
              className="border-border rounded-lg border px-3 py-1.5 disabled:opacity-60"
            >
              {webhook || !settings?.discordWebhook ? "Save" : "Remove"}
            </button>
          </form>
          <p className="text-muted mt-1 text-xs">
            Discord → Server settings → Integrations → Webhooks → New webhook →
            Copy URL.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await api<{ results: string[] }>("/api/alerts/test", {
                method: "POST",
              });
              return r.results.length
                ? `Test sent: ${r.results.join(", ")}`
                : "Nothing set up yet — turn on a delivery method first.";
            })
          }
          className="bg-accent rounded-lg px-4 py-2 font-medium text-white disabled:opacity-60 dark:text-black"
        >
          Send test alert
        </button>
        {msg && (
          <p className="text-muted text-xs" aria-live="polite">
            {msg}
          </p>
        )}
      </div>
    </section>
  );
}

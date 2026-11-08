"use client";

import { useMemo, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";
import { parseWatchHistory, type ParseResult } from "@/lib/takeout/parse";
import {
  estimateDurations,
  mostRewatched,
  summarize,
  topChannels,
  viewsOverTime,
  weekHourGrid,
  type Bucket,
  type ChannelStat,
} from "@/lib/takeout/stats";

type Range = "all" | "365" | "90" | "30";
const RANGES: { id: Range; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "365", label: "12 months" },
  { id: "90", label: "90 days" },
  { id: "30", label: "30 days" },
];

interface Loaded {
  result: ParseResult;
  source: "file" | "sample";
  fileName: string;
}

const nf = new Intl.NumberFormat("en");
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function InsightsClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(
    text: Promise<string>,
    source: Loaded["source"],
    fileName: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      const json: unknown = JSON.parse(await text);
      const result = parseWatchHistory(json);
      if (result.events.length === 0)
        throw new Error("No watch events found in this file.");
      setLoaded({ result, source, fileName });
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "That file isn't valid JSON. In Google Takeout, set the history format to JSON (the default is HTML)."
          : e instanceof Error
            ? e.message
            : "Could not read that file.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <UploadPanel
        busy={busy}
        error={error}
        onFile={(f) => load(f.text(), "file", f.name)}
        onSample={() =>
          load(
            fetch("/sample-watch-history.json").then((r) => r.text()),
            "sample",
            "sample data",
          )
        }
      />
    );
  }
  return <Dashboard loaded={loaded} onReset={() => setLoaded(null)} />;
}

function UploadPanel(props: {
  busy: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onSample: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <section className="mt-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files.item(0);
          if (f) props.onFile(f);
        }}
        className={`bg-card flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          over ? "border-accent" : "border-border"
        }`}
      >
        <p className="font-medium">Drop watch-history.json here</p>
        <p className="text-muted mt-1 text-sm">
          Found in Takeout → YouTube and YouTube Music → history
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={props.busy}
            onClick={() => input.current?.click()}
            className="bg-accent rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-black"
          >
            {props.busy ? "Reading…" : "Choose file"}
          </button>
          <button
            type="button"
            disabled={props.busy}
            onClick={props.onSample}
            className="border-border rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Try sample data
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.item(0);
            if (f) props.onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {props.error && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
          {props.error}
        </p>
      )}
      <details className="text-muted mt-6 text-sm">
        <summary className="cursor-pointer">How to get the file</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>Open takeout.google.com and click “Deselect all”.</li>
          <li>Tick “YouTube and YouTube Music”.</li>
          <li>Under “All YouTube data included”, keep only “history”.</li>
          <li>Under “Multiple formats”, set history to JSON.</li>
          <li>Export, download the zip, and unzip watch-history.json.</li>
        </ol>
      </details>
    </section>
  );
}

function Dashboard({
  loaded,
  onReset,
}: {
  loaded: Loaded;
  onReset: () => void;
}) {
  const [range, setRange] = useState<Range>("365");
  const [includeMusic, setIncludeMusic] = useState(true);
  const all = loaded.result.events;
  const hasMusic = useMemo(() => all.some((e) => e.product === "music"), [all]);

  const view = useMemo(() => {
    const lastTime = all.at(-1)?.time.getTime() ?? 0;
    const from = range === "all" ? -Infinity : lastTime - Number(range) * 864e5;
    const events = all.filter(
      (e) => e.time.getTime() > from && (includeMusic || e.product !== "music"),
    );
    const durations = estimateDurations(events);
    const summary = summarize(events, durations);
    const spanDays =
      summary.first && summary.last
        ? (summary.last.getTime() - summary.first.getTime()) / 864e5
        : 0;
    const unit: "day" | "month" = spanDays > 120 ? "month" : "day";
    return {
      summary,
      unit,
      buckets: viewsOverTime(events, durations, unit),
      grid: weekHourGrid(events),
      channels: topChannels(events, durations, 10),
      rewatched: mostRewatched(events, 5),
    };
  }, [all, range, includeMusic]);

  const s = view.summary;
  const linked = loaded.source === "file";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Time range"
          className="border-border bg-card inline-flex rounded-lg border p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="radio"
              aria-checked={range === r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                range === r.id ? "bg-accent-soft font-medium" : "text-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {hasMusic && (
          <label className="text-muted flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeMusic}
              onChange={(e) => setIncludeMusic(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Include YouTube Music
          </label>
        )}
        <button
          type="button"
          onClick={onReset}
          className="text-muted ml-auto text-sm underline underline-offset-4"
        >
          Load another file
        </button>
      </div>
      <p className="text-muted mt-3 text-xs">
        {loaded.fileName}
        {s.first &&
          s.last &&
          ` · ${dateFmt.format(s.first)} – ${dateFmt.format(s.last)}`}
        {loaded.result.skipped.ads > 0 &&
          ` · ${nf.format(loaded.result.skipped.ads)} ads excluded`}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Estimated watch time"
          value={formatDuration(s.estimatedSeconds)}
          note="estimate"
        />
        <Stat label="Videos watched" value={nf.format(s.views)} />
        <Stat label="Channels" value={nf.format(s.uniqueChannels)} />
        <Stat
          label="Per active day"
          value={formatDuration(
            s.activeDays ? s.estimatedSeconds / s.activeDays : 0,
          )}
          note={`${nf.format(s.activeDays)} active days`}
        />
      </dl>

      <Card
        title={`Views per ${view.unit}`}
        subtitle="Each bar counts videos started in that period."
      >
        <TimeChart buckets={view.buckets} unit={view.unit} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="When you watch"
          subtitle="Views by weekday and hour, in your local time."
        >
          <Heatmap grid={view.grid} />
        </Card>
        <Card className="lg:col-span-2" title="Most rewatched">
          {view.rewatched.length === 0 ? (
            <p className="text-muted text-sm">
              No video watched more than once.
            </p>
          ) : (
            <ol className="space-y-3">
              {view.rewatched.map((v) => (
                <li key={v.videoId} className="flex gap-3 text-sm">
                  <span className="text-muted w-8 shrink-0 font-mono tabular-nums">
                    {v.views}×
                  </span>
                  <span className="min-w-0">
                    {linked && v.url ? (
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {v.title}
                      </a>
                    ) : (
                      v.title
                    )}
                    {v.channelName && (
                      <span className="text-muted block truncate text-xs">
                        {v.channelName}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card title="Top channels" subtitle="Ranked by views; time is estimated.">
        <TopChannels channels={view.channels} linked={linked} />
      </Card>

      <p className="text-muted mt-6 text-xs leading-relaxed">
        How watch time is estimated: Takeout records when each video started,
        not how long you watched. Each view is credited the time until your next
        view, up to 30 minutes; the last view of a session counts as 8 minutes.
      </p>
    </div>
  );
}

function Stat({
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

function Card(props: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border-border bg-card mt-4 rounded-xl border p-5 ${props.className ?? ""}`}
    >
      <h2 className="font-semibold">{props.title}</h2>
      {props.subtitle && (
        <p className="text-muted mt-0.5 text-xs">{props.subtitle}</p>
      )}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function niceMax(n: number) {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * p >= n) ?? 10;
  return step * p;
}

const monthFmt = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
});
const dayFmt = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
});

function TimeChart({
  buckets,
  unit,
}: {
  buckets: Bucket[];
  unit: "day" | "month";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...buckets.map((b) => b.views)));
  const fmt = (d: Date) =>
    unit === "month" ? monthFmt.format(d) : dayFmt.format(d);
  const labelIdx = new Set([
    0,
    Math.floor((buckets.length - 1) / 2),
    buckets.length - 1,
  ]);
  const hovered = hover === null ? null : buckets.at(hover);

  return (
    <div>
      <div className="flex gap-2">
        <div className="text-muted flex h-44 flex-col justify-between text-right text-xs tabular-nums">
          <span>{nf.format(max)}</span>
          <span>{nf.format(max / 2)}</span>
          <span>0</span>
        </div>
        <div
          className="relative h-44 flex-1"
          onMouseLeave={() => setHover(null)}
        >
          <div
            className="absolute inset-0 flex flex-col justify-between"
            aria-hidden
          >
            <div className="border-grid border-t" />
            <div className="border-grid border-t" />
            <div className="border-grid border-t" />
          </div>
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {buckets.map((b, i) => (
              <div
                key={b.key}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className={`bg-chart w-full rounded-t-[4px] ${
                    hover !== null && hover !== i ? "opacity-50" : ""
                  }`}
                  style={{ height: `${(b.views / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          {hovered && hover !== null && (
            <div
              className="border-border bg-card pointer-events-none absolute top-1 z-10 rounded-lg border px-3 py-2 text-xs shadow-sm"
              style={
                hover / buckets.length > 0.6
                  ? { right: `${(1 - (hover + 1) / buckets.length) * 100}%` }
                  : { left: `${(hover / buckets.length) * 100}%` }
              }
            >
              <p className="font-medium">{fmt(hovered.start)}</p>
              <p className="text-muted tabular-nums">
                {nf.format(hovered.views)} views ·{" "}
                {formatDuration(hovered.seconds)}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="text-muted relative mt-2 ml-8 h-4 text-xs">
        {buckets.map((b, i) =>
          labelIdx.has(i) ? (
            <span
              key={b.key}
              className="absolute whitespace-nowrap"
              style={
                i === buckets.length - 1
                  ? { right: 0 }
                  : i === 0
                    ? { left: 0 }
                    : {
                        left: `${((i + 0.5) / buckets.length) * 100}%`,
                        transform: "translateX(-50%)",
                      }
              }
            >
              {fmt(b.start)}
            </span>
          ) : null,
        )}
      </div>
      <details className="mt-4 text-xs">
        <summary className="text-muted cursor-pointer">Show data table</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-normal">
                  {unit === "month" ? "Month" : "Day"}
                </th>
                <th className="py-1 text-right font-normal">Views</th>
                <th className="py-1 text-right font-normal">Est. time</th>
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map((b) => (
                <tr key={b.key} className="border-grid border-t">
                  <td className="py-1">{fmt(b.start)}</td>
                  <td className="py-1 text-right">{nf.format(b.views)}</td>
                  <td className="py-1 text-right">
                    {formatDuration(b.seconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Heatmap({ grid }: { grid: number[][] }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const value = hover ? (grid.at(hover.d)?.at(hover.h) ?? 0) : null;
  return (
    <div>
      <p
        className="text-muted mb-2 h-4 text-xs tabular-nums"
        aria-live="polite"
      >
        {hover && value !== null
          ? `${DAYS.at(hover.d)} ${String(hover.h).padStart(2, "0")}:00 – ${nf.format(value)} views`
          : "Hover a cell for details"}
      </p>
      <div className="flex gap-2" onMouseLeave={() => setHover(null)}>
        <div className="text-muted grid grid-rows-7 gap-[2px] text-xs">
          {DAYS.map((d) => (
            <span key={d} className="flex items-center leading-none">
              {d}
            </span>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
          {grid.map((row, d) =>
            row.map((v, h) => (
              <div
                key={`${d}-${h}`}
                onMouseEnter={() => setHover({ d, h })}
                className={`aspect-square rounded-[3px] ${v === 0 ? "bg-grid" : "bg-chart"} ${
                  hover && hover.d === d && hover.h === h
                    ? "ring-foreground ring-2"
                    : ""
                }`}
                style={
                  v === 0 ? undefined : { opacity: 0.15 + 0.85 * (v / max) }
                }
                title={`${DAYS.at(d)} ${h}:00 – ${v} views`}
              />
            )),
          )}
        </div>
      </div>
      <div className="text-muted mt-2 ml-9 flex justify-between text-xs">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      <div className="text-muted mt-3 flex items-center gap-2 text-xs">
        <span>Fewer</span>
        {[0.15, 0.36, 0.58, 0.79, 1].map((o) => (
          <span
            key={o}
            className="bg-chart size-3 rounded-[3px]"
            style={{ opacity: o }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function TopChannels({
  channels,
  linked,
}: {
  channels: ChannelStat[];
  linked: boolean;
}) {
  const max = Math.max(1, ...channels.map((c) => c.views));
  return (
    <ol className="space-y-2.5">
      {channels.map((c, i) => (
        <li
          key={c.key}
          className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 text-sm"
        >
          <span className="text-muted font-mono text-xs leading-5 tabular-nums">
            {i + 1}
          </span>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              {linked && c.url ? (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:underline"
                >
                  {c.name}
                </a>
              ) : (
                <span className="truncate">{c.name}</span>
              )}
              <span className="text-muted shrink-0 text-xs tabular-nums">
                {nf.format(c.views)} views · {formatDuration(c.seconds)}
              </span>
            </div>
            <div className="mt-1 h-2">
              <div
                className="bg-chart h-full rounded-r-[4px]"
                style={{ width: `${(c.views / max) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

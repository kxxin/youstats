// Generates public/sample-watch-history.json: synthetic, fictional data in
// Google Takeout format, used by the "Try sample data" button.
// Run: node scripts/make-sample.mjs
import { writeFileSync } from "node:fs";

let seed = 42;
const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const id = (
  n,
  alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789",
) => Array.from({ length: n }, () => pick(alphabet)).join("");

const channels = [
  [
    "Pixel Kitchen",
    9,
    [
      "15-minute fried rice",
      "Knife skills for beginners",
      "Kaya toast three ways",
    ],
  ],
  [
    "Circuit Notes",
    7,
    ["How transistors really work", "Building a tiny CPU", "Why ESP32?"],
  ],
  [
    "Lofi Orbit",
    6,
    ["Study beats to focus to", "Rainy night lofi mix"],
    "YouTube Music",
  ],
  [
    "Gradient Descent Daily",
    5,
    [
      "Attention explained visually",
      "Mamba vs Transformers",
      "Backprop by hand",
    ],
  ],
  ["Trail & Tread", 4, ["Bukit Gasing loop vlog", "Ultralight gear review"]],
  ["Retro Arcade Club", 3, ["Speedrun history", "Top 10 boss fights"]],
  ["Quiet Desk Setup", 2, ["Minimal desk tour", "Cable management guide"]],
  ["Daily Market Wrap", 2, ["Markets in 5 minutes", "What moved stocks today"]],
  ["Paper Fold Studio", 1, ["Origami crane", "Modular origami star"]],
  ["Night Sky Journal", 1, ["Finding Saturn tonight", "Meteor shower guide"]],
  ["Campus Life MY", 1, ["Final year survival tips", "Exam week vlog"]],
].map(([name, weight, titles, header = "YouTube"]) => ({
  name,
  weight,
  header,
  id: "UC" + id(22),
  // Many episodes per channel so rewatch counts look realistic
  videos: titles.flatMap((t) =>
    Array.from({ length: 12 }, (_, k) => ({
      t: k ? `${t} — part ${k + 1}` : t,
      v: id(11),
    })),
  ),
}));
const total = channels.reduce((s, c) => s + c.weight, 0);
const pickChannel = () => {
  let r = rand() * total;
  for (const c of channels) if ((r -= c.weight) < 0) return c;
  return channels[0];
};

const out = [];
const end = Date.UTC(2026, 10, 7, 15); // 7 Nov 2026
const start = Date.UTC(2025, 8, 1);
for (let day = start; day < end; day += 864e5) {
  const weekday = new Date(day).getUTCDay();
  const sessions = rand() < 0.15 ? 0 : weekday === 0 || weekday === 6 ? 3 : 2;
  for (let s = 0; s < sessions; s++) {
    // Malaysia evenings: 11:00-15:00 UTC = 19:00-23:00 MYT, plus some lunch breaks
    let t = day + (rand() < 0.75 ? 11 + rand() * 4 : 4 + rand() * 2) * 36e5;
    const n = 1 + Math.floor(rand() * 5);
    for (let k = 0; k < n; k++) {
      const c = pickChannel();
      const v = pick(c.videos);
      const url =
        c.header === "YouTube Music"
          ? "https://music.youtube.com"
          : "https://www.youtube.com";
      out.push({
        header: c.header,
        title: `Watched ${v.t}`,
        titleUrl: `${url}/watch?v=${v.v}`,
        subtitles: [
          { name: c.name, url: `https://www.youtube.com/channel/${c.id}` },
        ],
        time: new Date(t).toISOString(),
        products: ["YouTube"],
        activityControls: ["YouTube watch history"],
      });
      t += (3 + rand() * 20) * 6e4;
    }
  }
}
out.reverse(); // Takeout lists newest first
writeFileSync(
  new URL("../public/sample-watch-history.json", import.meta.url),
  JSON.stringify(out),
);
console.log(`wrote ${out.length} events`);

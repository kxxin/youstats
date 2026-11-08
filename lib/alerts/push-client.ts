"use client";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission, subscribe this browser and save it on the server. */
export async function enablePush() {
  if (!pushSupported())
    throw new Error("This browser doesn't support push notifications.");
  if (!VAPID)
    throw new Error("Push isn't configured on the server (VAPID key missing).");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Notifications were blocked for this site.");
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID),
    }));
  const res = await fetch("/api/alerts/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error("Couldn't save this device.");
}

export async function disablePush() {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await fetch("/api/alerts/push", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

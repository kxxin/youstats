// YouStats service worker: shows push alerts and opens the video on click.
self.addEventListener("push", (event) => {
  let data = { title: "YouStats", body: "", url: "/live" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      tag: data.url,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/live";
  event.waitUntil(self.clients.openWindow(url));
});

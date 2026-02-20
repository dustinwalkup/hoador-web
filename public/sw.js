/**
 * Minimal service worker for PWA push notifications.
 * Handles push and notificationclick only. Scope: /
 * Requirements: 2.1, 2.2, 2.3, 2.4, 7.7, 7.8
 */

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || "Notification";
  const body = payload.body || "";
  const linkUrl = payload.linkUrl || "/";
  const data = payload.data || {};
  const tag = data.type || "notification";

  const options = {
    body,
    data: { linkUrl, ...data },
    tag,
    icon: "/favicon.svg",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const linkUrl = event.notification.data?.linkUrl || "/";
  const urlToOpen = new URL(linkUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        if (windowClients.length > 0) {
          var client = windowClients[0];
          if (client.navigate) {
            return client.navigate(urlToOpen).then(function (c) {
              return c ? c.focus() : client.focus();
            });
          }
          return client.focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});

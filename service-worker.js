const CACHE_VERSION = "wheaterflow-v20260829-kmi-v2-2358";
const APP_CACHE = `${CACHE_VERSION}-app`;
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./style.css",
  "./script.js",
  "./castService.js",
  "./tvPairingService.js",
  "./manifest.webmanifest",
  "./assets/ui/onboarding/location.png",
  "./assets/ui/onboarding/bell.png",
  "./assets/ui/onboarding/profile.png",
  "./assets/ui/onboarding/check.png",
  "./assets/ui/onboarding/rain.png",
  "./assets/ui/onboarding/lightning.png",
  "./assets/ui/onboarding/warning.png",
  "./assets/ui/onboarding/calendar.png",
  "./assets/ui/onboarding/back.png",
  "./assets/branding/weerscoop-logo-master.png",
  "./assets/backgrounds/zonnig.png",
  "./assets/backgrounds/licht bewolkt.png",
  "./assets/backgrounds/Overwegend zonnig.png",
  "./assets/backgrounds/Half bewolkt.png",
  "./assets/backgrounds/Bewolkt.png",
  "./assets/backgrounds/Zwaarbewolkt.png",
  "./assets/backgrounds/Mist.png",
  "./assets/backgrounds/Nevel.png",
  "./assets/backgrounds/Motregen.png",
  "./assets/backgrounds/Lichte regen.png",
  "./assets/backgrounds/Regen.png",
  "./assets/backgrounds/Hevige regen.png",
  "./assets/backgrounds/Onweersbuien.png",
  "./assets/backgrounds/Zwaar onweer.png",
  "./assets/backgrounds/Hagel.png",
  "./assets/backgrounds/tv-night-clear.png",
  "./assets/backgrounds/tv-night-light-clouds.png",
  "./assets/backgrounds/tv-night-cloudy.png",
  "./assets/backgrounds/tv-night-heavy-clouds.png",
  "./assets/backgrounds/tv-drizzle.png",
  "./assets/backgrounds/tv-light-rain.png",
  "./assets/backgrounds/tv-rain.png",
  "./assets/backgrounds/tv-heavy-rain.png",
  "./assets/weather/night/01-night-clear.jpeg",
  "./assets/weather/night/02-night-mostly-clear.jpeg",
  "./assets/weather/night/03-night-partly-cloudy.jpeg",
  "./assets/weather/night/04-night-cloudy.jpeg",
  "./assets/weather/night/05-night-overcast.jpeg",
  "./assets/weather/night/06-night-fog.jpeg",
  "./assets/weather/night/07-night-mist.jpeg",
  "./assets/weather/night/08-night-drizzle.jpeg",
  "./assets/weather/night/09-night-light-rain.jpeg",
  "./assets/weather/night/10-night-rain.jpeg",
  "./assets/weather/night/11-night-heavy-rain.jpeg",
  "./assets/weather/night/12-night-rain-showers.jpeg",
  "./assets/weather/night/13-night-thunderstorm.jpeg",
  "./assets/weather/night/14-night-thunder-showers.jpeg",
  "./assets/weather/night/15-night-severe-thunderstorm.jpeg",
  "./assets/weather/night/16-night-hail.jpeg",
  "./assets/weather/night/17-night-sleet.jpeg",
  "./assets/weather/night/18-night-light-snow.jpeg",
  "./assets/weather/night/19-night-snow.jpeg",
  "./assets/weather/night/20-night-heavy-snow.jpeg",
  "./assets/moon/new-moon.jpg",
  "./assets/moon/young-crescent.jpg",
  "./assets/moon/first-quarter.jpg",
  "./assets/moon/waxing-moon.jpg",
  "./assets/moon/full-moon.jpg",
  "./assets/moon/waning-moon.jpg",
  "./assets/moon/last-quarter.jpg",
  "./assets/moon/earthshine-moon.jpg",
  "./assets/data/astro-events.json",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-167.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/badge-96.png",
  "./assets/ui/home/tv.png",
  "./assets/ui/home/settings.png",
  "./assets/ui/profile/location.png",
  "./assets/ui/profile/notifications.png",
  "./assets/ui/profile/preferences.png",
  "./assets/ui/profile/pro.png",
  "./assets/ui/profile/settings.png",
  "./assets/ui/profile/edit.png",
  "./assets/ui/profile/today.png",
  "./assets/ui/profile/forecast.png",
  "./assets/ui/profile/radar.png",
  "./assets/ui/profile/community.png",
  "./assets/ui/profile/profile.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => undefined))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => !key.startsWith(CACHE_VERSION)).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isLiveDataRequest(url) {
  return [
    "api.open-meteo.com",
    "geocoding-api.open-meteo.com",
    "air-quality-api.open-meteo.com",
    "marine-api.open-meteo.com",
    "api.rainviewer.com",
    "weatherflow-radar.leanderdevriendt.workers.dev",
    "api.dataplatform.knmi.nl",
    "aviationweather.gov",
    "api.wheaterflow.be"
  ].some(host => url.hostname.includes(host));
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isLiveDataRequest(url) || url.pathname.includes("/.netlify/functions/") || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(APP_CACHE).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html") || caches.match("./offline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const copy = response.clone();
        caches.open(APP_CACHE).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Wheaterflow",
      body: event.data?.text() || "Nieuwe weerinformatie beschikbaar."
    };
  }

  const title = data.title || "Wheaterflow";
  const options = {
    body: data.body || "",
    icon: data.icon || "./icons/icon-192.png",
    badge: data.badge || "./icons/badge-96.png",
    image: data.image,
    tag: data.tag || "wheaterflow-weather",
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.requireInteraction),
    data: {
      url: data.url || "./",
      type: data.type || "weather"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

/* Vorratio Service Worker – App-Shell offline verfügbar halten. */
const CACHE = "vorratio-v9";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./fonts/bricolage-grotesque-latin.woff2",
  "./fonts/bricolage-grotesque-latin-ext.woff2",
  "./fonts/figtree-latin.woff2",
  "./fonts/figtree-latin-ext.woff2",
  "./js/app.js",
  "./js/icons.js",
  "./js/storage.js",
  "./js/engine.js",
  "./js/kochbuch.js",
  "./js/angebote.js",
  "./js/ai.js",
  "./js/generator.js",
  "./js/scan.js",
  "./js/diktat.js",
  "./js/substitution.js",
  "./js/data/kerndb.js",
  "./js/data/rezepte-komplex.js",
  "./js/data/rezepte-tofu.js",
  "./js/data/rezepte-welt.js",
  "./js/data/rezepte-alltag.js",
  "./js/data/profil.js",
  "./js/data/angebote-demo.js",
  "./js/data/substitutionen.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first für die Shell (frische Updates), Cache-Fallback offline.
   Fremd-APIs (Claude, Open Food Facts) werden nie gecacht. */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Nur vollständige Antworten cachen: Teilinhalte (206) und Fehlerseiten
        // lehnt cache.put ab – ohne den Filter quittiert der Browser das mit
        // einer unbehandelten Rejection in der Konsole.
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

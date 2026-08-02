/* Vorratio Service Worker – App-Shell offline verfügbar halten. */
const CACHE = "vorratio-v10";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./fonts/bricolage-grotesque-latin.woff2",
  "./fonts/bricolage-grotesque-latin-ext.woff2",
  "./fonts/figtree-latin.woff2",
  "./fonts/figtree-latin-ext.woff2",
  "./js/app.js",
  "./js/ui.js",
  "./js/kochmodus.js",
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
  "./js/data/allergene.js",
  "./js/data/rezepte-komplex.js",
  "./js/data/rezepte-tofu.js",
  "./js/data/rezepte-welt.js",
  "./js/data/rezepte-alltag.js",
  "./js/data/rezepte-fruehstueck.js",
  "./js/data/profil.js",
  "./js/data/angebote-demo.js",
  "./js/data/substitutionen.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

/* `cache: "reload"` erzwingt echte Netz-Antworten: Ohne das darf der Browser
   die Shell-Dateien aus seinem HTTP-Cache legen (GitHub Pages erlaubt zehn
   Minuten) – eine neue Version läge dann im Cache und wäre trotzdem alt. */
self.addEventListener("install", (e) => {
  const frischeShell = SHELL.map((pfad) => new Request(pfad, { cache: "reload" }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(frischeShell)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first für die Shell (frische Updates), Cache-Fallback offline.
   Fremd-APIs (Claude, Open Food Facts) werden nie gecacht.

   Zwei Dinge, die "network-first" naiv falsch macht:
   1. Nur vollständige, erfolgreiche Antworten gehören in den Cache. Ein 404
      oder 500 würde sonst eingelagert und danach dauerhaft offline
      ausgeliefert; Teilinhalte (206) lehnt cache.put ohnehin ab und quittiert
      das mit einer unbehandelten Rejection in der Konsole.
   2. Ein hängendes Netz ist schlimmer als gar keins: Im schlechten Mobilnetz
      löst `fetch` weder aus noch schlägt es fehl, und die App startet nicht.
      Deshalb gewinnt nach TIMEOUT_MS der Cache, falls er etwas hat. */
const TIMEOUT_MS = 3000;

function ausCache(request) {
  return caches.match(request, { ignoreSearch: true });
}

/* Beim Netz-Zugriff immer beim Server rückfragen statt blind aus dem
   HTTP-Cache zu antworten. Kostet eine Konditional-Anfrage (304, wenige
   Bytes) und ist der Unterschied zwischen "die App aktualisiert sich" und
   "sie zeigt zehn Minuten lang den alten Stand". Navigationen lassen sich
   nicht umbauen – die revalidiert der Browser beim Laden ohnehin. */
function mitRueckfrage(request) {
  try { return new Request(request, { cache: "no-cache" }); }
  catch { return request; }
}

async function netzZuerst(request) {
  const cacheTreffer = ausCache(request);

  const netz = fetch(mitRueckfrage(request)).then((res) => {
    if (res && res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
    }
    return res;
  });

  // Wartet das Netz zu lange, springt der Cache ein – sofern er etwas hat.
  const geduld = new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS))
    .then(() => cacheTreffer)
    .then((treffer) => treffer || netz);

  try {
    return await Promise.race([netz, geduld]);
  } catch {
    return (await cacheTreffer) || Response.error();
  }
}

/* Die App fragt nach, welcher Stand hier tatsächlich liegt (Profil-Screen).
   Ohne diese Auskunft bliebe "aktualisiert sich das Ding?" eine Glaubensfrage. */
self.addEventListener("message", (e) => {
  if (e.data === "version") e.source?.postMessage?.({ typ: "version", cache: CACHE });
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(netzZuerst(e.request));
});

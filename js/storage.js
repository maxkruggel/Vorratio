/* Vorratio Persistenz (Kap. 6.4): Auto-Save als Grundprinzip – eine Aktion = ein Save.
   Rein lokal (localStorage), JSON-Export/-Import als Backup gegen iOS-Storage-Eviction
   und als Migrationspfad Richtung Server-Variante. */

const STORAGE_KEY = "vorratio_v1";

const DEFAULT_STATE = {
  version: 1,
  profil: {
    name: "",
    ernaehrungsform: null,   // Achse 1 (genau eine)
    ausschluesse: [],        // Achse 2 (Allergien/Intoleranzen + halal/koscher)
    eigeneAusschluesse: [],  // Achse 2, frei eingetragen ("Rosenkohl", "Koriander")
    vorlieben: [],           // Achse 3 (optional, je Ernährungsform eigene Auswahl)
    stile: [],               // Achse 4 (optional)
    ziele: [],               // Achse 5 (optional, wissenschaftlich rückgekoppelt)
    onboarded: false,
  },
  bestand: [],               // [{ id, zutat_id, name, kategorie, art, einheit, menge, fuellstand, updated }]
  vorschlaege: null,         // Push-Fallback: { datum, slot, rezeptIds: [], gewuerfelt, bestandLeer }
  snackVorschlaege: null,    // Snack-Ecke (slot-unabhängig): { datum, rezeptIds: [], gewuerfelt }
  historie: [],              // [{ rezeptId, name, portionen, datum }]
  einkauf: {
    rezept: [],              // rezeptbezogene Liste [{ zutat_id, name, menge, einheit, erledigt }]
    woche: [],               // Wocheneinkauf [{ zutat_id, name, erledigt, auto }]
    rezeptId: null,
  },
  angebote: {                // Angebots-Crawl (Kap. 4.7/7.4)
    plz: "",                 // Standort für den Crawl
    apikey: "",              // Marktguru-Keys (aus der Web-App, s. docs/angebots-crawl.md)
    clientkey: "",
    proxy: "",               // optionaler CORS-Proxy-Präfix
    demo: false,             // true = Demo-Daten erzwingen (ohne Keys ohnehin Demo)
    letzter: null,           // letztes Crawl-Ergebnis (gilt eine Kalenderwoche)
  },
  aiRezepte: [],             // AI-generierte Rezepte (kruggel-recipe-db/v1-kompatibel)
  vorratRezepte: [],         // offline aus dem Bestand kombinierte Rezepte (generator.js)
  /* Laufender Kochmodus. Liegt im State, weil iOS PWA-Seiten im Hintergrund
     verwirft: Wer beim 25-Minuten-Köcheln kurz die App wechselt, stand sonst
     wieder auf Schritt 1. Der Timer merkt sich `ende` als Zeitstempel, läuft
     also über Schließen und Neuladen hinweg weiter.
     { rezeptId, portionen, step, timer: { name, typ, total, rest, ende,
       laeuft, gestartet, fertig } } */
  kochen: null,
  /* Tipp-Dosierung: Tipps kommen nach und nach statt alle auf einmal.
     `klicks` zählt die Interaktionen bis zum nächsten Pop-up, `gesehen`
     merkt sich die schon gezeigten Tipps, damit sie rotieren. */
  tipps: { klicks: 0, gesehen: [] },
  settings: { erstellt: null, apiKey: null },
};

/* Felder, die in älteren Sicherungen fehlen können. Verschachtelte Objekte
   werden einzeln aufgefüllt: Der Spread beim Laden ersetzt einen Teilbaum
   komplett, eine Sicherung mit `einkauf: { rezept: [] }` hätte sonst kein
   `woche` und die Einkaufsansicht liefe auf undefined. */
function migriere(s) {
  s.profil = { ...DEFAULT_STATE.profil, ...(s.profil || {}) };
  s.profil.ziele ||= [];
  s.profil.eigeneAusschluesse ||= [];
  s.profil.vorlieben ||= [];
  s.profil.ausschluesse ||= [];
  s.profil.stile ||= [];
  s.einkauf = { ...DEFAULT_STATE.einkauf, ...(s.einkauf || {}) };
  s.einkauf.rezept ||= [];
  s.einkauf.woche ||= [];
  s.angebote = { ...DEFAULT_STATE.angebote, ...(s.angebote || {}) };
  s.settings = { ...DEFAULT_STATE.settings, ...(s.settings || {}) };
  s.tipps = { klicks: 0, gesehen: [], ...(s.tipps || {}) };
  s.tipps.gesehen ||= [];
  s.bestand ||= [];
  s.historie ||= [];
  s.aiRezepte ||= [];
  s.vorratRezepte ||= [];
  if (s.kochen === undefined) s.kochen = null;
  return s;
}

let state = null;
const listeners = [];
const fehlerListeners = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = migriere({ ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) });
    }
  } catch (e) {
    console.warn("Vorratio: Ladefehler, starte frisch.", e);
  }
  if (!state) {
    state = structuredClone(DEFAULT_STATE);
    state.settings.erstellt = new Date().toISOString();
  }
  return state;
}

/* Eine Aktion = ein Save. Jede Mutation läuft über save().

   Scheitert das Schreiben (voller localStorage, iOS-Storage-Eviction, privater
   Modus), darf das nicht still passieren: Der Nutzer arbeitet sonst weiter und
   verliert alles beim nächsten Öffnen. Deshalb melden wir es nach oben – die
   App zeigt daraufhin einen Hinweis mit dem Weg zum Export.
   Rückgabe: true = gespeichert, false = nicht gespeichert. */
function save() {
  let ok = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    ok = false;
    console.error("Vorratio: Speichern fehlgeschlagen.", e);
    fehlerListeners.forEach((fn) => fn(e));
  }
  listeners.forEach((fn) => fn(state));
  return ok;
}

function onChange(fn) { listeners.push(fn); }

/* Wird gerufen, wenn ein save() fehlgeschlagen ist. */
function onSpeicherFehler(fn) { fehlerListeners.push(fn); }

function getState() { return state; }

/* JSON-Export: vollständiger Datenbestand als Datei.

   Ohne den API-Key. Die Sicherung landet in Downloads, iCloud oder im Chat mit
   einem zweiten Gerät – ein Schlüssel im Klartext hat dort nichts verloren.
   Beim Import bleibt deshalb der Key erhalten, der auf dem Gerät liegt. */
function exportJson() {
  const daten = { ...state, settings: { ...state.settings, apiKey: null } };
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const datum = lokalesDatum();
  a.href = url;
  a.download = `vorratio-backup-${datum}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* Datum als YYYY-MM-DD in Ortszeit. toISOString() rechnet nach UTC um – in der
   Sommerzeit wäre zwischen 0 und 2 Uhr noch der Vortag dran, und die
   tagesstabilen Vorschläge würden erst um 2 Uhr wechseln statt um Mitternacht. */
function lokalesDatum(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* JSON-Import: Datei einspielen, ersetzt den kompletten Bestand. */
function importJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !("profil" in data)) {
          throw new Error("Keine gültige Vorratio-Sicherung.");
        }
        // Der Key steht nicht in der Sicherung (s. exportJson) – den vom Gerät behalten.
        const bisherigerKey = state?.settings?.apiKey || null;
        state = migriere({ ...structuredClone(DEFAULT_STATE), ...data });
        state.settings.apiKey ||= bisherigerKey;
        if (!save()) throw new Error("Import konnte nicht gespeichert werden – der Gerätespeicher ist voll.");
        resolve(state);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  state.settings.erstellt = new Date().toISOString();
  save();
}

export {
  load, save, getState, onChange, onSpeicherFehler, exportJson, importJson, resetAll, lokalesDatum,
};

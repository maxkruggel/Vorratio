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
    stile: [],               // Achse 3 (optional)
    ziele: [],               // Achse 4 (optional, wissenschaftlich rückgekoppelt)
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
  /* Kochbuch (Kap. 4.10): gemerkte und eigene Rezepte als vollständige Kopien
     im Rezeptschema. Bewusst Kopien statt Verweisen – ein gemerktes Rezept
     überlebt so die Rotation des AI- und des Generator-Pools. */
  kochbuch: [],
  /* Tipp-Dosierung: Tipps kommen nach und nach statt alle auf einmal.
     `klicks` zählt die Interaktionen bis zum nächsten Pop-up, `gesehen`
     merkt sich die schon gezeigten Tipps, damit sie rotieren. */
  tipps: { klicks: 0, gesehen: [] },
  settings: { erstellt: null, apiKey: null },
};

/* Felder, die in älteren Sicherungen fehlen können. */
function migriere(s) {
  s.profil.ziele ||= [];
  s.profil.eigeneAusschluesse ||= [];
  s.tipps ||= { klicks: 0, gesehen: [] };
  s.tipps.gesehen ||= [];
  s.aiRezepte ||= [];
  s.vorratRezepte ||= [];
  s.kochbuch ||= [];
  return s;
}

let state = null;
const listeners = [];

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

/* Eine Aktion = ein Save. Jede Mutation läuft über save(). */
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Vorratio: Speichern fehlgeschlagen.", e);
  }
  listeners.forEach((fn) => fn(state));
}

function onChange(fn) { listeners.push(fn); }

function getState() { return state; }

/* JSON-Export: vollständiger Datenbestand als Datei. */
function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const datum = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `vorratio-backup-${datum}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
        state = migriere({ ...structuredClone(DEFAULT_STATE), ...data });
        save();
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

export { load, save, getState, onChange, exportJson, importJson, resetAll };

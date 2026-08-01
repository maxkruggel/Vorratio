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
    stile: [],               // Achse 3 (optional)
    onboarded: false,
  },
  bestand: [],               // [{ id, zutat_id, name, kategorie, art, einheit, menge, fuellstand, updated }]
  vorschlaege: null,         // Push-Fallback: { datum, slot, rezeptIds: [], gewuerfelt, bestandLeer }
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
  settings: { erstellt: null, apiKey: null },
};

let state = null;
const listeners = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
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
        state = { ...structuredClone(DEFAULT_STATE), ...data };
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

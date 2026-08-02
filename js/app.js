/* Vorratio – App-Steuerung & Views.
   User Journey (Kap. 4): Onboarding → Ersteinrichtung Bestand → tägliche
   Vorschläge (3 je Slot, neu würfeln) → fokussierter Einkauf → Kochmodus mit
   Timern → Abhaken & Abbuchung → Wocheneinkauf. */

import { load, save, getState, exportJson, importJson, resetAll } from "./storage.js";
import { ZUTATEN, REZEPTE, PREPS, BASES, TIPPS, IDEEN, TECHNIKEN } from "./data/kerndb.js";
import {
  ERNAEHRUNGSFORMEN, AUSSCHLUESSE, STILE, ZIELE, hinweiseFuerForm, FORM_HINWEISE,
  vorliebenFuerForm, gewaehlteVorlieben,
} from "./data/profil.js";
import {
  ZUTAT_INDEX, aktuellerSlot, SLOT_NAMEN, rezeptErlaubt, vorschlaege, snackVorschlaege,
  zielTreffer, vorliebenTreffer, tagesSeed, bestandsAbgleich, abbuchen, mengeAnzeige, wochenKandidaten,
} from "./engine.js";
import { angebotsCrawl, isoWoche, liveKonfiguriert } from "./angebote.js";
import { generiereRezepte, scanBon, leseDiktat, leseBarcodeVomFoto } from "./ai.js";
import { diktatVerfuegbar, starteDiktat, parseDiktat, diktatAnzeige } from "./diktat.js";
import { generiereAusVorrat, vorratsTiefe } from "./generator.js";
import { lookupBarcode, vorschlagZutat, kameraVerfuegbar, starteKameraScan } from "./scan.js";
import { SUB_KATEGORIEN, SUB_ANWENDUNGEN } from "./data/substitutionen.js";
import { subsFiltern, ersatzVorschlaege, produkteSortiert } from "./substitution.js";
import {
  KOCHBUCH_FILTER, QUELLE_LABEL, quelleVon, istGemerkt, findeGemerkt, merken, vergessen,
  setzeNotiz, ersetze, kochbuchListe, gekochtAnzahl, katalogZutaten,
  EDITOR_EINHEITEN, MAHLZEITEN, SCHWIERIGKEITEN,
  leererEntwurf, entwurfAus, entwurfFehler, eigenesRezept, tagsAusZutaten,
  leereZutat, leererSchritt,
} from "./kochbuch.js";
import { icon, logoMark } from "./icons.js";

/* Kern-DB + AI-generierte + aus dem Vorrat kombinierte + gespeicherte Rezepte
   als ein Pool. Das Kochbuch enthält Kopien – gleiche id gewinnt einmal, damit
   ein gemerktes Rezept nicht doppelt in den Vorschlägen auftaucht. Eigene
   Rezepte kommen so ganz nebenbei in die tägliche Vorschlagsrunde. */
function alleRezepte() {
  const s = getState();
  const gesehen = new Set();
  return [...REZEPTE, ...(s.aiRezepte || []), ...(s.vorratRezepte || []), ...(s.kochbuch || [])]
    .filter((r) => !gesehen.has(r.id) && gesehen.add(r.id));
}
const findRezept = (id) => alleRezepte().find((r) => r.id === id);
const istEigen = (r) => r.quelle_typ === "eigen";

/* Meta-Zeile einer Rezeptkarte – eigene Rezepte haben oft keine Küche. */
const rezeptMeta = (r) => [r.cuisine, r.schwierigkeit, portionenText(r.portionen)].filter(Boolean).join(" · ");

/* Herkunfts-Pill. Kern-Rezepte tragen keine – sie sind der Normalfall. */
const QUELLE_ICON = { eigen: "stift", ai: "claude", vorrat: "vorrat" };
function quellenBadge(rezept) {
  const q = quelleVon(rezept);
  if (!QUELLE_ICON[q]) return "";
  return `<span class="badge">${icon(QUELLE_ICON[q], 14)}${esc(QUELLE_LABEL[q])}</span>`;
}

const app = document.getElementById("app");
const tabbar = document.getElementById("tabbar");
let view = "heute";
let cook = null;            // { rezept, portionen, step, timer }
let detailRezept = null;

const KATEGORIE_NAMEN = {
  trocken: "Trockenware & Vorrat", frisch: "Frischware", konserve: "Konserven",
  gewuerz: "Gewürze", kuehl: "Kühlschrank", tk: "Tiefkühl",
};

/* Feste Essenszeiten – als Pill im Heute-Kopf (Design 07). */
const SLOT_ZEIT = { fruehstueck: "8:00", mittag: "11:30", abend: "17:30" };

const portionenText = (n) => `${n} ${n === 1 ? "Portion" : "Portionen"}`;

/* ------------------------------------------------------------------ Helpers */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const heuteStr = () => new Date().toISOString().slice(0, 10);

function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

/* -------------------------------------------------------- Bildschirmwechsel
   Jede Interaktion zeichnet ihren Screen komplett neu. Würde dabei jedes Mal
   die Einblendung neu starten, flackert die Oberfläche bei jedem Tap – genau
   das wirkte ruppig. Darum bekommt nur der echte Wechsel eine (ruhige)
   Einblendung; ein Neuzeichnen desselben Screens tauscht still den Inhalt und
   behält die Scrollposition. */
let letzterScreen = null;

function zeigeApp(html, key) {
  const gleicherScreen = key === letzterScreen;
  letzterScreen = key;
  const frag = h(html);
  if (gleicherScreen) frag.firstElementChild?.classList.remove("fade-in");
  app.replaceChildren(frag);
}

/* -------------------------------------------------- Dialoge & Bestätigungen
   Ersetzt die nativen confirm()/alert() durch gestaltete Sheets bzw. Toasts
   (Design-Übergabe Kap. 5, „dürfen gern durch gestaltete Dialoge ersetzt
   werden"). Beide hängen an <body>, nicht an #app – ein render() dazwischen
   räumt sie also nicht weg. */
function dialog({ titel, text = "", bestaetigen = "OK", abbrechen = null, danger = false, symbol = null }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "sheet";
    d.innerHTML = `
      <form method="dialog" class="sheet-inner">
        ${symbol ? icon(symbol, 28, danger ? "ic-warn" : "ic-accent") : ""}
        <h3>${esc(titel)}</h3>
        ${text ? `<p>${esc(text)}</p>` : ""}
        <div class="btn-row">
          ${abbrechen ? `<button class="btn secondary" value="nein" autofocus>${esc(abbrechen)}</button>` : ""}
          <button class="btn${danger ? " danger-solid" : ""}" value="ja"${abbrechen ? "" : " autofocus"}>${esc(bestaetigen)}</button>
        </div>
      </form>`;
    // Tap auf den Scrim = abbrechen, genau wie ESC
    d.addEventListener("click", (e) => { if (e.target === d) { d.returnValue = "nein"; d.close(); } });
    d.addEventListener("close", () => { d.remove(); resolve(d.returnValue === "ja"); }, { once: true });
    document.body.append(d);
    d.showModal();
  });
}

const bestaetige = (opts) => dialog({ abbrechen: "Abbrechen", ...opts });

/* Kurze Rückmeldung ohne Gegenfrage – ersetzt die reinen alert()-Bestätigungen. */
let toastTimer = null;
function toast(text, art = "ok") {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = `toast ${art}`;
  t.setAttribute("role", "status");
  t.innerHTML = `${icon(art === "warn" ? "achtung" : "check", 20)}<span>${esc(text)}</span>`;
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add("weg");
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

/* ------------------------------------------------------------ Tipp-Pop-up
   Alle Tipps auf einmal liest niemand. Darum meldet sich alle paar Taps einer
   von allein – immer einer, den man noch nicht gesehen hat, und erst wenn
   gerade nichts Wichtigeres offen ist (kein Kochschritt, kein Dialog). */
const KLICKS_BIS_TIPP = 9;
let tippPopOffen = false;
let tippPopTimer = null;

function naechsterUngesehenerTipp() {
  const s = getState();
  const gesehen = new Set(s.tipps.gesehen);
  const offen = tippReihenfolge().filter((t) => !gesehen.has(t.id));
  if (offen.length) return offen[0];
  // Alles gesehen: von vorn, aber in neuer Runde
  s.tipps.gesehen = [];
  return tippReihenfolge()[0] || null;
}

function zeigeTippPop() {
  const t = naechsterUngesehenerTipp();
  if (!t) return;
  const s = getState();
  if (!s.tipps.gesehen.includes(t.id)) s.tipps.gesehen.push(t.id);
  save();

  const { titel, body } = teileTitel(t.text);
  tippPopOffen = true;
  const box = document.createElement("div");
  box.className = "tipp-pop";
  box.setAttribute("role", "status");
  box.innerHTML = `
    ${icon(t.symbol, 22)}
    <div class="tipp-body">${titel ? `<b>${esc(titel)}</b>` : "<b>Küchentipp</b>"}${esc(body)}</div>
    <button class="icon-btn tipp-zu" aria-label="Tipp schließen">${icon("x", 20)}</button>`;
  const weg = () => {
    clearTimeout(tippPopTimer);
    box.classList.add("weg");
    setTimeout(() => { box.remove(); tippPopOffen = false; }, 320);
  };
  box.querySelector("button").addEventListener("click", weg);
  document.body.append(box);
  tippPopTimer = setTimeout(weg, 11000);
}

/* Jeder Tap auf einen Bedienpunkt zählt – Scrollen und Tippen im Text nicht. */
document.addEventListener("click", (e) => {
  const s = getState();
  if (!s?.profil?.onboarded) return;
  if (!e.target.closest("button, .chip, .choice, .tappable, .tab")) return;
  if (e.target.closest(".tipp-pop")) return;
  s.tipps.klicks = (s.tipps.klicks || 0) + 1;
  if (s.tipps.klicks < KLICKS_BIS_TIPP) { save(); return; }
  s.tipps.klicks = 0;
  save();
  // Nicht mitten in einen Kochschritt, ein Rezept in Arbeit oder einen offenen Dialog platzen
  if (cook || editor || tippPopOffen || document.querySelector("dialog[open]")) return;
  zeigeTippPop();
});

function render() {
  const s = getState();
  const vorher = letzterScreen;
  if (!s.profil.onboarded) {
    tabbar.hidden = true;
    document.body.classList.add("onboarding");   // kein Tabbar-Platz im Onboarding
    renderOnboarding();
    return;
  }
  tabbar.hidden = false;
  document.body.classList.remove("onboarding");
  tabbar.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (cook) { renderKochmodus(); return; }
  if (editor) { renderRezeptEditor(); return; }
  if (detailRezept) { renderRezeptDetail(detailRezept); return; }
  ({
    heute: renderHeute, kochbuch: renderKochbuch, vorrat: renderVorrat,
    einkauf: renderEinkauf, wissen: renderWissen, profil: renderProfil,
  }[view] || renderHeute)();
  // Nur beim echten Wechsel nach oben springen – sonst reißt es einen beim
  // Antippen mitten in der Liste an den Seitenanfang.
  if (letzterScreen !== vorher) window.scrollTo(0, 0);
}

tabbar.addEventListener("click", async (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  if (cook && !await bestaetige({
    titel: "Kochen verlassen?",
    text: "Der Kochmodus wird geschlossen. Es wird nichts abgebucht.",
    bestaetigen: "Verlassen", abbrechen: "Weiterkochen", danger: true, symbol: "achtung",
  })) return;
  if (editor && !await bestaetige({
    titel: "Rezept verwerfen?",
    text: "Das angefangene Rezept ist noch nicht im Kochbuch.",
    bestaetigen: "Verwerfen", abbrechen: "Weiter schreiben", danger: true, symbol: "achtung",
  })) return;
  cook = null;
  editor = null;
  // Ein Mikrofon, das im nächsten Tab weiterhört, gehört in keine Vorrats-App.
  diktat = null;
  stoppeAufnahme();
  clearTimerTick();
  view = b.dataset.view;
  detailRezept = null;
  render();
});

/* ------------------------------------------------------------ Onboarding */
const leeresOb = () => ({ step: 0, name: "", form: null, ausschluesse: [], eigene: [], vorlieben: [], stile: [], ziele: [] });
let ob = leeresOb();

const OB_STEPS = [obWelcome, obName, obForm, obAusschluesse, obVorlieben, obStile, obZiele, obToleranz];

/* Fortschrittsbalken der Übergabe: Willkommen zählt als Schritt 1 mit. */
function progressBar(done, total) {
  return `<div class="progress-bar">${Array.from({ length: total }, (_, i) => `<span class="${i < done ? "done" : ""}"></span>`).join("")}</div>`;
}

function renderOnboarding() {
  const welcome = ob.step === 0;
  /* Jeder Schritt ist korrigierbar: Zurück steht über dem Fortschrittsbalken. */
  const kopf = welcome ? "" : `
    <button class="backlink" data-ob="back">${icon("zurueck", 20)}Zurück</button>
    ${progressBar(ob.step + 1, OB_STEPS.length)}`;
  zeigeApp(`
    <div class="fade-in ${welcome ? "onboard-welcome" : "onboard-step"}">${kopf}${OB_STEPS[ob.step]()}</div>`,
  `onboarding:${ob.step}`);
  bindOnboarding();
}

function obWelcome() {
  return `
    <div class="spacer"></div>
    <div class="onboard-hero">
      ${logoMark(88)}
      <div class="wordmark">vorratio</div>
      <p>Kennt deinen Vorrat. Schlägt vor, was du daraus kochst. Bucht ab, was du verbrauchst.</p>
    </div>
    <button class="btn" data-ob="next">Los geht's</button>
    <p class="centered-note">Sieben kurze Schritte · ca. 3 Minuten</p>
    <div class="spacer"></div>
    <div class="foot-note">${icon("lokal", 18)}<span>Alles bleibt lokal auf deinem iPhone.<br>Kein Konto, kein Server.</span></div>`;
}

/* Name und Ernährungsform sind Pflicht: ohne sie kann die App weder ansprechen
   noch filtern. Beide Schritte lassen sich darum nicht überspringen – der
   Button bleibt gesperrt und sagt darüber, woran es hängt. Alles Weitere
   (Unverträglichkeiten, Stile, Ziele) bleibt ausdrücklich optional. */
function obName() {
  const bereit = ob.name.trim().length > 0;
  return `
    <div class="screen-header"><h1>wie heißt du?</h1><p class="subtle">Nur für die Begrüßung. Der Name bleibt auf dem Gerät.</p></div>
    <label class="field"><input type="text" id="ob-name" placeholder="Dein Name" value="${esc(ob.name)}" autocomplete="given-name" enterkeyhint="next"></label>
    <p class="pflicht-note" id="ob-name-hinweis"${bereit ? " hidden" : ""}>Ohne Namen geht es nicht weiter – ein Spitzname reicht.</p>
    <button class="btn" data-ob="name"${bereit ? "" : " disabled"}>Weiter</button>`;
}

function obForm() {
  return `
    <div class="screen-header"><h1>wie isst du?</h1><p class="subtle">Genau eine Form. Allergien kommen im nächsten Schritt.</p></div>
    <div class="choice-list">
      ${ERNAEHRUNGSFORMEN.map((f) => `
        <button class="choice ${ob.form === f.id ? "selected" : ""}" data-form="${f.id}">
          <b>${esc(f.name)}</b><span class="subtle">${esc(f.kurz)}</span>
        </button>`).join("")}
    </div>
    ${ob.form ? "" : '<p class="pflicht-note">Wähl eine Form – sie entscheidet, was dir überhaupt vorgeschlagen wird.</p>'}
    <button class="btn" data-ob="next" ${ob.form ? "" : "disabled"}>Weiter</button>`;
}

/* Achse 2: Allergien, Intoleranzen und persönliche No-Gos. Neben den EU-14
   lässt sich alles frei eintragen – die Freitext-Einträge filtern in
   engine.js über Rezept- und Zutatennamen genauso hart wie die Standards. */
function eigeneAusschluesseHtml(liste) {
  return `
    <div class="section-gap">
      <h2>Etwas dabei, das hier fehlt?</h2>
      ${liste.length ? `
        <div class="chip-wrap" style="margin-bottom:10px">
          ${liste.map((t, i) => `
            <button class="chip selected" data-eigen-weg="${i}">${esc(t)}<span class="chip-x">×</span></button>`).join("")}
        </div>` : ""}
      <div class="add-row">
        <input type="text" id="eigen-input" placeholder="z. B. Rosenkohl" autocomplete="off">
        <button class="btn small-btn" id="eigen-add" aria-label="Eintragen">${icon("plus", 20)}</button>
      </div>
      <p class="subtle small" style="margin-top:8px">Was du hier einträgst, taucht in keinem Vorschlag mehr auf.</p>
    </div>`;
}

function obAusschluesse() {
  const gruppe = (g, titel) => `
    <div class="section-gap">
      <h2>${titel}</h2>
      <div class="chip-wrap">
        ${AUSSCHLUESSE.filter((a) => a.gruppe === g).map((a) => `
          <button class="chip ${ob.ausschluesse.includes(a.id) ? "selected" : ""}" data-aus="${a.id}">${esc(a.name)}</button>`).join("")}
      </div>
    </div>`;
  return `
    <div class="screen-header"><h1>was verträgst du nicht?</h1><p class="subtle">Allergien, Unverträglichkeiten und alles, was bei dir grundsätzlich nicht auf den Teller kommt. Alles optional.</p></div>
    ${gruppe("allergie", "Allergien &amp; Intoleranzen")}
    ${gruppe("religioes", "Religiös-kulturell")}
    ${eigeneAusschluesseHtml(ob.eigene)}
    <button class="btn" data-ob="next">Weiter</button>`;
}

/* Achse 3: Vorlieben – Frage, Auswahl und Abschluss-Hinweis kommen je
   Ernährungsform aus profil.js, damit ein Veganer nach der Proteinquelle und
   ein Pescetarier nach dem Fisch gefragt wird statt beide nach demselben.
   Der Schritt steht bewusst NACH den Ausschlüssen: Was ausgeschlossen ist,
   wird gar nicht erst als Vorliebe angeboten. */
function vorliebenListeHtml(konfig, gewaehlt, attr = "data-vorliebe") {
  return `
    <div class="choice-list">
      ${konfig.optionen.map((v) => `
        <button class="choice ${gewaehlt.includes(v.id) ? "selected" : ""}" ${attr}="${v.id}">
          <b>${esc(v.name)}</b><span class="subtle">${esc(v.kurz)}</span>
        </button>`).join("")}
    </div>`;
}

/* Auswahl bereinigen, wenn sich Form oder Ausschlüsse ändern – eine Vorliebe,
   die es in der neuen Liste nicht mehr gibt, darf nicht im Profil hängen
   bleiben (Tofu überlebt den Wechsel, Käse beim Wechsel auf vegan nicht). */
function bereinigeVorlieben(profilAehnlich) {
  const erlaubt = vorliebenFuerForm(profilAehnlich.form ?? profilAehnlich.ernaehrungsform,
    profilAehnlich.ausschluesse || [], profilAehnlich.eigene || profilAehnlich.eigeneAusschluesse || [])
    .optionen.map((v) => v.id);
  const liste = profilAehnlich.vorlieben || [];
  profilAehnlich.vorlieben = liste.filter((id) => erlaubt.includes(id));
}

function obVorlieben() {
  const konfig = vorliebenFuerForm(ob.form, ob.ausschluesse, ob.eigene);
  return `
    <div class="screen-header"><h1>${esc(konfig.frage)}</h1><p class="subtle">${esc(konfig.intro)}</p></div>
    ${vorliebenListeHtml(konfig, ob.vorlieben)}
    ${konfig.hinweis ? `
      <div class="inline-hint">${icon("tipp", 20)}
        <div class="hint-body"><b>Gut zu wissen</b>${esc(konfig.hinweis)}</div>
      </div>` : ""}
    <button class="btn" data-ob="next">${ob.vorlieben.length ? "Weiter" : "Ohne Vorlieben weiter"}</button>`;
}

function obStile() {
  return `
    <div class="screen-header"><h1>worauf hast du lust?</h1><p class="subtle">Deine Lieblingsrichtungen. Was dazu passt, rutscht in den Vorschlägen nach oben – der Rest bleibt trotzdem sichtbar.</p></div>
    <div class="choice-list">
      ${STILE.map((s) => {
        const aktiv = ob.stile.includes(s.id);
        return `
        <button class="choice ${aktiv ? "selected" : ""}" data-stil="${s.id}"><b>${esc(s.name)}</b></button>
        ${aktiv && s.hinweis ? `
          <div class="inline-hint warn">${icon("achtung", 20)}
            <div class="hint-body"><b>Ehrlich dazu gesagt</b>${esc(s.hinweis)}</div>
          </div>` : ""}`;
      }).join("")}
    </div>
    <button class="btn" data-ob="next">Weiter</button>`;
}

/* Achse 5: Ziele – nur über Ernährung beeinflussbare Ziele; jede Auswahl klappt
   direkt darunter auf, was dazu wirklich belegt ist (inkl. dem, was NICHT
   belegt ist). Rückkopplung: Vorschlags-Score + AI-Rezeptgenerierung. */
const belegBadge = (z) => z.evidenz === "hoch"
  ? '<span class="badge">gut untersucht</span>'
  : '<span class="badge neutral">teils untersucht</span>';

/* Ziel-Karte + aufgeklappter Hinweis – gleiche Bausteine im Onboarding und im
   Profil, damit der Hinweis überall direkt am Ziel hängt statt am Seitenende. */
function zielListeHtml(gewaehlt, attr = "data-ziel") {
  return `
    <div class="choice-list">
      ${ZIELE.map((z) => {
        const aktiv = gewaehlt.includes(z.id);
        return `
        <button class="choice ${aktiv ? "selected" : ""}" ${attr}="${z.id}">
          <b>${esc(z.name)} ${belegBadge(z)}</b>
          <span class="subtle">${esc(z.kurz)}</span>
        </button>
        ${aktiv ? `
          <div class="inline-hint">${icon("ziel", 20)}
            <div class="hint-body"><b>Was dazu wirklich belegt ist</b>${esc(z.hinweis)}</div>
          </div>` : ""}`;
      }).join("")}
    </div>`;
}

function obZiele() {
  return `
    <div class="screen-header"><h1>was willst du erreichen?</h1><p class="subtle">Optional, mehrere möglich. Passende Rezepte kommen nach oben – verboten wird nichts. Zu jedem Ziel siehst du direkt, was dazu belegt ist.</p></div>
    ${zielListeHtml(ob.ziele)}
    <button class="btn" data-ob="next">${ob.ziele.length ? "Weiter" : "Ohne Ziele weiter"}</button>`;
}

function obToleranz() {
  const punkte = [
    "Du musst nie etwas abwiegen.",
    "Prisen, EL und TL laufen unter Toleranz.",
    "Stimmt mal was nicht, korrigierst du es in zwei Taps.",
  ];
  return `
    <div class="screen-header"><h1>eine sache noch</h1><p class="subtle">Kurz erklärt, warum du hier nie eine Waage brauchst.</p></div>
    <div class="card hint-card" style="flex-direction:column;padding:22px;border-radius:18px">
      <h3 style="color:var(--accent-deep)">Toleranz statt Scheinpräzision</h3>
      <p style="font-size:15px;line-height:1.6">Beim Kochen bucht vorratio den Verbrauch mit ±10–15 % Spielraum ab. Du kochst aus der Hüfte, die App rechnet mit.</p>
      <div style="display:flex;gap:10px;align-items:center;margin-top:4px">
        <span class="badge" style="background:var(--surface);font-size:15px;padding:7px 13px">~350 g</span>
        <span class="small">statt 347,5 g</span>
      </div>
    </div>
    <div class="card">
      ${punkte.map((t) => `
        <div class="list-item"><span class="check">${icon("check", 22)}</span><span class="grow">${t}</span></div>`).join("")}
    </div>
    <button class="btn" data-ob="fertig">Verstanden – Bestand einrichten</button>`;
}

function bindOnboarding() {
  app.querySelectorAll("[data-form]").forEach((b) => b.addEventListener("click", () => {
    ob.form = b.dataset.form;
    bereinigeVorlieben(ob);          // andere Form → andere Vorlieben-Liste
    renderOnboarding();
  }));
  app.querySelectorAll("[data-aus]").forEach((b) => b.addEventListener("click", () => {
    toggle(ob.ausschluesse, b.dataset.aus);
    bereinigeVorlieben(ob);          // ausgeschlossen heißt auch: keine Vorliebe
    renderOnboarding();
  }));
  app.querySelectorAll("[data-vorliebe]").forEach((b) => b.addEventListener("click", () => { toggle(ob.vorlieben, b.dataset.vorliebe); renderOnboarding(); }));
  app.querySelectorAll("[data-stil]").forEach((b) => b.addEventListener("click", () => { toggle(ob.stile, b.dataset.stil); renderOnboarding(); }));
  app.querySelectorAll("[data-ziel]").forEach((b) => b.addEventListener("click", () => { toggle(ob.ziele, b.dataset.ziel); renderOnboarding(); }));
  bindEigeneAusschluesse(ob.eigene, () => { bereinigeVorlieben(ob); renderOnboarding(); });
  app.querySelector('[data-ob="back"]')?.addEventListener("click", () => {
    // Name-Eingabe beim Zurückgehen nicht verlieren
    const feld = app.querySelector("#ob-name");
    if (feld) ob.name = feld.value.trim();
    ob.step = Math.max(0, ob.step - 1);
    renderOnboarding();
  });
  app.querySelector('[data-ob="next"]')?.addEventListener("click", () => {
    if (OB_STEPS[ob.step] === obForm && !ob.form) return;   // Ernährungsform ist Pflicht
    ob.step++;
    renderOnboarding();
  });

  /* Der Weiter-Button des Namensschritts folgt der Eingabe live – ohne
     Neuzeichnen, sonst springt bei jedem Buchstaben die Tastatur zu. */
  const nameFeld = app.querySelector("#ob-name");
  if (nameFeld) {
    const weiter = app.querySelector('[data-ob="name"]');
    const hinweis = app.querySelector("#ob-name-hinweis");
    const pruefe = () => {
      const ok = nameFeld.value.trim().length > 0;
      weiter.disabled = !ok;
      if (hinweis) hinweis.hidden = ok;
      return ok;
    };
    nameFeld.addEventListener("input", pruefe);
    nameFeld.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (pruefe()) weiter.click();
    });
  }

  app.querySelector('[data-ob="name"]')?.addEventListener("click", () => {
    const wert = app.querySelector("#ob-name").value.trim();
    if (!wert) return;
    ob.name = wert;
    ob.step++;
    renderOnboarding();
  });
  app.querySelector('[data-ob="fertig"]')?.addEventListener("click", () => {
    /* Letzte Sicherung: Pflichtangaben fehlen (z. B. nach einem Rücksprung),
       also zurück auf den Schritt, an dem es hängt – statt ein halbes Profil
       zu speichern. */
    if (!ob.name.trim() || !ob.form) {
      ob.step = OB_STEPS.indexOf(ob.name.trim() ? obForm : obName);
      renderOnboarding();
      toast(ob.name.trim() ? "Wähl noch deine Ernährungsform." : "Trag noch deinen Namen ein.", "warn");
      return;
    }
    const s = getState();
    s.profil = {
      name: ob.name, ernaehrungsform: ob.form, ausschluesse: ob.ausschluesse,
      eigeneAusschluesse: ob.eigene, vorlieben: ob.vorlieben, stile: ob.stile,
      ziele: ob.ziele, onboarded: true,
    };
    save();
    view = "vorrat";
    render();
  });
}

/* Freitext-Ausschlüsse hinzufügen/entfernen – geteilt von Onboarding und Profil. */
function bindEigeneAusschluesse(liste, danach) {
  const feld = app.querySelector("#eigen-input");
  const uebernehmen = () => {
    const wert = (feld?.value || "").trim();
    if (wert.length < 2) return;
    if (!liste.some((t) => t.toLowerCase() === wert.toLowerCase())) liste.push(wert);
    danach();
  };
  app.querySelector("#eigen-add")?.addEventListener("click", uebernehmen);
  feld?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); uebernehmen(); } });
  app.querySelectorAll("[data-eigen-weg]").forEach((b) => b.addEventListener("click", () => {
    liste.splice(Number(b.dataset.eigenWeg), 1);
    danach();
  }));
}

function toggle(arr, val) {
  const i = arr.indexOf(val);
  i >= 0 ? arr.splice(i, 1) : arr.push(val);
}

/* ------------------------------------------------------------------ Heute */
let aiLaeuft = false;
let aiFehler = null;
let genHinweis = null;      // Rückmeldung des Offline-Generators
let vorratWurf = 0;         // zählt die Würfe, damit jeder Klick neue Rezepte bringt

/* Klartextnamen der Bausteine, die der Generator im Vorrat sucht. */
const BAUSTEIN_NAMEN = {
  protein: "eine Proteinquelle (Hülsenfrüchte, Tofu, Ei, Fleisch oder Fisch)",
  gemuese: "Gemüse", basis: "eine Sättigungsbeilage (Reis, Nudeln, Kartoffeln)",
  aroma: "Aromaten (Zwiebel, Knoblauch, Ingwer)", fluessig: "etwas Flüssiges (Brühe, Tomaten, Kokosmilch)",
};

/* Push-Fallback (Kap. 7.1): Web Push braucht einen Push-Server – ohne ihn
   greift der dokumentierte Fallback: die Vorschläge für den aktuellen Slot
   werden beim Öffnen erzeugt und persistiert, liegen also sofort bereit und
   bleiben innerhalb eines Slots stabil. Neu erzeugt wird bei Tages- oder
   Slot-Wechsel, bei "Neu würfeln", nach der Bestands-Ersteinrichtung und
   wenn ein gemerktes Rezept nicht mehr zum Profil passt oder aus dem
   AI-Pool gefallen ist. */
function stelleVorschlaegeBereit(neuWuerfeln = false) {
  const s = getState();
  if (!s.profil.onboarded) return null;
  const datum = heuteStr();
  const slot = aktuellerSlot();
  const bestandLeer = s.bestand.length === 0;
  const v = s.vorschlaege;
  const gueltig = v && v.datum === datum && v.slot === slot
    && !(v.bestandLeer && !bestandLeer)
    && (v.rezeptIds || []).every((id) => {
      const r = findRezept(id);
      return r && rezeptErlaubt(r, s.profil);
    });
  if (gueltig && !neuWuerfeln) return v;

  const gewuerfelt = gueltig ? (v.gewuerfelt || 0) + 1 : 0;
  const vs = vorschlaege(s.profil, s.bestand, slot, tagesSeed(datum, gewuerfelt), 3, alleRezepte());
  s.vorschlaege = { datum, slot, rezeptIds: vs.map((x) => x.rezept.id), gewuerfelt, bestandLeer };
  save();
  return s.vorschlaege;
}

/* Snack-Ecke: Vorschläge unabhängig von den Essenszeiten – tagesstabil,
   eigener Wurf-Zähler, gleiche Gültigkeitsprüfung wie die Slot-Vorschläge. */
function stelleSnacksBereit(neuWuerfeln = false) {
  const s = getState();
  if (!s.profil.onboarded) return null;
  const datum = heuteStr();
  const v = s.snackVorschlaege;
  const gueltig = v && v.datum === datum
    && (v.rezeptIds || []).length > 0
    && (v.rezeptIds || []).every((id) => {
      const r = findRezept(id);
      return r && rezeptErlaubt(r, s.profil);
    });
  if (gueltig && !neuWuerfeln) return v;

  const gewuerfelt = gueltig ? (v.gewuerfelt || 0) + 1 : 0;
  const vs = snackVorschlaege(s.profil, s.bestand, tagesSeed(datum, gewuerfelt) ^ 0x5eed, 2, alleRezepte());
  s.snackVorschlaege = { datum, rezeptIds: vs.map((x) => x.rezept.id), gewuerfelt };
  save();
  return s.snackVorschlaege;
}

/* Rezeptkarte (Design 07): Titel + Zeit-Pill, Meta-Zeile, darunter die
   Status-Pills – „von claude", „im Kochbuch", „alles da" bzw. „N fehlen". */
function rezeptKarte(v, meta, { gedimmt = false, herkunft = true } = {}) {
  const fehlt = v.abgleich.fehlt;
  const gemerkt = herkunft && istGemerkt(getState(), v.rezept.id);
  const tags = gedimmt ? "" : `
    <div class="card-tags">
      ${herkunft ? quellenBadge(v.rezept) : ""}
      ${gemerkt ? `<span class="badge">${icon("gemerkt", 14)}im Kochbuch</span>` : ""}
      ${fehlt.length === 0
        ? `<span class="badge">${icon("check", 18)}alles da</span>`
        : `<span class="badge warn">${fehlt.length === 1 ? "1 fehlt" : `${fehlt.length} fehlen`}</span>
           <span class="small subtle">${fehlt.map((z) => esc(z.zutat_name)).join(" · ")}</span>`}
    </div>`;
  return `
    <div class="card tappable${gedimmt ? " dim" : ""}" data-rezept="${v.rezept.id}">
      <div class="card-row">
        <h3>${esc(v.rezept.name)}</h3>
        <span class="badge neutral">${v.rezept.gesamtzeit_min.gesamt} Min</span>
      </div>
      <p class="subtle small" style="margin-top:6px">${meta}</p>
      ${tags}
    </div>`;
}

function renderHeute() {
  const s = getState();
  const bereit = stelleVorschlaegeBereit();
  const slot = bereit.slot;
  const vs = bereit.rezeptIds
    .map((id) => findRezept(id))
    .filter(Boolean)
    .map((rezept) => ({ rezept, abgleich: bestandsAbgleich(rezept, s.bestand) }));
  const snacksBereit = stelleSnacksBereit();
  const snacks = (snacksBereit?.rezeptIds || [])
    .map((id) => findRezept(id))
    .filter(Boolean)
    .map((rezept) => ({ rezept, abgleich: bestandsAbgleich(rezept, s.bestand) }));
  const gruss = s.profil.name ? `moin, ${esc(s.profil.name)}` : "moin";
  const leererBestand = s.bestand.length === 0;

  zeigeApp(`
    <div class="fade-in">
      <div class="screen-header card-row">
        <div>
          <h1>${gruss}</h1>
          <p class="subtle">Aus deinem Bestand, fürs ${SLOT_NAMEN[slot]}.</p>
        </div>
        <span class="badge" style="margin-top:4px">${SLOT_ZEIT[slot]}</span>
      </div>
      ${leererBestand ? `
        <div class="accent-card">
          ${icon("vorrat", 40)}
          <h3>Dein Vorrat ist noch leer</h3>
          <p>Erfass einmal, was da ist – Trockenware, Frisches, Konserven, Gewürze. Das dauert rund 15 Minuten. Danach passen alle Vorschläge zu dem, was wirklich im Schrank steht.</p>
          <button class="btn" style="background:var(--surface);color:var(--accent-deep);margin-top:14px" data-go="vorrat">Bestand einrichten</button>
        </div>
        <h2 class="section-gap">Solange zeigen wir dir Klassiker</h2>` : ""}
      ${vs.map((v) => rezeptKarte(v, esc(rezeptMeta(v.rezept)), { gedimmt: leererBestand })).join("")}
      <div class="btn-row">
        <button class="btn secondary" id="wuerfeln">${icon("wuerfeln", 19)}Neu würfeln</button>
        <button class="btn secondary" id="vorrat-generieren" ${leererBestand ? "disabled" : ""}>${icon("vorrat", 19)}Aus Vorrat bauen</button>
        <button class="btn" id="ai-generieren" ${aiLaeuft ? "disabled" : ""}>${icon("claude", 19)}${aiLaeuft ? "Claude kocht …" : "Claude fragen"}</button>
      </div>
      ${genHinweis ? `<p class="small subtle" style="text-align:center;margin-top:8px">${esc(genHinweis)}</p>` : ""}
      ${aiFehler ? `<p class="small warn-text" style="text-align:center;margin-top:8px">${esc(aiFehler)}</p>` : ""}

      <hr class="divider">
      <div class="section-gap">
        <h2>Snacks &amp; Süßes</h2>
        <p class="subtle small" style="margin-bottom:10px">Unabhängig von den Essenszeiten – Eis, Sorbet, Fruchtleder &amp; Co. aus deinem Vorrat.</p>
        ${snacks.map((v) => rezeptKarte(v, `${esc(v.rezept.kategorie)} · ${esc(v.rezept.schwierigkeit)} · ${portionenText(v.rezept.portionen)}`)).join("")
          || '<div class="empty-state"><p>Kein Snack passt gerade zu deinem Profil.</p></div>'}
        <div class="btn-row">
          <button class="btn secondary" id="snack-wuerfeln">${icon("wuerfeln", 19)}Andere Snacks</button>
          <button class="btn secondary" id="ai-snacks" ${aiLaeuft ? "disabled" : ""}>${icon("claude", 19)}${aiLaeuft ? "Claude denkt …" : "Snack-Ideen"}</button>
        </div>
      </div>

      <p class="centered-note">Vorschläge um 8:00, 11:30 und 17:30 – liegen beim Öffnen bereit.<br>Snacks laufen außerhalb der Zeiten.</p>
    </div>`, "heute");

  app.querySelectorAll("[data-rezept]").forEach((c) => c.addEventListener("click", () => {
    oeffneRezept(c.dataset.rezept);
  }));
  app.querySelector("#wuerfeln").addEventListener("click", () => { stelleVorschlaegeBereit(true); render(); });
  app.querySelector("#snack-wuerfeln").addEventListener("click", () => { stelleSnacksBereit(true); render(); });
  app.querySelector("#ai-generieren").addEventListener("click", () => starteAiGenerierung(slot));
  app.querySelector("#ai-snacks").addEventListener("click", () => starteAiGenerierung("snack"));
  app.querySelector("#vorrat-generieren").addEventListener("click", () => baueAusVorrat(slot));
  app.querySelector('[data-go="vorrat"]')?.addEventListener("click", (e) => { e.stopPropagation(); view = "vorrat"; render(); });
}

/* Offline-Generator (generator.js): kombiniert den tatsächlichen Bestand nach
   festen Küchenmustern zu neuen Rezepten – ohne API-Key und ohne Netz.
   Jeder Klick würfelt neu, die Ergebnisse landen im gemeinsamen Rezeptpool. */
function baueAusVorrat(slot, prefix = "") {
  const s = getState();
  aiFehler = null;
  if (slot === "snack") {
    // Der Generator baut Hauptmahlzeiten – Snacks brauchen eigene Muster
    // (Gefrieren, Dörren) und kommen aus der Datenbank oder von Claude.
    genHinweis = prefix + "Der Vorrats-Generator baut Hauptmahlzeiten. Snack-Ideen kommen aus der Rezeptdatenbank oder von Claude.";
    render();
    return;
  }
  const tiefe = vorratsTiefe(s.bestand);
  if (tiefe.belegt < 3) {
    genHinweis = prefix + `Dafür ist der Vorrat noch zu dünn (${tiefe.belegt} von ${tiefe.gesamt} Bausteinen). `
      + "Es fehlt vor allem: " + tiefe.fehlend.map((f) => BAUSTEIN_NAMEN[f] || f).join(", ") + ".";
    render();
    return;
  }
  vorratWurf += 1;
  const neue = generiereAusVorrat(s.profil, s.bestand, slot, 3, tagesSeed(heuteStr(), vorratWurf));
  if (!neue.length) {
    genHinweis = prefix + "Aus diesem Bestand ließ sich gerade nichts bauen, das zu deinem Profil passt.";
    render();
    return;
  }
  s.vorratRezepte = [...neue, ...(s.vorratRezepte || []).filter((r) => !neue.some((n) => n.id === r.id))].slice(0, 24);
  save();
  if (slot === "snack") stelleSnacksBereit(true); else stelleVorschlaegeBereit(true);
  genHinweis = prefix + `${neue.length} Rezepte aus deinem Bestand gebaut – erkennbar am Vorrats-Etikett.`;
  render();
}

/* AI-Rezeptgenerierung (Kap. 4.3): 3 frische Vorschläge aus dem Bestand. */
async function starteAiGenerierung(slot) {
  const s = getState();
  if (!s.settings.apiKey) {
    // Ohne Key nicht ins Leere laufen lassen: der Offline-Generator kann
    // dasselbe Versprechen einlösen, nur ohne freie Rezeptideen.
    baueAusVorrat(slot, "Kein API-Key hinterlegt, deshalb offline aus dem Vorrat gebaut. "
      + "Für freie Rezeptideen von Claude den Key einmalig im Profil eintragen. ");
    return;
  }
  aiLaeuft = true;
  aiFehler = null;
  render();
  try {
    const neue = await generiereRezepte(s.settings.apiKey, s.profil, s.bestand, slot);
    s.aiRezepte = [...neue, ...(s.aiRezepte || [])].slice(0, 24);  // jüngste behalten
    save();
    // Neue Rezepte in die passende Vorschlagsschiene würfeln
    if (slot === "snack") stelleSnacksBereit(true);
    else stelleVorschlaegeBereit(true);
  } catch (e) {
    aiFehler = e.message;
  }
  aiLaeuft = false;
  render();
}

/* ---------------------------------------------------------- Rezept-Detail */
/* Ein Rezept öffnen. Der Zurück-Link zeigt auf den Tab, aus dem es kam –
   das Detail liegt über dem Screen, der Tab wechselt dabei nicht. */
function oeffneRezept(id) {
  const rezept = findRezept(id);
  if (!rezept) return;
  detailRezept = rezept;
  render();
}

function renderRezeptDetail(vorlage) {
  const s = getState();
  // Nach Bearbeiten/Merken kann das Objekt veraltet sein – über die id neu holen.
  const rezept = findRezept(vorlage.id) || vorlage;
  detailRezept = rezept;
  const ab = bestandsAbgleich(rezept, s.bestand);
  const tip = TIPPS[Math.abs(hashCode(rezept.id)) % TIPPS.length];
  // Sichtbare Rückkopplung Achse 5: auf welche gewählten Ziele zahlt das Rezept ein?
  const zielePassend = zielTreffer(rezept, s.profil.ziele || []).filter((t) => t.fit > 0).map((t) => t.ziel.name);
  // … und Achse 3: welche deiner Lieblingszutaten stecken drin?
  const vorliebenPassend = vorliebenTreffer(rezept, s.profil).map((v) => v.name);
  const gemerkt = istGemerkt(s, rezept.id);
  const gespeichert = gemerkt ? findeGemerkt(s, rezept.id) : null;
  const meta = [rezept.cuisine, `${rezept.gesamtzeit_min.gesamt} Min`, rezept.schwierigkeit, portionenText(rezept.portionen)]
    .filter(Boolean).join(" · ");

  zeigeApp(`
    <div class="fade-in">
      <div class="detail-head">
        <button class="backlink" id="zurueck">${icon("zurueck", 20)}${view === "kochbuch" ? "Kochbuch" : "Heute"}</button>
        ${istEigen(rezept) ? "" : `
          <button class="merk-btn${gemerkt ? " an" : ""}" id="merken" aria-pressed="${gemerkt}">
            ${icon(gemerkt ? "gemerkt" : "merken", 19)}${gemerkt ? "gemerkt" : "merken"}
          </button>`}
      </div>
      <div class="screen-header" style="margin-top:10px">
        <h1>${esc(rezept.name)}</h1>
        <p class="subtle small">${esc(meta)}</p>
        ${quellenBadge(rezept) ? `<div class="card-tags" style="margin-top:8px">${quellenBadge(rezept)}</div>` : ""}
      </div>
      <div class="card">
        ${rezept.zutaten.map((z) => {
          const fehlt = ab.fehlt.includes(z);
          return `<div class="list-item">
            <span class="check">${icon(fehlt ? "checkLeer" : "check", 24)}</span>
            <div class="grow${fehlt ? " mute" : ""}">${esc(zutatText(z))}${z.optional ? ' <span class="subtle small">(optional)</span>' : ""}</div>
            ${fehlt ? '<span class="badge warn">fehlt</span>' : `<span class="value small">${esc(bestandsText(z, s.bestand))}</span>`}
          </div>`;
        }).join("")}
      </div>
      ${vorliebenPassend.length ? `
        <div class="card hint-card">${icon("idee", 20)}
          <div class="hint-body"><b>Trifft deine Vorlieben</b>${esc(vorliebenPassend.join(" · "))}</div>
        </div>` : ""}
      ${zielePassend.length ? `
        <div class="card hint-card">${icon("ziel", 20)}
          <div class="hint-body"><b>Zahlt auf deine Ziele ein</b>${esc(zielePassend.join(" · "))}</div>
        </div>` : ""}
      ${rezept.naehrwert_einordnung?.makro_hinweis ? `
        <div class="card hint-card">${icon("tipp", 20)}
          <div class="hint-body"><b>Gut zu wissen</b>${esc(rezept.naehrwert_einordnung.makro_hinweis)}</div>
        </div>` : ""}
      ${ersatzIdeenHtml(ab.fehlt, s.profil)}
      ${gemerkt ? `
        <div class="card">
          <h2>Deine Notiz</h2>
          <textarea id="rezept-notiz" rows="2" placeholder="z. B. mit doppelt Knoblauch, Backofen 10 Min länger">${esc(gespeichert.notiz || "")}</textarea>
          <p class="subtle small" style="margin-top:8px">Wird beim Verlassen des Feldes gesichert.</p>
        </div>` : ""}
      <div class="card hint-card">${icon("tipp", 20)}<span class="hint-body">${esc(tip.text)}</span></div>
      ${ab.fehlt.length > 0 ? `
        <button class="btn" id="einkauf-starten">${ab.fehlt.length === 1 ? "1 Sache" : `${ab.fehlt.length} Sachen`} auf die Einkaufsliste</button>
        <button class="btn secondary" id="kochen-trotzdem">Trotzdem kochen</button>`
        : `<button class="btn" id="kochen">Jetzt kochen</button>`}
      ${istEigen(rezept) ? `
        <button class="btn secondary" id="rezept-bearbeiten">${icon("stift", 19)}Rezept bearbeiten</button>
        <button class="btn danger" id="rezept-loeschen">Rezept löschen</button>` : ""}
    </div>`, `rezept:${rezept.id}`);

  app.querySelector("#zurueck").addEventListener("click", () => { detailRezept = null; render(); });
  /* Eigene Rezepte haben keinen Merken-Schalter: sie stehen ohnehin nur im
     Kochbuch. Ihr Gegenstück ist „Rezept löschen" unten – mit Rückfrage. */
  app.querySelector("#merken")?.addEventListener("click", () => {
    if (!gemerkt) {
      merken(s, rezept);
      save();
      toast("Im Kochbuch gespeichert");
      renderRezeptDetail(rezept);
      return;
    }
    vergessen(s, rezept.id);
    save();
    toast("Aus dem Kochbuch genommen");
    if (view === "kochbuch") { detailRezept = null; render(); return; }
    renderRezeptDetail(rezept);
  });
  app.querySelector("#rezept-notiz")?.addEventListener("change", (e) => {
    setzeNotiz(s, rezept.id, e.target.value);
    save();
    toast("Notiz gesichert");
  });
  app.querySelector("#rezept-bearbeiten")?.addEventListener("click", () => {
    editor = entwurfAus(rezept);
    render();
  });
  app.querySelector("#rezept-loeschen")?.addEventListener("click", () => loescheEigenes(rezept));
  app.querySelector("#kochen")?.addEventListener("click", () => startKochen(rezept));
  app.querySelector("#kochen-trotzdem")?.addEventListener("click", () => startKochen(rezept));
  app.querySelector("#einkauf-starten")?.addEventListener("click", () => {
    // Rezeptbezogene Einkaufsliste: nur die fehlenden Zutaten (Kap. 4.4)
    s.einkauf.rezept = ab.fehlt.map((z) => ({ zutat_id: z.zutat_id, name: z.zutat_name, menge: z.menge, einheit: z.einheit, erledigt: false }));
    s.einkauf.rezeptId = rezept.id;
    save();
    detailRezept = null;
    view = "einkauf";
    render();
  });
}

/* Rechte Spalte der Zutaten-Checkliste (Design 09): „~350 g da" / „6 da". */
function bestandsText(z, bestand) {
  const item = z.zutat_id && bestand.find((b) => b.zutat_id === z.zutat_id);
  if (!item) return "";
  const m = mengeAnzeige(item);
  return m === "vorrätig" || m === "leer" ? m : `${m} da`;
}

function zutatText(z) {
  const menge = z.menge != null ? `${z.menge} ${z.einheit === "Stk" ? "" : z.einheit + " "}`.trim() + " " : "";
  return `${menge}${z.zutat_name}`;
}

/* Ersatz-Ideen für fehlende Zutaten (Substitutions-DB): statt einkaufen ggf.
   pflanzlich ersetzen – Profil-Ausschlüsse sind bereits herausgefiltert.
   Ei ist funktionsbasiert (binden/lockern/aufschlagen …), daher mehrere Zeilen. */
function ersatzIdeenHtml(fehlt, profil) {
  const zeilen = [];
  for (const z of fehlt) {
    const vs = ersatzVorschlaege(z.zutat_id, profil);
    for (const e of vs) {
      // Mehrere Datensätze je Zutat (Ei-Funktionen, Schlag- vs. Kochsahne) unterscheidbar halten
      const label = e.funktion || (vs.length > 1 ? e.original : null);
      zeilen.push(`
        <div class="list-item">
          <div class="grow small">
            <b>${esc(z.zutat_name)}</b>${label ? ` <span class="subtle">(${esc(label)})</span>` : ""}
            → ${esc(e.name)} <span class="subtle">· ${esc(e.verhaeltnis)}</span>
          </div>
        </div>`);
    }
  }
  if (!zeilen.length) return "";
  return `
    <div class="card">
      <h2>Fehlt? Lässt sich ersetzen</h2>
      <p class="subtle small" style="margin:6px 0 4px">Pflanzliche Alternativen aus der Substitutions-DB – Details im Wissen-Tab unter „Ersatz“.</p>
      ${zeilen.join("")}
    </div>`;
}

function hashCode(str) {
  let hsh = 0;
  for (const c of str) hsh = ((hsh << 5) - hsh + c.charCodeAt(0)) | 0;
  return hsh;
}

/* ---------------------------------------------------------------- Kochbuch
   Kap. 4.10: der Ort, an dem Rezepte bleiben. Gemerkte Vorschläge und eigene
   Rezepte liegen hier nebeneinander – beides vollwertige Rezepte, die durch
   Bestandsabgleich, Kochmodus und Abbuchung laufen. */
let kochbuchSuche = "";
let kochbuchFilter = "alle";
let editor = null;          // Entwurf des eigenen Rezepts (siehe kochbuch.js)

function kochbuchLeerHtml() {
  const wege = [
    ["merken", "Einen Vorschlag merken", "heute"],
    ["stift", "Eigenes Rezept eintragen", "editor"],
  ];
  return `
    <div class="empty-state">
      ${icon("kochbuch", 52)}
      <h3>Dein Kochbuch ist leer</h3>
      <p>Was dir schmeckt, muss nicht jeden Tag neu gewürfelt werden. Tipp bei einem Rezept oben rechts auf „merken“ – dann liegt es hier, auch wenn Claude längst neue Ideen hatte.</p>
    </div>
    <div class="section-gap">
      <h2>Zwei Wege hinein</h2>
      ${wege.map(([ic, titel, ziel]) => `
        <button class="card weg-karte" data-kweg="${ziel}">
          ${icon(ic, 24)}
          <span class="grow"><span class="name">${titel}</span></span>
          ${icon("weiter", 20)}
        </button>`).join("")}
    </div>`;
}

function renderKochbuch() {
  const s = getState();
  const alle = s.kochbuch || [];
  const kochbar = alle.filter((r) => bestandsAbgleich(r, s.bestand).fehlt.length === 0).length;

  zeigeApp(`
    <div class="fade-in">
      <div class="screen-header">
        <div class="card-row" style="align-items:center">
          <h1>kochbuch</h1>
          <div class="head-actions">
            <button class="pill-btn" id="eigenes-neu">${icon("plus", 19)}Eigenes</button>
          </div>
        </div>
        <p class="subtle small">${alle.length ? `${alle.length} ${alle.length === 1 ? "Rezept" : "Rezepte"} · ${kochbar} sofort kochbar` : "Noch nichts gespeichert"}</p>
      </div>
      ${alle.length ? `
        <input type="text" id="kochbuch-suche" placeholder="Suchen – Name, Küche oder Zutat" value="${esc(kochbuchSuche)}" autocomplete="off">
        <div class="chip-wrap chip-nav" style="margin:12px 0 16px">
          ${KOCHBUCH_FILTER.map((f) => `
            <button class="chip ${kochbuchFilter === f.id ? "selected" : ""}" data-kfilter="${f.id}">${esc(f.name)}</button>`).join("")}
        </div>
        <div id="kochbuch-liste">${kochbuchTrefferHtml()}</div>
        <p class="centered-note">Gemerkte Rezepte bleiben, auch wenn Claude neue Ideen hat.<br>Sie tauchen ganz normal in den Tagesvorschlägen auf.</p>`
        : kochbuchLeerHtml()}
    </div>`, "kochbuch");

  bindKochbuchKarten();
  app.querySelectorAll("[data-kfilter]").forEach((b) => b.addEventListener("click", () => {
    kochbuchFilter = b.dataset.kfilter;
    renderKochbuch();
  }));
  app.querySelectorAll("[data-kweg]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.kweg === "editor") { editor = leererEntwurf(); render(); return; }
    view = "heute";
    render();
  }));
  app.querySelector("#eigenes-neu").addEventListener("click", () => { editor = leererEntwurf(); render(); });
  const feld = app.querySelector("#kochbuch-suche");
  feld?.addEventListener("input", () => {
    kochbuchSuche = feld.value;
    // Nur die Trefferliste tauschen, damit die Tastatur den Fokus behält
    app.querySelector("#kochbuch-liste").innerHTML = kochbuchTrefferHtml();
    bindKochbuchKarten();
  });
}

/* Trefferliste des Kochbuchs – „N× gekocht" kommt aus der Historie. */
function kochbuchTrefferHtml() {
  const s = getState();
  const treffer = kochbuchListe(s, { suche: kochbuchSuche, quelle: kochbuchFilter });
  if (!treffer.length) {
    return `
      <div class="empty-state">
        ${icon("suche", 42)}
        <h3>Nichts gefunden</h3>
        <p>Kein gespeichertes Rezept passt zu dieser Suche.</p>
      </div>`;
  }
  return treffer.map((rezept) => {
    const oft = gekochtAnzahl(s, rezept.id);
    const meta = [rezeptMeta(rezept), oft ? `${oft}× gekocht` : ""].filter(Boolean).join(" · ");
    return rezeptKarte({ rezept, abgleich: bestandsAbgleich(rezept, s.bestand) }, esc(meta), { herkunft: false });
  }).join("");
}

function bindKochbuchKarten() {
  app.querySelectorAll("[data-rezept]").forEach((c) => c.addEventListener("click", () => {
    oeffneRezept(c.dataset.rezept);
  }));
}

async function loescheEigenes(rezept) {
  if (!await bestaetige({
    titel: "Rezept löschen?",
    text: `„${rezept.name}“ steht nur in deinem Kochbuch – gelöscht ist es weg.`,
    bestaetigen: "Löschen", danger: true, symbol: "achtung",
  })) return;
  vergessen(getState(), rezept.id);
  save();
  detailRezept = null;
  view = "kochbuch";
  toast("Rezept gelöscht");
  render();
}

/* ------------------------------------------------------- Rezept-Editor
   Eigene Rezepte im gleichen Schema wie alles andere – nur so laufen sie durch
   Profilfilter, Bestandsabgleich, Timer und Abbuchung. Zumutbar bleibt das,
   weil Vorratio die lästigen Teile übernimmt: Zutaten kommen per
   Vorschlagsliste aus dem Katalog (nur ein eindeutiger Treffer wird mit dem
   Vorrat verknüpft), Ernährungsform und Allergene werden aus den Zutaten
   vorgeschlagen und bleiben korrigierbar. */
const FORM_TAG_NAMEN = {
  vegan: "vegan", vegetarisch: "vegetarisch", pescetarisch: "pescetarisch",
  mit_fisch: "mit Fisch", mit_fleisch: "mit Fleisch", mit_gefluegel: "mit Geflügel",
};

/* Sichtbare Eingaben in den Entwurf übernehmen – vor jedem Neuzeichnen. */
function uebernehmeEditorFelder() {
  if (!editor) return;
  app.querySelectorAll("[data-e]").forEach((el) => { editor[el.dataset.e] = el.value; });
  for (const [attr, liste] of [["data-ez", editor.zutaten], ["data-es", editor.schritte]]) {
    app.querySelectorAll(`[${attr}]`).forEach((el) => {
      const [i, feld] = el.getAttribute(attr).split(".");
      if (liste[i]) liste[i][feld] = el.value;
    });
  }
}

function zeichneEditor() {
  uebernehmeEditorFelder();
  renderRezeptEditor();
}

function editorZutatenHtml() {
  return editor.zutaten.map((z, i) => `
    <div class="zeile-zutat">
      <input type="text" data-ez="${i}.menge" inputmode="decimal" placeholder="Menge" value="${esc(z.menge)}">
      <select data-ez="${i}.einheit">
        ${EDITOR_EINHEITEN.map((e) => `<option value="${e}" ${z.einheit === e ? "selected" : ""}>${e === "nach_Bedarf" ? "n. Bedarf" : e}</option>`).join("")}
      </select>
      <button class="icon-btn" data-zutat-weg="${i}" aria-label="Zutat entfernen">${icon("x", 20)}</button>
      <input class="voll" type="text" data-ez="${i}.zutat_name" list="zutat-katalog" placeholder="Zutat – aus der Liste wählen" value="${esc(z.zutat_name)}">
    </div>`).join("");
}

function editorSchritteHtml() {
  return editor.schritte.map((s, i) => `
    <div class="zeile-schritt">
      <div class="card-row" style="align-items:center">
        <h2 style="margin:0">Schritt ${i + 1}</h2>
        <button class="icon-btn" data-schritt-weg="${i}" aria-label="Schritt entfernen">${icon("x", 20)}</button>
      </div>
      <textarea data-es="${i}.text" rows="2" placeholder="Was ist zu tun?">${esc(s.text)}</textarea>
      <div class="zeile-timer">
        <input type="text" data-es="${i}.minuten" inputmode="numeric" placeholder="Min" value="${esc(s.minuten)}">
        <input type="text" data-es="${i}.timer_name" placeholder="Timer-Name (optional)" value="${esc(s.timer_name)}">
      </div>
    </div>`).join("");
}

function renderRezeptEditor() {
  const s = getState();
  const katalog = katalogZutaten(s);
  const neu = !editor.id;
  // Solange niemand die Chips angefasst hat, folgen sie den Zutaten.
  if (!editor.tagsManuell) {
    const auto = tagsAusZutaten(editor.zutaten.map((z) => ({ zutat_name: z.zutat_name })));
    editor.ernaehrungsform = auto.ernaehrungsform;
    editor.allergene = auto.allergene;
  }
  const allergene = AUSSCHLUESSE.filter((a) => a.gruppe === "allergie");

  zeigeApp(`
    <div class="fade-in">
      <div class="detail-head">
        <button class="backlink" id="editor-zurueck">${icon("zurueck", 20)}Kochbuch</button>
        <span class="cook-step-count">${neu ? "Neues Rezept" : "Bearbeiten"}</span>
      </div>
      <div class="screen-header" style="margin-top:10px">
        <h1>${neu ? "eigenes rezept" : "rezept bearbeiten"}</h1>
        <p class="subtle small">Nur Name, Zutaten und Schritte sind Pflicht. Den Rest füllt Vorratio auf, so gut es geht.</p>
      </div>

      <div class="card">
        <label class="field">Name
          <input type="text" data-e="name" placeholder="z. B. Omas Kartoffelsuppe" value="${esc(editor.name)}"></label>
        <label class="field">Kategorie
          <input type="text" data-e="kategorie" placeholder="z. B. Suppe/Eintopf" value="${esc(editor.kategorie)}"></label>
        <label class="field">Küche
          <input type="text" data-e="cuisine" placeholder="z. B. deutsch" value="${esc(editor.cuisine)}"></label>
        <label class="field" style="margin-bottom:0">Gesamtzeit in Minuten
          <input type="text" data-e="zeit" inputmode="numeric" placeholder="leer = aus den Timern gerechnet" value="${esc(editor.zeit)}"></label>
      </div>

      <div class="card">
        <div class="stepper">
          <button id="e-p-minus" aria-label="Weniger Portionen">${icon("minus", 22)}</button>
          <span style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span class="count">${editor.portionen}</span>
            <span class="subtle small">Portionen</span>
          </span>
          <button id="e-p-plus" class="primary" aria-label="Mehr Portionen">${icon("plus", 22)}</button>
        </div>
        <hr class="divider" style="margin:18px 0 14px">
        <h2>Wann passt das?</h2>
        <div class="chip-wrap">
          ${MAHLZEITEN.map((m) => `
            <button class="chip ${editor.mahlzeitentyp.includes(m.id) ? "selected" : ""}" data-emahl="${m.id}">${esc(m.name)}</button>`).join("")}
        </div>
        <h2 class="section-gap">Aufwand</h2>
        <div class="chip-wrap">
          ${SCHWIERIGKEITEN.map((g) => `
            <button class="chip ${editor.schwierigkeit === g ? "selected" : ""}" data-egrad="${g}">${g}</button>`).join("")}
        </div>
      </div>

      <h2 class="section-gap">Zutaten</h2>
      <p class="subtle small" style="margin-bottom:12px">Zutaten aus der Vorschlagsliste werden mit deinem Vorrat verrechnet – abgeglichen, eingekauft, abgebucht. Frei getippte Namen stehen im Rezept, zählen aber nicht für den Bestand.</p>
      <div class="card">
        ${editorZutatenHtml()}
        <button class="chip chip-plus" id="zutat-mehr">${icon("plus", 16)}Zutat</button>
      </div>

      <h2 class="section-gap">Schritte</h2>
      <p class="subtle small" style="margin-bottom:12px">Ein Handgriff pro Schritt. Wo du eine Minutenzahl einträgst, gibt es im Kochmodus einen benannten Timer.</p>
      <div class="card">
        ${editorSchritteHtml()}
        <button class="chip chip-plus" id="schritt-mehr">${icon("plus", 16)}Schritt</button>
      </div>

      <h2 class="section-gap">Für wen ist das Rezept?</h2>
      <p class="subtle small" style="margin-bottom:10px">${editor.tagsManuell
        ? "Von dir gesetzt – Vorratio filtert danach."
        : "Aus den Zutaten abgeleitet. Stimmt etwas nicht, tipp es einfach an."}</p>
      <div class="chip-wrap">
        ${Object.entries(FORM_TAG_NAMEN).map(([id, name]) => `
          <button class="chip ${editor.ernaehrungsform.includes(id) ? "selected" : ""}" data-eform="${id}">${esc(name)}</button>`).join("")}
      </div>
      <h2 class="section-gap">Enthält</h2>
      <p class="subtle small" style="margin-bottom:10px">Harte Ausschlüsse: Wer eins davon im Profil ausgeschlossen hat, bekommt dieses Rezept nie vorgeschlagen.</p>
      <div class="chip-wrap">
        ${allergene.map((a) => `
          <button class="chip ${editor.allergene.includes(a.id) ? "selected" : ""}" data-eall="${a.id}">${esc(a.name)}</button>`).join("")}
      </div>

      <label class="field section-gap">Gut zu wissen (optional)
        <textarea data-e="hinweis" rows="2" placeholder="z. B. schmeckt aufgewärmt besser">${esc(editor.hinweis)}</textarea></label>

      <button class="btn" id="editor-sichern">${neu ? "Ins Kochbuch legen" : "Änderungen sichern"}</button>
      <button class="btn secondary" id="editor-abbrechen">Abbrechen</button>
      <datalist id="zutat-katalog">${katalog.map((z) => `<option value="${esc(z.name)}"></option>`).join("")}</datalist>
    </div>`, `editor:${editor.id || "neu"}`);

  bindEditor();
}

function bindEditor() {
  const zurueck = async () => {
    uebernehmeEditorFelder();
    const leer = !String(editor.name).trim()
      && !editor.zutaten.some((z) => String(z.zutat_name).trim())
      && !editor.schritte.some((s) => String(s.text).trim());
    if (!leer && !await bestaetige({
      titel: "Rezept verwerfen?",
      text: editor.id ? "Die Änderungen gehen verloren." : "Das angefangene Rezept ist noch nicht im Kochbuch.",
      bestaetigen: "Verwerfen", abbrechen: "Weiter schreiben", danger: true, symbol: "achtung",
    })) return;
    editor = null;
    render();
  };
  app.querySelector("#editor-zurueck").addEventListener("click", zurueck);
  app.querySelector("#editor-abbrechen").addEventListener("click", zurueck);

  app.querySelector("#e-p-minus").addEventListener("click", () => { editor.portionen = Math.max(1, editor.portionen - 1); zeichneEditor(); });
  app.querySelector("#e-p-plus").addEventListener("click", () => { editor.portionen++; zeichneEditor(); });
  app.querySelectorAll("[data-emahl]").forEach((b) => b.addEventListener("click", () => { toggle(editor.mahlzeitentyp, b.dataset.emahl); zeichneEditor(); }));
  app.querySelectorAll("[data-egrad]").forEach((b) => b.addEventListener("click", () => { editor.schwierigkeit = b.dataset.egrad; zeichneEditor(); }));
  app.querySelectorAll("[data-eform]").forEach((b) => b.addEventListener("click", () => {
    editor.tagsManuell = true;
    toggle(editor.ernaehrungsform, b.dataset.eform);
    zeichneEditor();
  }));
  app.querySelectorAll("[data-eall]").forEach((b) => b.addEventListener("click", () => {
    editor.tagsManuell = true;
    toggle(editor.allergene, b.dataset.eall);
    zeichneEditor();
  }));
  app.querySelectorAll("[data-zutat-weg]").forEach((b) => b.addEventListener("click", () => {
    uebernehmeEditorFelder();
    editor.zutaten.splice(Number(b.dataset.zutatWeg), 1);
    if (!editor.zutaten.length) editor.zutaten.push(leereZutat());
    renderRezeptEditor();
  }));
  app.querySelectorAll("[data-schritt-weg]").forEach((b) => b.addEventListener("click", () => {
    uebernehmeEditorFelder();
    editor.schritte.splice(Number(b.dataset.schrittWeg), 1);
    if (!editor.schritte.length) editor.schritte.push(leererSchritt());
    renderRezeptEditor();
  }));
  app.querySelector("#zutat-mehr").addEventListener("click", () => {
    uebernehmeEditorFelder();
    editor.zutaten.push(leereZutat());
    renderRezeptEditor();
  });
  app.querySelector("#schritt-mehr").addEventListener("click", () => {
    uebernehmeEditorFelder();
    editor.schritte.push(leererSchritt());
    renderRezeptEditor();
  });
  app.querySelector("#editor-sichern").addEventListener("click", () => {
    uebernehmeEditorFelder();
    const s = getState();
    const katalog = katalogZutaten(s);
    const fehler = entwurfFehler(editor, katalog);
    if (fehler) { toast(fehler, "warn"); return; }
    const rezept = eigenesRezept(editor, katalog);
    const neu = !editor.id;
    if (neu) s.kochbuch.unshift(rezept); else ersetze(s, rezept);
    save();
    editor = null;
    view = "kochbuch";
    detailRezept = rezept;
    toast(neu ? "Rezept im Kochbuch" : "Rezept aktualisiert");
    render();
  });
}

/* -------------------------------------------------------------- Kochmodus */
function startKochen(rezept) {
  cook = { rezept, portionen: rezept.portionen || 2, step: -1, timer: null };
  render();
}

function renderKochmodus() {
  const { rezept, step } = cook;
  clearTimerTick();

  if (step === -1) {
    const faktor = cook.portionen / (rezept.portionen || cook.portionen);
    const vorschau = rezept.zutaten.filter((z) => z.menge != null).slice(0, 3)
      .map((z) => `${Math.round(z.menge * faktor * 10) / 10} ${z.einheit === "Stk" ? "×" : z.einheit} ${z.zutat_name}`)
      .join(" · ");
    zeigeApp(`
      <div class="fade-in">
        <button class="backlink" id="abbrechen">${icon("zurueck", 20)}Abbrechen</button>
        <div class="screen-header" style="margin-top:10px"><h1>${esc(rezept.name)}</h1><p class="subtle">Für wie viele kochst du?</p></div>
        <div class="card" style="padding:26px 20px;border-radius:20px">
          <div class="stepper">
            <button id="p-minus" aria-label="Weniger Portionen">${icon("minus", 22)}</button>
            <span class="count">${cook.portionen}</span>
            <button id="p-plus" class="primary" aria-label="Mehr Portionen">${icon("plus", 22)}</button>
          </div>
          <p class="subtle small" style="text-align:center;margin-top:16px">Portionen · Mengen rechnen sich mit</p>
        </div>
        ${vorschau ? `
          <div class="card hint-card" style="flex-direction:column">
            <b>Für ${cook.portionen} ${cook.portionen === 1 ? "Portion" : "Portionen"} brauchst du</b>
            <span>${esc(vorschau)}</span>
          </div>` : ""}
        <button class="btn" id="los">Los kochen</button>
      </div>`, "kochen-portionen");
    app.querySelector("#abbrechen").addEventListener("click", () => { cook = null; render(); });
    app.querySelector("#p-minus").addEventListener("click", () => { cook.portionen = Math.max(1, cook.portionen - 1); renderKochmodus(); });
    app.querySelector("#p-plus").addEventListener("click", () => { cook.portionen++; renderKochmodus(); });
    app.querySelector("#los").addEventListener("click", () => { cook.step = 0; renderKochmodus(); });
    return;
  }

  if (step >= rezept.schritte.length) { renderValidierung(); return; }

  const s = rezept.schritte[step];
  const hatTimer = s.dauer_sekunden != null && s.dauer_sekunden > 0;
  cook.timer = hatTimer
    ? { name: s.timer_name || "Timer", typ: s.timer_typ || "", total: s.dauer_sekunden, rest: s.dauer_sekunden, laeuft: false, gestartet: false, fertig: false, ende: null }
    : null;

  zeigeApp(`
    <div class="fade-in cook-screen">
      <div class="cook-head">
        <button class="backlink" id="abbrechen">${icon("zurueck", 20)}Abbrechen</button>
        <span class="cook-step-count">Schritt ${step + 1} von ${rezept.schritte.length}</span>
      </div>
      ${progressBar(step + 1, rezept.schritte.length)}
      ${s.temperatur_c ? `<p class="cook-meta">${s.temperatur_c} °C</p>` : ""}
      <p class="cook-step">${esc(s.text)}</p>
      <div id="timer-slot">${timerBoxHtml()}</div>
      ${hatTimer ? '<p class="centered-note">Der Timer läuft weiter, solange die App offen bleibt.</p>' : ""}
      <div class="btn-row">
        ${step > 0 ? `<button class="btn secondary icon-only" id="prev" aria-label="Zurück">${icon("zurueck", 20)}</button>` : ""}
        <button class="btn" id="next">${step === rezept.schritte.length - 1 ? "Fertig" : "Weiter"}</button>
      </div>
    </div>`, `kochen:${step}`);

  app.querySelector("#abbrechen").addEventListener("click", async () => {
    if (await bestaetige({
      titel: "Kochen abbrechen?",
      text: "Der angefangene Durchlauf geht verloren. Es wird nichts abgebucht.",
      bestaetigen: "Abbrechen", abbrechen: "Weiterkochen", danger: true, symbol: "achtung",
    })) { cook = null; render(); }
  });
  app.querySelector("#prev")?.addEventListener("click", () => { cook.step--; renderKochmodus(); });
  app.querySelector("#next").addEventListener("click", () => { cook.step++; renderKochmodus(); });
  bindTimer();
}

/* --------------------------------------------------------------- Timer
   Design 12/30: benannter Timer auf Tannenfläche, Fortschrittsbalken,
   Pause / +1 Min; abgelaufen wechselt die Kachel auf Terrakotta. */
function timerBoxHtml() {
  const t = cook?.timer;
  if (!t) return "";
  if (t.fertig) {
    return `
      <div class="timer-box done">
        <span class="timer-name">${esc(t.name)} · fertig</span>
        <span class="timer-display">Fertig!</span>
        <div class="timer-actions"><button id="timer-aus">Timer aus</button></div>
      </div>`;
  }
  const pct = t.total ? Math.max(0, Math.min(100, ((t.total - t.rest) / t.total) * 100)) : 0;
  const status = t.laeuft ? "läuft" : t.gestartet ? "pausiert" : (t.typ || "bereit");
  return `
    <div class="timer-box">
      <span class="timer-name">${esc(t.name)} · ${esc(status)}</span>
      <span class="timer-display" id="timer-display">${fmtZeit(t.rest)}</span>
      <div class="timer-track"><div id="timer-track-fill" style="width:${pct}%"></div></div>
      <div class="timer-actions">
        <button id="timer-toggle">${t.laeuft ? "Pause" : t.gestartet ? "Weiter" : "Timer starten"}</button>
        <button id="timer-plus">+1 Min</button>
      </div>
    </div>`;
}

function renderTimerBox() {
  const slot = app.querySelector("#timer-slot");
  if (!slot) return;
  slot.innerHTML = timerBoxHtml();
  bindTimer();
}

function bindTimer() {
  app.querySelector("#timer-toggle")?.addEventListener("click", () => {
    const t = cook.timer;
    if (t.laeuft) { t.laeuft = false; clearTimerTick(); }
    else {
      if (!t.gestartet && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
      t.gestartet = true;
      t.laeuft = true;
      t.ende = Date.now() + t.rest * 1000;
      startTimerTick();
    }
    renderTimerBox();
  });
  app.querySelector("#timer-plus")?.addEventListener("click", () => {
    const t = cook.timer;
    t.rest += 60;
    t.total += 60;
    if (t.laeuft) t.ende += 60000;
    renderTimerBox();
  });
  app.querySelector("#timer-aus")?.addEventListener("click", () => {
    cook.timer = { ...cook.timer, fertig: false, laeuft: false, gestartet: false, rest: cook.timer.total };
    renderTimerBox();
  });
}

let timerInterval = null;
function clearTimerTick() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

function startTimerTick() {
  clearTimerTick();
  timerInterval = setInterval(() => {
    const t = cook?.timer;
    if (!t || !t.laeuft) { clearTimerTick(); return; }
    t.rest = Math.max(0, Math.round((t.ende - Date.now()) / 1000));
    if (t.rest <= 0) {
      clearTimerTick();
      t.laeuft = false;
      t.fertig = true;
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Vorratio", { body: `${t.name}: fertig!` });
      }
      renderTimerBox();
      return;
    }
    const d = document.getElementById("timer-display");
    const f = document.getElementById("timer-track-fill");
    if (d) d.textContent = fmtZeit(t.rest);
    if (f) f.style.width = `${((t.total - t.rest) / t.total) * 100}%`;
  }, 250);
}

function fmtZeit(sek) {
  if (sek >= 3600) return `${Math.floor(sek / 3600)} h ${Math.round((sek % 3600) / 60)} min`;
  const m = Math.floor(sek / 60), s2 = sek % 60;
  return `${m}:${String(s2).padStart(2, "0")}`;
}

/* Abschluss: Abhaken → Validierung → Abbuchung (Kap. 4.6) */
function renderValidierung() {
  const { rezept, portionen } = cook;
  zeigeApp(`
    <div class="fade-in">
      <div style="margin-bottom:20px">
        ${icon("geschafft", 44, "ic-accent")}
        <h1 style="margin-top:14px">fertig gekocht</h1>
        <p class="subtle" style="margin-top:8px">Kurz bestätigen, dann bucht vorratio den Verbrauch ab – mit Toleranzband.</p>
      </div>
      <div class="card">
        <div class="card-row">
          <h3 style="font-size:18px">${esc(rezept.name)}</h3>
          <span class="badge neutral">${portionen} ${portionen === 1 ? "Portion" : "Portionen"}</span>
        </div>
        <p class="subtle small" style="margin-top:10px">Abgebucht werden die Rezeptmengen × Portionsfaktor. Kleinmengen (EL, TL, Prisen) laufen unter Toleranz.</p>
      </div>
      <button class="btn" id="buchen">Abhaken &amp; abbuchen</button>
      <button class="btn secondary" id="ohne">Fertig ohne Abbuchung</button>
    </div>`, "kochen-fertig");
  app.querySelector("#buchen").addEventListener("click", () => {
    const s = getState();
    const gebucht = abbuchen(rezept, s.bestand, portionen);
    s.historie.unshift({ rezeptId: rezept.id, name: rezept.name, portionen, datum: new Date().toISOString() });
    if (s.einkauf.rezeptId === rezept.id) { s.einkauf.rezept = []; s.einkauf.rezeptId = null; }
    syncWochenliste(s);
    save();
    cook = null;
    detailRezept = null;      // sonst liegt das Rezept-Detail noch über dem Zielscreen
    view = "vorrat";
    render();
    toast(gebucht.length ? `Verbrauch abgebucht · ${gebucht.length} ${gebucht.length === 1 ? "Position" : "Positionen"}` : "Gekocht – nichts abzubuchen");
  });
  app.querySelector("#ohne").addEventListener("click", () => { cook = null; detailRezept = null; view = "heute"; render(); });
}

/* ------------------------------------------------------------------ Vorrat */
let vorratAddOffen = false;
let vorratSuche = "";

function renderVorrat() {
  const s = getState();
  const gruppen = {};
  for (const item of s.bestand) (gruppen[item.kategorie] ||= []).push(item);

  zeigeApp(`
    <div class="fade-in">
      <div class="screen-header">
        <div class="card-row" style="align-items:center">
          <h1>vorrat</h1>
          <div class="head-actions">
            <button class="square-btn" id="diktat-toggle" aria-label="Vorräte diktieren">${icon("mikro", 21)}</button>
            <button class="square-btn" id="scan-toggle" aria-label="Barcode scannen">${icon("barcode", 21)}</button>
            <button class="pill-btn" id="add-toggle">${vorratAddOffen ? icon("x", 19) : icon("plus", 19)}${vorratAddOffen ? "Schließen" : "Erfassen"}</button>
          </div>
        </div>
        <p class="subtle small">${s.bestand.length} Artikel</p>
      </div>
      ${diktat ? diktatUi() : ""}
      ${scanPanel ? barcodeUi() : ""}
      ${vorratAddOffen ? vorratAddForm() : ""}
      ${s.bestand.length === 0 && !vorratAddOffen && !scanPanel && !diktat ? vorratLeerHtml() : ""}
      ${Object.entries(KATEGORIE_NAMEN).filter(([k]) => gruppen[k]?.length).map(([k, titel]) => `
        <div class="section-gap">
          <h2>${titel}</h2>
          <div class="card">
            ${gruppen[k].map((item) => vorratZeile(item)).join("")}
          </div>
        </div>`).join("")}
      ${s.bestand.length ? '<p class="centered-note">Tippe einen Artikel an, um die Menge zu korrigieren.</p>' : ""}
    </div>`, "vorrat");

  app.querySelector("#add-toggle").addEventListener("click", () => { vorratAddOffen = !vorratAddOffen; renderVorrat(); });
  /* Die drei Erfassungswege teilen sich den Platz über der Liste – wer einen
     aufmacht, schließt die anderen. */
  app.querySelector("#scan-toggle").addEventListener("click", () => {
    stoppeKamera();
    stoppeAufnahme();
    diktat = null;
    scanPanel = scanPanel ? null : { status: "start" };
    renderVorrat();
  });
  app.querySelector("#diktat-toggle").addEventListener("click", () => {
    stoppeKamera();
    stoppeAufnahme();
    scanPanel = null;
    diktat = diktat ? null : { status: "start", text: "" };
    renderVorrat();
  });
  bindVorratAdd();
  bindBarcode();
  bindDiktat();
  /* Die drei Wege hinein führen jeweils direkt in ihren Ablauf. */
  app.querySelectorAll("[data-weg]").forEach((b) => b.addEventListener("click", () => {
    const weg = b.dataset.weg;
    if (weg === "erfassen") { vorratAddOffen = true; renderVorrat(); return; }
    if (weg === "barcode") { scanPanel = { status: "start" }; renderVorrat(); return; }
    if (weg === "mikro") { diktat = { status: "start", text: "" }; renderVorrat(); return; }
    // Kassenbon: liegt im Einkauf. Der Klick zählt noch als Nutzergeste,
    // darum öffnet der Dateidialog (= Kamera auf dem iPhone) direkt mit.
    view = "einkauf";
    render();
    app.querySelector("#bon-start")?.click();
    app.querySelector("#bon-key")?.scrollIntoView({ block: "center" });
  }));
  /* Die Bestandszeilen sind Divs mit role="button" – dann müssen sie auch auf
     Enter und Leertaste reagieren, sonst sind sie für Tastatur und Schaltersteuerung
     zwar anspringbar, aber nicht auslösbar. */
  app.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => renderVorratEdit(b.dataset.edit));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      renderVorratEdit(b.dataset.edit);
    });
  });
}

/* Bestandszeile: Schüttgut bekommt den Füllstandsbalken der Übergabe (Design 14),
   zählbare und pauschale Artikel die Mengenangabe rechts. */
function vorratZeile(item) {
  const voll = item.packung || ZUTAT_INDEX[item.zutat_id]?.packung || null;
  const meter = item.art === "schuettgut" && voll && item.menge != null
    ? `<div class="fill-meter"><div style="width:${Math.round(Math.min(1, item.menge / voll) * 100)}%"></div></div>`
    : `<span class="value">${mengeAnzeige(item)}</span>`;
  const zweitzeile = item.art === "schuettgut"
    ? `<span class="subtle small" style="display:block">${mengeAnzeige(item)}</span>` : "";
  return `
    <div class="list-item tappable" data-edit="${item.id}" role="button" tabindex="0">
      <div class="grow"><span class="name">${esc(item.name)}</span>${zweitzeile}</div>
      ${meter}
    </div>`;
}

/* Leerer Vorrat (Design 15): Erklärkarte + die Wege hinein. Sie sind echte
   Buttons – sie sahen vorher tippbar aus, waren es aber nicht. */
function vorratLeerHtml() {
  const wege = [
    ["mikro", "Vorräte aufzählen"],
    ["erfassen", "Aus der Liste tippen"],
    ["barcode", "Barcode scannen"],
    ["kamera", "Kassenbon fotografieren"],
  ];
  return `
    <div class="empty-state">
      ${icon("vorrat", 52)}
      <h3>Noch nichts erfasst</h3>
      <p>Einmalige Aufnahme: Trockenware, Frisches, Konserven, Gewürze. Danach hält vorratio den Stand von allein aktuell.</p>
    </div>
    <div class="section-gap">
      <h2>Vier Wege hinein</h2>
      ${wege.map(([ic, titel]) => `
        <button class="card weg-karte" data-weg="${ic}">
          ${icon(ic, 24)}
          <span class="grow"><span class="name">${titel}</span></span>
          ${icon("weiter", 20)}
        </button>`).join("")}
    </div>`;
}

/* -------------------------------------------- Barcode-Scan (Kap. 6.3)
   EAN → Open-Food-Facts-Lookup → Zutat-Zuordnung bestätigen → Buchung. */
let scanPanel = null;   // {status:'start'|'kamera'|'laden'|'fehler'|'treffer'|'kein_treffer', ...}
let kamera = null;      // aktiver Kamera-Scan { stop }

function stoppeKamera() { kamera?.stop?.(); kamera = null; }

function barcodeUi() {
  const p = scanPanel;
  if (p.status === "start") {
    /* Der Kamera-Weg ist immer da: wo der Browser Strichcodes selbst erkennt,
       läuft der Live-Scan; sonst wird der Code fotografiert und Claude liest
       die Ziffern darunter ab. Erst ohne beides bleibt nur das Eintippen. */
    const live = kameraVerfuegbar();
    const foto = !live && !!getState().settings.apiKey;
    return `
      <div class="section-gap">
        <div class="section-head"><h2>Barcode</h2><button class="backlink" id="ean-abbrechen">Abbrechen</button></div>
        ${live || foto ? `
          <button class="scan-view" id="ean-kamera" style="width:100%">
            <span style="width:210px;height:110px;border-radius:12px;border:2px solid rgba(255,253,248,.85)"></span>
            <span>${live ? "Strichcode ins Feld halten" : "Strichcode fotografieren"}</span>
          </button>
          ${foto ? '<input type="file" id="ean-foto" accept="image/*" capture="environment" hidden>' : ""}
          <div class="or-line"><span>oder Nummer eintippen</span></div>` : `
          <div class="card hint-card">${icon("kamera", 20)}
            <div class="hint-body"><b>Kamera-Scan braucht deinen Claude-Key</b>Dieser Browser erkennt Strichcodes nicht selbst. Mit hinterlegtem Key fotografierst du den Code einfach – Claude liest die Nummer ab. Solange tippst du sie ein.</div>
          </div>`}
        <input type="text" id="ean-input" inputmode="numeric" placeholder="z. B. 4311501659286">
        <button class="btn" id="ean-suchen">Nachschlagen</button>
        <p class="centered-note">Produktdaten von Open Food Facts (ODbL). Die Nummer steht unter dem Strichcode.</p>
      </div>`;
  }
  if (p.status === "kamera") return `
    <div class="section-gap">
      <div class="scan-view"><video id="scan-video" playsinline muted></video></div>
      <button class="btn secondary" id="ean-kamera-stopp">Abbrechen</button>
    </div>`;
  if (p.status === "foto") return `<div class="card"><p class="subtle small">Claude liest den Strichcode …</p></div>`;
  if (p.status === "laden") return `<div class="card"><p class="subtle small">Suche ${esc(p.ean)} bei Open Food Facts …</p></div>`;
  if (p.status === "fehler") return `
    <div class="card hint-card warn">${icon("achtung", 20)}<span class="hint-body">${esc(p.msg)}</span></div>
    <button class="btn secondary" id="ean-zurueck">Zurück</button>`;
  if (p.status === "kein_treffer") return `
    <div class="card hint-card warn">${icon("achtung", 20)}
      <span class="hint-body">Barcode ${esc(p.ean)} ist nicht in Open Food Facts. Produkt bitte über „Erfassen“ anlegen.</span>
    </div>
    <button class="btn secondary" id="ean-zurueck">Zurück</button>`;
  // Treffer: Produkt + Zuordnungsvorschlag
  const produkt = p.produkt;
  return `
    <div class="section-gap">
      <div class="section-head"><h2>Gefunden</h2><button class="backlink" id="ean-zurueck">Abbrechen</button></div>
      <div class="card">
        <div style="display:flex;gap:14px;align-items:flex-start">
          ${produkt.bild
            ? `<img src="${esc(produkt.bild)}" alt="" style="width:56px;height:56px;object-fit:contain;border-radius:12px;background:var(--accent-soft);flex:none">`
            : `<span style="width:56px;height:56px;border-radius:12px;background:var(--accent-soft);display:grid;place-items:center;flex:none;color:var(--accent)">${icon("vorrat", 26)}</span>`}
          <div>
            <h3 style="font-size:19px">${esc(produkt.name)}</h3>
            <p class="subtle small" style="margin-top:3px">${produkt.marke ? esc(produkt.marke) + " · " : ""}${produkt.menge_text ? esc(produkt.menge_text) : ""}</p>
            <p class="small mute" style="letter-spacing:.03em">EAN ${esc(produkt.gtin)}</p>
          </div>
        </div>
        <hr class="divider" style="margin:14px 0">
        <p class="small mute" style="margin-bottom:8px">Als welche Zutat buchen?</p>
        <select id="ean-zutat">
          ${ZUTATEN.map((z) => `<option value="${z.id}" ${p.vorschlag?.id === z.id ? "selected" : ""}>${esc(z.name)}</option>`).join("")}
        </select>
        ${p.vorschlag ? "" : '<p class="subtle small" style="margin-top:6px">Kein automatischer Treffer – bitte auswählen.</p>'}
      </div>
      <div class="card hint-card" style="flex-direction:column">
        <b>Menge wird als Packungsgröße gebucht</b>
        <span>Angebrochen? Danach einmal am Regler korrigieren.</span>
      </div>
      <div class="btn-row">
        <button class="btn secondary" id="ean-verwerfen">Verwerfen</button>
        <button class="btn" id="ean-buchen">In den Vorrat</button>
      </div>
    </div>`;
}

function bindBarcode() {
  const suche = async (ean) => {
    scanPanel = { status: "laden", ean };
    renderVorrat();
    try {
      const produkt = await lookupBarcode(ean);
      scanPanel = produkt
        ? { status: "treffer", produkt, vorschlag: vorschlagZutat(produkt.name) }
        : { status: "kein_treffer", ean };
    } catch (e) {
      scanPanel = { status: "fehler", msg: e.message };
    }
    renderVorrat();
  };

  app.querySelector("#ean-suchen")?.addEventListener("click", () => {
    const ean = app.querySelector("#ean-input").value.trim();
    if (ean) suche(ean);
  });
  app.querySelector("#ean-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const ean = e.target.value.trim(); if (ean) suche(ean); }
  });
  app.querySelector("#ean-kamera")?.addEventListener("click", async () => {
    // Ohne BarcodeDetector (iOS Safari) wird fotografiert statt live gescannt.
    const fotoFeld = app.querySelector("#ean-foto");
    if (fotoFeld) { fotoFeld.click(); return; }
    scanPanel = { status: "kamera" };
    renderVorrat();
    const video = app.querySelector("#scan-video");
    kamera = await starteKameraScan(video,
      (ean) => { kamera = null; suche(ean); },
      () => { kamera = null; scanPanel = { status: "fehler", msg: "Kamera nicht verfügbar oder Zugriff abgelehnt." }; renderVorrat(); });
  });
  app.querySelector("#ean-foto")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    scanPanel = { status: "foto" };
    renderVorrat();
    try {
      const base64 = await dateiAlsBase64(file);
      const ean = await leseBarcodeVomFoto(getState().settings.apiKey, base64, file.type || "image/jpeg");
      if (ean) suche(ean);
      else { scanPanel = { status: "fehler", msg: "Auf dem Foto war keine Strichcode-Nummer zu lesen. Nochmal näher ran – oder die Nummer eintippen." }; renderVorrat(); }
    } catch (err) {
      scanPanel = { status: "fehler", msg: err.message };
      renderVorrat();
    }
  });
  app.querySelector("#ean-kamera-stopp")?.addEventListener("click", () => { stoppeKamera(); scanPanel = { status: "start" }; renderVorrat(); });
  app.querySelectorAll("#ean-zurueck, #ean-verwerfen").forEach((b) => b.addEventListener("click", () => { scanPanel = { status: "start" }; renderVorrat(); }));
  app.querySelector("#ean-abbrechen")?.addEventListener("click", () => { stoppeKamera(); scanPanel = null; renderVorrat(); });
  app.querySelector("#ean-buchen")?.addEventListener("click", () => {
    const s = getState();
    const zutatId = app.querySelector("#ean-zutat").value;
    const produkt = scanPanel.produkt;
    const kat = ZUTAT_INDEX[zutatId];
    // OFF-Packungsgröße nutzen, wenn Einheit zum Bestandseintrag passt
    const einheit = produkt.mengen_einheit === "g" || produkt.mengen_einheit === "ml" ? produkt.mengen_einheit : null;
    buchZugang(s, zutatId, einheit && kat?.einheit === einheit ? produkt.menge : null, einheit);
    save();
    scanPanel = null;
    renderVorrat();
  });
}

/* --------------------------------------------- Vorräte diktieren (Kap. 9.4)
   Aufzählen statt antippen: Schranktür auf, Mikro an, alles der Reihe nach
   sagen. Der Text wird lokal ausgewertet (diktat.js) – ohne Netz und ohne
   Key. Liegt ein Claude-Key vor, übernimmt das Modell die Zuordnung; fällt
   es aus, springt der lokale Parser ein, statt das Diktat verpuffen zu lassen.
   Am Ende steht immer die Bestätigungsliste: Vorratio rät, der Mensch nickt ab. */
let diktat = null;      // null | { status:'start'|'hoeren'|'lesen'|'fehler'|'ergebnis', text, … }
let aufnahme = null;    // laufende Spracherkennung { stop }

function stoppeAufnahme() { aufnahme?.stop?.(); aufnahme = null; }

const DIKTAT_BEISPIEL = "Zwei Kilo Mehl, eine Dose Kichererbsen, drei Zwiebeln, Milch ist fast leer, Salz ist da.";

function diktatUi() {
  const d = diktat;
  if (d.status === "hoeren") return `
    <div class="section-gap">
      <div class="card mic-panel">
        <span class="mic-round aktiv">${icon("mikro", 38)}</span>
        <p class="mic-live" id="dik-live"><span class="mute">Leg los – zähl einfach auf, was da ist.</span></p>
      </div>
      <button class="btn" id="dik-stopp">Fertig – Liste erstellen</button>
      <button class="btn ghost" id="dik-abbruch">Abbrechen</button>
    </div>`;

  if (d.status === "lesen") return `
    <div class="section-gap"><div class="card"><p class="subtle small">Claude sortiert dein Diktat …</p></div></div>`;

  if (d.status === "fehler") return `
    <div class="section-gap">
      <div class="card hint-card warn">${icon("achtung", 20)}<span class="hint-body">${esc(d.msg)}</span></div>
      <button class="btn secondary" id="dik-zurueck">Zurück</button>
    </div>`;

  if (d.status === "ergebnis") return diktatErgebnisUi(d);

  // Start: Mikro, wo der Browser zuhören kann – das Textfeld immer.
  const live = diktatVerfuegbar();
  return `
    <div class="section-gap">
      <div class="section-head"><h2>Diktat</h2><button class="backlink" id="dik-schliessen">Abbrechen</button></div>
      ${live ? `
        <button class="card mic-panel" id="dik-start">
          <span class="mic-round">${icon("mikro", 38)}</span>
          <span class="name">Vorräte aufzählen</span>
          <span class="subtle small">„${esc(DIKTAT_BEISPIEL)}“</span>
        </button>
        <div class="or-line"><span>oder eintippen</span></div>` : ""}
      <textarea id="dik-text" rows="4" placeholder="Ein Artikel je Komma – Menge, Anteil („halb voll“) oder „ist alle“ dahinter.">${esc(d.text || "")}</textarea>
      ${live ? "" : `
        <div class="card hint-card" style="margin-top:10px">${icon("mikro", 20)}
          <span class="hint-body">Dieser Browser hört nicht selbst zu. Auf dem iPhone diktierst du über die Mikrofontaste der Tastatur direkt ins Feld – der Rest läuft gleich.</span>
        </div>`}
      <button class="btn" id="dik-auswerten">Liste erstellen</button>
      <p class="centered-note">${getState().settings.apiKey
        ? "Claude sortiert das Diktat, du bestätigst. Mengen bleiben Schätzwerte."
        : "Die Auswertung läuft auf dem Gerät – ohne Key, ohne Netz. Mit Claude-Key wird sie treffsicherer."}</p>
    </div>`;
}

function diktatErgebnisUi(d) {
  const s = getState();
  const zuBuchen = d.eintraege.filter((e) => e.buchen).length;
  return `
    <div class="section-gap">
      <div class="section-head">
        <h2>Verstanden</h2>
        <button class="backlink" id="dik-text-zurueck">Text ändern</button>
      </div>
      <p class="subtle small" style="margin-bottom:10px">${d.eintraege.length} ${d.eintraege.length === 1 ? "Artikel" : "Artikel"} erkannt. Was du hier bestätigst, ersetzt den bisherigen Stand.</p>
      <div class="card">
        ${d.eintraege.map((e, i) => {
          const vorhanden = e.zutat_id ? s.bestand.find((b) => b.zutat_id === e.zutat_id) : null;
          return `
          <div class="list-item" style="align-items:flex-start">
            <button class="check" data-dik-check="${i}" aria-label="Übernehmen" style="margin-top:0">${icon(e.buchen ? "check" : "checkLeer", 24)}</button>
            <div class="grow">
              <span class="name">${esc(e.name)}</span>
              <span class="small mute" style="display:block">„${esc(e.rohtext)}“${vorhanden ? ` · bisher ${esc(mengeAnzeige(vorhanden))}` : ""}</span>
              ${e.zutat_id ? "" : '<span class="small warn-text" style="display:block">Nicht im Katalog – wird als eigener Artikel angelegt</span>'}
              ${e.offen ? `
                <select data-dik-zutat="${i}" style="margin-top:8px">
                  <option value="">Als eigenen Artikel anlegen</option>
                  ${ZUTATEN.map((z) => `<option value="${z.id}" ${e.zutat_id === z.id ? "selected" : ""}>${esc(z.name)}</option>`).join("")}
                </select>`
                : `<button class="mini-link" data-dik-oeffnen="${i}">Zutat ändern</button>`}
            </div>
            <span class="value">${esc(diktatAnzeige(e))}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="btn-row">
        <button class="btn secondary" id="dik-verwerfen">Verwerfen</button>
        <button class="btn" id="dik-buchen" ${zuBuchen ? "" : "disabled"}>${zuBuchen} übernehmen</button>
      </div>
      <p class="centered-note">Mengen sind Schätzwerte – vorratio rechnet mit ±10–15 % Spielraum.</p>
    </div>`;
}

/* Diktattext auswerten. Mit Key über Claude, ohne Key (und wenn Claude nicht
   erreichbar ist) über den lokalen Parser. */
async function werteDiktatAus(text) {
  const s = getState();
  const roh = String(text || "").trim();
  if (roh.length < 3) {
    diktat = { status: "fehler", text: roh, msg: "Da war nichts zu hören. Sag oder tipp zum Beispiel: „Zwei Kilo Mehl, eine Dose Kichererbsen, Milch ist fast leer.“" };
    renderVorrat();
    return;
  }

  let eintraege = [];
  if (s.settings.apiKey) {
    diktat = { status: "lesen", text: roh };
    renderVorrat();
    try {
      eintraege = await leseDiktat(s.settings.apiKey, roh);
    } catch (e) {
      eintraege = parseDiktat(roh, s.bestand);
      toast(eintraege.length ? "Claude nicht erreichbar – lokal ausgewertet." : e.message, "warn");
    }
  } else {
    eintraege = parseDiktat(roh, s.bestand);
  }

  /* Zutat-IDs gegen den Katalog prüfen: eine erfundene ID würde sonst als
     Geisterzutat im Bestand landen, die kein Rezept je findet. Anteile
     kommen mal als 0,5 und mal als 50 (Prozent) zurück – beides wird hier
     auf denselben Bereich gebracht. */
  eintraege = eintraege.map((e) => {
    const kat = e.zutat_id ? ZUTAT_INDEX[e.zutat_id] : null;
    const anteil = e.anteil == null ? null : Math.min(1, Math.max(0, e.anteil > 1 ? e.anteil / 100 : e.anteil));
    return { ...e, zutat_id: kat?.id || null, name: kat?.name || e.name, anteil, buchen: true, offen: !kat || !e.sicher };
  }).filter((e) => e.name && e.name.trim().length > 1);

  if (!eintraege.length) {
    diktat = { status: "fehler", text: roh, msg: "Aus dem Diktat ließ sich kein Artikel lesen. Nenn die Sachen einzeln, mit Komma dazwischen." };
  } else {
    diktat = { status: "ergebnis", text: roh, eintraege };
  }
  renderVorrat();
}

function bindDiktat() {
  app.querySelector("#dik-schliessen")?.addEventListener("click", () => { stoppeAufnahme(); diktat = null; renderVorrat(); });
  app.querySelector("#dik-zurueck")?.addEventListener("click", () => { diktat = { status: "start", text: diktat.text }; renderVorrat(); });
  app.querySelector("#dik-text-zurueck")?.addEventListener("click", () => { diktat = { status: "start", text: diktat.text }; renderVorrat(); });
  app.querySelector("#dik-auswerten")?.addEventListener("click", () => werteDiktatAus(app.querySelector("#dik-text").value));

  app.querySelector("#dik-start")?.addEventListener("click", () => {
    // Getipptes geht beim Wechsel in die Aufnahme nicht verloren.
    const bisher = app.querySelector("#dik-text")?.value || "";
    diktat = { status: "hoeren", text: bisher };
    renderVorrat();
    const feld = app.querySelector("#dik-live");
    aufnahme = starteDiktat({
      /* Läuft bei jedem Zwischenergebnis – darum nur den Textknoten
         auffrischen statt den Screen neu zu zeichnen. */
      onText: (fertig, zwischen) => {
        diktat.text = [bisher, fertig].filter(Boolean).join(" ");
        if (!feld) return;
        feld.innerHTML = `${esc(diktat.text)}${zwischen ? ` <span class="mute">${esc(zwischen)}</span>` : ""}`
          || '<span class="mute">Leg los – zähl einfach auf, was da ist.</span>';
      },
      onFehler: (msg) => { aufnahme = null; diktat = { status: "fehler", text: diktat.text, msg }; renderVorrat(); },
      onEnde: () => { aufnahme = null; if (diktat?.status === "hoeren") werteDiktatAus(diktat.text); },
    });
  });
  app.querySelector("#dik-stopp")?.addEventListener("click", () => {
    const text = diktat.text;
    stoppeAufnahme();
    // Nicht auf onEnde warten: Safari lässt sich damit Zeit.
    werteDiktatAus(text);
  });
  app.querySelector("#dik-abbruch")?.addEventListener("click", () => { stoppeAufnahme(); diktat = { status: "start", text: diktat.text }; renderVorrat(); });

  app.querySelectorAll("[data-dik-check]").forEach((b) => b.addEventListener("click", () => {
    const e = diktat.eintraege[Number(b.dataset.dikCheck)];
    e.buchen = !e.buchen;
    renderVorrat();
  }));
  app.querySelectorAll("[data-dik-oeffnen]").forEach((b) => b.addEventListener("click", () => {
    diktat.eintraege[Number(b.dataset.dikOeffnen)].offen = true;
    renderVorrat();
  }));
  app.querySelectorAll("[data-dik-zutat]").forEach((sel) => sel.addEventListener("change", () => {
    const e = diktat.eintraege[Number(sel.dataset.dikZutat)];
    const kat = ZUTAT_INDEX[sel.value];
    e.zutat_id = kat?.id || null;
    if (kat) e.name = kat.name;
    renderVorrat();
  }));
  app.querySelector("#dik-verwerfen")?.addEventListener("click", () => { diktat = null; renderVorrat(); });
  app.querySelector("#dik-buchen")?.addEventListener("click", () => uebernehmeDiktat());
}

function uebernehmeDiktat() {
  const s = getState();
  let gebucht = 0;
  for (const e of diktat.eintraege) {
    if (!e.buchen) continue;
    const item = e.zutat_id ? bestandFuer(s, e.zutat_id) : freierBestand(s, e.name);
    if (!item) continue;
    item.menge = diktatMenge(item, e);
    item.updated = new Date().toISOString();
    gebucht++;
  }
  save();
  diktat = null;
  toast(gebucht === 1 ? "1 Artikel übernommen" : `${gebucht} Artikel übernommen`);
  renderVorrat();
}

/* Diktierte Angabe → Menge in der Einheit des Artikels. Toleranzprinzip:
   Was sich nicht sauber umrechnen lässt, wird als Packungszahl gelesen statt
   scheinpräzise geschätzt; Gramm und Milliliter runden auf 10er. */
const CONTAINER_EINHEIT = new Set(["Pck", "Glas", "Becher", "Flasche", "Rolle", "Scheibe"]);

function diktatMenge(item, e) {
  const kat = ZUTAT_INDEX[item.zutat_id];
  const voll = item.packung || kat?.packung || 500;
  const rund10 = (n) => Math.max(0, Math.round(n / 10) * 10);

  if (item.art === "pauschal") return e.aktion === "leer" ? 0 : null;
  if (e.aktion === "leer") return 0;
  if (e.aktion === "anteil") {
    if (item.art === "zaehlbar") return Math.max(1, Math.round((e.anteil ?? 0.5) * Math.max(item.menge || 0, 4)));
    return rund10((e.anteil ?? 0.5) * voll);
  }
  if (e.aktion !== "menge" || e.menge == null) {
    // „hab ich noch“ ohne Menge: Erfasstes bleibt stehen, Neues gilt als voll.
    if (item.menge) return item.menge;
    return item.art === "zaehlbar" ? 1 : voll;
  }

  const n = e.menge;
  const eh = e.einheit;
  if (item.art === "zaehlbar") {
    // Gewicht auf einer zählbaren Zutat: über den Doseninhalt in Stück rechnen
    if ((eh === "g" || eh === "kg") && kat?.inhalt_g) return Math.max(1, Math.round((eh === "kg" ? n * 1000 : n) / kat.inhalt_g));
    return Math.max(0, Math.round(n));
  }
  const faktor = { g: 1, kg: 1000, ml: 1, l: 1000 }[eh];
  if (faktor) return rund10(n * faktor);          // ml ≈ g liegt im Toleranzband
  if (!eh || CONTAINER_EINHEIT.has(eh) || eh === "Stk") return rund10(n * voll);   // „zwei Packungen Mehl“
  return rund10(n * voll);
}

/* Zutatensuche: erst wörtliche Treffer, dann klanglich nahe Einträge
   ("Rahmspinat" findet auch "Blattspinat"). Bleibt beides leer, wird die
   Eingabe als eigener Artikel angelegt – die Liste ist ein Startpunkt,
   kein Käfig. */
function zutatTreffer(suche, imBestand) {
  const frei = ZUTATEN.filter((z) => !imBestand.has(z.id));
  if (!suche) return { direkt: frei.slice(0, 12), aehnlich: [] };
  const q = suche.toLowerCase().trim();
  const direkt = frei.filter((z) => z.name.toLowerCase().includes(q));
  const gefunden = new Set(direkt.map((z) => z.id));
  const nah = vorschlagZutat(suche);
  const aehnlich = direkt.length ? [] : frei.filter((z) => {
    if (gefunden.has(z.id)) return false;
    if (nah && z.id === nah.id) return true;
    // Wortstämme vergleichen: "rahmspinat" ↔ "blattspinat"
    return z.name.toLowerCase().split(/[^a-zäöüß]+/).some((w) => w.length >= 4 && (q.includes(w) || w.includes(q)));
  }).slice(0, 6);
  return { direkt: direkt.slice(0, 12), aehnlich };
}

function trefferChips({ direkt, aehnlich }, suche) {
  if (direkt.length) return direkt.map((z) => `<button class="chip" data-add="${z.id}">${esc(z.name)}</button>`).join("");
  const eigen = suche.trim()
    ? `<button class="chip chip-neu" data-add-frei="1">${icon("plus", 16)}„${esc(suche.trim())}" anlegen</button>` : "";
  if (!aehnlich.length) {
    return eigen || '<span class="subtle small">Tipp etwas ein – oder leg dir einen eigenen Artikel an.</span>';
  }
  return `${eigen}${aehnlich.map((z) => `<button class="chip" data-add="${z.id}">${esc(z.name)}<span class="chip-note">ähnlich</span></button>`).join("")}`;
}

function vorratAddForm() {
  const s = getState();
  const imBestand = new Set(s.bestand.map((b) => b.zutat_id));
  const treffer = zutatTreffer(vorratSuche, imBestand);
  return `
    <div class="section-gap">
      <input type="text" id="add-suche" placeholder="z. B. Mehl, Reis, Rahmspinat …" value="${esc(vorratSuche)}" autocomplete="off">
      <h2 class="section-gap">${vorratSuche ? "Treffer" : "Häufig erfasst"}</h2>
      <div class="chip-wrap">${trefferChips(treffer, vorratSuche)}</div>
      <div class="card hint-card" style="margin-top:16px">${icon("tipp", 20)}
        <span class="hint-body">Erst grob alles antippen, was da ist. Die Mengen kannst du danach in Ruhe schätzen. Was nicht in der Liste steht, tippst du einfach ein und legst es an.</span>
      </div>
    </div>`;
}

function bindVorratAdd() {
  const suche = app.querySelector("#add-suche");
  const bindeChips = (wrap) => {
    wrap.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => addBestand(b.dataset.add)));
    wrap.querySelector("[data-add-frei]")?.addEventListener("click", () => addBestandFrei(vorratSuche));
  };
  if (suche) {
    suche.addEventListener("input", () => {
      vorratSuche = suche.value;
      // Nur Chip-Liste neu zeichnen, Fokus behalten
      const wrap = app.querySelector(".chip-wrap");
      const imBestand = new Set(getState().bestand.map((b) => b.zutat_id));
      wrap.innerHTML = trefferChips(zutatTreffer(vorratSuche, imBestand), vorratSuche);
      bindeChips(wrap);
    });
    suche.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const imBestand = new Set(getState().bestand.map((b) => b.zutat_id));
      const { direkt } = zutatTreffer(vorratSuche, imBestand);
      direkt.length ? addBestand(direkt[0].id) : addBestandFrei(vorratSuche);
    });
  }
  bindeChips(app);
}

/* Eigener Artikel aus freier Eingabe: Kategorie und Führungsart werden aus dem
   Namen abgeleitet, damit der Mengen-Screen direkt die richtige Bedienung
   zeigt (Stepper, Füllstandsregler oder da/leer). */
const FREI_REGELN = [
  { kat: "tk",      art: "schuettgut", packung: 450, muster: /tk|tiefkühl|gefroren|rahmspinat|eis\b/ },
  { kat: "gewuerz", art: "pauschal",   muster: /gewürz|pulver|pfeffer|salz|paprika|curry|zimt|kümmel|muskat|chili/ },
  { kat: "konserve", art: "zaehlbar",  einheit: "Dose", muster: /dose|konserve|glas\b/ },
  { kat: "kuehl",   art: "schuettgut", packung: 250, muster: /käse|quark|joghurt|sahne|milch|butter|wurst|schinken|tofu|tempeh|seitan|fleisch|hack|fisch|filet|creme|dip/ },
  { kat: "frisch",  art: "zaehlbar",   muster: /salat|kohl|obst|gemüse|frisch|kraut|beere|apfel|birne|zwiebel|kürbis|paprika|gurke/ },
  { kat: "trocken", art: "schuettgut", packung: 500, muster: /mehl|reis|nudel|pasta|müsli|flocken|zucker|linsen|bohnen|kerne|nüsse|nuss/ },
];

function freieZutatDaten(name) {
  const n = name.toLowerCase();
  const regel = FREI_REGELN.find((r) => r.muster.test(n));
  return {
    kategorie: regel?.kat || "trocken",
    art: regel?.art || "schuettgut",
    einheit: regel?.einheit || (regel?.art === "zaehlbar" ? "Stk" : "g"),
    packung: regel?.packung || (regel?.art === "schuettgut" || !regel ? 500 : null),
  };
}

/* Eigener Bestandsartikel zu einem freien Namen – vorhandener zuerst.
   Auch der Weg, auf dem diktierte Artikel ohne Katalogtreffer landen. */
function freierBestand(s, rohName) {
  const name = rohName.trim().replace(/\s+/g, " ");
  const zutatId = `frei_${name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "_").replace(/^_|_$/g, "")}`;
  const vorhanden = s.bestand.find((b) => b.zutat_id === zutatId);
  if (vorhanden) return vorhanden;
  const daten = freieZutatDaten(name);
  const item = {
    id: `b_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    zutat_id: zutatId,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    kategorie: daten.kategorie, art: daten.art, einheit: daten.einheit, packung: daten.packung,
    menge: daten.art === "pauschal" ? null : daten.art === "zaehlbar" ? 1 : daten.packung,
    eigen: true,
    updated: new Date().toISOString(),
  };
  s.bestand.push(item);
  return item;
}

function addBestandFrei(rohName) {
  const name = rohName.trim().replace(/\s+/g, " ");
  if (name.length < 2) return;
  const s = getState();
  const item = freierBestand(s, name);
  vorratSuche = "";
  save();
  renderVorratEdit(item.id);
}

function addBestand(zutatId) {
  const kat = ZUTAT_INDEX[zutatId];
  if (!kat) return;
  const s = getState();
  const item = {
    id: `b_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    zutat_id: kat.id, name: kat.name, kategorie: kat.kategorie, art: kat.art, einheit: kat.einheit,
    packung: kat.packung || null,
    menge: kat.art === "pauschal" ? null : kat.art === "zaehlbar" ? 1 : kat.packung || 500,
    updated: new Date().toISOString(),
  };
  s.bestand.push(item);
  vorratSuche = "";
  save();
  renderVorratEdit(item.id);
}

/* Mengen-Erfassung: Stepper für Zählbares, Silhouetten-Slider für Schüttgut
   ("Wie voll ist die Packung?"), vorhanden/leer für Pauschales (Kap. 5). */
function renderVorratEdit(itemId) {
  const s = getState();
  const item = s.bestand.find((b) => b.id === itemId);
  if (!item) { renderVorrat(); return; }
  const voll = item.packung || ZUTAT_INDEX[item.zutat_id]?.packung || null;
  const anteil = voll && item.menge != null ? Math.min(1, item.menge / voll) : 0.5;

  const pct = Math.round(anteil * 100);
  const untertitel = [KATEGORIE_NAMEN[item.kategorie]];
  if (item.art === "schuettgut" && voll) untertitel.push(`Packung ${voll} ${item.einheit}`);
  else if (item.art === "zaehlbar") untertitel.push("zählbar");
  else if (item.art === "pauschal") untertitel.push("pauschal geführt");

  let mengenUi = "";
  let fussnote = "";
  if (item.art === "zaehlbar") {
    /* Runder Stepper mit Schnellwahl – Design 20. */
    mengenUi = `
      <div class="card" style="padding:30px 20px;border-radius:20px">
        <div class="stepper">
          <button id="minus" aria-label="Weniger">${icon("minus", 22)}</button>
          <span style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span class="count">${item.menge ?? 0}</span>
            <span class="subtle small">${esc(item.einheit)}</span>
          </span>
          <button id="plus" class="primary" aria-label="Mehr">${icon("plus", 22)}</button>
        </div>
        <div class="chip-wrap" style="justify-content:center;margin-top:16px">
          <button class="chip" data-quick="6">+6</button>
          <button class="chip" data-quick="10">+10</button>
          <button class="chip" data-quick="0">aufgebraucht</button>
        </div>
      </div>`;
  } else if (item.art === "schuettgut") {
    /* Silhouetten-Schätzer: Packung, Näherungswert, Regler, Viertel-Raster – Design 19. */
    const stufen = [["leer", 0], ["¼", 25], ["½", 50], ["¾", 75], ["voll", 100]];
    const naheStufe = stufen.reduce((a, b) => (Math.abs(b[1] - pct) < Math.abs(a[1] - pct) ? b : a))[1];
    mengenUi = `
      <div class="card" style="padding:24px 20px;border-radius:20px">
        <p class="subtle" style="text-align:center;margin-bottom:18px">Wie voll ist die Packung noch?</p>
        <div class="pack-row">
          <div class="pack-silhouette"><div id="pack-fill" style="height:${pct}%"></div></div>
          <div style="padding-bottom:8px">
            <div class="pack-value" id="menge-label">${mengeAnzeige(item)}</div>
            <div class="subtle small" id="pack-pct">etwa ${pct} %</div>
          </div>
        </div>
        <input type="range" id="fuellstand" min="0" max="100" step="5" value="${pct}" style="--pct:${pct}%" aria-label="Füllstand in Prozent">
        <div class="quick-row">
          ${stufen.map(([label, v]) => `<button class="chip ${naheStufe === v ? "selected" : ""}" data-stufe="${v}">${label}</button>`).join("")}
        </div>
      </div>`;
    fussnote = '<p class="centered-note">Schätzen reicht – vorratio rechnet mit ±10–15 % Spielraum.</p>';
  } else {
    /* Vorrätig / leer als Zwei-Kachel-Umschalter – Design 21. */
    const leer = item.menge === 0;
    mengenUi = `
      <div class="card" style="padding:20px;border-radius:20px">
        <div class="toggle-row">
          <button class="toggle-tile ${leer ? "" : "active"}" id="da">${icon("check", 24)}vorrätig</button>
          <button class="toggle-tile ${leer ? "active" : ""}" id="leer">${icon(leer ? "check" : "checkLeer", 24)}leer</button>
        </div>
        <p class="centered-note" style="margin-top:14px">Bei Salz, Pfeffer und Öl zählt nur: da oder nicht da. Sobald du „leer“ tippst, wandert es auf den Wocheneinkauf.</p>
      </div>`;
  }

  zeigeApp(`
    <div class="fade-in">
      <button class="backlink" id="zurueck">${icon("zurueck", 20)}Vorrat</button>
      <div class="screen-header" style="margin-top:10px">
        <h1>${esc(item.name)}</h1>
        <p class="subtle small">${untertitel.join(" · ")}</p>
      </div>
      ${mengenUi}
      ${fussnote}
      <button class="btn" id="sichern">Sichern</button>
      <button class="btn danger" id="entfernen">Aus dem Vorrat entfernen</button>
    </div>`, `vorrat-edit:${itemId}`);

  const stempel = () => { item.updated = new Date().toISOString(); save(); };

  app.querySelector("#zurueck").addEventListener("click", () => renderVorrat());
  app.querySelector("#sichern").addEventListener("click", () => { stempel(); renderVorrat(); });
  app.querySelector("#entfernen").addEventListener("click", () => {
    s.bestand = s.bestand.filter((b) => b.id !== item.id);
    save();
    renderVorrat();
  });
  app.querySelector("#minus")?.addEventListener("click", () => { item.menge = Math.max(0, (item.menge ?? 0) - 1); stempel(); renderVorratEdit(itemId); });
  app.querySelector("#plus")?.addEventListener("click", () => { item.menge = (item.menge ?? 0) + 1; stempel(); renderVorratEdit(itemId); });
  app.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => {
    const n = Number(b.dataset.quick);
    item.menge = n === 0 ? 0 : (item.menge ?? 0) + n;
    stempel();
    renderVorratEdit(itemId);
  }));
  app.querySelector("#da")?.addEventListener("click", () => { item.menge = null; stempel(); renderVorratEdit(itemId); });
  app.querySelector("#leer")?.addEventListener("click", () => { item.menge = 0; stempel(); renderVorratEdit(itemId); });
  app.querySelectorAll("[data-stufe]").forEach((b) => b.addEventListener("click", () => {
    setzeFuellstand(item, Number(b.dataset.stufe), voll);
    stempel();
    renderVorratEdit(itemId);
  }));
  const slider = app.querySelector("#fuellstand");
  slider?.addEventListener("input", () => {
    const v = Number(slider.value);
    setzeFuellstand(item, v, voll);
    slider.style.setProperty("--pct", `${v}%`);
    app.querySelector("#pack-fill").style.height = `${v}%`;
    app.querySelector("#menge-label").textContent = mengeAnzeige(item);
    app.querySelector("#pack-pct").textContent = `etwa ${v} %`;
    const nahe = [0, 25, 50, 75, 100].reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    app.querySelectorAll("[data-stufe]").forEach((b) => b.classList.toggle("selected", Number(b.dataset.stufe) === nahe));
    stempel();
  });
}

function setzeFuellstand(item, prozent, voll) {
  const basis = voll || 500;
  item.menge = Math.round((prozent / 100) * basis / 10) * 10;
}

/* ----------------------------------------------------------------- Einkauf */
function syncWochenliste(s) {
  // Leere/fast leere Vorräte landen automatisch auf der Wochenliste (Kap. 4.7)
  const kandidaten = wochenKandidaten(s.bestand);
  for (const k of kandidaten) {
    if (!s.einkauf.woche.some((w) => w.zutat_id === k.zutat_id)) {
      s.einkauf.woche.push({ zutat_id: k.zutat_id, name: k.name, erledigt: false, auto: true });
    }
  }
}

function renderEinkauf() {
  const s = getState();
  syncWochenliste(s);
  const rezept = s.einkauf.rezeptId ? findRezept(s.einkauf.rezeptId) : null;

  const rezeptErledigt = s.einkauf.rezept.filter((e) => e.erledigt).length;

  zeigeApp(`
    <div class="fade-in">
      <div class="screen-header"><h1>einkauf</h1><p class="subtle small">Kurz und fokussiert – nur was fehlt.</p></div>

      ${s.einkauf.rezept.length ? `
        <div class="section-head">
          <h2>Für ${esc(rezept?.name || "Rezept")}</h2>
          <span class="small mute">${rezeptErledigt} von ${s.einkauf.rezept.length}</span>
        </div>
        <div class="card">
          ${s.einkauf.rezept.map((e, i) => `
            <div class="list-item">
              <button class="check" data-r-check="${i}" aria-label="Abhaken">${icon(e.erledigt ? "check" : "checkLeer", 24)}</button>
              <div class="grow ${e.erledigt ? "done-text" : ""}">${e.menge != null ? `${e.menge} ${e.einheit === "Stk" ? "×" : e.einheit}` : ""} ${esc(e.name)}</div>
            </div>`).join("")}
        </div>
        <button class="btn" id="einkauf-fertig">Eingekauft → in den Vorrat buchen</button>` : ""}

      <div class="section-gap">
        <div class="section-head">
          <h2>Wocheneinkauf</h2>
          <span class="small mute">automatisch gesammelt</span>
        </div>
        ${s.einkauf.woche.length ? `
          <div class="card">
            ${s.einkauf.woche.map((e, i) => `
              <div class="list-item">
                <button class="check" data-w-check="${i}" aria-label="Abhaken">${icon(e.erledigt ? "check" : "checkLeer", 24)}</button>
                <div class="grow ${e.erledigt ? "done-text" : ""}">${esc(e.name)}</div>
                ${e.auto ? '<span class="badge neutral">auto</span>' : ""}
                <button class="icon-btn" data-w-del="${i}" aria-label="Von der Liste nehmen">${icon("x", 20)}</button>
              </div>`).join("")}
          </div>
          <button class="btn secondary" id="woche-fertig">Erledigtes in den Vorrat buchen</button>` : `
          <div class="empty-state">
            ${icon("einkauf", 46)}
            <h3>Nichts auf der Liste</h3>
            <p>Dein Vorrat sieht gut aus. Was leer wird, landet hier automatisch.</p>
          </div>`}
      </div>

      <div class="section-gap">
        <h2>Bon-Scan</h2>
        ${bonScanUi()}
      </div>
      ${angebotsSektion(s)}
    </div>`, "einkauf");

  bindAngebote(s);

  app.querySelectorAll("[data-r-check]").forEach((b) => b.addEventListener("click", () => {
    const e = s.einkauf.rezept[Number(b.dataset.rCheck)];
    e.erledigt = !e.erledigt;
    save(); renderEinkauf();
  }));
  app.querySelectorAll("[data-w-check]").forEach((b) => b.addEventListener("click", () => {
    const e = s.einkauf.woche[Number(b.dataset.wCheck)];
    e.erledigt = !e.erledigt;
    save(); renderEinkauf();
  }));
  app.querySelectorAll("[data-w-del]").forEach((b) => b.addEventListener("click", () => {
    s.einkauf.woche.splice(Number(b.dataset.wDel), 1);
    save(); renderEinkauf();
  }));
  app.querySelector("#einkauf-fertig")?.addEventListener("click", async () => {
    /* Gebucht wird, was abgehakt ist – vorher wanderte die ganze Liste in den
       Vorrat, auch die Punkte, die im Laden nicht zu bekommen waren. Wer gar
       nichts abhakt, meint mit „Eingekauft" den ganzen Einkauf; nur dann zählt
       die komplette Liste. Nicht Gekauftes bleibt stehen. */
    const abgehakt = s.einkauf.rezept.filter((e) => e.erledigt);
    const buchen = abgehakt.length ? abgehakt : s.einkauf.rezept;
    for (const e of buchen) buchZugang(s, e.zutat_id);
    s.einkauf.rezept = s.einkauf.rezept.filter((e) => !buchen.includes(e));
    const rid = s.einkauf.rezeptId;
    if (!s.einkauf.rezept.length) s.einkauf.rezeptId = null;
    save();
    const r = rid && !s.einkauf.rezept.length ? findRezept(rid) : null;
    if (r && await bestaetige({
      titel: "Bestand aufgefüllt",
      text: `Direkt mit „${r.name}“ loslegen?`,
      bestaetigen: "Jetzt kochen", abbrechen: "Später", symbol: "check",
    })) { startKochen(r); return; }
    renderEinkauf();
  });
  app.querySelector("#woche-fertig")?.addEventListener("click", () => {
    const erledigt = s.einkauf.woche.filter((e) => e.erledigt);
    for (const e of erledigt) buchZugang(s, e.zutat_id);
    s.einkauf.woche = s.einkauf.woche.filter((e) => !e.erledigt);
    save(); renderEinkauf();
  });
  bindBonScan(s);
}

/* --------------------------------------------------- Bon-Scan (Kap. 7.3)
   Foto → Claude Vision → strukturierte Artikel → Bestätigung → Buchung. */
let bon = null;  // null | {status:'laden'|'fehler'|'ergebnis', ...}

function bonScanUi() {
  const s = getState();
  if (!s.settings.apiKey) {
    /* Design 24: Key-Hinweis in Terrakotta mit direktem Weg ins Profil. */
    return `
      <div class="card hint-card warn" style="flex-direction:column">
        <div style="display:flex;gap:11px">
          ${icon("lokal", 21)}
          <div class="hint-body">
            <b>Bon-Scan braucht deinen Claude-Key</b>
            Einmal im Profil hinterlegen. Der Key bleibt auf dem Gerät und geht nur an Anthropic.
          </div>
        </div>
        <button class="btn danger-solid" id="bon-key" style="margin-top:2px">Key im Profil hinterlegen</button>
      </div>`;
  }
  if (!bon) {
    return `
      <button class="btn secondary" id="bon-start">${icon("kamera", 21)}Kassenbon fotografieren</button>
      <input type="file" id="bon-file" accept="image/*" capture="environment" hidden>`;
  }
  if (bon.status === "laden") return `<div class="card"><p class="subtle small">Claude liest den Bon …</p></div>`;
  if (bon.status === "fehler") return `
    <div class="card hint-card warn">${icon("achtung", 20)}<span class="hint-body">${esc(bon.msg)}</span></div>
    <button class="btn secondary" id="bon-reset">Nochmal versuchen</button>`;
  // Ergebnis: Artikel bestätigen
  const zuBuchen = bon.artikel.filter((a) => a.buchen && a.zutat_id).length;
  return `
    <div class="section-head">
      <h2>Bon gelesen</h2>
      ${bon.haendler ? `<span class="badge">${esc(bon.haendler)}</span>` : ""}
    </div>
    <p class="subtle small" style="margin-bottom:10px">Claude hat ${bon.artikel.length} ${bon.artikel.length === 1 ? "Position" : "Positionen"} erkannt. Prüf kurz, was in den Vorrat soll.</p>
    <div class="card">
      ${bon.artikel.map((a, i) => `
        <div class="list-item" style="align-items:flex-start">
          <button class="check" data-bon-check="${i}" aria-label="Übernehmen" style="margin-top:0">${icon(a.buchen ? "check" : "checkLeer", 24)}</button>
          <div class="grow">
            <span class="name${a.zutat_id ? "" : " mute"}">${esc(a.name)}</span>
            <span class="small mute" style="display:block;letter-spacing:.02em">${esc(a.bon_text)}${a.menge ? ` · ~${a.menge} ${a.einheit}` : ""}</span>
            ${a.zutat_id ? "" : '<span class="small warn-text" style="display:block">Keine Zutat zugeordnet – wird nicht gebucht</span>'}
          </div>
        </div>`).join("")}
    </div>
    <div class="btn-row">
      <button class="btn secondary" id="bon-reset">Verwerfen</button>
      <button class="btn" id="bon-buchen" ${zuBuchen ? "" : "disabled"}>${zuBuchen} buchen</button>
    </div>`;
}

function bindBonScan(s) {
  app.querySelector("#bon-key")?.addEventListener("click", () => { view = "profil"; render(); });
  app.querySelector("#bon-start")?.addEventListener("click", () => app.querySelector("#bon-file").click());
  app.querySelector("#bon-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    bon = { status: "laden" };
    renderEinkauf();
    try {
      const base64 = await dateiAlsBase64(file);
      const data = await scanBon(s.settings.apiKey, base64, file.type || "image/jpeg");
      const artikel = (data.artikel || [])
        .filter((a) => a.lebensmittel)
        .map((a) => ({ ...a, buchen: !!a.zutat_id }));
      if (!artikel.length) bon = { status: "fehler", msg: "Keine Lebensmittel auf dem Bon erkannt." };
      else bon = { status: "ergebnis", haendler: data.haendler, artikel };
    } catch (err) {
      bon = { status: "fehler", msg: err.message };
    }
    renderEinkauf();
  });
  app.querySelectorAll("[data-bon-check]").forEach((b) => b.addEventListener("click", () => {
    const a = bon.artikel[Number(b.dataset.bonCheck)];
    a.buchen = !a.buchen;
    renderEinkauf();
  }));
  app.querySelector("#bon-reset")?.addEventListener("click", () => { bon = null; renderEinkauf(); });
  app.querySelector("#bon-buchen")?.addEventListener("click", () => {
    let gebucht = 0;
    for (const a of bon.artikel) {
      if (!a.buchen || !a.zutat_id) continue;
      buchZugang(s, a.zutat_id, a.menge, a.einheit);
      gebucht++;
    }
    save();
    bon = null;
    toast(gebucht === 1 ? "1 Artikel gebucht" : `${gebucht} Artikel gebucht`);
    renderEinkauf();
  });
}

function dateiAlsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* Zugang buchen: Packungsgröße liefert die Menge – kein Wiegen (Kap. 5).
   Optional mit erkannter Menge (Bon-Scan / Barcode: Packungsgröße vom Produkt). */
/* Bestandszeile zu einer Katalogzutat – legt sie leer an, wenn es sie noch
   nicht gibt. Die Menge setzt der Aufrufer. */
function bestandFuer(s, zutatId) {
  const vorhanden = s.bestand.find((b) => b.zutat_id === zutatId);
  if (vorhanden) return vorhanden;
  const kat = ZUTAT_INDEX[zutatId];
  const item = {
    id: `b_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    zutat_id: zutatId, name: kat?.name || zutatId, kategorie: kat?.kategorie || "trocken",
    art: kat?.art || "schuettgut", einheit: kat?.einheit || "g", packung: kat?.packung || null,
    menge: 0, updated: null,
  };
  s.bestand.push(item);
  return item;
}

function buchZugang(s, zutatId, menge = null, einheit = null) {
  if (!zutatId) return;
  const kat = ZUTAT_INDEX[zutatId];
  const item = bestandFuer(s, zutatId);
  if (item.art === "pauschal") {
    item.menge = null;
  } else if (menge != null && einheit === item.einheit) {
    item.menge = (item.menge ?? 0) + menge;                       // erkannte Menge passt direkt
  } else if (item.art === "zaehlbar") {
    item.menge = (item.menge ?? 0) + (kat?.einheit === "Stk" && !kat?.inhalt_g ? 6 : 1); // Eier & Co. kommen im Karton
  } else {
    item.menge = (item.menge ?? 0) + (item.packung || kat?.packung || 500);
  }
  item.updated = new Date().toISOString();
}

/* ------------------------------------------------------- Angebots-Crawl
   Kap. 4.7/7.4: einmal wöchentlich Wocheneinkaufsliste × Standort-Angebote →
   Markt-Empfehlung mit Abdeckung und Konditionen. Ergebnis gilt eine
   Kalenderwoche; bewusst kein Markt-Hopping (1 Empfehlung + max. 2 Alternativen). */
let crawlLaeuft = null;        // { done, total } während eines Laufs
let crawlFehler = null;
let crawlSetupOffen = false;

/* Alle offenen Einkaufspunkte (Wochenliste + rezeptbezogene Liste), dedupliziert. */
function crawlListe(s) {
  const punkte = [...s.einkauf.woche, ...s.einkauf.rezept].filter((e) => !e.erledigt && e.zutat_id);
  const gesehen = new Set();
  return punkte.filter((e) => !gesehen.has(e.zutat_id) && gesehen.add(e.zutat_id))
    .map((e) => ({ zutat_id: e.zutat_id, name: e.name }));
}

const preisFmt = (n) => n == null ? "–" : `${n.toFixed(2).replace(".", ",")} €`;

function angebotsSektion(s) {
  const a = s.angebote;
  const liste = crawlListe(s);
  const live = liveKonfiguriert(a) && !a.demo;
  const erg = a.letzter;
  const aktuell = erg && erg.kw === isoWoche();

  let inhalt;
  if (crawlLaeuft) {
    inhalt = `
      <div class="card" style="text-align:center">
        <p><b>Angebote werden verglichen …</b></p>
        <p class="subtle small" id="crawl-progress">${crawlLaeuft.done}/${crawlLaeuft.total}</p>
      </div>`;
  } else if (erg) {
    inhalt = `
      ${aktuell ? "" : `<div class="card hint-card">${icon("achtung", 20)}<div class="hint-body"><b>Ergebnis aus KW ${esc(erg.kw.slice(-2))}</b>Die Angebote sind wahrscheinlich abgelaufen – einmal neu suchen.</div></div>`}
      ${angebotsErgebnisHtml(erg)}
      <button class="btn secondary" id="crawl-start" ${liste.length ? "" : "disabled"}>Angebote neu suchen</button>`;
  } else {
    inhalt = `
      <button class="btn" id="crawl-start" ${liste.length ? "" : "disabled"}>${liste.length ? `Günstigsten Markt für ${liste.length} ${liste.length === 1 ? "Punkt" : "Punkte"} suchen` : "Günstigsten Markt suchen"}</button>
      ${liste.length ? "" : '<p class="subtle small" style="text-align:center;margin-top:6px">Sobald etwas auf der Liste steht, kann die Suche losgehen.</p>'}`;
  }

  return `
    <hr class="divider">
    <div class="section-head">
      <h2>Angebote der Woche</h2>
      <button class="btn ghost small-btn" id="crawl-setup">${crawlSetupOffen ? "Schließen" : "Einstellungen"}</button>
    </div>
    <p class="subtle small" style="margin:2px 0 10px">Einmal pro Woche, am besten freitags: In welchem Markt bekommst du deine Liste am günstigsten?</p>
    ${crawlSetupOffen ? angebotsSetupHtml(a) : ""}
    ${!live && !crawlSetupOffen ? `
      <div class="card hint-card">${icon("achtung", 20)}
        <div class="hint-body"><b>Läuft gerade mit Beispielangeboten</b>Du siehst, wie der Vergleich funktioniert – die Preise sind aber erfunden. Echte Prospektpreise schaltest du unter „Einstellungen“ frei.</div>
      </div>` : ""}
    ${crawlFehler ? `
      <div class="card hint-card warn">${icon("achtung", 20)}
        <div class="hint-body"><b>Die Angebote ließen sich nicht laden</b>
        Prüf kurz deine Internetverbindung. Bleibt es dabei, sind wahrscheinlich die Zugangsdaten unter „Einstellungen → Für Fortgeschrittene“ abgelaufen. Mit Beispielangeboten geht es immer weiter.
        <span class="small mute" style="display:block;margin-top:6px">Technisch: ${esc(crawlFehler)}</span></div>
      </div>` : ""}
    ${inhalt}`;
}

/* Einstellungen: Für den Normalfall reicht die Postleitzahl. Alles, wofür man
   Entwicklertools öffnen müsste, liegt zugeklappt unter „Für Fortgeschrittene" –
   vorher stand das Zeug ungefragt mitten im Einkauf. */
let crawlExpertenOffen = false;

function angebotsSetupHtml(a) {
  const live = liveKonfiguriert(a) && !a.demo;
  return `
    <div class="card">
      <label class="field">Deine Postleitzahl
        <input type="text" id="crawl-plz" inputmode="numeric" maxlength="5" placeholder="z. B. 20095" value="${esc(a.plz)}"></label>
      <p class="subtle small" style="margin:-6px 0 12px">Damit vorratio weiß, welche Märkte überhaupt in deiner Nähe sind.</p>

      <div class="card-row" style="align-items:center">
        <span class="small">${live ? "Echte Prospektpreise sind freigeschaltet." : "Zurzeit: Beispielangebote."}</span>
        <span class="badge${live ? "" : " neutral"}">${live ? "echt" : "Beispiel"}</span>
      </div>

      <button class="btn ghost small-btn" id="crawl-experten" style="margin-top:10px">${crawlExpertenOffen ? "Für Fortgeschrittene schließen" : "Für Fortgeschrittene öffnen"}</button>
      ${crawlExpertenOffen ? `
        <div style="margin-top:12px;border-top:1px solid var(--line-soft);padding-top:14px">
          <p class="subtle small" style="margin-bottom:12px">Echte Prospektpreise kommen von Marktguru. Dafür braucht es zwei Zugangsschlüssel, die man sich am Computer aus dem Browser kopiert – nichts, was man nebenbei macht. Ohne sie funktioniert alles andere ganz normal weiter.</p>
          <label class="field">Zugangsschlüssel 1 (x-apikey)
            <input type="text" id="crawl-apikey" autocomplete="off" placeholder="von marktguru.de" value="${esc(a.apikey)}"></label>
          <label class="field">Zugangsschlüssel 2 (x-clientkey)
            <input type="text" id="crawl-clientkey" autocomplete="off" value="${esc(a.clientkey)}"></label>
          <label class="field">Zwischenserver (nur falls nötig)
            <input type="text" id="crawl-proxy" autocomplete="off" placeholder="leer lassen" value="${esc(a.proxy)}"></label>
          <button class="chip ${a.demo ? "selected" : ""}" id="crawl-demo">Immer Beispielangebote nutzen</button>
          <p class="subtle small" style="margin-top:10px">Schritt für Schritt erklärt in docs/angebots-crawl.md.</p>
        </div>` : ""}
      <button class="btn small-btn" id="crawl-speichern" style="margin-top:12px">Speichern</button>
    </div>`;
}

function angebotsErgebnisHtml(erg) {
  const datum = new Date(erg.datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const quelle = erg.quelle === "demo" ? "Beispielangebote" : `Prospektpreise für PLZ ${esc(erg.plz)}`;
  const fuss = `<p class="subtle small" style="text-align:center;margin-top:4px">Stand ${datum} (KW ${esc(erg.kw.slice(-2))}) · Quelle: ${quelle}</p>`;

  if (!erg.maerkte.length) {
    return `<div class="card"><p class="small">Für deine Liste gibt es diese Woche keine passenden Angebote.</p></div>${fuss}`;
  }

  const [best, ...alternativen] = erg.empfehlung;
  const bestHtml = `
    <div class="card">
      <div class="card-row">
        <h3>Dein Markt der Woche: ${esc(best.name)}</h3>
        <span class="badge">deckt ${best.deckung} von ${erg.listeGroesse}</span>
      </div>
      <p class="subtle small">${best.angebote} passende Angebote${best.ersparnisPct != null ? ` · Ø −${best.ersparnisPct} %` : ""}</p>
      ${best.positionen.map((p) => `
        <div class="list-item">
          <div class="grow">
            <span class="name">${esc(p.name)}</span>
            <span class="subtle small" style="display:block">${esc(p.angebot.produkt)}${p.angebot.marke ? ` · ${esc(p.angebot.marke)}` : ""}${p.angebot.mengeText ? ` · ${esc(p.angebot.mengeText)}` : ""}</span>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <b>${preisFmt(p.angebot.preis)}</b>
            ${p.angebot.altpreis != null ? `<span class="subtle small" style="display:block"><s>${preisFmt(p.angebot.altpreis)}</s></span>` : ""}
          </div>
        </div>`).join("")}
    </div>`;

  const altHtml = alternativen.length ? `
    <div class="card">
      ${alternativen.map((m) => `
        <div class="list-item">
          <div class="grow">
            <span class="name">${esc(m.name)}</span>
            <span class="subtle small" style="display:block">deckt ${m.deckung} von ${erg.listeGroesse}${m.ersparnisPct != null ? ` · Ø −${m.ersparnisPct} %` : ""} · ${m.angebote} Angebote</span>
          </div>
        </div>`).join("")}
      <p class="subtle small" style="margin-top:8px">Bewusst kein Markt-Hopping – mehr als zwei, drei Märkte zeigt Vorratio nicht.</p>
    </div>` : "";

  const ohne = erg.ohneAngebot.length
    ? `<p class="subtle small" style="margin:2px 0 6px">Ohne Angebot diese Woche: ${erg.ohneAngebot.map(esc).join(", ")}</p>` : "";

  return bestHtml + altHtml + ohne + fuss;
}

function bindAngebote(s) {
  app.querySelector("#crawl-setup")?.addEventListener("click", () => { crawlSetupOffen = !crawlSetupOffen; renderEinkauf(); });
  app.querySelector("#crawl-demo")?.addEventListener("click", (e) => {
    s.angebote.demo = !s.angebote.demo;
    save();
    e.target.classList.toggle("selected", s.angebote.demo);
  });
  app.querySelector("#crawl-experten")?.addEventListener("click", () => {
    // Eingetipptes nicht verlieren, wenn der Fortgeschrittenen-Teil zuklappt
    uebernehmeCrawlFelder(s);
    crawlExpertenOffen = !crawlExpertenOffen;
    renderEinkauf();
  });
  app.querySelector("#crawl-speichern")?.addEventListener("click", () => {
    uebernehmeCrawlFelder(s);
    save();
    crawlSetupOffen = false;
    toast("Einstellungen gespeichert");
    renderEinkauf();
  });
  app.querySelector("#crawl-start")?.addEventListener("click", () => starteCrawl(s));
}

/* Nur die Felder übernehmen, die gerade sichtbar sind. */
function uebernehmeCrawlFelder(s) {
  const wert = (sel) => app.querySelector(sel)?.value.trim();
  const plz = wert("#crawl-plz");
  if (plz != null) s.angebote.plz = (plz.match(/\d{5}/) || [""])[0];
  for (const [sel, feld] of [["#crawl-apikey", "apikey"], ["#crawl-clientkey", "clientkey"], ["#crawl-proxy", "proxy"]]) {
    const v = wert(sel);
    if (v != null) s.angebote[feld] = v;
  }
  save();
}

async function starteCrawl(s) {
  const liste = crawlListe(s);
  if (!liste.length || crawlLaeuft) return;
  crawlLaeuft = { done: 0, total: liste.length };
  crawlFehler = null;
  renderEinkauf();
  try {
    const ergebnis = await angebotsCrawl(liste, s.angebote, {
      onProgress: (done, total, name) => {
        crawlLaeuft = { done, total };
        const el = document.getElementById("crawl-progress");
        if (el) el.textContent = `${done}/${total} · ${name}`;
      },
    });
    const s2 = getState();
    s2.angebote.letzter = ergebnis;
    if (ergebnis.fehler.length && !ergebnis.maerkte.length) {
      // Alle Anfragen gescheitert (z. B. CORS/Keys) → Fehler zeigen statt leerem Ergebnis
      crawlFehler = ergebnis.fehler[0];
      s2.angebote.letzter = null;
    }
    save();
  } catch (e) {
    crawlFehler = e?.message || String(e);
  }
  crawlLaeuft = null;
  if (view === "einkauf" && !cook && !detailRezept) renderEinkauf();
}

/* ------------------------------------------------------------------ Wissen */
let wissenTab = "tipps";
let ersatzKat = null;   // Kategorie-Filter im Ersatz-Tab (null = alle)
let ersatzAnw = null;   // Anwendungsfall-Filter (backen/aufschlagen/… , null = alle)

/* Substitutions-DB als browsebarer Wissens-Tab: Kategorie- und Anwendungs-
   Filter, Alternativen priorisiert (1 = neutralste Wahl), Handelsbeispiele
   mit Eigenmarken zuerst. Profil-Ausschlüsse filtern hart (wie überall). */
function ersatzTabHtml(s) {
  const eintraege = subsFiltern({ kategorie: ersatzKat, anwendung: ersatzAnw, profil: s.profil });
  const b12 = s.profil.ernaehrungsform === "vegan" ? `
    <div class="card hint-card"><b>Dauerhinweis für dein veganes Profil</b>${esc(FORM_HINWEISE.vegan[0])}</div>` : "";
  const ausgeblendetGesamt = eintraege.reduce((n, e) => n + e.ausgeblendet, 0);
  return `
    <p class="subtle small" style="margin-bottom:10px">Pflanzliche Alternativen zu tierischen Zutaten – priorisiert, mit Mengenverhältnis und Handelsbeispielen (Stand 08/2026; Sortimente ändern sich).${ausgeblendetGesamt ? ` ${ausgeblendetGesamt} Alternativen sind wegen deiner Ausschlüsse ausgeblendet.` : ""}</p>
    ${b12}
    <div class="chip-wrap" style="margin-bottom:8px">
      <button class="chip ${!ersatzKat ? "selected" : ""}" data-ekat="">Alle</button>
      ${Object.entries(SUB_KATEGORIEN).map(([id, name]) => `
        <button class="chip ${ersatzKat === id ? "selected" : ""}" data-ekat="${id}">${esc(name)}</button>`).join("")}
    </div>
    <div class="chip-wrap" style="margin-bottom:16px">
      <button class="chip ${!ersatzAnw ? "selected" : ""}" data-eanw="">Jede Anwendung</button>
      ${Object.entries(SUB_ANWENDUNGEN).map(([id, name]) => `
        <button class="chip ${ersatzAnw === id ? "selected" : ""}" data-eanw="${id}">${esc(name)}</button>`).join("")}
    </div>
    ${eintraege.map(({ sub, alternativen }) => `
      <div class="card">
        <div class="card-row">
          <h3>${esc(sub.original_zutat)}</h3>
          ${sub.funktion_name ? `<span class="badge neutral">${esc(sub.funktion_name)}</span>` : ""}
        </div>
        ${alternativen.map((a, i) => {
          const produkte = produkteSortiert(a).slice(0, 3)
            .map((p) => `${esc(p.produkt)} (${p.laeden.map(esc).join(", ")})`).join(" · ");
          return `
          <div style="margin-top:${i ? 12 : 8}px${i ? ";border-top:1px solid var(--line, #eceae4);padding-top:10px" : ""}">
            <p><b>${esc(a.alternative_name)}</b> <span class="subtle small">· ${esc(a.verhaeltnis)}</span></p>
            <p class="small subtle" style="margin-top:4px">${esc(a.hinweise || "")}</p>
            <div class="chip-wrap" style="margin-top:6px">
              ${(a.geeignet_fuer || []).map((g) => `<span class="badge neutral">${esc(SUB_ANWENDUNGEN[g] || g)}</span>`).join("")}
            </div>
            ${a.naehrwert_hinweis ? `<p class="small" style="margin-top:6px;color:var(--accent)">${esc(a.naehrwert_hinweis)}</p>` : ""}
            ${produkte ? `<p class="small subtle" style="margin-top:6px">Im Handel: ${produkte}</p>` : ""}
          </div>`;
        }).join("")}
      </div>`).join("") || '<div class="empty-state"><p class="small">Keine Alternative passt zu dieser Filter-Kombination.</p></div>'}
    <p class="subtle small" style="text-align:center;margin-top:14px">Bei Fertigprodukten (v. a. Worcestersauce, Milchpulver, Brühe) immer Zutatenliste/V-Label prüfen – Rezepturen variieren.</p>`;
}

/* Tipps/Ideen liegen als „Titel: Fließtext" in der Kern-DB – für die
   Karten-Optik der Übergabe wird die führende Kurzzeile abgetrennt. */
function teileTitel(text) {
  const i = text.indexOf(": ");
  if (i > 0 && i < 60) return { titel: text.slice(0, i), body: text.slice(i + 2) };
  return { titel: null, body: text };
}

/* Tipps und Ideen sind dasselbe Versprechen: etwas, das du noch nicht wusstest.
   Sie liegen darum in einem Pool – nur die Bebilderung unterscheidet sie. */
const TIPP_POOL = [
  ...TIPPS.map((t) => ({ ...t, symbol: "tipp" })),
  ...IDEEN.map((i) => ({ ...i, symbol: "idee" })),
];
const TIPPS_PRO_RUNDE = 4;

/* Reihenfolge einmal pro Gerät festgelegt (Zufall, aber stabil), damit die
   Tipps beim Blättern nicht springen. */
function tippReihenfolge() {
  const s = getState();
  s.tipps.reihenfolge ||= TIPP_POOL.map((t) => t.id).sort(() => Math.random() - 0.5);
  // Neu dazugekommene Tipps hinten anhängen
  for (const t of TIPP_POOL) if (!s.tipps.reihenfolge.includes(t.id)) s.tipps.reihenfolge.push(t.id);
  return s.tipps.reihenfolge.map((id) => TIPP_POOL.find((t) => t.id === id)).filter(Boolean);
}

let tippSeite = 0;

function tippKarteHtml(t, neu) {
  const { titel, body } = teileTitel(t.text);
  return `
    <div class="card" style="display:flex;gap:12px">${icon(t.symbol, 22, "ic-accent")}
      <div class="grow">
        ${titel ? `<span class="name">${esc(titel)}</span>${neu ? ' <span class="badge">neu</span>' : ""}` : ""}
        <span class="subtle small" style="display:block${titel ? ";margin-top:4px" : ""}">${esc(body)}</span>
      </div>
    </div>`;
}

function tippsTabHtml() {
  const s = getState();
  const alle = tippReihenfolge();
  const seiten = Math.max(1, Math.ceil(alle.length / TIPPS_PRO_RUNDE));
  tippSeite = ((tippSeite % seiten) + seiten) % seiten;
  const start = tippSeite * TIPPS_PRO_RUNDE;
  const runde = alle.slice(start, start + TIPPS_PRO_RUNDE);
  const gesehen = new Set(s.tipps.gesehen);
  return `
    <p class="subtle small" style="margin-bottom:12px">Ein paar auf einmal – der Rest kommt nach und nach, auch zwischendurch beim Kochen.</p>
    ${runde.map((t) => tippKarteHtml(t, !gesehen.has(t.id))).join("")}
    <button class="btn secondary" id="tipps-weiter">${icon("wuerfeln", 19)}Weitere Tipps</button>
    <p class="centered-note">${start + runde.length} von ${alle.length}</p>`;
}

function renderWissen() {
  const tabs = { tipps: "Tipps", ersatz: "Ersatz", preps: "Zubereitung", bases: "Grundrezepte", techniken: "Techniken" };
  const inhalt = {
    ersatz: () => ersatzTabHtml(getState()),
    tipps: tippsTabHtml,
    preps: () => `<div class="card">${PREPS.map((p) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:5px">
        <div class="card-row" style="align-items:center"><span class="name">${esc(p.name)}</span><span class="badge neutral">${p.dauer_min} Min</span></div>
        <span class="subtle small">${esc(p.kurz)}</span>
      </div>`).join("")}</div>`,
    bases: () => BASES.map((b) => `
      <div class="card">
        <h3>${esc(b.name)}</h3>
        <p class="subtle small" style="margin-top:6px">${esc(b.kurz)}</p>
        ${b.varianten ? `<p class="small" style="margin-top:6px;color:var(--accent)">Varianten: ${esc(b.varianten)}</p>` : ""}
      </div>`).join(""),
    techniken: () => TECHNIKEN.map((t) => `
      <div class="card"><h3>${esc(t.name)}</h3><p class="subtle small" style="margin-top:6px">${esc(t.text)}</p></div>`).join(""),
  };

  zeigeApp(`
    <div class="fade-in">
      <div class="screen-header"><h1>wissen</h1><p class="subtle small">Grundtechniken und Küchentipps.</p></div>
      <div class="chip-wrap chip-nav" style="margin-bottom:16px">
        ${Object.entries(tabs).map(([id, name]) => `<button class="chip ${wissenTab === id ? "selected" : ""}" data-wtab="${id}">${name}</button>`).join("")}
      </div>
      ${inhalt[wissenTab]()}
    </div>`, "wissen");

  app.querySelectorAll("[data-wtab]").forEach((b) => b.addEventListener("click", () => { wissenTab = b.dataset.wtab; renderWissen(); }));
  app.querySelector("#tipps-weiter")?.addEventListener("click", () => {
    // Was man gerade gelesen hat, gilt als gesehen – "neu" bleibt ehrlich.
    const s = getState();
    const alle = tippReihenfolge();
    const start = tippSeite * TIPPS_PRO_RUNDE;
    for (const t of alle.slice(start, start + TIPPS_PRO_RUNDE)) {
      if (!s.tipps.gesehen.includes(t.id)) s.tipps.gesehen.push(t.id);
    }
    tippSeite++;
    save();
    renderWissen();
  });
  app.querySelectorAll("[data-ekat]").forEach((b) => b.addEventListener("click", () => { ersatzKat = b.dataset.ekat || null; renderWissen(); }));
  app.querySelectorAll("[data-eanw]").forEach((b) => b.addEventListener("click", () => { ersatzAnw = b.dataset.eanw || null; renderWissen(); }));
}

/* ------------------------------------------------------------------ Profil
   Die Übersicht zeigt nur, was dein Profil tatsächlich ausmacht – nicht den
   ganzen Katalog. Hinzufügen läuft über „+", Entfernen über das × am Eintrag;
   die volle Auswahlliste klappt nur auf, solange man sie braucht. */
let profilOffen = { form: false, aus: false, vorlieben: false, stile: false, ziele: false };

/* Kopfzeile eines Profil-Abschnitts. Der Schalter rechts erscheint nur, wenn er
   etwas zu sagen hat: „Fertig" beim offenen Abschnitt, „Ändern" bei der
   Ernährungsform (die kein „+"-Chip hat). Sonst öffnet der +-Chip darunter. */
function profilKopf(titel, schluessel, label = null) {
  const offen = profilOffen[schluessel];
  const schalter = offen ? "Fertig" : label;
  return `
    <div class="section-head section-gap">
      <h2>${titel}</h2>
      ${schalter ? `<button class="btn ghost small-btn" data-popen="${schluessel}">${schalter}</button>` : ""}
    </div>`;
}

function profilFormHtml(s, form) {
  const offen = profilOffen.form;
  return `
    ${profilKopf("Ernährungsform", "form", "Ändern")}
    ${offen ? `
      <div class="choice-list">
        ${ERNAEHRUNGSFORMEN.map((f) => `
          <button class="choice ${s.profil.ernaehrungsform === f.id ? "selected" : ""}" data-pform="${f.id}">
            <b>${esc(f.name)}</b><span class="subtle">${esc(f.kurz)}</span>
          </button>`).join("")}
      </div>` : `
      <div class="card">
        <div class="list-item" style="border-bottom:none">
          <div class="grow"><span class="name">${esc(form?.name || "Noch nicht gewählt")}</span>
          ${form ? `<span class="subtle small" style="display:block">${esc(form.kurz)}</span>` : ""}</div>
        </div>
      </div>`}`;
}

function profilAusschluesseHtml(s) {
  const gewaehlt = AUSSCHLUESSE.filter((a) => s.profil.ausschluesse.includes(a.id));
  const eigene = s.profil.eigeneAusschluesse || [];
  const offen = profilOffen.aus;
  const leer = !gewaehlt.length && !eigene.length;
  return `
    ${profilKopf("Ausschlüsse", "aus")}
    ${offen ? `
      <div class="chip-wrap">
        ${AUSSCHLUESSE.map((a) => `<button class="chip ${s.profil.ausschluesse.includes(a.id) ? "selected" : ""}" data-paus="${a.id}">${esc(a.name)}</button>`).join("")}
      </div>
      ${eigeneAusschluesseHtml(eigene)}` : `
      <div class="chip-wrap">
        ${gewaehlt.map((a) => `<button class="chip selected" data-paus="${a.id}">${esc(a.name)}<span class="chip-x">×</span></button>`).join("")}
        ${eigene.map((t, i) => `<button class="chip selected" data-eigen-weg="${i}">${esc(t)}<span class="chip-x">×</span></button>`).join("")}
        <button class="chip chip-plus" data-popen="aus">${icon("plus", 16)}${leer ? "Ausschluss hinzufügen" : "Hinzufügen"}</button>
      </div>`}`;
}

/* Vorlieben im Profil: Frage und Liste hängen an der Ernährungsform – wechselt
   die Form, wechselt hier auch die Auswahl. Der formspezifische Hinweis bleibt
   dem Onboarding vorbehalten; im Profil stehen die Hinweise zur Ernährungsform
   ohnehin weiter unten. */
function profilVorliebenHtml(s) {
  const konfig = vorliebenFuerForm(s.profil.ernaehrungsform, s.profil.ausschluesse, s.profil.eigeneAusschluesse || []);
  const gewaehlt = gewaehlteVorlieben(s.profil.ernaehrungsform, s.profil.vorlieben || []);
  return `
    ${profilKopf("Vorlieben", "vorlieben")}
    ${profilOffen.vorlieben ? `
      <p class="subtle small" style="margin-bottom:10px">${esc(konfig.intro)}</p>
      ${vorliebenListeHtml(konfig, s.profil.vorlieben || [], "data-pvorliebe")}` : `
      <div class="chip-wrap">
        ${gewaehlt.map((v) => `<button class="chip selected" data-pvorliebe="${v.id}">${esc(v.name)}<span class="chip-x">×</span></button>`).join("")}
        <button class="chip chip-plus" data-popen="vorlieben">${icon("plus", 16)}${gewaehlt.length ? "Hinzufügen" : "Vorliebe hinzufügen"}</button>
      </div>`}`;
}

function profilStileHtml(s) {
  const gewaehlt = STILE.filter((st) => s.profil.stile.includes(st.id));
  const offen = profilOffen.stile;
  return `
    ${profilKopf("Stil-Präferenzen", "stile")}
    ${offen ? `
      <div class="chip-wrap">
        ${STILE.map((st) => `<button class="chip ${s.profil.stile.includes(st.id) ? "selected" : ""}" data-pstil="${st.id}">${esc(st.name)}</button>`).join("")}
      </div>` : `
      <div class="chip-wrap">
        ${gewaehlt.map((st) => `<button class="chip selected" data-pstil="${st.id}">${esc(st.name)}<span class="chip-x">×</span></button>`).join("")}
        <button class="chip chip-plus" data-popen="stile">${icon("plus", 16)}${gewaehlt.length ? "Hinzufügen" : "Stil hinzufügen"}</button>
      </div>`}
    ${gewaehlt.filter((st) => st.hinweis).map((st) => `
      <div class="inline-hint warn" style="margin-top:10px">${icon("achtung", 20)}
        <div class="hint-body"><b>${esc(st.name)}</b>${esc(st.hinweis)}</div>
      </div>`).join("")}`;
}

function profilZieleHtml(s) {
  const ziele = s.profil.ziele || [];
  const gewaehlt = ZIELE.filter((z) => ziele.includes(z.id));
  return `
    ${profilKopf("Ziele", "ziele")}
    ${profilOffen.ziele ? zielListeHtml(ziele, "data-pziel") : `
      <div class="chip-wrap">
        ${gewaehlt.map((z) => `<button class="chip selected" data-pziel="${z.id}">${esc(z.name)}<span class="chip-x">×</span></button>`).join("")}
        <button class="chip chip-plus" data-popen="ziele">${icon("plus", 16)}${gewaehlt.length ? "Hinzufügen" : "Ziel hinzufügen"}</button>
      </div>
      ${gewaehlt.map((z) => `
        <div class="inline-hint" style="margin-top:10px">${icon("ziel", 20)}
          <div class="hint-body"><b>${esc(z.name)} – was dazu belegt ist</b>${esc(z.hinweis)}</div>
        </div>`).join("")}`}`;
}

function renderProfil() {
  const s = getState();
  const form = ERNAEHRUNGSFORMEN.find((f) => f.id === s.profil.ernaehrungsform);
  const hinweise = hinweiseFuerForm(s.profil.ernaehrungsform);

  const stilNamen = (s.profil.stile || []).map((id) => STILE.find((st) => st.id === id)?.name).filter(Boolean);
  const initial = (s.profil.name || "?").trim().charAt(0).toUpperCase() || "?";

  zeigeApp(`
    <div class="fade-in">
      <div class="profile-head">
        <div class="avatar">${esc(initial)}</div>
        <div>
          <h1>${esc(s.profil.name || "ohne namen")}</h1>
          <p class="subtle small">${esc([form?.name, ...stilNamen].filter(Boolean).join(" · ") || "Profil einrichten")}</p>
        </div>
      </div>

      ${profilFormHtml(s, form)}
      ${profilAusschluesseHtml(s)}
      ${profilVorliebenHtml(s)}
      ${profilStileHtml(s)}
      ${profilZieleHtml(s)}

      <h2 class="section-gap">Hinweise zu deiner Ernährungsform</h2>
      ${hinweise.map((t) => `<div class="card hint-card">${icon("tipp", 20)}<span class="hint-body">${esc(t)}</span></div>`).join("")}
      <p class="subtle small">${esc(FORM_HINWEISE.sonderfaelle)}</p>

      ${s.historie.length ? `
        <h2 class="section-gap">Zuletzt gekocht</h2>
        <div class="card">
          ${s.historie.slice(0, 8).map((e) => `
            <div class="list-item"><div class="grow"><span class="name">${esc(e.name)}</span>
            <span class="subtle small" style="display:block">${new Date(e.datum).toLocaleDateString("de-DE")} · ${portionenText(e.portionen)}</span></div></div>`).join("")}
        </div>` : ""}

      <h2 class="section-gap">Claude-API-Key</h2>
      <div class="card">
        <div class="card-row" style="align-items:center;margin-bottom:12px">
          <span class="name">Für AI-Rezepte &amp; Bon-Scan</span>
          <span class="badge${s.settings.apiKey ? "" : " neutral"}">${s.settings.apiKey ? "hinterlegt" : "fehlt"}</span>
        </div>
        <input type="password" id="api-key" placeholder="sk-ant-…" value="${esc(s.settings.apiKey || "")}" autocomplete="off">
        <button class="btn small-btn" id="api-key-save" style="margin-top:10px">Speichern</button>
        <p class="subtle small" style="margin-top:10px">Bleibt lokal auf diesem Gerät und geht nur an api.anthropic.com. Key erstellen: console.anthropic.com.</p>
        ${(s.aiRezepte || []).length ? `
          <hr class="divider" style="margin:14px 0">
          <div class="card-row" style="align-items:center"><span class="small">${s.aiRezepte.length} AI-Rezepte gespeichert</span>
          <button class="btn ghost small-btn" id="ai-loeschen">Löschen</button></div>` : ""}
      </div>

      <h2 class="section-gap">Aus dem Vorrat gebaute Rezepte</h2>
      <div class="card">
        <p class="subtle small">Der Vorrats-Generator kombiniert deinen tatsächlichen Bestand nach festen Küchenmustern zu neuen Rezepten – offline, ohne API-Key. Zu finden über „Aus Vorrat bauen“ auf der Heute-Seite.</p>
        ${(s.vorratRezepte || []).length ? `
          <hr class="divider" style="margin:14px 0">
          <div class="card-row" style="align-items:center"><span class="small">${s.vorratRezepte.length} Vorrats-Rezepte gespeichert</span>
          <button class="btn ghost small-btn" id="vorrat-loeschen">Löschen</button></div>` : ""}
      </div>

      <h2 class="section-gap">Daten</h2>
      <div class="btn-row">
        <button class="btn secondary" id="export">Export</button>
        <button class="btn secondary" id="import">Import</button>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden>
      <p class="subtle small" style="margin-top:10px">Alles liegt lokal auf diesem Gerät. Der Export ist dein Backup (auch gegen iOS-Speicherbereinigung) – regelmäßig sichern.</p>
      <button class="btn danger" id="reset">Alle Daten zurücksetzen</button>
      <p class="centered-note" style="margin-top:20px">vorratio v1 · lokal &amp; privat · ersetzt keine Ernährungs- oder ärztliche Beratung</p>
    </div>`, "profil");

  app.querySelectorAll("[data-popen]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.popen;
    profilOffen[k] = !profilOffen[k];
    renderProfil();
  }));
  app.querySelectorAll("[data-pform]").forEach((b) => b.addEventListener("click", () => {
    s.profil.ernaehrungsform = b.dataset.pform;
    profilOffen.form = false;      // eine Form, eine Entscheidung – Liste schließt sich
    bereinigeVorlieben(s.profil);  // Vorlieben folgen der Form
    save();
    renderProfil();
  }));
  app.querySelectorAll("[data-paus]").forEach((b) => b.addEventListener("click", () => {
    toggle(s.profil.ausschluesse, b.dataset.paus);
    bereinigeVorlieben(s.profil);
    save();
    renderProfil();
  }));
  app.querySelectorAll("[data-pvorliebe]").forEach((b) => b.addEventListener("click", () => {
    s.profil.vorlieben ||= [];
    toggle(s.profil.vorlieben, b.dataset.pvorliebe);
    // Geänderte Vorlieben sollen sofort wirken: die gemerkten Vorschläge des
    // laufenden Slots verfallen und werden beim nächsten "Heute" neu gescort.
    s.vorschlaege = null;
    s.snackVorschlaege = null;
    save();
    renderProfil();
  }));
  app.querySelectorAll("[data-pstil]").forEach((b) => b.addEventListener("click", () => { toggle(s.profil.stile, b.dataset.pstil); save(); renderProfil(); }));
  app.querySelectorAll("[data-pziel]").forEach((b) => b.addEventListener("click", () => { s.profil.ziele ||= []; toggle(s.profil.ziele, b.dataset.pziel); save(); renderProfil(); }));
  s.profil.eigeneAusschluesse ||= [];
  bindEigeneAusschluesse(s.profil.eigeneAusschluesse, () => { bereinigeVorlieben(s.profil); save(); renderProfil(); });
  app.querySelector("#api-key-save").addEventListener("click", () => {
    s.settings.apiKey = app.querySelector("#api-key").value.trim() || null;
    save();
    toast(s.settings.apiKey ? "API-Key gespeichert" : "API-Key entfernt");
    renderProfil();
  });
  app.querySelector("#ai-loeschen")?.addEventListener("click", async () => {
    if (await bestaetige({
      titel: "AI-Rezepte löschen?",
      text: `${s.aiRezepte.length} von Claude generierte Rezepte werden entfernt. Die Kern-Rezepte bleiben – und was du dir ins Kochbuch gelegt hast, ebenfalls.`,
      bestaetigen: "Löschen", danger: true, symbol: "achtung",
    })) { s.aiRezepte = []; save(); renderProfil(); }
  });
  app.querySelector("#vorrat-loeschen")?.addEventListener("click", async () => {
    if (await bestaetige({
      titel: "Vorrats-Rezepte löschen?",
      text: `${s.vorratRezepte.length} aus deinem Bestand gebaute Rezepte werden entfernt. Die Kern-Rezepte bleiben – und was du dir ins Kochbuch gelegt hast, ebenfalls.`,
      bestaetigen: "Löschen", danger: true, symbol: "achtung",
    })) { s.vorratRezepte = []; save(); renderProfil(); }
  });
  app.querySelector("#export").addEventListener("click", exportJson);
  app.querySelector("#import").addEventListener("click", () => app.querySelector("#import-file").click());
  app.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await importJson(file); toast("Import erfolgreich"); render(); }
    catch (err) {
      await dialog({ titel: "Import fehlgeschlagen", text: err.message, bestaetigen: "Verstanden", danger: true, symbol: "achtung" });
    }
  });
  app.querySelector("#reset").addEventListener("click", async () => {
    if (await bestaetige({
      titel: "Wirklich alles löschen?",
      text: "Vorrat, Profil, Historie und Einkaufslisten werden entfernt. Ohne vorherigen Export ist das endgültig.",
      bestaetigen: "Alles löschen", danger: true, symbol: "achtung",
    })) {
      resetAll();
      ob = leeresOb();
      profilOffen = { form: false, aus: false, vorlieben: false, stile: false, ziele: false };
      editor = null;
      kochbuchSuche = "";
      kochbuchFilter = "alle";
      render();
    }
  });
}

/* ------------------------------------------------------------------- Start */
load();
stelleVorschlaegeBereit();   // Push-Fallback: beim Öffnen liegen die Slot-Vorschläge bereit
stelleSnacksBereit();        // … und die Snack-Ecke gleich mit
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
render();

/* Wandert die App in den Hintergrund, endet ein laufendes Diktat sofort –
   das Gesagte bleibt als Text stehen und lässt sich beim Zurückkommen
   auswerten. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" || !aufnahme) return;
  const text = diktat?.text || "";
  stoppeAufnahme();
  diktat = { status: "start", text };
});

/* iOS-PWAs werden meist fortgesetzt statt neu geladen – beim Zurückkehren in
   den Vordergrund zählt das als "Öffnen": Slot prüfen, Vorschläge bereitlegen. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const vorher = getState().vorschlaege;
  const snacksVorher = getState().snackVorschlaege;
  const nachher = stelleVorschlaegeBereit();
  const snacksNachher = stelleSnacksBereit();
  if (view === "heute" && !cook && !editor && !detailRezept && (nachher !== vorher || snacksNachher !== snacksVorher)) render();
});

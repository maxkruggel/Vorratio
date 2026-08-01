/* Vorratio – App-Steuerung & Views.
   User Journey (Kap. 4): Onboarding → Ersteinrichtung Bestand → tägliche
   Vorschläge (3 je Slot, neu würfeln) → fokussierter Einkauf → Kochmodus mit
   Timern → Abhaken & Abbuchung → Wocheneinkauf. */

import { load, save, getState, exportJson, importJson, resetAll } from "./storage.js";
import { ZUTATEN, REZEPTE, PREPS, BASES, TIPPS, IDEEN, TECHNIKEN } from "./data/kerndb.js";
import { ERNAEHRUNGSFORMEN, AUSSCHLUESSE, STILE, hinweiseFuerForm, FORM_HINWEISE } from "./data/profil.js";
import {
  ZUTAT_INDEX, aktuellerSlot, SLOT_NAMEN, rezeptErlaubt, vorschlaege, tagesSeed,
  bestandsAbgleich, abbuchen, mengeAnzeige, wochenKandidaten,
} from "./engine.js";

const app = document.getElementById("app");
const tabbar = document.getElementById("tabbar");
let view = "heute";
let cook = null;            // { rezept, portionen, step, timer }
let detailRezept = null;

const KATEGORIE_NAMEN = {
  trocken: "Trockenware & Vorrat", frisch: "Frischware", konserve: "Konserven",
  gewuerz: "Gewürze", kuehl: "Kühlschrank", tk: "Tiefkühl",
};

/* ------------------------------------------------------------------ Helpers */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const heuteStr = () => new Date().toISOString().slice(0, 10);

function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

function render() {
  const s = getState();
  if (!s.profil.onboarded) { tabbar.hidden = true; renderOnboarding(); return; }
  tabbar.hidden = false;
  tabbar.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (cook) { renderKochmodus(); return; }
  if (detailRezept) { renderRezeptDetail(detailRezept); return; }
  ({ heute: renderHeute, vorrat: renderVorrat, einkauf: renderEinkauf, wissen: renderWissen, profil: renderProfil }[view] || renderHeute)();
  window.scrollTo(0, 0);
}

tabbar.addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  if (cook && !confirm("Kochen verlassen? Es wird nichts abgebucht.")) return;
  cook = null;
  clearTimerTick();
  view = b.dataset.view;
  detailRezept = null;
  render();
});

/* ------------------------------------------------------------ Onboarding */
let ob = { step: 0, name: "", form: null, ausschluesse: [], stile: [] };

function renderOnboarding() {
  const steps = [obWelcome, obName, obForm, obAusschluesse, obStile, obToleranz];
  app.replaceChildren(h(`<div class="fade-in">${steps[ob.step]()}</div>`));
  bindOnboarding();
}

function obWelcome() {
  return `
    <div class="onboard-hero">
      <div class="logo-mark">V</div>
      <h1>Vorratio</h1>
      <p class="subtle" style="margin-top:8px">Kennt deinen Vorrat. Schlägt dir vor, was du daraus kochst.<br>Bucht ab, was du verbrauchst.</p>
    </div>
    <button class="btn" data-ob="next">Los geht's</button>`;
}

function obName() {
  return `
    <div class="screen-header"><h1>Wie heißt du?</h1><p class="subtle">Damit Vorratio dich ansprechen kann.</p></div>
    <label class="field"><input type="text" id="ob-name" placeholder="Dein Name" value="${esc(ob.name)}" autocomplete="given-name"></label>
    <button class="btn" data-ob="name">Weiter</button>`;
}

function obForm() {
  return `
    <div class="screen-header"><h1>Deine Ernährungsform</h1><p class="subtle">Genau eine – Allergien und Stile kommen gleich separat.</p></div>
    <div class="choice-list">
      ${ERNAEHRUNGSFORMEN.map((f) => `
        <button class="choice ${ob.form === f.id ? "selected" : ""}" data-form="${f.id}">
          <b>${esc(f.name)}</b><span class="subtle">${esc(f.kurz)}</span>
        </button>`).join("")}
    </div>
    <button class="btn" data-ob="next" ${ob.form ? "" : "disabled"}>Weiter</button>`;
}

function obAusschluesse() {
  const gruppe = (g, titel) => `
    <h3 style="margin:14px 0 8px">${titel}</h3>
    <div class="chip-wrap">
      ${AUSSCHLUESSE.filter((a) => a.gruppe === g).map((a) => `
        <button class="chip ${ob.ausschluesse.includes(a.id) ? "selected" : ""}" data-aus="${a.id}">${esc(a.name)}</button>`).join("")}
    </div>`;
  return `
    <div class="screen-header"><h1>Ausschlüsse</h1><p class="subtle">Harte Filter – Rezepte damit siehst du nie. Mehrfachauswahl, alles optional.</p></div>
    ${gruppe("allergie", "Allergien & Intoleranzen")}
    ${gruppe("religioes", "Religiös-kulturell")}
    <button class="btn" data-ob="next">Weiter</button>`;
}

function obStile() {
  return `
    <div class="screen-header"><h1>Stil-Präferenzen</h1><p class="subtle">Optional – passende Rezepte werden bevorzugt, nichts wird verboten.</p></div>
    <div class="chip-wrap">
      ${STILE.map((s) => `<button class="chip ${ob.stile.includes(s.id) ? "selected" : ""}" data-stil="${s.id}">${esc(s.name)}</button>`).join("")}
    </div>
    ${ob.stile.map((id) => STILE.find((s) => s.id === id)?.hinweis).filter(Boolean).map((t) => `
      <div class="card hint-card" style="margin-top:12px"><b>Hinweis</b>${esc(t)}</div>`).join("")}
    <button class="btn" data-ob="next">Weiter</button>`;
}

function obToleranz() {
  return `
    <div class="screen-header"><h1>Eine Sache noch</h1></div>
    <div class="card">
      <p><b>Vorratio arbeitet mit Toleranz, nicht mit Scheinpräzision.</b></p>
      <p class="subtle" style="margin-top:8px">Beim Kochen wird der Verbrauch mit ±10–15 % Spielraum pro Produkt abgebucht – du kochst aus der Hüfte, die App rechnet mit. Du musst nie etwas abwiegen. Mengen siehst du immer als Näherung („~500 g“).</p>
    </div>
    <button class="btn" data-ob="fertig">Verstanden – Bestand einrichten</button>`;
}

function bindOnboarding() {
  app.querySelectorAll("[data-form]").forEach((b) => b.addEventListener("click", () => { ob.form = b.dataset.form; renderOnboarding(); }));
  app.querySelectorAll("[data-aus]").forEach((b) => b.addEventListener("click", () => { toggle(ob.ausschluesse, b.dataset.aus); renderOnboarding(); }));
  app.querySelectorAll("[data-stil]").forEach((b) => b.addEventListener("click", () => { toggle(ob.stile, b.dataset.stil); renderOnboarding(); }));
  app.querySelector('[data-ob="next"]')?.addEventListener("click", () => { ob.step++; renderOnboarding(); });
  app.querySelector('[data-ob="name"]')?.addEventListener("click", () => {
    ob.name = app.querySelector("#ob-name").value.trim();
    ob.step++;
    renderOnboarding();
  });
  app.querySelector('[data-ob="fertig"]')?.addEventListener("click", () => {
    const s = getState();
    s.profil = { name: ob.name, ernaehrungsform: ob.form, ausschluesse: ob.ausschluesse, stile: ob.stile, onboarded: true };
    save();
    view = "vorrat";
    render();
  });
}

function toggle(arr, val) {
  const i = arr.indexOf(val);
  i >= 0 ? arr.splice(i, 1) : arr.push(val);
}

/* ------------------------------------------------------------------ Heute */

/* Push-Fallback (Kap. 7.1): Web Push braucht einen Push-Server – ohne ihn
   greift der dokumentierte Fallback: die Vorschläge für den aktuellen Slot
   werden beim Öffnen erzeugt und persistiert, liegen also sofort bereit und
   bleiben innerhalb eines Slots stabil. Neu erzeugt wird bei Tages- oder
   Slot-Wechsel, bei "Neu würfeln", nach der Bestands-Ersteinrichtung und
   wenn ein gemerktes Rezept nicht mehr zum Profil passt. */
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
      const r = REZEPTE.find((x) => x.id === id);
      return r && rezeptErlaubt(r, s.profil);
    });
  if (gueltig && !neuWuerfeln) return v;

  const gewuerfelt = gueltig ? (v.gewuerfelt || 0) + 1 : 0;
  const vs = vorschlaege(s.profil, s.bestand, slot, tagesSeed(datum, gewuerfelt));
  s.vorschlaege = { datum, slot, rezeptIds: vs.map((x) => x.rezept.id), gewuerfelt, bestandLeer };
  save();
  return s.vorschlaege;
}

function renderHeute() {
  const s = getState();
  const bereit = stelleVorschlaegeBereit();
  const slot = bereit.slot;
  const vs = bereit.rezeptIds
    .map((id) => REZEPTE.find((r) => r.id === id))
    .filter(Boolean)
    .map((rezept) => ({ rezept, abgleich: bestandsAbgleich(rezept, s.bestand) }));
  const gruss = s.profil.name ? `Moin, ${esc(s.profil.name)}` : "Moin";
  const leererBestand = s.bestand.length === 0;

  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="screen-header">
        <h1>${gruss}</h1>
        <p class="subtle">Vorschläge fürs ${SLOT_NAMEN[slot]} – aus deinem Bestand.</p>
      </div>
      ${leererBestand ? `
        <div class="card hint-card"><b>Dein Vorrat ist noch leer</b>
        Richte einmal deinen Bestand ein (ca. 15 Minuten) – danach passen die Vorschläge zu dem, was wirklich da ist.
        <button class="btn small-btn" style="margin-top:10px" data-go="vorrat">Zum Vorrat</button></div>` : ""}
      ${vs.map((v, i) => `
        <div class="card tappable" data-rezept="${v.rezept.id}">
          <div class="card-row">
            <h3>${esc(v.rezept.name)}</h3>
            <span class="badge neutral">${v.rezept.gesamtzeit_min.gesamt} Min</span>
          </div>
          <p class="subtle">${esc(v.rezept.cuisine)} · ${esc(v.rezept.schwierigkeit)} · ${v.rezept.portionen} Portionen</p>
          ${v.abgleich.fehlt.length === 0
            ? `<span class="badge" style="margin-top:8px">Alles da ✓</span>`
            : `<p class="small" style="margin-top:8px;color:var(--warn)">Das fehlt dir: ${v.abgleich.fehlt.map((z) => esc(z.zutat_name)).join(", ")}</p>`}
        </div>`).join("")}
      <button class="btn secondary" id="wuerfeln">↻ Neu würfeln</button>
      <p class="subtle small" style="text-align:center;margin-top:14px">Feste Zeiten: 8:00 Frühstück · 11:30 Mittag · 17:30 Abend<br>Ohne Push-Einrichtung liegen die Vorschläge beim Öffnen bereit.</p>
    </div>`));

  app.querySelectorAll("[data-rezept]").forEach((c) => c.addEventListener("click", () => {
    detailRezept = REZEPTE.find((r) => r.id === c.dataset.rezept);
    render();
  }));
  app.querySelector("#wuerfeln").addEventListener("click", () => { stelleVorschlaegeBereit(true); render(); });
  app.querySelector('[data-go="vorrat"]')?.addEventListener("click", (e) => { e.stopPropagation(); view = "vorrat"; render(); });
}

/* ---------------------------------------------------------- Rezept-Detail */
function renderRezeptDetail(rezept) {
  const s = getState();
  const ab = bestandsAbgleich(rezept, s.bestand);
  const tip = TIPPS[Math.abs(hashCode(rezept.id)) % TIPPS.length];

  app.replaceChildren(h(`
    <div class="fade-in">
      <button class="btn ghost small-btn" id="zurueck">‹ Zurück</button>
      <div class="screen-header" style="margin-top:10px">
        <h1>${esc(rezept.name)}</h1>
        <p class="subtle">${esc(rezept.cuisine)} · ${rezept.gesamtzeit_min.gesamt} Min · ${esc(rezept.schwierigkeit)} · ${rezept.portionen} Portionen</p>
      </div>
      <div class="card">
        <h2>Zutaten</h2>
        ${rezept.zutaten.map((z) => {
          const fehlt = ab.fehlt.includes(z);
          return `<div class="list-item">
            <span class="check ${fehlt ? "" : "done"}">✓</span>
            <div class="grow">${esc(zutatText(z))}${z.optional ? ' <span class="subtle small">(optional)</span>' : ""}</div>
            ${fehlt ? '<span class="badge warn">fehlt</span>' : ""}
          </div>`;
        }).join("")}
      </div>
      ${rezept.naehrwert_einordnung?.makro_hinweis ? `
        <div class="card hint-card"><b>Gut zu wissen</b>${esc(rezept.naehrwert_einordnung.makro_hinweis)}</div>` : ""}
      ${ab.fehlt.length > 0 ? `
        <button class="btn" id="einkauf-starten">Einkaufsliste erstellen (${ab.fehlt.length} fehlt)</button>
        <button class="btn secondary" id="kochen-trotzdem">Trotzdem kochen</button>`
        : `<button class="btn" id="kochen">Jetzt kochen</button>`}
      <div class="card" style="margin-top:16px"><p class="small subtle">💡 ${esc(tip.text)}</p></div>
    </div>`));

  app.querySelector("#zurueck").addEventListener("click", () => { detailRezept = null; render(); });
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

function zutatText(z) {
  const menge = z.menge != null ? `${z.menge} ${z.einheit === "Stk" ? "" : z.einheit + " "}`.trim() + " " : "";
  return `${menge}${z.zutat_name}`;
}

function hashCode(str) {
  let hsh = 0;
  for (const c of str) hsh = ((hsh << 5) - hsh + c.charCodeAt(0)) | 0;
  return hsh;
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
    app.replaceChildren(h(`
      <div class="fade-in">
        <button class="btn ghost small-btn" id="abbrechen">‹ Abbrechen</button>
        <div class="screen-header" style="margin-top:10px"><h1>${esc(rezept.name)}</h1><p class="subtle">Für wie viele Portionen kochst du?</p></div>
        <div class="card" style="text-align:center">
          <div class="stepper" style="justify-content:center">
            <button id="p-minus">−</button>
            <span class="count">${cook.portionen}</span>
            <button id="p-plus">+</button>
          </div>
        </div>
        <button class="btn" id="los">Los kochen</button>
      </div>`));
    app.querySelector("#abbrechen").addEventListener("click", () => { cook = null; render(); });
    app.querySelector("#p-minus").addEventListener("click", () => { cook.portionen = Math.max(1, cook.portionen - 1); renderKochmodus(); });
    app.querySelector("#p-plus").addEventListener("click", () => { cook.portionen++; renderKochmodus(); });
    app.querySelector("#los").addEventListener("click", () => { cook.step = 0; renderKochmodus(); });
    return;
  }

  if (step >= rezept.schritte.length) { renderValidierung(); return; }

  const s = rezept.schritte[step];
  const hatTimer = s.dauer_sekunden != null && s.dauer_sekunden > 0;

  app.replaceChildren(h(`
    <div class="fade-in">
      <button class="btn ghost small-btn" id="abbrechen">‹ Abbrechen</button>
      <div class="card cook-step">
        <span class="step-nr">Schritt ${step + 1} von ${rezept.schritte.length}${s.temperatur_c ? ` · ${s.temperatur_c} °C` : ""}</span>
        <p class="step-text">${esc(s.text)}</p>
        ${hatTimer ? `
          <div class="timer-box" id="timer-box">
            <div class="timer-name">${esc(s.timer_name || "Timer")} · ${esc(s.timer_typ || "")}</div>
            <div class="timer-display" id="timer-display">${fmtZeit(s.dauer_sekunden)}</div>
            <button class="btn small-btn" id="timer-start" style="margin-top:8px">Timer starten</button>
          </div>` : ""}
        <div class="progress-dots">${rezept.schritte.map((_, i) => `<span class="${i <= step ? "done" : ""}"></span>`).join("")}</div>
      </div>
      <div class="btn-row">
        ${step > 0 ? '<button class="btn secondary" id="prev">‹ Zurück</button>' : ""}
        <button class="btn" id="next">${step === rezept.schritte.length - 1 ? "Fertig ✓" : "Weiter ›"}</button>
      </div>
    </div>`));

  app.querySelector("#abbrechen").addEventListener("click", () => {
    if (confirm("Kochen abbrechen? Es wird nichts abgebucht.")) { cook = null; render(); }
  });
  app.querySelector("#prev")?.addEventListener("click", () => { cook.step--; renderKochmodus(); });
  app.querySelector("#next").addEventListener("click", () => { cook.step++; renderKochmodus(); });
  app.querySelector("#timer-start")?.addEventListener("click", (e) => startTimer(s, e.target));
}

let timerInterval = null;
function clearTimerTick() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

function startTimer(schritt, btn) {
  btn.hidden = true;
  const display = document.getElementById("timer-display");
  const box = document.getElementById("timer-box");
  const ende = Date.now() + schritt.dauer_sekunden * 1000;
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  timerInterval = setInterval(() => {
    const rest = Math.round((ende - Date.now()) / 1000);
    if (rest <= 0) {
      clearTimerTick();
      display.textContent = "Fertig!";
      box.classList.add("done");
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Vorratio", { body: `${schritt.timer_name || "Timer"}: fertig!` });
      }
      return;
    }
    display.textContent = fmtZeit(rest);
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
  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="screen-header"><h1>Fertig gekocht 🎉</h1><p class="subtle">Kurz bestätigen, dann bucht Vorratio den Verbrauch ab (mit Toleranzband).</p></div>
      <div class="card">
        <p><b>${esc(rezept.name)}</b> · ${portionen} Portionen</p>
        <p class="subtle small" style="margin-top:6px">Abgebucht werden die Rezeptmengen × Portionsfaktor. Kleinmengen (EL, TL, Prisen) laufen unter Toleranz.</p>
      </div>
      <button class="btn" id="buchen">Abhaken & abbuchen</button>
      <button class="btn secondary" id="ohne">Fertig ohne Abbuchung</button>
    </div>`));
  app.querySelector("#buchen").addEventListener("click", () => {
    const s = getState();
    const gebucht = abbuchen(rezept, s.bestand, portionen);
    s.historie.unshift({ rezeptId: rezept.id, name: rezept.name, portionen, datum: new Date().toISOString() });
    if (s.einkauf.rezeptId === rezept.id) { s.einkauf.rezept = []; s.einkauf.rezeptId = null; }
    syncWochenliste(s);
    save();
    cook = null;
    view = "vorrat";
    render();
  });
  app.querySelector("#ohne").addEventListener("click", () => { cook = null; view = "heute"; render(); });
}

/* ------------------------------------------------------------------ Vorrat */
let vorratAddOffen = false;
let vorratSuche = "";

function renderVorrat() {
  const s = getState();
  const gruppen = {};
  for (const item of s.bestand) (gruppen[item.kategorie] ||= []).push(item);

  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="screen-header card-row">
        <div><h1>Vorrat</h1><p class="subtle">${s.bestand.length} Artikel · Mengen sind Näherungen</p></div>
        <button class="btn small-btn" id="add-toggle">${vorratAddOffen ? "Schließen" : "+ Erfassen"}</button>
      </div>
      ${vorratAddOffen ? vorratAddForm() : ""}
      ${s.bestand.length === 0 && !vorratAddOffen ? `
        <div class="empty-state"><div class="big">▤</div>
          <p><b>Noch nichts erfasst.</b></p>
          <p class="small">Einmalige Aufnahme: Trockenware, Frischware, Konserven, Gewürze – danach hält Vorratio den Stand automatisch aktuell.</p>
        </div>` : ""}
      ${Object.entries(KATEGORIE_NAMEN).filter(([k]) => gruppen[k]?.length).map(([k, titel]) => `
        <div class="section-gap">
          <h2>${titel}</h2>
          <div class="card">
            ${gruppen[k].map((item) => `
              <div class="list-item" data-item="${item.id}">
                <div class="grow">
                  <span class="name">${esc(item.name)}</span>
                  <span class="subtle small" style="display:block">${mengeAnzeige(item)}</span>
                </div>
                <button class="btn ghost small-btn" data-edit="${item.id}">Ändern</button>
              </div>`).join("")}
          </div>
        </div>`).join("")}
    </div>`));

  app.querySelector("#add-toggle").addEventListener("click", () => { vorratAddOffen = !vorratAddOffen; renderVorrat(); });
  bindVorratAdd();
  app.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => renderVorratEdit(b.dataset.edit)));
}

function vorratAddForm() {
  const s = getState();
  const imBestand = new Set(s.bestand.map((b) => b.zutat_id));
  const treffer = ZUTATEN
    .filter((z) => !imBestand.has(z.id))
    .filter((z) => !vorratSuche || z.name.toLowerCase().includes(vorratSuche.toLowerCase()))
    .slice(0, 12);
  return `
    <div class="card">
      <label class="field">Produkt suchen oder auswählen
        <input type="text" id="add-suche" placeholder="z. B. Mehl, Reis, Eier …" value="${esc(vorratSuche)}">
      </label>
      <div class="chip-wrap">
        ${treffer.map((z) => `<button class="chip" data-add="${z.id}">${esc(z.name)}</button>`).join("") || '<span class="subtle small">Kein Treffer in der Zutatenliste.</span>'}
      </div>
      <p class="subtle small" style="margin-top:10px">Barcode-Scan, Schrankfoto-Analyse und Bon-Scan folgen als nächste Ausbaustufe – die Auswahl hier ist der schriftliche Weg + Auswahlfenster.</p>
    </div>`;
}

function bindVorratAdd() {
  const suche = app.querySelector("#add-suche");
  if (suche) {
    suche.addEventListener("input", () => {
      vorratSuche = suche.value;
      // Nur Chip-Liste neu zeichnen, Fokus behalten
      const wrap = app.querySelector(".chip-wrap");
      const s = getState();
      const imBestand = new Set(s.bestand.map((b) => b.zutat_id));
      const treffer = ZUTATEN.filter((z) => !imBestand.has(z.id))
        .filter((z) => !vorratSuche || z.name.toLowerCase().includes(vorratSuche.toLowerCase())).slice(0, 12);
      wrap.innerHTML = treffer.map((z) => `<button class="chip" data-add="${z.id}">${esc(z.name)}</button>`).join("")
        || '<span class="subtle small">Kein Treffer in der Zutatenliste.</span>';
      wrap.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => addBestand(b.dataset.add)));
    });
  }
  app.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => addBestand(b.dataset.add)));
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

  let mengenUi = "";
  if (item.art === "zaehlbar") {
    mengenUi = `
      <div class="stepper" style="justify-content:center">
        <button id="minus">−</button>
        <span class="count">${item.menge ?? 0}</span>
        <button id="plus">+</button>
      </div>
      <p class="subtle small" style="text-align:center;margin-top:6px">${esc(item.einheit)} vorhanden</p>`;
  } else if (item.art === "schuettgut") {
    mengenUi = `
      <p class="subtle small">Wie voll ist die Packung${voll ? ` (${voll} ${item.einheit})` : ""}?</p>
      <div class="fill-meter"><div id="meter" style="width:${Math.round(anteil * 100)}%"></div></div>
      <input type="range" id="fuellstand" min="0" max="100" step="5" value="${Math.round(anteil * 100)}">
      <p style="text-align:center;font-weight:700" id="menge-label">${mengeAnzeige(item)}</p>`;
  } else {
    mengenUi = `
      <div class="btn-row">
        <button class="btn ${item.menge !== 0 ? "" : "secondary"}" id="da">Vorrätig</button>
        <button class="btn ${item.menge === 0 ? "" : "secondary"}" id="leer">Leer</button>
      </div>`;
  }

  app.replaceChildren(h(`
    <div class="fade-in">
      <button class="btn ghost small-btn" id="zurueck">‹ Vorrat</button>
      <div class="screen-header" style="margin-top:10px"><h1>${esc(item.name)}</h1><p class="subtle">${KATEGORIE_NAMEN[item.kategorie]}</p></div>
      <div class="card">${mengenUi}</div>
      <button class="btn secondary" id="entfernen">Aus dem Vorrat entfernen</button>
    </div>`));

  app.querySelector("#zurueck").addEventListener("click", () => renderVorrat());
  app.querySelector("#entfernen").addEventListener("click", () => {
    s.bestand = s.bestand.filter((b) => b.id !== item.id);
    save();
    renderVorrat();
  });
  app.querySelector("#minus")?.addEventListener("click", () => { item.menge = Math.max(0, (item.menge ?? 0) - 1); item.updated = new Date().toISOString(); save(); renderVorratEdit(itemId); });
  app.querySelector("#plus")?.addEventListener("click", () => { item.menge = (item.menge ?? 0) + 1; item.updated = new Date().toISOString(); save(); renderVorratEdit(itemId); });
  app.querySelector("#da")?.addEventListener("click", () => { item.menge = null; save(); renderVorratEdit(itemId); });
  app.querySelector("#leer")?.addEventListener("click", () => { item.menge = 0; save(); renderVorratEdit(itemId); });
  const slider = app.querySelector("#fuellstand");
  slider?.addEventListener("input", () => {
    const basis = voll || 500;
    item.menge = Math.round((slider.value / 100) * basis / 10) * 10;
    item.updated = new Date().toISOString();
    app.querySelector("#meter").style.width = `${slider.value}%`;
    app.querySelector("#menge-label").textContent = mengeAnzeige(item);
    save();
  });
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
  const rezept = s.einkauf.rezeptId ? REZEPTE.find((r) => r.id === s.einkauf.rezeptId) : null;

  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="screen-header"><h1>Einkauf</h1><p class="subtle">Kurz und fokussiert – nur was fehlt.</p></div>

      ${s.einkauf.rezept.length ? `
        <h2>Für: ${esc(rezept?.name || "Rezept")}</h2>
        <div class="card">
          ${s.einkauf.rezept.map((e, i) => `
            <div class="list-item">
              <button class="check ${e.erledigt ? "done" : ""}" data-r-check="${i}">✓</button>
              <div class="grow ${e.erledigt ? "done-text" : ""}">${e.menge != null ? `${e.menge} ${e.einheit === "Stk" ? "×" : e.einheit}` : ""} ${esc(e.name)}</div>
            </div>`).join("")}
        </div>
        <button class="btn" id="einkauf-fertig">Einkauf bestätigen → Bestand auffüllen</button>
        <p class="subtle small" style="margin:8px 0 0;text-align:center">Später läuft das über den Kassenbon-Scan bzw. die Picnic-Quittung.</p>
        <hr class="divider">` : ""}

      <h2>Wocheneinkauf</h2>
      <p class="subtle small" style="margin-bottom:8px">Leere und fast leere Vorräte, automatisch gesammelt.</p>
      ${s.einkauf.woche.length ? `
        <div class="card">
          ${s.einkauf.woche.map((e, i) => `
            <div class="list-item">
              <button class="check ${e.erledigt ? "done" : ""}" data-w-check="${i}">✓</button>
              <div class="grow ${e.erledigt ? "done-text" : ""}">${esc(e.name)}${e.auto ? ' <span class="badge neutral">auto</span>' : ""}</div>
              <button class="btn ghost small-btn" data-w-del="${i}">✕</button>
            </div>`).join("")}
        </div>
        <button class="btn secondary" id="woche-fertig">Erledigtes in den Bestand buchen</button>` : `
        <div class="empty-state"><p class="small">Gerade nichts auf der Liste – dein Vorrat sieht gut aus.</p></div>`}
      <p class="subtle small" style="margin-top:14px;text-align:center">Der wöchentliche Angebots-Crawl (bester Markt für deine Liste) ist als Ausbaustufe geplant.</p>
    </div>`));

  app.querySelectorAll("[data-r-check]").forEach((b) => b.addEventListener("click", () => {
    s.einkauf.rezept[b.dataset.rCheck].erledigt = !s.einkauf.rezept[b.dataset.rCheck].erledigt;
    save(); renderEinkauf();
  }));
  app.querySelectorAll("[data-w-check]").forEach((b) => b.addEventListener("click", () => {
    s.einkauf.woche[b.dataset.wCheck].erledigt = !s.einkauf.woche[b.dataset.wCheck].erledigt;
    save(); renderEinkauf();
  }));
  app.querySelectorAll("[data-w-del]").forEach((b) => b.addEventListener("click", () => {
    s.einkauf.woche.splice(b.dataset.wDel, 1);
    save(); renderEinkauf();
  }));
  app.querySelector("#einkauf-fertig")?.addEventListener("click", () => {
    for (const e of s.einkauf.rezept) buchZugang(s, e.zutat_id);
    s.einkauf.rezept = [];
    const rid = s.einkauf.rezeptId;
    s.einkauf.rezeptId = null;
    save();
    if (rid) { const r = REZEPTE.find((x) => x.id === rid); if (r && confirm("Bestand aufgefüllt. Direkt mit dem Kochen loslegen?")) { startKochen(r); return; } }
    renderEinkauf();
  });
  app.querySelector("#woche-fertig")?.addEventListener("click", () => {
    const erledigt = s.einkauf.woche.filter((e) => e.erledigt);
    for (const e of erledigt) buchZugang(s, e.zutat_id);
    s.einkauf.woche = s.einkauf.woche.filter((e) => !e.erledigt);
    save(); renderEinkauf();
  });
}

/* Zugang buchen: Packungsgröße liefert die Menge – kein Wiegen (Kap. 5). */
function buchZugang(s, zutatId) {
  if (!zutatId) return;
  const kat = ZUTAT_INDEX[zutatId];
  let item = s.bestand.find((b) => b.zutat_id === zutatId);
  if (!item) {
    item = {
      id: `b_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
      zutat_id: zutatId, name: kat?.name || zutatId, kategorie: kat?.kategorie || "trocken",
      art: kat?.art || "schuettgut", einheit: kat?.einheit || "g", packung: kat?.packung || null,
      menge: 0, updated: null,
    };
    s.bestand.push(item);
  }
  if (item.art === "pauschal") item.menge = null;
  else if (item.art === "zaehlbar") item.menge = (item.menge ?? 0) + (kat?.einheit === "Stk" && !kat?.inhalt_g ? 6 : 1); // Eier & Co. kommen im Karton
  else item.menge = (item.menge ?? 0) + (item.packung || kat?.packung || 500);
  item.updated = new Date().toISOString();
}

/* ------------------------------------------------------------------ Wissen */
let wissenTab = "tipps";

function renderWissen() {
  const tabs = { tipps: "Tipps", preps: "Zubereitung", bases: "Grundrezepte", techniken: "Techniken" };
  const inhalt = {
    tipps: () => TIPPS.map((t) => `<div class="card"><p class="small">💡 ${esc(t.text)}</p></div>`).join("")
      + IDEEN.map((i) => `<div class="card"><p class="small">✦ ${esc(i.text)}</p></div>`).join(""),
    preps: () => PREPS.map((p) => `
      <div class="card">
        <div class="card-row"><h3>${esc(p.name)}</h3><span class="badge neutral">${p.dauer_min} Min</span></div>
        <p class="small subtle" style="margin-top:6px">${esc(p.kurz)}</p>
      </div>`).join(""),
    bases: () => BASES.map((b) => `
      <div class="card">
        <h3>${esc(b.name)}</h3>
        <p class="small subtle" style="margin-top:6px">${esc(b.kurz)}</p>
        ${b.varianten ? `<p class="small" style="margin-top:6px;color:var(--accent)">Varianten: ${esc(b.varianten)}</p>` : ""}
      </div>`).join(""),
    techniken: () => TECHNIKEN.map((t) => `
      <div class="card"><h3>${esc(t.name)}</h3><p class="small subtle" style="margin-top:6px">${esc(t.text)}</p></div>`).join(""),
  };

  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="screen-header"><h1>Wissen</h1><p class="subtle">Grundtechniken, Zubereitungen und Küchentipps – anfängertauglich.</p></div>
      <div class="chip-wrap" style="margin-bottom:16px">
        ${Object.entries(tabs).map(([id, name]) => `<button class="chip ${wissenTab === id ? "selected" : ""}" data-wtab="${id}">${name}</button>`).join("")}
      </div>
      ${inhalt[wissenTab]()}
    </div>`));

  app.querySelectorAll("[data-wtab]").forEach((b) => b.addEventListener("click", () => { wissenTab = b.dataset.wtab; renderWissen(); }));
}

/* ------------------------------------------------------------------ Profil */
function renderProfil() {
  const s = getState();
  const form = ERNAEHRUNGSFORMEN.find((f) => f.id === s.profil.ernaehrungsform);
  const hinweise = hinweiseFuerForm(s.profil.ernaehrungsform);

  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="screen-header"><h1>Profil</h1><p class="subtle">${esc(s.profil.name || "Ohne Namen")}</p></div>

      <h2>Ernährungsform</h2>
      <div class="choice-list">
        ${ERNAEHRUNGSFORMEN.map((f) => `
          <button class="choice ${s.profil.ernaehrungsform === f.id ? "selected" : ""}" data-pform="${f.id}">
            <b>${esc(f.name)}</b><span class="subtle">${esc(f.kurz)}</span>
          </button>`).join("")}
      </div>

      <h2 class="section-gap">Ausschlüsse</h2>
      <div class="chip-wrap">
        ${AUSSCHLUESSE.map((a) => `<button class="chip ${s.profil.ausschluesse.includes(a.id) ? "selected" : ""}" data-paus="${a.id}">${esc(a.name)}</button>`).join("")}
      </div>

      <h2 class="section-gap">Stil-Präferenzen</h2>
      <div class="chip-wrap">
        ${STILE.map((st) => `<button class="chip ${s.profil.stile.includes(st.id) ? "selected" : ""}" data-pstil="${st.id}">${esc(st.name)}</button>`).join("")}
      </div>

      <h2 class="section-gap">Hinweise zu deiner Ernährungsform</h2>
      ${hinweise.map((t) => `<div class="card hint-card">${esc(t)}</div>`).join("")}
      <p class="subtle small">${esc(FORM_HINWEISE.sonderfaelle)}</p>

      ${s.historie.length ? `
        <h2 class="section-gap">Zuletzt gekocht</h2>
        <div class="card">
          ${s.historie.slice(0, 8).map((e) => `
            <div class="list-item"><div class="grow"><span class="name">${esc(e.name)}</span>
            <span class="subtle small" style="display:block">${new Date(e.datum).toLocaleDateString("de-DE")} · ${e.portionen} Portionen</span></div></div>`).join("")}
        </div>` : ""}

      <h2 class="section-gap">Daten</h2>
      <div class="btn-row">
        <button class="btn secondary" id="export">JSON-Export</button>
        <button class="btn secondary" id="import">JSON-Import</button>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden>
      <p class="subtle small" style="margin-top:8px">Alles liegt lokal auf diesem Gerät. Der Export ist dein Backup (auch gegen iOS-Speicherbereinigung) – regelmäßig sichern.</p>
      <button class="btn danger" id="reset">Alle Daten zurücksetzen</button>
      <p class="subtle small" style="text-align:center;margin-top:20px">Vorratio v1 · lokal & privat · ersetzt keine Ernährungs- oder ärztliche Beratung</p>
    </div>`));

  app.querySelectorAll("[data-pform]").forEach((b) => b.addEventListener("click", () => { s.profil.ernaehrungsform = b.dataset.pform; save(); renderProfil(); }));
  app.querySelectorAll("[data-paus]").forEach((b) => b.addEventListener("click", () => { toggle(s.profil.ausschluesse, b.dataset.paus); save(); renderProfil(); }));
  app.querySelectorAll("[data-pstil]").forEach((b) => b.addEventListener("click", () => { toggle(s.profil.stile, b.dataset.pstil); save(); renderProfil(); }));
  app.querySelector("#export").addEventListener("click", exportJson);
  app.querySelector("#import").addEventListener("click", () => app.querySelector("#import-file").click());
  app.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await importJson(file); alert("Import erfolgreich."); render(); }
    catch (err) { alert(`Import fehlgeschlagen: ${err.message}`); }
  });
  app.querySelector("#reset").addEventListener("click", () => {
    if (confirm("Wirklich ALLE Daten löschen? Ohne Export ist das endgültig.")) { resetAll(); ob = { step: 0, name: "", form: null, ausschluesse: [], stile: [] }; render(); }
  });
}

/* ------------------------------------------------------------------- Start */
load();
stelleVorschlaegeBereit();   // Push-Fallback: beim Öffnen liegen die Slot-Vorschläge bereit
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
render();

/* iOS-PWAs werden meist fortgesetzt statt neu geladen – beim Zurückkehren in
   den Vordergrund zählt das als "Öffnen": Slot prüfen, Vorschläge bereitlegen. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const vorher = getState().vorschlaege;
  const nachher = stelleVorschlaegeBereit();
  if (view === "heute" && !cook && !detailRezept && nachher !== vorher) render();
});

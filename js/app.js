/* Vorratio – App-Steuerung & Views.
   User Journey (Kap. 4): Onboarding → Ersteinrichtung Bestand → tägliche
   Vorschläge (3 je Slot, neu würfeln) → fokussierter Einkauf → Kochmodus mit
   Timern → Abhaken & Abbuchung → Wocheneinkauf. */

import { load, save, getState, exportJson, importJson, resetAll } from "./storage.js";
import { ZUTATEN, REZEPTE, PREPS, BASES, TIPPS, IDEEN, TECHNIKEN } from "./data/kerndb.js";
import { ERNAEHRUNGSFORMEN, AUSSCHLUESSE, STILE, ZIELE, hinweiseFuerForm, FORM_HINWEISE } from "./data/profil.js";
import {
  ZUTAT_INDEX, aktuellerSlot, SLOT_NAMEN, rezeptErlaubt, vorschlaege, snackVorschlaege,
  zielTreffer, tagesSeed, bestandsAbgleich, abbuchen, mengeAnzeige, wochenKandidaten,
} from "./engine.js";
import { angebotsCrawl, isoWoche, liveKonfiguriert } from "./angebote.js";
import { generiereRezepte, scanBon } from "./ai.js";
import { lookupBarcode, vorschlagZutat, kameraVerfuegbar, starteKameraScan } from "./scan.js";
import { SUB_KATEGORIEN, SUB_ANWENDUNGEN } from "./data/substitutionen.js";
import { subsFiltern, ersatzVorschlaege, produkteSortiert } from "./substitution.js";
import { icon, logoMark } from "./icons.js";

/* Kern-DB + AI-generierte Rezepte als gemeinsamer Pool. */
const alleRezepte = () => [...REZEPTE, ...(getState().aiRezepte || [])];
const findRezept = (id) => alleRezepte().find((r) => r.id === id);
const istAi = (r) => r.quelle_typ === "ai_generiert";

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
let ob = { step: 0, name: "", form: null, ausschluesse: [], stile: [], ziele: [] };

const OB_STEPS = [obWelcome, obName, obForm, obAusschluesse, obStile, obZiele, obToleranz];

/* Fortschrittsbalken der Übergabe: Willkommen zählt als Schritt 1 mit. */
function progressBar(done, total) {
  return `<div class="progress-bar">${Array.from({ length: total }, (_, i) => `<span class="${i < done ? "done" : ""}"></span>`).join("")}</div>`;
}

function renderOnboarding() {
  const welcome = ob.step === 0;
  const bar = welcome ? "" : progressBar(ob.step + 1, OB_STEPS.length);
  app.replaceChildren(h(`
    <div class="fade-in ${welcome ? "onboard-welcome" : "onboard-step"}">${bar}${OB_STEPS[ob.step]()}</div>`));
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
    <p class="centered-note">Sechs kurze Schritte · ca. 2 Minuten</p>
    <div class="spacer"></div>
    <div class="foot-note">${icon("lokal", 18)}<span>Alles bleibt lokal auf deinem iPhone.<br>Kein Konto, kein Server.</span></div>`;
}

function obName() {
  return `
    <div class="screen-header"><h1>wie heißt du?</h1><p class="subtle">Nur für die Begrüßung. Der Name bleibt auf dem Gerät.</p></div>
    <label class="field"><input type="text" id="ob-name" placeholder="Dein Name" value="${esc(ob.name)}" autocomplete="given-name"></label>
    <button class="btn" data-ob="name">Weiter</button>`;
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
    <button class="btn" data-ob="next" ${ob.form ? "" : "disabled"}>Weiter</button>`;
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
    <div class="screen-header"><h1>was fliegt raus?</h1><p class="subtle">Harte Filter – Rezepte damit siehst du nie. Alles optional, mehrere möglich.</p></div>
    ${gruppe("allergie", "Allergien &amp; Intoleranzen")}
    ${gruppe("religioes", "Religiös-kulturell")}
    <button class="btn" data-ob="next">Weiter</button>`;
}

function obStile() {
  return `
    <div class="screen-header"><h1>worauf hast du lust?</h1><p class="subtle">Weiche Vorlieben – passende Rezepte kommen weiter nach oben, verboten wird nichts.</p></div>
    <div class="chip-wrap">
      ${STILE.map((s) => `<button class="chip ${ob.stile.includes(s.id) ? "selected" : ""}" data-stil="${s.id}">${esc(s.name)}</button>`).join("")}
    </div>
    ${ob.stile.map((id) => STILE.find((s) => s.id === id)).filter((s) => s?.hinweis).map((s) => `
      <div class="card hint-card warn" style="margin-top:12px">${icon("achtung", 22)}
        <div class="hint-body"><b>${esc(s.name)}</b>${esc(s.hinweis)}</div>
      </div>`).join("")}
    <button class="btn" data-ob="next">Weiter</button>`;
}

/* Achse 4: Ziele – nur wissenschaftlich belegte, über Ernährung beeinflussbare
   Ziele; jede Auswahl zeigt sofort ehrlich die Evidenzlage (inkl. dem, was
   NICHT belegt ist). Rückkopplung: Vorschlags-Score + AI-Rezeptgenerierung. */
function obZiele() {
  return `
    <div class="screen-header"><h1>was willst du erreichen?</h1><p class="subtle">Optional, mehrere möglich – passende Rezepte kommen nach oben, verboten wird nichts. Nur Ziele, die nachweislich über Ernährung beeinflussbar sind.</p></div>
    <div class="choice-list">
      ${ZIELE.map((z) => `
        <button class="choice ${ob.ziele.includes(z.id) ? "selected" : ""}" data-ziel="${z.id}">
          <b>${esc(z.name)} ${z.evidenz === "hoch" ? '<span class="badge">Evidenz: hoch</span>' : '<span class="badge neutral">Evidenz: begrenzt</span>'}</b>
          <span class="subtle">${esc(z.kurz)}</span>
        </button>`).join("")}
    </div>
    ${ob.ziele.map((id) => ZIELE.find((z) => z.id === id)).filter(Boolean).map((z) => `
      <div class="card hint-card" style="margin-top:12px">${icon("ziel", 22)}
        <div class="hint-body"><b>${esc(z.name)} – was die Wissenschaft sagt</b>${esc(z.hinweis)}</div>
      </div>`).join("")}
    <button class="btn" data-ob="next">${ob.ziele.length ? "Weiter" : "Ohne Ziele weiter"}</button>`;
}

function obToleranz() {
  const punkte = [
    "Du musst nie etwas abwiegen.",
    "Prisen, EL und TL laufen unter Toleranz.",
    "Stimmt mal was nicht, korrigierst du es in zwei Taps.",
  ];
  return `
    <div class="screen-header"><h1>eine sache noch</h1><p class="subtle">Damit du weißt, warum hier nirgends krumme Zahlen stehen.</p></div>
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
  app.querySelectorAll("[data-form]").forEach((b) => b.addEventListener("click", () => { ob.form = b.dataset.form; renderOnboarding(); }));
  app.querySelectorAll("[data-aus]").forEach((b) => b.addEventListener("click", () => { toggle(ob.ausschluesse, b.dataset.aus); renderOnboarding(); }));
  app.querySelectorAll("[data-stil]").forEach((b) => b.addEventListener("click", () => { toggle(ob.stile, b.dataset.stil); renderOnboarding(); }));
  app.querySelectorAll("[data-ziel]").forEach((b) => b.addEventListener("click", () => { toggle(ob.ziele, b.dataset.ziel); renderOnboarding(); }));
  app.querySelector('[data-ob="next"]')?.addEventListener("click", () => { ob.step++; renderOnboarding(); });
  app.querySelector('[data-ob="name"]')?.addEventListener("click", () => {
    ob.name = app.querySelector("#ob-name").value.trim();
    ob.step++;
    renderOnboarding();
  });
  app.querySelector('[data-ob="fertig"]')?.addEventListener("click", () => {
    const s = getState();
    s.profil = { name: ob.name, ernaehrungsform: ob.form, ausschluesse: ob.ausschluesse, stile: ob.stile, ziele: ob.ziele, onboarded: true };
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
let aiLaeuft = false;
let aiFehler = null;

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
   Status-Pills – „von claude", „alles da" bzw. „N fehlen" mit Namen. */
function rezeptKarte(v, meta, gedimmt = false) {
  const fehlt = v.abgleich.fehlt;
  const tags = gedimmt ? "" : `
    <div class="card-tags">
      ${istAi(v.rezept) ? `<span class="badge">${icon("claude", 14)}von claude</span>` : ""}
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

  app.replaceChildren(h(`
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
      ${vs.map((v) => rezeptKarte(v, `${esc(v.rezept.cuisine)} · ${esc(v.rezept.schwierigkeit)} · ${portionenText(v.rezept.portionen)}`, leererBestand)).join("")}
      <div class="btn-row">
        <button class="btn secondary" id="wuerfeln">${icon("wuerfeln", 19)}Neu würfeln</button>
        <button class="btn" id="ai-generieren" ${aiLaeuft ? "disabled" : ""}>${icon("claude", 19)}${aiLaeuft ? "Claude kocht …" : "Claude fragen"}</button>
      </div>
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
    </div>`));

  app.querySelectorAll("[data-rezept]").forEach((c) => c.addEventListener("click", () => {
    detailRezept = findRezept(c.dataset.rezept);
    render();
  }));
  app.querySelector("#wuerfeln").addEventListener("click", () => { stelleVorschlaegeBereit(true); render(); });
  app.querySelector("#snack-wuerfeln").addEventListener("click", () => { stelleSnacksBereit(true); render(); });
  app.querySelector("#ai-generieren").addEventListener("click", () => starteAiGenerierung(slot));
  app.querySelector("#ai-snacks").addEventListener("click", () => starteAiGenerierung("snack"));
  app.querySelector('[data-go="vorrat"]')?.addEventListener("click", (e) => { e.stopPropagation(); view = "vorrat"; render(); });
}

/* AI-Rezeptgenerierung (Kap. 4.3): 3 frische Vorschläge aus dem Bestand. */
async function starteAiGenerierung(slot) {
  const s = getState();
  if (!s.settings.apiKey) {
    aiFehler = "Kein API-Key hinterlegt – einmalig im Profil unter 'Claude API' eintragen.";
    render();
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
function renderRezeptDetail(rezept) {
  const s = getState();
  const ab = bestandsAbgleich(rezept, s.bestand);
  const tip = TIPPS[Math.abs(hashCode(rezept.id)) % TIPPS.length];
  // Sichtbare Rückkopplung Achse 4: auf welche gewählten Ziele zahlt das Rezept ein?
  const zielePassend = zielTreffer(rezept, s.profil.ziele || []).filter((t) => t.fit > 0).map((t) => t.ziel.name);

  app.replaceChildren(h(`
    <div class="fade-in">
      <button class="backlink" id="zurueck">${icon("zurueck", 20)}Heute</button>
      <div class="screen-header" style="margin-top:10px">
        <h1>${esc(rezept.name)}</h1>
        <p class="subtle small">${esc(rezept.cuisine)} · ${rezept.gesamtzeit_min.gesamt} Min · ${esc(rezept.schwierigkeit)} · ${portionenText(rezept.portionen)}</p>
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
      ${zielePassend.length ? `
        <div class="card hint-card">${icon("ziel", 20)}
          <div class="hint-body"><b>Zahlt auf deine Ziele ein</b>${esc(zielePassend.join(" · "))}</div>
        </div>` : ""}
      ${rezept.naehrwert_einordnung?.makro_hinweis ? `
        <div class="card hint-card">${icon("tipp", 20)}
          <div class="hint-body"><b>Gut zu wissen</b>${esc(rezept.naehrwert_einordnung.makro_hinweis)}</div>
        </div>` : ""}
      ${ersatzIdeenHtml(ab.fehlt, s.profil)}
      <div class="card hint-card">${icon("tipp", 20)}<span class="hint-body">${esc(tip.text)}</span></div>
      ${ab.fehlt.length > 0 ? `
        <button class="btn" id="einkauf-starten">${ab.fehlt.length === 1 ? "1 Sache" : `${ab.fehlt.length} Sachen`} auf die Einkaufsliste</button>
        <button class="btn secondary" id="kochen-trotzdem">Trotzdem kochen</button>`
        : `<button class="btn" id="kochen">Jetzt kochen</button>`}
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
    app.replaceChildren(h(`
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
  cook.timer = hatTimer
    ? { name: s.timer_name || "Timer", typ: s.timer_typ || "", total: s.dauer_sekunden, rest: s.dauer_sekunden, laeuft: false, gestartet: false, fertig: false, ende: null }
    : null;

  app.replaceChildren(h(`
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
      <div class="btn-row" style="margin-top:20px">
        ${step > 0 ? `<button class="btn secondary icon-only" id="prev" aria-label="Zurück">${icon("zurueck", 20)}</button>` : ""}
        <button class="btn" id="next">${step === rezept.schritte.length - 1 ? "Fertig" : "Weiter"}</button>
      </div>
    </div>`));

  app.querySelector("#abbrechen").addEventListener("click", () => {
    if (confirm("Kochen abbrechen? Es wird nichts abgebucht.")) { cook = null; render(); }
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
  app.replaceChildren(h(`
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
      <div class="screen-header">
        <div class="card-row" style="align-items:center">
          <h1>vorrat</h1>
          <div class="head-actions">
            <button class="square-btn" id="scan-toggle" aria-label="Barcode scannen">${icon("barcode", 21)}</button>
            <button class="pill-btn" id="add-toggle">${vorratAddOffen ? icon("x", 19) : icon("plus", 19)}${vorratAddOffen ? "Schließen" : "Erfassen"}</button>
          </div>
        </div>
        <p class="subtle small">${s.bestand.length} Artikel · Mengen sind Näherungen</p>
      </div>
      ${scanPanel ? barcodeUi() : ""}
      ${vorratAddOffen ? vorratAddForm() : ""}
      ${s.bestand.length === 0 && !vorratAddOffen ? vorratLeerHtml() : ""}
      ${Object.entries(KATEGORIE_NAMEN).filter(([k]) => gruppen[k]?.length).map(([k, titel]) => `
        <div class="section-gap">
          <h2>${titel}</h2>
          <div class="card">
            ${gruppen[k].map((item) => vorratZeile(item)).join("")}
          </div>
        </div>`).join("")}
      ${s.bestand.length ? '<p class="centered-note">Tippe einen Artikel an, um die Menge zu korrigieren.</p>' : ""}
    </div>`));

  app.querySelector("#add-toggle").addEventListener("click", () => { vorratAddOffen = !vorratAddOffen; renderVorrat(); });
  app.querySelector("#scan-toggle").addEventListener("click", () => {
    stoppeKamera();
    scanPanel = scanPanel ? null : { status: "start" };
    renderVorrat();
  });
  bindVorratAdd();
  bindBarcode();
  app.querySelector("#vorrat-leer-cta")?.addEventListener("click", () => { vorratAddOffen = true; renderVorrat(); });
  app.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => renderVorratEdit(b.dataset.edit)));
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

/* Leerer Vorrat (Design 15): Erklärkarte + die drei Wege hinein. */
function vorratLeerHtml() {
  const wege = [
    ["erfassen", "Aus der Liste tippen", "Über 200 gängige Zutaten vorbereitet"],
    ["barcode", "Barcode scannen", "Produktdaten von Open Food Facts"],
    ["kamera", "Kassenbon fotografieren", "Claude liest ihn aus"],
  ];
  return `
    <div class="empty-state">
      ${icon("vorrat", 52)}
      <h3>Noch nichts erfasst</h3>
      <p>Einmalige Aufnahme: Trockenware, Frisches, Konserven, Gewürze. Danach hält vorratio den Stand von allein aktuell.</p>
    </div>
    <div class="section-gap">
      <h2>Drei Wege hinein</h2>
      ${wege.map(([ic, titel, text]) => `
        <div class="card" style="display:flex;align-items:center;gap:13px;padding:15px">
          ${icon(ic, 24)}
          <div class="grow"><span class="name">${titel}</span><span class="subtle small" style="display:block">${text}</span></div>
        </div>`).join("")}
    </div>
    <button class="btn" id="vorrat-leer-cta">Ersten Artikel erfassen</button>`;
}

/* -------------------------------------------- Barcode-Scan (Kap. 6.3)
   EAN → Open-Food-Facts-Lookup → Zutat-Zuordnung bestätigen → Buchung. */
let scanPanel = null;   // {status:'start'|'kamera'|'laden'|'fehler'|'treffer'|'kein_treffer', ...}
let kamera = null;      // aktiver Kamera-Scan { stop }

function stoppeKamera() { kamera?.stop?.(); kamera = null; }

function barcodeUi() {
  const p = scanPanel;
  if (p.status === "start") {
    return `
      <div class="section-gap">
        <div class="section-head"><h2>Barcode</h2><button class="backlink" id="ean-abbrechen">Abbrechen</button></div>
        ${kameraVerfuegbar() ? `
          <button class="scan-view" id="ean-kamera" style="width:100%">
            <span style="width:210px;height:110px;border-radius:12px;border:2px solid rgba(255,253,248,.85)"></span>
            <span>Strichcode ins Feld halten</span>
          </button>
          <div class="or-line"><span>oder Nummer eintippen</span></div>` : ""}
        <input type="text" id="ean-input" inputmode="numeric" placeholder="z. B. 4311501659286">
        <button class="btn" id="ean-suchen">Nachschlagen</button>
        <p class="centered-note">Produktdaten von Open Food Facts (ODbL). Die Nummer steht unter dem Strichcode.${kameraVerfuegbar() ? "" : "<br>Kamera-Scan ist auf diesem Browser nicht verfügbar (iOS Safari)."}</p>
      </div>`;
  }
  if (p.status === "kamera") return `
    <div class="section-gap">
      <div class="scan-view"><video id="scan-video" playsinline muted></video></div>
      <button class="btn secondary" id="ean-kamera-stopp">Abbrechen</button>
    </div>`;
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
    scanPanel = { status: "kamera" };
    renderVorrat();
    const video = app.querySelector("#scan-video");
    kamera = await starteKameraScan(video,
      (ean) => { kamera = null; suche(ean); },
      () => { kamera = null; scanPanel = { status: "fehler", msg: "Kamera nicht verfügbar oder Zugriff abgelehnt." }; renderVorrat(); });
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

function vorratAddForm() {
  const s = getState();
  const imBestand = new Set(s.bestand.map((b) => b.zutat_id));
  const treffer = ZUTATEN
    .filter((z) => !imBestand.has(z.id))
    .filter((z) => !vorratSuche || z.name.toLowerCase().includes(vorratSuche.toLowerCase()))
    .slice(0, 12);
  return `
    <div class="section-gap">
      <input type="text" id="add-suche" placeholder="z. B. Mehl, Reis, Eier …" value="${esc(vorratSuche)}">
      <h2 class="section-gap">${vorratSuche ? "Treffer" : "Häufig erfasst"}</h2>
      <div class="chip-wrap">
        ${treffer.map((z) => `<button class="chip" data-add="${z.id}">${esc(z.name)}</button>`).join("") || '<span class="subtle small">Kein Treffer in der Zutatenliste.</span>'}
      </div>
      <div class="card hint-card" style="margin-top:16px">${icon("tipp", 20)}
        <span class="hint-body">Erst grob alles antippen, was da ist. Die Mengen kannst du danach in Ruhe schätzen.</span>
      </div>
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

  app.replaceChildren(h(`
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
    </div>`));

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

  app.replaceChildren(h(`
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
    </div>`));

  bindAngebote(s);

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
    if (rid) { const r = findRezept(rid); if (r && confirm("Bestand aufgefüllt. Direkt mit dem Kochen loslegen?")) { startKochen(r); return; } }
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
        <button class="btn" id="bon-key" style="background:var(--warn);color:#fffdf8;margin-top:2px">Key im Profil hinterlegen</button>
      </div>`;
  }
  if (!bon) {
    return `
      <button class="btn secondary" id="bon-start">${icon("kamera", 21)}Kassenbon fotografieren</button>
      <input type="file" id="bon-file" accept="image/*" capture="environment" hidden>
      <p class="centered-note">Claude liest den Bon und füllt den Bestand auf – auch Zusatzkäufe.</p>`;
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
    const a = bon.artikel[b.dataset.bonCheck];
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
    alert(`${gebucht} Artikel in den Bestand gebucht.`);
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
function buchZugang(s, zutatId, menge = null, einheit = null) {
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
        <p><b>Crawl läuft …</b></p>
        <p class="subtle small" id="crawl-progress">${crawlLaeuft.done}/${crawlLaeuft.total}</p>
      </div>`;
  } else if (erg) {
    inhalt = `
      ${aktuell ? "" : `<div class="card hint-card">${icon("achtung", 20)}<div class="hint-body"><b>Ergebnis aus KW ${esc(erg.kw.slice(-2))}</b>Die Angebote sind wahrscheinlich abgelaufen – einmal neu checken.</div></div>`}
      ${angebotsErgebnisHtml(erg)}
      <button class="btn secondary" id="crawl-start" ${liste.length ? "" : "disabled"}>Angebote neu checken</button>`;
  } else {
    inhalt = `
      <button class="btn" id="crawl-start" ${liste.length ? "" : "disabled"}>Besten Markt für ${liste.length || "deine"} Punkte finden</button>
      ${liste.length ? "" : '<p class="subtle small" style="text-align:center;margin-top:6px">Sobald etwas auf der Liste steht, kann der Crawl loslegen.</p>'}`;
  }

  return `
    <hr class="divider">
    <div class="section-head">
      <h2>Angebots-Crawl</h2>
      <button class="btn ghost small-btn" id="crawl-setup">${crawlSetupOffen ? "Schließen" : "Einstellungen"}</button>
    </div>
    <p class="subtle small" style="margin:2px 0 10px">Einmal wöchentlich, z. B. freitags: Welcher Markt deckt deine Liste am besten ab? Quelle: ${live ? `Marktguru (PLZ ${esc(a.plz)})` : "Demo-Daten"}</p>
    ${crawlSetupOffen ? angebotsSetupHtml(a) : ""}
    ${crawlFehler ? `
      <div class="card hint-card warn">${icon("achtung", 20)}
        <div class="hint-body"><b>Crawl fehlgeschlagen: ${esc(crawlFehler)}</b>
        Typische Ursachen: Keys abgelaufen, CORS blockiert (dann Proxy eintragen) oder offline. Der Demo-Modus geht immer.</div>
      </div>` : ""}
    ${inhalt}`;
}

function angebotsSetupHtml(a) {
  return `
    <div class="card">
      <label class="field">Postleitzahl (Standort für die Angebote)
        <input type="text" id="crawl-plz" inputmode="numeric" maxlength="5" placeholder="z. B. 20095" value="${esc(a.plz)}"></label>
      <label class="field">Marktguru x-apikey
        <input type="text" id="crawl-apikey" autocomplete="off" placeholder="aus marktguru.de kopieren" value="${esc(a.apikey)}"></label>
      <label class="field">Marktguru x-clientkey
        <input type="text" id="crawl-clientkey" autocomplete="off" value="${esc(a.clientkey)}"></label>
      <label class="field">CORS-Proxy (optional, Präfix vor der API-URL)
        <input type="text" id="crawl-proxy" autocomplete="off" placeholder="leer = direkt" value="${esc(a.proxy)}"></label>
      <button class="chip ${a.demo ? "selected" : ""}" id="crawl-demo">Demo-Modus erzwingen</button>
      <p class="subtle small" style="margin-top:10px">Keys holen: marktguru.de im Desktop-Browser öffnen → Entwicklertools → Netzwerk → eine Anfrage an api.marktguru.de anklicken → Request-Header <code>x-apikey</code> und <code>x-clientkey</code> kopieren. Ohne Keys läuft der Crawl mit Demo-Daten. Details: docs/angebots-crawl.md.</p>
      <button class="btn small-btn" id="crawl-speichern" style="margin-top:8px">Speichern</button>
    </div>`;
}

function angebotsErgebnisHtml(erg) {
  const datum = new Date(erg.datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const quelle = erg.quelle === "demo" ? "Demo-Daten" : `Marktguru, PLZ ${esc(erg.plz)}`;
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
  app.querySelector("#crawl-speichern")?.addEventListener("click", () => {
    s.angebote.plz = (app.querySelector("#crawl-plz").value.match(/\d{5}/) || [""])[0];
    s.angebote.apikey = app.querySelector("#crawl-apikey").value.trim();
    s.angebote.clientkey = app.querySelector("#crawl-clientkey").value.trim();
    s.angebote.proxy = app.querySelector("#crawl-proxy").value.trim();
    save();
    crawlSetupOffen = false;
    renderEinkauf();
  });
  app.querySelector("#crawl-start")?.addEventListener("click", () => starteCrawl(s));
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

function renderWissen() {
  const tabs = { tipps: "Tipps", ersatz: "Ersatz", preps: "Zubereitung", bases: "Grundrezepte", techniken: "Techniken" };
  const inhalt = {
    ersatz: () => ersatzTabHtml(getState()),
    /* Tipps als Karten mit Glühbirne, Ideen als Soft-Karten mit Stern (Design 25). */
    tipps: () => TIPPS.map((t) => {
      const { titel, body } = teileTitel(t.text);
      return `
        <div class="card" style="display:flex;gap:12px">${icon("tipp", 22)}
          <div class="grow">${titel ? `<span class="name">${esc(titel)}</span>` : ""}
          <span class="subtle small" style="display:block${titel ? ";margin-top:4px" : ""}">${esc(body)}</span></div>
        </div>`;
    }).join("")
      + (IDEEN.length ? '<h2 class="section-gap">Ideen aus deinem Bestand</h2>' : "")
      + IDEEN.map((i) => {
        const { titel, body } = teileTitel(i.text);
        return `
          <div class="card hint-card">${icon("idee", 22)}
            <div class="hint-body">${titel ? `<b>${esc(titel)}</b>` : ""}${esc(body)}</div>
          </div>`;
      }).join(""),
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

  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="screen-header"><h1>wissen</h1><p class="subtle small">Grundtechniken und Küchentipps – anfängertauglich.</p></div>
      <div class="chip-wrap chip-nav" style="margin-bottom:16px">
        ${Object.entries(tabs).map(([id, name]) => `<button class="chip ${wissenTab === id ? "selected" : ""}" data-wtab="${id}">${name}</button>`).join("")}
      </div>
      ${inhalt[wissenTab]()}
    </div>`));

  app.querySelectorAll("[data-wtab]").forEach((b) => b.addEventListener("click", () => { wissenTab = b.dataset.wtab; renderWissen(); }));
  app.querySelectorAll("[data-ekat]").forEach((b) => b.addEventListener("click", () => { ersatzKat = b.dataset.ekat || null; renderWissen(); }));
  app.querySelectorAll("[data-eanw]").forEach((b) => b.addEventListener("click", () => { ersatzAnw = b.dataset.eanw || null; renderWissen(); }));
}

/* ------------------------------------------------------------------ Profil */
function renderProfil() {
  const s = getState();
  const form = ERNAEHRUNGSFORMEN.find((f) => f.id === s.profil.ernaehrungsform);
  const hinweise = hinweiseFuerForm(s.profil.ernaehrungsform);

  const stilNamen = (s.profil.stile || []).map((id) => STILE.find((st) => st.id === id)?.name).filter(Boolean);
  const initial = (s.profil.name || "?").trim().charAt(0).toUpperCase() || "?";

  app.replaceChildren(h(`
    <div class="fade-in">
      <div class="profile-head">
        <div class="avatar">${esc(initial)}</div>
        <div>
          <h1>${esc(s.profil.name || "ohne namen")}</h1>
          <p class="subtle small">${esc([form?.name, ...stilNamen].filter(Boolean).join(" · ") || "Profil einrichten")}</p>
        </div>
      </div>

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

      <h2 class="section-gap">Ziele</h2>
      <p class="subtle small" style="margin-bottom:8px">Passende Rezepte werden bevorzugt (Vorschläge + AI-Generierung), nichts wird verboten.</p>
      <div class="chip-wrap">
        ${ZIELE.map((z) => `<button class="chip ${(s.profil.ziele || []).includes(z.id) ? "selected" : ""}" data-pziel="${z.id}">${esc(z.name)}</button>`).join("")}
      </div>
      ${(s.profil.ziele || []).map((id) => ZIELE.find((z) => z.id === id)).filter(Boolean).map((z) => `
        <div class="card hint-card" style="margin-top:12px">${icon("ziel", 20)}
          <div class="hint-body"><b>${esc(z.name)} – was die Wissenschaft sagt</b>${esc(z.hinweis)}</div>
        </div>`).join("")}

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

      <h2 class="section-gap">Daten</h2>
      <div class="btn-row">
        <button class="btn secondary" id="export">Export</button>
        <button class="btn secondary" id="import">Import</button>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden>
      <p class="subtle small" style="margin-top:10px">Alles liegt lokal auf diesem Gerät. Der Export ist dein Backup (auch gegen iOS-Speicherbereinigung) – regelmäßig sichern.</p>
      <button class="btn danger" id="reset">Alle Daten zurücksetzen</button>
      <p class="centered-note" style="margin-top:20px">vorratio v1 · lokal &amp; privat · ersetzt keine Ernährungs- oder ärztliche Beratung</p>
    </div>`));

  app.querySelectorAll("[data-pform]").forEach((b) => b.addEventListener("click", () => { s.profil.ernaehrungsform = b.dataset.pform; save(); renderProfil(); }));
  app.querySelectorAll("[data-paus]").forEach((b) => b.addEventListener("click", () => { toggle(s.profil.ausschluesse, b.dataset.paus); save(); renderProfil(); }));
  app.querySelectorAll("[data-pstil]").forEach((b) => b.addEventListener("click", () => { toggle(s.profil.stile, b.dataset.pstil); save(); renderProfil(); }));
  app.querySelectorAll("[data-pziel]").forEach((b) => b.addEventListener("click", () => { s.profil.ziele ||= []; toggle(s.profil.ziele, b.dataset.pziel); save(); renderProfil(); }));
  app.querySelector("#api-key-save").addEventListener("click", () => {
    s.settings.apiKey = app.querySelector("#api-key").value.trim() || null;
    save();
    alert(s.settings.apiKey ? "API-Key gespeichert." : "API-Key entfernt.");
  });
  app.querySelector("#ai-loeschen")?.addEventListener("click", () => {
    if (confirm("Alle gespeicherten AI-Rezepte löschen?")) { s.aiRezepte = []; save(); renderProfil(); }
  });
  app.querySelector("#export").addEventListener("click", exportJson);
  app.querySelector("#import").addEventListener("click", () => app.querySelector("#import-file").click());
  app.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await importJson(file); alert("Import erfolgreich."); render(); }
    catch (err) { alert(`Import fehlgeschlagen: ${err.message}`); }
  });
  app.querySelector("#reset").addEventListener("click", () => {
    if (confirm("Wirklich ALLE Daten löschen? Ohne Export ist das endgültig.")) { resetAll(); ob = { step: 0, name: "", form: null, ausschluesse: [], stile: [], ziele: [] }; render(); }
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

/* iOS-PWAs werden meist fortgesetzt statt neu geladen – beim Zurückkehren in
   den Vordergrund zählt das als "Öffnen": Slot prüfen, Vorschläge bereitlegen. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const vorher = getState().vorschlaege;
  const snacksVorher = getState().snackVorschlaege;
  const nachher = stelleVorschlaegeBereit();
  const snacksNachher = stelleSnacksBereit();
  if (view === "heute" && !cook && !detailRezept && (nachher !== vorher || snacksNachher !== snacksVorher)) render();
});

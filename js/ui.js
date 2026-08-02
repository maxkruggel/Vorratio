/* Vorratio – UI-Grundbausteine.
   Escaping, Screen-Tausch, Dialoge und Toasts. Bewusst ohne Kenntnis von State
   oder Views: alles hier ist reine Darstellung und wird von app.js und
   kochmodus.js gemeinsam benutzt. */

import { icon } from "./icons.js";

const app = document.getElementById("app");

/* Jede Interpolation von Nutzdaten läuft hier durch – ohne Ausnahme. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

const aktuellerScreen = () => letzterScreen;

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

/* Fortschrittsbalken aus Segmenten – Onboarding und Kochschritte teilen ihn sich. */
function progressBar(done, total) {
  return `<div class="progress-bar">${Array.from({ length: total }, (_, i) => `<span class="${i < done ? "done" : ""}"></span>`).join("")}</div>`;
}

/* Sekunden als Timer-Anzeige: "12:05" bzw. "1 h 25 min". */
function fmtZeit(sek) {
  if (sek >= 3600) return `${Math.floor(sek / 3600)} h ${Math.round((sek % 3600) / 60)} min`;
  const m = Math.floor(sek / 60), s2 = sek % 60;
  return `${m}:${String(s2).padStart(2, "0")}`;
}

export { app, esc, h, zeigeApp, aktuellerScreen, dialog, bestaetige, toast, progressBar, fmtZeit };

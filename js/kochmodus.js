/* Vorratio – Kochmodus: Portionswahl, Schrittkarten, Timer, Abbuchung (Kap. 4.5/4.6).

   Der laufende Durchgang liegt im State (`state.kochen`), nicht nur im Speicher
   dieses Moduls. Grund: iOS verwirft PWA-Seiten im Hintergrund. Wer beim
   25-Minuten-Köcheln kurz in eine andere App wechselt, stand vorher wieder auf
   Schritt 1 – bei einer App, deren Kernversprechen der geführte Kochmodus ist,
   ist das der teuerste Datenverlust überhaupt.

   Der Timer rechnet deshalb konsequent gegen einen Zeitstempel (`ende`) statt
   Sekunden herunterzuzählen: Er läuft über Schließen, Sperren und Neuladen
   hinweg korrekt weiter. Was die App NICHT kann, ist ohne Push-Server im
   Hintergrund klingeln – das sagt sie im Kochmodus offen dazu, statt es zu
   versprechen. Kommt man zurück und die Zeit ist um, meldet sie es sofort. */

import { getState, save } from "./storage.js";
import { abbuchen } from "./engine.js";
import { icon } from "./icons.js";
import { app, esc, zeigeApp, bestaetige, progressBar, fmtZeit } from "./ui.js";

/* Von app.js gestellt: render (Rückkehr in die normale Navigation),
   findRezept (Rezeptpool inkl. AI-/Vorratsrezepten) und syncWochenliste. */
let hooks = { render: () => {}, findRezept: () => null, syncWochenliste: () => {} };
function initKochmodus(h) { hooks = { ...hooks, ...h }; }

/* Laufender Durchgang, gespiegelt aus state.kochen. `rezept` ist das aufgelöste
   Rezeptobjekt – im State steht nur die ID. */
let cook = null;

const istAktiv = () => cook != null;

/* State → Speicher. Nach jedem Schritt- und Timerwechsel. */
function merke() {
  const s = getState();
  s.kochen = cook && {
    rezeptId: cook.rezept.id,
    portionen: cook.portionen,
    step: cook.step,
    timer: cook.timer,
  };
  save();
}

/* Beim App-Start: unterbrochenen Durchgang wiederherstellen. Findet sich das
   Rezept nicht mehr (AI-Rezept aus dem Pool gefallen), wird verworfen. */
function stelleKochenWieder() {
  const s = getState();
  if (!s.kochen) return false;
  const rezept = hooks.findRezept(s.kochen.rezeptId);
  if (!rezept) { s.kochen = null; save(); return false; }
  cook = {
    rezept,
    portionen: s.kochen.portionen || rezept.portionen || 2,
    step: s.kochen.step ?? -1,
    timer: s.kochen.timer || null,
  };
  // Ist der Timer abgelaufen, während die App zu war, sofort Bescheid geben.
  if (aktualisiereTimer()) { melde(cook.timer); merke(); }
  return true;
}

function startKochen(rezept) {
  cook = { rezept, portionen: rezept.portionen || 2, step: -1, timer: null };
  merke();
  hooks.render();
}

/* Kochmodus verlassen, ohne abzubuchen. */
function beendeKochen() {
  cook = null;
  clearTimerTick();
  const s = getState();
  if (s.kochen) { s.kochen = null; save(); }
}

/* Nachfrage vor dem Verlassen – benutzt auch die Tabbar. */
async function darfVerlassen() {
  if (!cook) return true;
  return bestaetige({
    titel: "Kochen verlassen?",
    text: "Der Kochmodus wird geschlossen. Es wird nichts abgebucht.",
    bestaetigen: "Verlassen", abbrechen: "Weiterkochen", danger: true, symbol: "achtung",
  });
}

/* ------------------------------------------------------------------ Ansicht */
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
    app.querySelector("#abbrechen").addEventListener("click", () => { beendeKochen(); hooks.render(); });
    app.querySelector("#p-minus").addEventListener("click", () => { cook.portionen = Math.max(1, cook.portionen - 1); merke(); renderKochmodus(); });
    app.querySelector("#p-plus").addEventListener("click", () => { cook.portionen++; merke(); renderKochmodus(); });
    app.querySelector("#los").addEventListener("click", () => { cook.step = 0; merke(); renderKochmodus(); });
    return;
  }

  if (step >= rezept.schritte.length) { renderValidierung(); return; }

  const s = rezept.schritte[step];
  const hatTimer = s.dauer_sekunden != null && s.dauer_sekunden > 0;
  // Timer nur neu aufsetzen, wenn er zu einem anderen Schritt gehört – sonst
  // würde jedes Neuzeichnen einen laufenden Timer zurückstellen.
  if (!hatTimer) cook.timer = null;
  else if (!cook.timer || cook.timer.step !== step) {
    cook.timer = {
      step, name: s.timer_name || "Timer", typ: s.timer_typ || "",
      total: s.dauer_sekunden, rest: s.dauer_sekunden,
      laeuft: false, gestartet: false, fertig: false, ende: null,
    };
  }
  aktualisiereTimer();

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
      ${hatTimer ? '<p class="centered-note">Der Timer läuft auch weiter, wenn du die App schließt.<br>Klingeln kann sie im Hintergrund nicht – beim Zurückkommen meldet sie sich sofort.</p>' : ""}
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
    })) { beendeKochen(); hooks.render(); }
  });
  app.querySelector("#prev")?.addEventListener("click", () => { cook.step--; merke(); renderKochmodus(); });
  app.querySelector("#next").addEventListener("click", () => { cook.step++; merke(); renderKochmodus(); });
  merke();
  bindTimer();
  // Ein aus dem State wiederhergestellter Timer läuft schon – dann muss auch
  // die Anzeige wieder ticken, sonst steht sie still, während die Zeit läuft.
  if (cook.timer?.laeuft) startTimerTick();
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
    if (t.laeuft) {
      // Pause: verbleibende Zeit festhalten, Zeitstempel fällt weg
      t.rest = restAusEnde(t);
      t.laeuft = false;
      t.ende = null;
      clearTimerTick();
    } else {
      if (!t.gestartet && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
      t.gestartet = true;
      t.laeuft = true;
      t.ende = Date.now() + t.rest * 1000;
      startTimerTick();
    }
    merke();
    renderTimerBox();
  });
  app.querySelector("#timer-plus")?.addEventListener("click", () => {
    const t = cook.timer;
    t.rest += 60;
    t.total += 60;
    if (t.laeuft) t.ende += 60000;
    merke();
    renderTimerBox();
  });
  app.querySelector("#timer-aus")?.addEventListener("click", () => {
    cook.timer = { ...cook.timer, fertig: false, laeuft: false, gestartet: false, ende: null, rest: cook.timer.total };
    merke();
    renderTimerBox();
  });
}

const restAusEnde = (t) => (t.ende ? Math.max(0, Math.round((t.ende - Date.now()) / 1000)) : t.rest);

/* Rechnet einen laufenden Timer gegen die Wanduhr nach. Wird beim Start, beim
   Wiederherstellen und bei jeder Rückkehr in den Vordergrund gerufen – so ist
   die Anzeige auch dann richtig, wenn das Intervall zwischendurch schlief.
   Rückgabe: true, wenn der Timer dabei gerade abgelaufen ist. */
function aktualisiereTimer() {
  const t = cook?.timer;
  if (!t || !t.laeuft) return false;
  t.rest = restAusEnde(t);
  if (t.rest > 0) return false;
  t.laeuft = false;
  t.fertig = true;
  t.ende = null;
  return true;
}

/* Beim Zurückkehren in den Vordergrund: abgelaufenen Timer melden. */
function pruefeTimerNachPause() {
  if (!cook?.timer) return false;
  const abgelaufen = aktualisiereTimer();
  if (abgelaufen) {
    melde(cook.timer);
    merke();
  } else if (cook.timer.laeuft) {
    startTimerTick();
  }
  renderTimerBox();
  return abgelaufen;
}

function melde(t) {
  if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Vorratio", { body: `${t.name}: fertig!` });
  }
}

let timerInterval = null;
function clearTimerTick() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

function startTimerTick() {
  clearTimerTick();
  timerInterval = setInterval(() => {
    const t = cook?.timer;
    if (!t || !t.laeuft) { clearTimerTick(); return; }
    if (aktualisiereTimer()) {
      clearTimerTick();
      melde(t);
      merke();
      renderTimerBox();
      return;
    }
    const d = document.getElementById("timer-display");
    const f = document.getElementById("timer-track-fill");
    if (d) d.textContent = fmtZeit(t.rest);
    if (f) f.style.width = `${((t.total - t.rest) / t.total) * 100}%`;
  }, 250);
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
    abbuchen(rezept, s.bestand, portionen);
    s.historie.unshift({ rezeptId: rezept.id, name: rezept.name, portionen, datum: new Date().toISOString() });
    if (s.einkauf.rezeptId === rezept.id) { s.einkauf.rezept = []; s.einkauf.rezeptId = null; }
    hooks.syncWochenliste(s);
    beendeKochen();
    hooks.render("vorrat");
  });
  app.querySelector("#ohne").addEventListener("click", () => { beendeKochen(); hooks.render("heute"); });
}

export {
  initKochmodus, startKochen, beendeKochen, darfVerlassen, istAktiv,
  stelleKochenWieder, renderKochmodus, pruefeTimerNachPause,
};

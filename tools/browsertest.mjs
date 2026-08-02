#!/usr/bin/env node
/* Vorratio Browser-Rauchtest.

   Klickt die App in einem echten Chromium einmal komplett durch: Onboarding,
   alle fünf Tabs, Kochmodus mit Timer – und lädt mittendrin neu, um zu prüfen,
   dass der laufende Kochdurchgang samt Timer das überlebt. Genau dafür liegt
   der Kochzustand im State; ohne diesen Test fällt ein Rückfall nicht auf.

   Läuft absichtlich NICHT in der CI: Vorratio hat keine Abhängigkeiten und
   soll auch keine bekommen. Playwright wird für den Lauf einmalig danebengelegt.

   Voraussetzung:  npm install --no-save playwright-core
                   (plus ein Chromium, Pfad unten oder über CHROME_PFAD)
   Aufruf:         python3 -m http.server 8137 &
                   node tools/browsertest.mjs
*/
import { chromium } from "playwright-core";

const BASIS = process.env.VORRATIO_URL || "http://localhost:8137";
const fehler = [];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PFAD || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.setDefaultTimeout(6000);

page.on("pageerror", (e) => fehler.push(`JS-Fehler: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") fehler.push(`Konsole: ${m.text()}`); });

/* Die App blendet alle 9 Taps einen Küchentipp ein. Der liegt über der
   Oberfläche und fängt Klicks ab – für den Nutzer gewollt, für den Test im Weg,
   weil er mitten in einem Schritt auftaucht. Er wird deshalb nicht unterdrückt
   (er soll sich weiter zeigen und dabei fehlerfrei rendern), sondern nur
   klickdurchlässig gemacht. */
await page.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = ".tipp-pop { pointer-events: none !important; }";
    document.head.append(s);
  });
});

const schritt = async (name, fn) => {
  try { await fn(); console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FEHL ${name}: ${e.message}`); fehler.push(`${name}: ${e.message}`); }
};

await page.goto(BASIS, { waitUntil: "domcontentloaded" });

console.log("Onboarding:");
await schritt("Startbildschirm da", async () => {
  await page.waitForSelector('#app [data-ob="next"]', { timeout: 5000 });
});

// Onboarding durchklicken: immer den letzten aktiven Weiter-Button nehmen
await schritt("8 Schritte durchklicken", async () => {
  for (let i = 0; i < 20; i++) {
    if (await page.locator("#tabbar:not([hidden])").count()) return;
    // Name eintragen, falls der Namensschritt dran ist
    if (await page.locator("#ob-name").count()) {
      await page.fill("#ob-name", "Testkoch");
      await page.locator('[data-ob="name"]').click();
    } else if (await page.locator('[data-ob="fertig"]').count()) {
      await page.locator('[data-ob="fertig"]').click();
    } else {
      const weiter = page.locator('[data-ob="next"]');
      if (await weiter.count() && await weiter.isEnabled()) await weiter.click();
      else if (await page.locator(".choice").count()) await page.locator(".choice").first().click();
      else throw new Error("kein Bedienelement gefunden");
    }
    await page.waitForTimeout(150);
  }
  throw new Error("Tabbar nie erschienen");
});

console.log("Tabs:");
for (const tab of ["heute", "kochbuch", "vorrat", "einkauf", "wissen", "profil"]) {
  await schritt(`Tab ${tab}`, async () => {
    await page.click(`[data-view="${tab}"]`);
    await page.waitForTimeout(250);
    const txt = await page.locator("#app").innerText();
    if (!txt.trim()) throw new Error("Screen leer");
  });
}

console.log("Kochmodus:");
await schritt("Rezept öffnen und Kochen starten", async () => {
  await page.click('[data-view="heute"]');
  await page.waitForTimeout(200);
  await page.locator("[data-rezept]").first().click();
  await page.waitForTimeout(250);
  const kochen = page.locator("#kochen, #kochen-trotzdem").first();
  await kochen.click();
  await page.waitForTimeout(250);
  await page.locator("#los").click();
  await page.waitForTimeout(250);
});

await schritt("durch die Schritte bis zu einem Timer", async () => {
  for (let i = 0; i < 12; i++) {
    if (await page.locator("#timer-toggle").count()) return;
    const next = page.locator("#next");
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(180);
  }
  if (!(await page.locator("#timer-toggle").count())) throw new Error("kein Schritt mit Timer gefunden");
});

let vorher = null;
await schritt("Timer starten", async () => {
  await page.locator("#timer-toggle").click();
  await page.waitForTimeout(1400);
  vorher = await page.locator("#timer-display").innerText();
  if (!/\d/.test(vorher)) throw new Error(`Timeranzeige unerwartet: ${vorher}`);
});

await schritt("Timer zählt herunter", async () => {
  await page.waitForTimeout(1600);
  const jetzt = await page.locator("#timer-display").innerText();
  if (jetzt === vorher) throw new Error(`Anzeige steht still bei ${jetzt}`);
  vorher = jetzt;
});

await schritt("Neuladen: Kochmodus und Timer überleben", async () => {
  const gemerkt = await page.evaluate(() => JSON.parse(localStorage.getItem("vorratio_v1")).kochen);
  if (!gemerkt) throw new Error("state.kochen wurde nicht gespeichert");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);   // echter Abstand, sonst ist die Sekundenanzeige gleich
  if (!(await page.locator("#timer-display").count())) throw new Error("Kochmodus nach Neuladen weg");
  const nachher = await page.locator("#timer-display").innerText();
  console.log(`       vor dem Neuladen ${vorher}, danach ${nachher}`);
  const sek = (t) => { const [m, s] = t.split(":").map(Number); return t.includes("h") ? 9999 : m * 60 + (s || 0); };
  const diff = sek(vorher) - sek(nachher);
  if (diff < 2) throw new Error(`Timer lief über das Neuladen nicht weiter (${vorher} → ${nachher})`);
  console.log(`       ${diff} s vergangen – der Timer hat das Neuladen überlebt`);
});

await schritt("Kochen abbrechen führt zurück", async () => {
  await page.click('[data-view="heute"]');
  await page.waitForTimeout(200);
  const dlg = page.locator("dialog[open] button.danger-solid, dialog[open] button[value=ja]").first();
  if (await dlg.count()) await dlg.click();
  await page.waitForTimeout(300);
  if (!(await page.locator("#wuerfeln").count())) throw new Error("nicht auf 'heute' gelandet");
});

await browser.close();

console.log(fehler.length ? `\n${fehler.length} Problem(e):\n` + fehler.map((f) => "  ✗ " + f).join("\n") : "\nBrowser-Rauchtest grün.");
process.exit(fehler.length ? 1 : 0);

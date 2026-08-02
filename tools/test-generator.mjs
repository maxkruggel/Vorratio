#!/usr/bin/env node
/* Vorratio Generator-Tests.

   Der Offline-Generator ist pur (kein DOM, kein State) und damit ohne
   Framework testbar. Geprüft wird vor allem das, was still falsch sein kann:
   ob aus einem gefüllten Vorrat überhaupt etwas entsteht, ob der Profilfilter
   auch hier hart greift, und ob ein Misserfolg erklärbar bleibt.

   Anlass für diese Datei war genau so ein stiller Fehler: `vorratsTiefe`
   meldete ab drei belegten Rollen „genug", gebaut wurde aber erst, wenn ein
   Küchenmuster ALLE seine Rollen zusammenbekam. Dazwischen ließ die
   Vorprüfung durch, der Generator lieferte null, und der Knopf schien in der
   App nichts zu tun. Deshalb ist `vorratsTiefe` keine Vorbedingung mehr,
   sondern nur noch die Erklärung hinterher – das prüft dieser Test mit.

   Aufruf: node tools/test-generator.mjs  ·  Exit-Code 1 = mindestens ein Test rot. */

import { generiereAusVorrat, vorratsTiefe } from "../js/generator.js";
import { rezeptErlaubt } from "../js/engine.js";
import { allergeneFuerRezept, enthaeltSchwein } from "../js/data/allergene.js";

let bestanden = 0;
const fehler = [];
let gruppe = "";

const beschreibe = (name) => { gruppe = name; };
function pruefe(name, fn) {
  try {
    fn();
    bestanden++;
  } catch (e) {
    fehler.push(`${gruppe} → ${name}\n     ${e.message}`);
  }
}
function gleich(ist, soll, hinweis = "") {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  if (a !== b) throw new Error(`${hinweis}erwartet ${b}, war ${a}`);
}
function wahr(bedingung, hinweis) {
  if (!bedingung) throw new Error(hinweis);
}

const profil = (extra = {}) => ({
  name: "Test", ernaehrungsform: "vegan", ausschluesse: [], eigeneAusschluesse: [],
  vorlieben: [], stile: [], ziele: [], personen: 2, onboarded: true, ...extra,
});

/* Bestandsposten in der Form, die storage.js hält – der Generator liest
   zutat_id und menge, alles andere ist Beiwerk. */
const posten = (zutat_id, extra = {}) => ({
  id: `b_${zutat_id}`, zutat_id, name: zutat_id, kategorie: "test",
  art: "schuettgut", einheit: "g", menge: 500, updated: "2026-01-01", ...extra,
});

const VOLL = ["ing_linsen_rot", "ing_reis_vollkorn", "ing_zwiebel", "ing_knoblauch",
  "ing_moehre", "ing_paprika", "ing_olivenoel", "ing_tomate_dose"].map(posten);

/* ------------------------------------------------------------------ Bauen */
beschreibe("Bauen");

pruefe("aus einem gefüllten Vorrat entstehen Rezepte", () => {
  const neue = generiereAusVorrat(profil(), VOLL, "abend", 3, 1);
  gleich(neue.length, 3, "drei angefragt: ");
  for (const r of neue) wahr(r.name && r.zutaten.length && r.schritte.length, `unvollständiges Rezept: ${r.name}`);
});

pruefe("gleicher Seed liefert dasselbe Ergebnis", () => {
  const a = generiereAusVorrat(profil(), VOLL, "abend", 3, 7).map((r) => r.id);
  const b = generiereAusVorrat(profil(), VOLL, "abend", 3, 7).map((r) => r.id);
  gleich(a, b, "deterministisch pro Seed: ");
});

pruefe("andere Seeds liefern andere Rezepte", () => {
  const a = new Set(generiereAusVorrat(profil(), VOLL, "abend", 3, 1).map((r) => r.id));
  const b = generiereAusVorrat(profil(), VOLL, "abend", 3, 2).map((r) => r.id);
  wahr(b.some((id) => !a.has(id)), "zwei Würfe waren komplett identisch – dann wirkt „neu würfeln“ tot");
});

pruefe("gebaute Rezepte tragen ihre Herkunft", () => {
  for (const r of generiereAusVorrat(profil(), VOLL, "abend", 3, 3)) {
    gleich(r.quelle_typ, "vorrat_generiert", `${r.name}: `);
    wahr(r.id.startsWith("GEN-"), `${r.name}: id ohne GEN-Präfix (${r.id})`);
  }
});

pruefe("leerer Vorrat baut nichts, statt zu werfen", () => {
  gleich(generiereAusVorrat(profil(), [], "abend", 3, 1).length, 0);
});

/* ----------------------------------------------------- Misserfolg erklären */
beschreibe("Misserfolg erklären");

/* Der Regressionstest zum Anlass dieser Datei: Wenn nichts gebaut wurde,
   MUSS `fehlend` etwas benennen – sonst steht der Nutzer vor einem Knopf,
   der ohne Begründung nichts tut. Der Bestand hier liegt genau im früheren
   Blindband: die Tiefe meldet drei belegte Rollen, gebaut wird trotzdem nichts. */
pruefe("dünner Vorrat: nichts gebaut, aber der Grund ist benennbar", () => {
  const duenn = [posten("ing_linsen_rot"), posten("ing_reis_vollkorn")];
  const tiefe = vorratsTiefe(duenn);
  gleich(generiereAusVorrat(profil(), duenn, "abend", 3, 1).length, 0, "hier baut der Generator noch nicht: ");
  wahr(tiefe.belegt >= 3, "Vorbedingung des Regressionsfalls entfallen – Test anpassen");
  wahr(tiefe.fehlend.length > 0, "nichts gebaut UND nichts fehlend: der Nutzer bekäme keine Begründung");
});

pruefe("aufgefüllter Vorrat schließt die Lücke", () => {
  const tiefe = vorratsTiefe(VOLL);
  gleich(tiefe.fehlend, [], "voller Bestand darf nichts vermissen: ");
  wahr(generiereAusVorrat(profil(), VOLL, "abend", 3, 1).length > 0, "voller Bestand baut nichts");
});

pruefe("alles auf leer zählt nicht als vorhanden", () => {
  const leer = VOLL.map((p) => ({ ...p, menge: 0 }));
  wahr(vorratsTiefe(leer).fehlend.length > 0, "leergesetzte Posten gelten weiter als Baustein");
});

/* --------------------------------------------------------- Profil ist hart */
beschreibe("Profil ist hart");

pruefe("vegan: nichts Tierisches in den gebauten Rezepten", () => {
  const fleisch = [...VOLL, posten("ing_hackfleisch_rind"), posten("ing_ei"), posten("ing_feta")];
  for (const r of generiereAusVorrat(profil(), fleisch, "abend", 3, 5)) {
    wahr(r.ernaehrungsform.includes("vegan"), `${r.name} ist nicht als vegan ausgewiesen`);
    wahr(rezeptErlaubt(r, profil()), `${r.name} fällt durch den Profilfilter`);
  }
});

pruefe("Allergene werden abgeleitet, nicht geglaubt", () => {
  const mitNuss = [...VOLL, posten("ing_erdnussmus", { art: "pauschal", menge: null })];
  for (const r of generiereAusVorrat(profil(), mitNuss, "abend", 3, 6)) {
    // allergeneFuerRezept liefert ein Set – die Deklaration darf nichts
    // auslassen, was sich aus den Zutaten ableiten lässt.
    const abgeleitet = [...allergeneFuerRezept(r)].sort();
    gleich([...r.allergene].sort(), abgeleitet, `${r.name}: Deklaration weicht von der Ableitung ab: `);
  }
});

pruefe("halal: kein Schwein aus einem Vorrat voller Schwein", () => {
  const p = profil({ ernaehrungsform: "mischkost", ausschluesse: ["halal"] });
  const schwein = [...VOLL, posten("ing_schweineschulter")];
  for (const r of generiereAusVorrat(p, schwein, "abend", 3, 8)) {
    wahr(!enthaeltSchwein(r), `${r.name} enthält Schwein trotz halal`);
    wahr(rezeptErlaubt(r, p), `${r.name} fällt durch den Profilfilter`);
  }
});

pruefe("eigene Ausschlüsse gelten auch hier", () => {
  const p = profil({ eigeneAusschluesse: ["Paprika"] });
  for (const r of generiereAusVorrat(p, VOLL, "abend", 3, 9)) {
    wahr(rezeptErlaubt(r, p), `${r.name} fällt durch den Profilfilter`);
  }
});

/* ------------------------------------------------------------------ Ausgabe */
console.log(`${bestanden} Tests bestanden.`);
if (fehler.length) {
  console.log(`\n${fehler.length} Test(s) rot:`);
  for (const f of fehler) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Generator grün.");

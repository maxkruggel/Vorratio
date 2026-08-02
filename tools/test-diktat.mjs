#!/usr/bin/env node
/* Vorratio Diktat-Tests.

   Der Diktat-Parser ist pur (Text rein, Einträge raus) und damit ohne
   Framework testbar. Geprüft wird vor allem das, was still falsch sein kann:
   Gesprochenes kommt oft ohne Satzzeichen an ("Salz Chiliflocken
   Sonnenblumenkerne"), und wer daraus einen Artikel statt drei liest, merkt
   das erst, wenn der halbe Schrank fehlt. Genauso still falsch wäre eine
   Menge, die beim falschen Artikel landet.

   Aufruf: node tools/test-diktat.mjs   ·  Exit-Code 1 = mindestens ein Test rot. */

import { parseDiktat, diktatAnzeige } from "../js/diktat.js";

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

/* Kurzschreibweise: Diktat → Liste aus "zutat_id|Anzeige" je Eintrag. */
const lies = (text, bestand = []) => parseDiktat(text, bestand)
  .map((e) => `${e.zutat_id || "frei"}|${diktatAnzeige(e)}`);
const ids = (text, bestand = []) => parseDiktat(text, bestand).map((e) => e.zutat_id);

/* ------------------------------------------------------ Aufzählung trennen */
beschreibe("Aufzählung");

pruefe("Kommas trennen die Artikel", () => {
  gleich(ids("Salz, Chiliflocken, Sonnenblumenkerne"),
    ["ing_salz", "ing_chiliflocken", "ing_sonnenblumenkerne"]);
});

/* Der Grund für diese Datei: Die iOS-Spracherkennung setzt selten Kommas.
   Ohne Zerlegung innerhalb des Abschnitts blieb von drei Zutaten eine übrig. */
pruefe("ohne Satzzeichen ebenso", () => {
  gleich(ids("Salz Chiliflocken Sonnenblumenkerne"),
    ["ing_salz", "ing_chiliflocken", "ing_sonnenblumenkerne"]);
});

pruefe("„und“/„dann“ trennen ebenfalls", () => {
  gleich(ids("Kaffee und Tee dann noch Zucker"), ["ing_kaffee", "ing_tee", "ing_zucker"]);
});

pruefe("mehrteilige Namen bleiben zusammen", () => {
  gleich(ids("passierte Tomaten geriebener Käse"), ["ing_passierte_tomaten", "ing_reibekaese"]);
});

pruefe("Unbekanntes verschluckt keinen Nachbarn", () => {
  gleich(ids("Haribo Sonnenblumenkerne"), [null, "ing_sonnenblumenkerne"]);
});

pruefe("Unbekanntes bleibt am Stück", () => {
  gleich(parseDiktat("irgendein Quatschwort").map((e) => e.name), ["Irgendein Quatschwort"]);
});

/* --------------------------------------------------------------- Mengen */
beschreibe("Mengen");

pruefe("Zahlwort + Einheit", () => {
  gleich(lies("zwei Kilo Mehl"), ["ing_mehl_405|2 kg"]);
});

pruefe("Ziffern, Dezimalkomma und Stückzahl", () => {
  gleich(lies("500 Gramm Nudeln, 1,5 Liter Olivenöl, sechs Eier"),
    ["ing_nudeln|500 g", "ing_olivenoel|1,5 l", "ing_ei|6 ×"]);
});

/* Jede genannte Menge beginnt einen neuen Artikel – auch ohne Komma. */
pruefe("jede Menge gehört ihrem eigenen Artikel", () => {
  gleich(lies("zwei Kilo Mehl eine Dose Kichererbsen drei Zwiebeln"),
    ["ing_mehl_405|2 kg", "ing_kichererbsen_dose|1 Dose", "ing_zwiebel|3 ×"]);
});

pruefe("die Einheit schärft die Zutat", () => {
  gleich(ids("drei Tomaten und zwei Dosen Tomaten"), ["ing_tomate_frisch", "ing_tomate_dose"]);
});

pruefe("ohne Menge gilt „vorrätig“", () => {
  gleich(lies("Salz ist da"), ["ing_salz|vorrätig"]);
});

/* ------------------------------------------------------- Anteile & Leeres */
beschreibe("Zustand");

pruefe("„halb voll“ ist ein Anteil, keine Menge 0,5", () => {
  gleich(lies("Mehl ist halb voll"), ["ing_mehl_405|noch etwa 50 %"]);
});

pruefe("„fast leer“ ist ein Anteil, kein leeres Fach", () => {
  gleich(lies("Milch ist fast leer"), ["ing_milch|noch etwa 15 %"]);
});

pruefe("„ist alle“ ist leer", () => {
  gleich(lies("Nudeln sind alle"), ["ing_nudeln|leer"]);
});

/* Ohne Satzzeichen muss jede Angabe bei ihrem eigenen Artikel landen. */
pruefe("Zustand gehört zum genannten Artikel", () => {
  gleich(lies("Butter halb voll Zucker fast leer Nudeln sind alle"),
    ["ing_butter|noch etwa 50 %", "ing_zucker|noch etwa 15 %", "ing_nudeln|leer"]);
});

pruefe("„ein halbes Kilo“ bleibt eine Menge", () => {
  gleich(lies("ein halbes Kilo Mehl"), ["ing_mehl_405|0,5 kg"]);
});

/* ------------------------------------------------------------- Zuordnung */
beschreibe("Zuordnung");

pruefe("Kurzformen treffen die naheliegende Zutat", () => {
  gleich(ids("Mehl, Reis, Nudeln, Eier, Zwiebeln"),
    ["ing_mehl_405", "ing_reis_weiss", "ing_nudeln", "ing_ei", "ing_zwiebel"]);
});

pruefe("Hafermilch ist Haferdrink", () => {
  gleich(ids("Hafermilch"), ["ing_haferdrink"]);
});

/* Bei sonst gleichwertigen Kandidaten entscheidet, was der Haushalt hat –
   "Kohl" trifft ein halbes Dutzend Katalogeinträge gleich gut. Eine kuratierte
   Kurzform ("Reis" → Weißer Reis) sticht diesen Bonus dagegen bewusst aus:
   Sie ist die Entscheidung, was gemeint ist, wenn nichts Näheres gesagt wird. */
pruefe("Bekanntes aus dem Bestand entscheidet den Gleichstand", () => {
  gleich(parseDiktat("Kohl")[0].zutat_id, "ing_gruenkohl");
  gleich(parseDiktat("Kohl", [{ zutat_id: "ing_chinakohl" }])[0].zutat_id, "ing_chinakohl");
});

pruefe("erkannte Artikel gelten als sicher, geratene nicht", () => {
  gleich(parseDiktat("Chiliflocken Haribo").map((e) => e.sicher), [true, false]);
});

pruefe("der gesprochene Text steht bei jedem Eintrag", () => {
  gleich(parseDiktat("Salz Chiliflocken").map((e) => e.rohtext), ["Salz", "Chiliflocken"]);
});

/* ------------------------------------------------------------------ Rand */
beschreibe("Randfälle");

pruefe("leerer Text ergibt nichts", () => {
  gleich(parseDiktat("").length, 0);
  gleich(parseDiktat("   ").length, 0);
  gleich(parseDiktat(null).length, 0);
});

pruefe("reines Füllwort-Geplapper ergibt nichts", () => {
  gleich(parseDiktat("also ähm ich glaube ja").length, 0);
});

/* ------------------------------------------------------- Eigener Wortschatz */
beschreibe("Eigener Wortschatz");

/* Der Katalog kennt keine Backoblaten und keine Fertigsuppe. Wer sie einmal
   angelegt hat, soll sie beim nächsten Diktat wiedererkannt bekommen –
   sonst müsste man denselben Namen jedes Mal von Hand nachtragen. */
const EIGENE = [
  { zutat_id: "frei_backoblaten", name: "Backoblaten", einheit: "g", art: "schuettgut" },
  { zutat_id: "frei_maggi_zwiebelsuppe", name: "Maggi Zwiebelsuppe", einheit: "Pck", art: "zaehlbar" },
];

pruefe("Unbekanntes wird als eigener Artikel vorgeschlagen", () => {
  const e = parseDiktat("Backoblaten")[0];
  gleich(e.zutat_id, null);
  gleich(e.name, "Backoblaten");
});

pruefe("eigene Artikel werden wiedererkannt", () => {
  gleich(ids("Backoblaten", EIGENE), ["frei_backoblaten"]);
});

pruefe("und trennen sich dann auch ohne Satzzeichen", () => {
  gleich(ids("Backoblaten Maggi Zwiebelsuppe Kokosraspeln", EIGENE),
    ["frei_backoblaten", "frei_maggi_zwiebelsuppe", "ing_kokosraspel"]);
});

pruefe("mit Menge und Zustand wie jede andere Zutat", () => {
  gleich(lies("zwei Packungen Maggi Zwiebelsuppe Backoblaten sind alle", EIGENE),
    ["frei_maggi_zwiebelsuppe|2 Pck", "frei_backoblaten|leer"]);
});

/* Ein Treffer darf sich seine Vorgänger nicht einverleiben. */
pruefe("ein Fenster hängt an seinem ersten Wort", () => {
  gleich(ids("Kokosraspeln Maggi Zwiebelsuppe", EIGENE),
    ["ing_kokosraspel", "frei_maggi_zwiebelsuppe"]);
});

/* ------------------------------------------------------------------ Ausgabe */
console.log(`${bestanden} Tests bestanden.`);
if (fehler.length) {
  console.log(`\n${fehler.length} Test(s) rot:`);
  for (const f of fehler) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Diktat grün.");

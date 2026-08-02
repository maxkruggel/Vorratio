#!/usr/bin/env node
/* Vorratio Engine-Tests.

   Die Engine ist pur (kein DOM, kein State) und damit ohne Framework testbar.
   Geprüft wird vor allem das, was still falsch sein kann und niemandem auffällt,
   bis es beim Nutzer schiefgeht: die harten Profilfilter, das Toleranzband und
   die Abbuchung. Der Halal-Filter etwa hat monatelang Schweinefleisch
   durchgelassen – so ein Fehler soll hier auffallen, nicht auf dem Teller.

   Aufruf: node tools/test-engine.mjs   ·  Exit-Code 1 = mindestens ein Test rot. */

import { REZEPTE, ZUTATEN } from "../js/data/kerndb.js";
import {
  rezeptErlaubt, bestandsAbgleich, istVorhanden, abbuchen, vorschlaege, snackVorschlaege,
  mengeInBestandsEinheit, wochenKandidaten, istGrundzutat, tagesSeed, pseudoZufall, mengeAnzeige,
  aktuellerSlot,
  ZUTAT_INDEX,
} from "../js/engine.js";
import { fotoEintraege, passeEintragAn } from "../js/vorratsfoto.js";
import { allergeneFuerRezept, enthaeltSchwein, enthaeltAlkohol } from "../js/data/allergene.js";
import { lokalesDatum } from "../js/storage.js";
import { ERNAEHRUNGSFORMEN, AUSSCHLUESSE } from "../js/data/profil.js";

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
function wahr(wert, hinweis = "sollte wahr sein") {
  if (!wert) throw new Error(hinweis);
}
function falsch(wert, hinweis = "sollte falsch sein") {
  if (wert) throw new Error(hinweis);
}

/* Testhelfer: Profil und Bestandsposten kurz schreiben. */
const profil = (over = {}) => ({
  name: "Test", ernaehrungsform: "mischkost", ausschluesse: [], eigeneAusschluesse: [],
  vorlieben: [], stile: [], ziele: [], onboarded: true, ...over,
});
const posten = (zutat_id, menge, over = {}) => ({
  id: `b_${zutat_id}_${menge}`, zutat_id, name: zutat_id, kategorie: "trocken",
  art: "schuettgut", einheit: "g", menge, ...over,
});
const rezept = (over = {}) => ({
  id: "T-001", name: "Testgericht", typ: "rezept", kategorie: "Test", cuisine: "test",
  mahlzeitentyp: ["mittag"], portionen: 2, schwierigkeit: "einfach",
  zutaten: [], schritte: [{ nr: 1, text: "Kochen.", dauer_sekunden: null, timer_typ: null }],
  gesamtzeit_min: { vorbereitung: 5, garzeit: 5, gesamt: 10 },
  ernaehrungsform: ["vegan", "vegetarisch"], allergene: [], tags: [],
  naehrwert_einordnung: { profil: "ausgewogen", makro_hinweis: "" }, quelle_typ: "test", ...over,
});
const zutat = (zutat_id, menge = 100, einheit = "g", over = {}) =>
  ({ menge, einheit, zutat_id, zutat_name: zutat_id, ...over });

/* ------------------------------------------------------- Profilfilter (Achse 1+2) */
beschreibe("rezeptErlaubt – Ernährungsform");

pruefe("vegan lässt kein Fleischgericht durch", () => {
  const r = rezept({ ernaehrungsform: ["mit_fleisch"] });
  falsch(rezeptErlaubt(r, profil({ ernaehrungsform: "vegan" })));
});

pruefe("mischkost lässt vegane Gerichte durch", () => {
  wahr(rezeptErlaubt(rezept(), profil({ ernaehrungsform: "mischkost" })));
});

pruefe("lacto schließt Ei aus, ovo schließt Milch aus", () => {
  const mitEi = rezept({ ernaehrungsform: ["vegetarisch"], allergene: ["ei"] });
  const mitMilch = rezept({ ernaehrungsform: ["vegetarisch"], allergene: ["laktose"] });
  falsch(rezeptErlaubt(mitEi, profil({ ernaehrungsform: "lacto" })), "lacto darf kein Ei zeigen");
  wahr(rezeptErlaubt(mitMilch, profil({ ernaehrungsform: "lacto" })), "lacto darf Milch zeigen");
  falsch(rezeptErlaubt(mitMilch, profil({ ernaehrungsform: "ovo" })), "ovo darf keine Milch zeigen");
  wahr(rezeptErlaubt(mitEi, profil({ ernaehrungsform: "ovo" })), "ovo darf Ei zeigen");
});

beschreibe("rezeptErlaubt – Allergene");

pruefe("deklariertes Allergen sperrt", () => {
  const r = rezept({ allergene: ["gluten"] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["gluten"] })));
});

pruefe("NICHT deklariertes Allergen sperrt trotzdem (Ableitung aus den Zutaten)", () => {
  // Genau der Fall eines AI-Rezepts, das sein allergene-Feld falsch ausfüllt.
  const r = rezept({ allergene: [], zutaten: [zutat("ing_nudeln", 250)] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["gluten"] })),
    "Nudeln im Rezept müssen den Gluten-Filter auslösen, auch ohne Deklaration");
});

pruefe("Allergen aus dem Zutatennamen sperrt (Zutat ohne zutat_id)", () => {
  const r = rezept({ allergene: [], zutaten: [{ menge: 2, einheit: "EL", zutat_id: null, zutat_name: "Haselnüsse" }] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["schalenfruechte"] })));
});

pruefe("optionale Zutat mit Allergen sperrt ebenfalls", () => {
  const r = rezept({ allergene: [], zutaten: [zutat("ing_ei", 2, "Stk", { optional: true })] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["ei"] })));
});

beschreibe("rezeptErlaubt – halal & koscher");

pruefe("halal sperrt Schweinefleisch", () => {
  const r = rezept({ ernaehrungsform: ["mit_fleisch"], zutaten: [zutat("ing_speck", 100)] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["halal"] })));
});

pruefe("halal sperrt Alkohol, auch verkocht", () => {
  const r = rezept({ zutaten: [zutat("ing_rotwein", 200, "ml")] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["halal"] })));
});

pruefe("halal sperrt Schwein auch ohne zutat_id (nur über den Namen)", () => {
  const r = rezept({ zutaten: [{ menge: 100, einheit: "g", zutat_id: null, zutat_name: "Serranoschinken" }] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["halal"] })));
});

pruefe("halal lässt Rind und Geflügel durch", () => {
  const r = rezept({ ernaehrungsform: ["mit_fleisch"], zutaten: [zutat("ing_hackfleisch_rind", 400)] });
  wahr(rezeptErlaubt(r, profil({ ausschluesse: ["halal"] })));
});

pruefe("koscher sperrt Fleisch-Milch-Kombination", () => {
  const r = rezept({
    ernaehrungsform: ["mit_fleisch"],
    zutaten: [zutat("ing_hackfleisch_rind", 400), zutat("ing_sahne", 150, "ml")],
  });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["koscher"] })));
});

pruefe("koscher lässt Fleisch ohne Milch durch", () => {
  const r = rezept({ ernaehrungsform: ["mit_fleisch"], zutaten: [zutat("ing_hackfleisch_rind", 400)] });
  wahr(rezeptErlaubt(r, profil({ ausschluesse: ["koscher"] })));
});

pruefe("koscher sperrt Meeresfrüchte", () => {
  const r = rezept({ ernaehrungsform: ["pescetarisch"], zutaten: [zutat("ing_garnelen", 300)] });
  falsch(rezeptErlaubt(r, profil({ ausschluesse: ["koscher"] })));
});

beschreibe("rezeptErlaubt – eigene Ausschlüsse");

pruefe("Freitext trifft Zutatennamen", () => {
  const r = rezept({ zutaten: [{ menge: 1, einheit: "Bund", zutat_id: null, zutat_name: "Koriander" }] });
  falsch(rezeptErlaubt(r, profil({ eigeneAusschluesse: ["koriander"] })));
});

pruefe("Freitext trifft Rezeptnamen", () => {
  falsch(rezeptErlaubt(rezept({ name: "Rosenkohlauflauf" }), profil({ eigeneAusschluesse: ["Rosenkohl"] })));
});

pruefe("zweibuchstabiger Ausschluss wird nicht verschluckt", () => {
  // "Ei" war vorher zu kurz und wurde stillschweigend ignoriert.
  const r = rezept({ name: "Ei auf Brot" });
  falsch(rezeptErlaubt(r, profil({ eigeneAusschluesse: ["Ei"] })));
});

/* ------------------------------------------------- Allergen-Ableitung: falsche Freunde */
beschreibe("allergeneFuerRezept – keine Fehlalarme");

const keinAllergen = (zutatName, allergen) => () => {
  const r = rezept({ zutaten: [{ menge: 1, einheit: "Dose", zutat_id: null, zutat_name: zutatName }] });
  falsch(allergeneFuerRezept(r).has(allergen), `"${zutatName}" darf nicht als ${allergen} gelten`);
};

pruefe("Kokosmilch ist keine Laktose", keinAllergen("Kokosmilch", "laktose"));
pruefe("Hafermilch ist keine Laktose", keinAllergen("Hafermilch", "laktose"));
pruefe("Erdnüsse sind keine Schalenfrüchte", keinAllergen("Erdnüsse", "schalenfruechte"));
pruefe("Kokosnuss ist keine Schalenfrucht", keinAllergen("Kokosnussraspel", "schalenfruechte"));
pruefe("Muskatnuss ist keine Schalenfrucht", keinAllergen("Muskatnuss", "schalenfruechte"));
pruefe("Reisnudeln enthalten kein Gluten", keinAllergen("Reisnudeln", "gluten"));
pruefe("Kichererbsenmehl enthält kein Gluten", keinAllergen("Kichererbsenmehl", "gluten"));
pruefe("mehligkochende Kartoffeln enthalten kein Gluten", keinAllergen("mehligkochende Kartoffeln", "gluten"));
pruefe("Tofu-Feta ist keine Laktose", keinAllergen("Tofu-Feta", "laktose"));
pruefe("vegane Mayonnaise enthält kein Ei", keinAllergen("vegane Mayonnaise", "ei"));
pruefe("Erdnussbutter ist keine Laktose", keinAllergen("Erdnussbutter", "laktose"));
pruefe("Reis löst kein Ei aus", keinAllergen("Reis", "ei"));
pruefe("Fleisch löst kein Ei aus", keinAllergen("Rinderhack", "ei"));
pruefe("Weintrauben lösen kein Sulfit aus", keinAllergen("Weintrauben", "sulfite"));
pruefe("Butterschmalz ist kein Schwein", () => {
  const r = rezept({ zutaten: [{ menge: 30, einheit: "g", zutat_id: null, zutat_name: "Butterschmalz" }] });
  falsch(enthaeltSchwein(r));
});
pruefe("Weintrauben sind kein Alkohol", () => {
  const r = rezept({ zutaten: [{ menge: 200, einheit: "g", zutat_id: null, zutat_name: "Weintrauben" }] });
  falsch(enthaeltAlkohol(r));
});

beschreibe("allergeneFuerRezept – echte Treffer");

const findetAllergen = (zutatName, allergen) => () => {
  const r = rezept({ zutaten: [{ menge: 1, einheit: "Stk", zutat_id: null, zutat_name: zutatName }] });
  wahr(allergeneFuerRezept(r).has(allergen), `"${zutatName}" muss als ${allergen} gelten`);
};

pruefe("Vollmilchschokolade ist Laktose", findetAllergen("Vollmilchschokolade", "laktose"));
pruefe("Dinkelmehl ist Gluten", findetAllergen("Dinkelmehl", "gluten"));
pruefe("Eigelb ist Ei", findetAllergen("Eigelb", "ei"));
pruefe("Haselnüsse sind Schalenfrüchte", findetAllergen("geröstete Haselnüsse", "schalenfruechte"));
pruefe("Gemüsebrühe gilt als Sellerie", findetAllergen("Gemüsebrühe", "sellerie"));

/* ------------------------------------------------------------- Bestandsabgleich */
beschreibe("bestandsAbgleich & istVorhanden");

pruefe("Toleranzband: 15 % zu wenig gilt noch als vorhanden", () => {
  const z = zutat("ing_nudeln", 500);
  wahr(istVorhanden([posten("ing_nudeln", 425)], z), "425 g von 500 g müssen reichen");
  falsch(istVorhanden([posten("ing_nudeln", 300)], z), "300 g von 500 g dürfen nicht reichen");
});

pruefe("mehrere Posten derselben Zutat werden summiert", () => {
  const z = zutat("ing_nudeln", 500);
  falsch(istVorhanden([posten("ing_nudeln", 250)], z), "ein halber Posten reicht nicht");
  wahr(istVorhanden([posten("ing_nudeln", 250), posten("ing_nudeln", 250)], z),
    "zwei angebrochene Packungen zusammen müssen reichen");
});

pruefe("pauschale Zutat: null = vorrätig, 0 = leer", () => {
  const z = zutat("ing_salz", null, "Prise");
  wahr(istVorhanden([posten("ing_salz", null, { art: "pauschal" })], z));
  falsch(istVorhanden([posten("ing_salz", 0, { art: "pauschal" })], z));
});

pruefe("leerer Bestand: nichts ist vorhanden", () => {
  falsch(istVorhanden([], zutat("ing_nudeln", 500)));
});

pruefe("EL/TL werden nicht gerechnet – Hauptsache etwas ist da", () => {
  const z = zutat("ing_olivenoel", 3, "EL");
  wahr(istVorhanden([posten("ing_olivenoel", 5, { einheit: "ml" })], z),
    "bei Küchenmaßen gilt das Toleranzprinzip");
});

pruefe("Basis-Zutaten und optionale zählen nie als fehlend", () => {
  const r = rezept({ zutaten: [zutat("ing_salz", null, "Prise"), zutat("ing_ei", 2, "Stk", { optional: true })] });
  const ab = bestandsAbgleich(r, []);
  gleich(ab.fehlt.length, 0, "nichts darf fehlen: ");
});

pruefe("Quote zählt vorhanden gegen fehlend", () => {
  const r = rezept({ zutaten: [zutat("ing_nudeln", 500), zutat("ing_moehre", 2, "Stk")] });
  const ab = bestandsAbgleich(r, [posten("ing_nudeln", 500)]);
  gleich(ab.vorhanden.length, 1);
  gleich(ab.fehlt.length, 1);
  gleich(ab.quote, 0.5);
});

/* -------------------------------------------------------------------- Abbuchung */
beschreibe("abbuchen");

pruefe("bucht die Rezeptmenge ab und rundet auf 10er", () => {
  const b = [posten("ing_nudeln", 500)];
  abbuchen(rezept({ zutaten: [zutat("ing_nudeln", 250)], portionen: 2 }), b, 2);
  gleich(b[0].menge, 250);
});

pruefe("Portionsfaktor rechnet mit", () => {
  const b = [posten("ing_nudeln", 1000)];
  abbuchen(rezept({ zutaten: [zutat("ing_nudeln", 250)], portionen: 2 }), b, 4);
  gleich(b[0].menge, 500, "doppelte Portionen = doppelter Abzug: ");
});

pruefe("räumt mehrere Posten der Reihe nach ab", () => {
  const b = [posten("ing_nudeln", 200), posten("ing_nudeln", 300)];
  abbuchen(rezept({ zutaten: [zutat("ing_nudeln", 400)], portionen: 2 }), b, 2);
  gleich(b[0].menge, 0, "angebrochene Packung zuerst leeren: ");
  gleich(b[1].menge, 100, "Rest von der zweiten: ");
});

pruefe("bucht nie unter null", () => {
  const b = [posten("ing_nudeln", 100)];
  abbuchen(rezept({ zutaten: [zutat("ing_nudeln", 500)], portionen: 2 }), b, 2);
  gleich(b[0].menge, 0);
});

pruefe("pauschale Posten und Küchenmaße bleiben unberührt", () => {
  const b = [posten("ing_salz", null, { art: "pauschal" }), posten("ing_olivenoel", 500, { einheit: "ml" })];
  abbuchen(rezept({ zutaten: [zutat("ing_salz", null, "Prise"), zutat("ing_olivenoel", 3, "EL")] }), b, 2);
  gleich(b[0].menge, null, "pauschal bleibt pauschal: ");
  gleich(b[1].menge, 500, "EL wird nicht gerechnet: ");
});

pruefe("Abgleich und Abbuchung sehen dieselbe Menge", () => {
  // Der Kern des Doppelposten-Fehlers: "alles da" anzeigen, dann zu wenig abbuchen.
  const b = [posten("ing_nudeln", 250), posten("ing_nudeln", 250)];
  const r = rezept({ zutaten: [zutat("ing_nudeln", 500)], portionen: 2 });
  wahr(bestandsAbgleich(r, b).fehlt.length === 0, "muss als vorhanden gelten");
  abbuchen(r, b, 2);
  gleich(b[0].menge + b[1].menge, 0, "und danach vollständig abgebucht sein: ");
});

/* ------------------------------------------------------------------ Vorschläge */
beschreibe("vorschlaege");

const bestandVoll = ZUTATEN.map((z, i) => ({
  id: `b${i}`, zutat_id: z.id, name: z.name, art: z.art, einheit: z.einheit,
  menge: z.art === "pauschal" ? null : 5000, packung: z.packung,
}));

pruefe("liefert die gewünschte Anzahl", () => {
  gleich(vorschlaege(profil(), bestandVoll, "mittag", 1, 3).length, 3);
});

pruefe("schlägt nichts vor, was das Profil verbietet", () => {
  const p = profil({ ernaehrungsform: "vegan", ausschluesse: ["gluten"] });
  for (const v of vorschlaege(p, bestandVoll, "abend", 7, 5)) {
    wahr(rezeptErlaubt(v.rezept, p), `${v.rezept.id} verstößt gegen das Profil`);
  }
});

pruefe("reine Snack-Rezepte landen nie in einem Essens-Slot", () => {
  const p = profil({ ernaehrungsform: "vegan", ausschluesse: ["gluten", "soja", "schalenfruechte"] });
  for (const slot of ["fruehstueck", "mittag", "abend"]) {
    for (const v of vorschlaege(p, [], slot, 3, 3)) {
      falsch(v.rezept.mahlzeitentyp.every((t) => t === "snack"),
        `${v.rezept.id} ist ein reiner Snack, steht aber im Slot ${slot}`);
    }
  }
});

pruefe("Auffüllen mit slot-fremden Rezepten ist nach Score sortiert", () => {
  // Künstlich leergefilterter Slot: der Rest muss nach Bestandsdeckung kommen,
  // nicht in Datenbankreihenfolge.
  const nurAbend = REZEPTE.filter((r) => !r.mahlzeitentyp.includes("fruehstueck")).slice(0, 40);
  const v = vorschlaege(profil(), bestandVoll, "fruehstueck", 5, 3, nurAbend);
  gleich(v.length, 3, "muss auffüllen: ");
  wahr(v[0].score >= v[1].score && v[1].score >= v[2].score, "Auffüller müssen sortiert sein");
  wahr(v.every((x) => x.slotFremd), "Auffüller müssen als slot-fremd markiert sein");
});

pruefe("Bestandsdeckung schlägt die weichen Boni", () => {
  const passt = rezept({ id: "T-VOLL", zutaten: [zutat("ing_nudeln", 100)] });
  const fehlt = rezept({ id: "T-LEER", tags: ["schnell"], zutaten: [zutat("ing_lachs", 300)] });
  const p = profil({ stile: ["schnell"] });
  const v = vorschlaege(p, [posten("ing_nudeln", 500)], "mittag", 0, 2, [passt, fehlt]);
  gleich(v[0].rezept.id, "T-VOLL", "Bestand muss den Stil-Bonus schlagen: ");
});

pruefe("Snackvorschläge kommen nur aus der Snack-Schiene", () => {
  for (const v of snackVorschlaege(profil(), bestandVoll, 1, 4)) {
    wahr(v.rezept.mahlzeitentyp.includes("snack"), `${v.rezept.id} ist kein Snack`);
  }
});

pruefe("gleicher Seed = gleiches Ergebnis, anderer Seed = andere Reihenfolge", () => {
  const a = vorschlaege(profil(), bestandVoll, "mittag", 42, 3).map((v) => v.rezept.id);
  const b = vorschlaege(profil(), bestandVoll, "mittag", 42, 3).map((v) => v.rezept.id);
  const c = vorschlaege(profil(), bestandVoll, "mittag", 43, 3).map((v) => v.rezept.id);
  gleich(a, b, "derselbe Wurf muss stabil sein: ");
  wahr(JSON.stringify(a) !== JSON.stringify(c), "ein neuer Wurf soll etwas ändern");
});

/* ------------------------------------------------ Abdeckung der ganzen Datenbank */
beschreibe("Datenbank-Abdeckung");

pruefe("kein halal-Profil bekommt Schwein oder Alkohol", () => {
  const p = profil({ ausschluesse: ["halal"] });
  const treffer = REZEPTE.filter((r) => rezeptErlaubt(r, p))
    .filter((r) => enthaeltSchwein(r) || enthaeltAlkohol(r));
  gleich(treffer.map((r) => r.id), [], "durchgerutscht: ");
});

pruefe("kein koscheres Profil bekommt Schwein", () => {
  const p = profil({ ausschluesse: ["koscher"] });
  const treffer = REZEPTE.filter((r) => rezeptErlaubt(r, p)).filter(enthaeltSchwein);
  gleich(treffer.map((r) => r.id), [], "durchgerutscht: ");
});

pruefe("kein Allergiker-Profil bekommt sein Allergen", () => {
  for (const a of AUSSCHLUESSE.filter((x) => x.gruppe !== "religioes")) {
    const p = profil({ ausschluesse: [a.id] });
    const treffer = REZEPTE.filter((r) => rezeptErlaubt(r, p))
      .filter((r) => allergeneFuerRezept(r).has(a.id));
    gleich(treffer.map((r) => r.id), [], `${a.id} durchgerutscht: `);
  }
});

pruefe("jede Ernährungsform hat echte Frühstücksrezepte", () => {
  for (const form of ERNAEHRUNGSFORMEN) {
    const p = profil({ ernaehrungsform: form.id });
    const anzahl = REZEPTE.filter((r) => rezeptErlaubt(r, p) && r.mahlzeitentyp.includes("fruehstueck")).length;
    wahr(anzahl >= 3, `${form.id} hat nur ${anzahl} Frühstücksrezepte`);
  }
});

pruefe("auch mehrfach eingeschränkte Profile haben ein Frühstück", () => {
  const faelle = [
    ["vegan", ["gluten"]],
    ["vegan", ["gluten", "soja"]],
    ["vegan", ["gluten", "soja", "schalenfruechte"]],
    ["ovo_lacto", ["gluten"]],
    ["mischkost", ["gluten", "laktose"]],
  ];
  for (const [form, aus] of faelle) {
    const p = profil({ ernaehrungsform: form, ausschluesse: aus });
    const anzahl = REZEPTE.filter((r) => rezeptErlaubt(r, p) && r.mahlzeitentyp.includes("fruehstueck")).length;
    wahr(anzahl >= 1, `${form} + ${aus.join("+")} hat kein einziges Frühstück`);
  }
});

/* --------------------------------------------------------------- Kleinigkeiten */
beschreibe("Einheiten, Datum & Anzeige");

pruefe("Dosen werden über den Inhalt umgerechnet", () => {
  gleich(mengeInBestandsEinheit({ menge: 500, einheit: "g", zutat_id: "ing_kichererbsen_dose" }, { einheit: "Dose" }), 2);
});

pruefe("Küchenmaße geben bewusst null zurück", () => {
  for (const einheit of ["EL", "TL", "Prise", "nach_Bedarf"]) {
    gleich(mengeInBestandsEinheit({ menge: 2, einheit, zutat_id: "ing_olivenoel" }, { einheit: "ml" }), null, `${einheit}: `);
  }
});

pruefe("Anzeige bleibt Näherung", () => {
  gleich(mengeAnzeige({ art: "schuettgut", menge: 500, einheit: "g" }), "~500 g");
  gleich(mengeAnzeige({ art: "pauschal", menge: 0 }), "leer");
  gleich(mengeAnzeige({ art: "zaehlbar", menge: 3, einheit: "Stk" }), "3 Stk");
});

pruefe("Wochenliste sammelt leere und fast leere Posten", () => {
  const b = [
    posten("ing_nudeln", 50, { packung: 500 }),    // ≤ 20 %
    posten("ing_reis_weiss", 800, { packung: 1000 }),
    posten("ing_salz", 0, { art: "pauschal" }),
  ];
  gleich(wochenKandidaten(b).map((x) => x.zutat_id), ["ing_nudeln", "ing_salz"]);
});

pruefe("Wochenliste summiert mehrere Posten derselben Zutat", () => {
  // Angebrochene Packung neben einer vollen: kein Grund zum Nachkaufen.
  const b = [
    posten("ing_nudeln", 50, { packung: 500 }),
    posten("ing_nudeln", 500, { packung: 500 }),
  ];
  gleich(wochenKandidaten(b).map((x) => x.zutat_id), []);
  // Zwei angebrochene Reste zusammen bleiben unter der Schwelle → Kandidat, aber nur einmal.
  const c = [posten("ing_nudeln", 40, { packung: 500 }), posten("ing_nudeln", 40, { packung: 500 })];
  gleich(wochenKandidaten(c).map((x) => x.zutat_id), ["ing_nudeln"]);
});

pruefe("Ein vorrätiger Pauschal-Posten reicht, ein unbestimmter auch", () => {
  const b = [
    posten("ing_salz", 0, { art: "pauschal" }),
    posten("ing_salz", null, { art: "pauschal" }),
    posten("ing_mehl", null, { packung: 1000 }),
  ];
  gleich(wochenKandidaten(b).map((x) => x.zutat_id), []);
});

pruefe("Zählbares ohne Packungsgröße: Vorrat erst bei 0, Frisches schon beim Rest", () => {
  const dose = (menge) => posten("frei_tomaten_dose", menge,
    { art: "zaehlbar", einheit: "Dose", kategorie: "konserve", packung: null });
  const moehre = (menge) => posten("ing_moehre", menge,
    { art: "zaehlbar", einheit: "Stk", kategorie: "frisch", packung: null });
  gleich(wochenKandidaten([dose(1)]).map((x) => x.zutat_id), []);
  gleich(wochenKandidaten([dose(0)]).map((x) => x.zutat_id), ["frei_tomaten_dose"]);
  gleich(wochenKandidaten([moehre(1)]).map((x) => x.zutat_id), ["ing_moehre"]);
  gleich(wochenKandidaten([moehre(2)]).map((x) => x.zutat_id), []);
});

pruefe("Grundzutaten sind als solche erkennbar", () => {
  wahr(istGrundzutat("ing_olivenoel"));
  wahr(istGrundzutat("ing_salz"));
  falsch(istGrundzutat("ing_nudeln"));
  falsch(istGrundzutat("frei_wacholderbeeren"));
});

pruefe("Slotgrenzen liegen bei 11:00 und 16:00", () => {
  const um = (h, m = 0) => aktuellerSlot(new Date(2026, 7, 2, h, m));
  gleich(um(7), "fruehstueck");
  gleich(um(10, 59), "fruehstueck");
  gleich(um(11), "mittag");
  gleich(um(15, 59), "mittag");
  gleich(um(16), "abend");
  gleich(um(23), "abend");
});

pruefe("Tagesdatum richtet sich nach der Ortszeit, nicht nach UTC", () => {
  // 1. Juli, 00:30 Ortszeit: in UTC+2 wäre der UTC-Tag noch der 30. Juni.
  gleich(lokalesDatum(new Date(2026, 6, 1, 0, 30)), "2026-07-01");
  gleich(lokalesDatum(new Date(2026, 0, 5, 23, 45)), "2026-01-05");
});

pruefe("tagesSeed ist pro Tag stabil und pro Wurf verschieden", () => {
  gleich(tagesSeed("2026-08-02", 0), tagesSeed("2026-08-02", 0));
  wahr(tagesSeed("2026-08-02", 0) !== tagesSeed("2026-08-02", 1));
  wahr(tagesSeed("2026-08-02", 0) !== tagesSeed("2026-08-03", 0));
});

pruefe("pseudoZufall bleibt im Intervall [0,1)", () => {
  for (const id of REZEPTE.slice(0, 60).map((r) => r.id)) {
    const v = pseudoZufall(id, 7);
    wahr(v >= 0 && v < 1, `${id} → ${v}`);
  }
});

/* --------------------------------------------------- Schrankfoto (Kap. 7.6)
   Ein Foto sieht, WAS dasteht, nicht WIE VIEL. Diese Tests halten genau das
   fest: erfundene Mengen dürfen nicht in den Bestand rutschen, und was das
   Modell nicht sehen konnte, muss als offen markiert bleiben. */
beschreibe("Schrankfoto");

// Ersatzangaben für alles ohne Katalogtreffer (in der App: freieZutatDaten).
const freiTest = () => ({ kategorie: "trocken", art: "schuettgut", einheit: "g", packung: 500 });
const gesehen = (over = {}) => ({
  gesehen: "im Fach", name: "Nudeln", zutat_id: "ing_nudeln",
  anzahl: null, fuellstand: null, sicher: true, ...over,
});

pruefe("Katalogtreffer bringt Führungsart, Einheit und Packung mit", () => {
  const [e] = fotoEintraege([gesehen()], freiTest);
  gleich(e.zutat_id, "ing_nudeln");
  gleich(e.art, "schuettgut");
  gleich(e.einheit, "g");
  gleich(e.packung, 500);
  falsch(e.offen, "sicherer Treffer zeigt die Zutatenwahl nicht offen");
});

pruefe("Erfundene zutat_id wird zum eigenen Artikel statt zur Geisterzutat", () => {
  const [e] = fotoEintraege([gesehen({ zutat_id: "ing_gibt_es_nicht", name: "Wunderpulver" })], freiTest);
  gleich(e.zutat_id, null);
  gleich(e.name, "Wunderpulver");
  wahr(e.offen, "ohne Katalogtreffer steht die Zutatenwahl offen");
});

pruefe("Blickdichte Packung: Menge bleibt geraten und wird als offen markiert", () => {
  const [e] = fotoEintraege([gesehen({ fuellstand: null })], freiTest);
  gleich(e.menge, 250, "halbe 500-g-Packung als Vorgabe: ");
  wahr(e.nachfragen, "ohne sichtbaren Füllstand muss nachgefragt werden");
});

pruefe("Sichtbarer Füllstand wird übernommen – auch als Prozentangabe", () => {
  const [anteil] = fotoEintraege([gesehen({ fuellstand: 0.25 })], freiTest);
  gleich(anteil.menge, 130, "0,25 × 500 g auf 10er gerundet: ");
  falsch(anteil.nachfragen, "sichtbarer Füllstand ist keine Rückfrage");
  const [prozent] = fotoEintraege([gesehen({ fuellstand: 80 })], freiTest);
  gleich(prozent.menge, 400, "80 % × 500 g: ");
  const [ueber] = fotoEintraege([gesehen({ fuellstand: 130 })], freiTest);
  gleich(ueber.menge, 500, "über voll wird gedeckelt: ");
});

pruefe("Zählbares: gezählte Stückzahl gilt, ungezähltes wird nachgefragt", () => {
  const dosen = { gesehen: "drei Dosen", name: "Kichererbsen", zutat_id: "ing_kichererbsen_dose", anzahl: 3, fuellstand: null, sicher: true };
  const [e] = fotoEintraege([dosen], freiTest);
  gleich(e.art, "zaehlbar");
  gleich(e.menge, 3);
  falsch(e.nachfragen, "gezählte Dosen sind keine Rückfrage");
  const [offen] = fotoEintraege([{ ...dosen, anzahl: null }], freiTest);
  gleich(offen.menge, 1);
  wahr(offen.nachfragen, "verdeckt gestapelt → nachfragen");
});

pruefe("Mehrere Schüttgut-Packungen werden gezählt statt geschätzt", () => {
  // 3 Tuben à 500 g (Testpackung): ganze zählen, die offene gilt als voll
  const [drei] = fotoEintraege([gesehen({ anzahl: 3 })], freiTest);
  gleich(drei.menge, 1500, "3 × 500 g: ");
  falsch(drei.nachfragen, "gezählte Packungen sind keine Rückfrage");
  // Zählung + sichtbarer Füllstand der offenen: 2 ganze + 0,5
  const [halb] = fotoEintraege([gesehen({ anzahl: 3, fuellstand: 0.5 })], freiTest);
  gleich(halb.menge, 1250, "2 ganze + halbe offene: ");
});

pruefe("Pauschale Zutaten bekommen nie eine Menge angedichtet", () => {
  const [e] = fotoEintraege([gesehen({ name: "Sesamöl", zutat_id: "ing_sesamoel", fuellstand: 0.4 })], freiTest);
  gleich(e.art, "pauschal");
  gleich(e.menge, null, "pauschal kennt nur da/leer: ");
  gleich(mengeAnzeige(e), "vorrätig");
});

pruefe("Dieselbe Zutat auf zwei Fotos wird zusammengelegt", () => {
  const dose = (anzahl, text) => ({ gesehen: text, name: "Kichererbsen", zutat_id: "ing_kichererbsen_dose", anzahl, fuellstand: null, sicher: true });
  const zaehlbar = fotoEintraege([dose(3, "vorne"), dose(2, "hinten")], freiTest);
  gleich(zaehlbar.length, 1, "einmal listen, nicht zweimal: ");
  gleich(zaehlbar[0].menge, 5, "zählbares addiert sich: ");
  wahr(zaehlbar[0].rohtext.includes("vorne") && zaehlbar[0].rohtext.includes("hinten"));

  const schuett = fotoEintraege([gesehen({ fuellstand: 0.3 }), gesehen({ fuellstand: 0.8 })], freiTest);
  gleich(schuett.length, 1);
  gleich(schuett[0].menge, 400, "beim Füllstand gewinnt der bessere Blick: ");
});

pruefe("Unbrauchbare Zeilen fliegen raus", () => {
  gleich(fotoEintraege([{ name: "", zutat_id: null }, { name: "x", zutat_id: null }], freiTest).length, 0);
  gleich(fotoEintraege(null, freiTest).length, 0);
});

pruefe("Zutatenwechsel zieht die Führungsart nach", () => {
  const [e] = fotoEintraege([gesehen({ zutat_id: "ing_kichererbsen_dose", name: "Kichererbsen", anzahl: 3 })], freiTest);
  passeEintragAn(e, ZUTAT_INDEX.ing_nudeln);
  gleich(e.art, "schuettgut");
  gleich(e.einheit, "g");
  gleich(e.menge, 250, "aus 3 Dosen darf kein 3 g werden: ");
});

/* ------------------------------------------------------------------ Ausgabe */
console.log(`${bestanden} Tests bestanden.`);
if (fehler.length) {
  console.log(`\n${fehler.length} Test(s) rot:`);
  for (const f of fehler) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Engine grün.");

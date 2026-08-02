#!/usr/bin/env node
/* Vorratio Rezept-Import-Tests.

   Der Import ist die Stelle, an der aus Prosa Daten werden – und Datenfehler
   fallen hier niemandem auf, sondern erst Wochen später beim Kochen: eine
   Menge, die um den Faktor 60 danebenliegt (Sekunden statt Minuten), eine
   Zutat, die auf die falsche zutat_id zeigt und den falschen Vorrat abbucht,
   ein optionales Fleisch, das ein veganes Rezept kippt.

   Getestet wird deshalb das Lesen und Ableiten, nicht das Schreiben: Zerlegung
   der Zutaten- und Schrittzeilen, Timer-Umrechnung, Katalog-Zuordnung, die
   abgeleiteten Tags und die Serialisierung.

   Aufruf: node tools/test-rezept-import.mjs   ·  Exit-Code 1 = mindestens ein Test rot. */

import { leseMarkdown, leseZutat, leseSchritt, timerName, baueRezept, serialisiere, naechsteId }
  from "./rezept-import.mjs";

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

const zutat = (zeile) => { const z = leseZutat(zeile, () => {}); return [z.menge, z.einheit, z.zutat_name]; };
const schritt = (zeile) => leseSchritt(zeile, 1);

/* ------------------------------------------------------------- Zutatenzeile */
beschreibe("Zutatenzeile");

pruefe("Menge, Einheit und Name werden getrennt", () => {
  gleich(zutat("200 g rote Linsen"), [200, "g", "rote Linsen"]);
});

pruefe("Plural-Einheiten zählen wie ihre Kurzform", () => {
  gleich(zutat("2 Zehen Knoblauch"), [2, "Zehe", "Knoblauch"]);
  gleich(zutat("3 Dosen Kichererbsen"), [3, "Dose", "Kichererbsen"]);
  gleich(zutat("1 Päckchen Backpulver"), [1, "Pck", "Backpulver"]);
});

pruefe("Zahl ohne Einheit ist eine Stückzahl", () => {
  gleich(zutat("2 Zwiebeln"), [2, "Stk", "Zwiebeln"]);
});

pruefe('"nach Bedarf" ist eine Einheit, keine Menge', () => {
  gleich(zutat("Salz nach Bedarf"), [null, "nach_Bedarf", "Salz"]);
});

pruefe("Zutat ohne jede Angabe wird nicht gerechnet", () => {
  gleich(zutat("Pfeffer"), [null, "nach_Bedarf", "Pfeffer"]);
});

pruefe("Brüche und Kommazahlen", () => {
  gleich(zutat("½ TL Zimt"), [0.5, "TL", "Zimt"]);
  gleich(zutat("1/2 Bund Petersilie"), [0.5, "Bund", "Petersilie"]);
  gleich(zutat("1,5 l Brühe"), [1.5, "l", "Brühe"]);
});

/* Toleranzprinzip: Eine Spanne wird nie nach oben gerundet – die untere Menge
   bucht im Zweifel zu wenig ab, und zu wenig lässt sich korrigieren. */
pruefe("Spanne nimmt die untere Menge", () => {
  gleich(zutat("2-3 EL Tomatenmark"), [2, "EL", "Tomatenmark"]);
  gleich(zutat("2–3 EL Tomatenmark"), [2, "EL", "Tomatenmark"]);
});

pruefe("optional wird erkannt und aus dem Namen entfernt", () => {
  const z = leseZutat("1 Bund Koriander (optional)", () => {});
  gleich([z.optional, z.zutat_name], [true, "Koriander"]);
});

pruefe("Packungsgröße in Klammern gehört nicht in den Namen", () => {
  gleich(zutat("1 Dose Kokosmilch (400 ml)"), [1, "Dose", "Kokosmilch"]);
});

pruefe("Klammern mit echtem Inhalt bleiben stehen", () => {
  gleich(zutat("200 g Beeren (TK oder frisch)"), [200, "g", "Beeren (TK oder frisch)"]);
});

/* ------------------------------------------------------------- Schrittzeile */
beschreibe("Schrittzeile");

pruefe("Minuten werden in Sekunden umgerechnet", () => {
  const s = schritt("Zwiebeln dünsten. (5 min, aktiv)");
  gleich([s.dauer_sekunden, s.timer_typ], [300, "aktiv"]);
});

pruefe("Sekunden und Stunden ebenso", () => {
  gleich(schritt("Kurz mitrösten. (90 s, aktiv)").dauer_sekunden, 90);
  gleich(schritt("Teig gehen lassen. (2 h, ruhen)").dauer_sekunden, 7200);
});

pruefe("Die Timer-Angabe verschwindet aus dem Text", () => {
  gleich(schritt("Zwiebeln dünsten. (5 min, aktiv)").text, "Zwiebeln dünsten.");
});

pruefe("Klammern ohne Timer-Art bleiben Text", () => {
  const s = schritt("Im Ofen backen (ca. 200 °C).");
  gleich([s.text, s.timer_typ], ["Im Ofen backen (ca. 200 °C).", null]);
});

pruefe("Temperatur wird aus dem Text gelesen", () => {
  gleich(schritt("Bei 200 °C backen. (25 min, ofen)").temperatur_c, 200);
});

pruefe("Schritt ohne Angabe bekommt keinen Timer", () => {
  const s = schritt("Mit Salz abschmecken.");
  gleich([s.dauer_sekunden, s.timer_typ, s.timer_name], [null, null, undefined]);
});

pruefe("Ein mitgegebener Timer-Name sticht die Ableitung", () => {
  const s = schritt('Linsen und Kokosmilch köcheln lassen. (20 min, passiv, "Linsen köcheln")');
  gleich([s.timer_name, !!s.name_abgeleitet], ["Linsen köcheln", false]);
});

/* Der abgeleitete Name ist Sache + Tätigkeit, wie in der Kern-DB. */
beschreibe("Timer-Name");

pruefe("Erstes Wort und Verb des ersten Teilsatzes", () => {
  gleich(timerName("Zwiebeln und Knoblauch fein würfeln und in Öl glasig dünsten"), "Zwiebeln dünsten");
  gleich(timerName("Hirse in einem Sieb heiß abspülen"), "Hirse abspülen");
});

pruefe('"lassen" benennt nichts und fällt weg', () => {
  gleich(timerName("Teig 20 Minuten ruhen lassen"), "Teig ruhen");
});

pruefe("Ein einzelnes Wort bleibt eines", () => {
  gleich(timerName("Abschmecken"), "Abschmecken");
});

/* ------------------------------------------------------------- Markdown */
beschreibe("Markdown");

const MD = `# Rotes Linsen-Dal

- **Portionen:** 4
- **Gesamtzeit:** 30 min
- **Schwierigkeit:** einfach
- **Küche:** indisch
- **Mahlzeit:** mittag | abend

## Zutaten

- 200 g rote Linsen
- 1 Dose Kokosmilch
- 2 Zwiebeln
- 1 EL Öl
- Salz nach Bedarf

## Schritte

1. Zwiebeln würfeln und dünsten. (5 min, aktiv)
2. Linsen und Kokosmilch zugeben und köcheln lassen. (20 min, passiv)
3. Abschmecken.

## Ersatz

- Kokosmilch → Sahne (Weniger süß)

## Hinweise

Rote Linsen zerfallen absichtlich.
`;

const bau = (md = MD) => baueRezept(leseMarkdown(md), {});

pruefe("Kopfdaten landen im Rezept", () => {
  const { rezept } = bau();
  gleich([rezept.name, rezept.portionen, rezept.cuisine, rezept.mahlzeitentyp],
    ["Rotes Linsen-Dal", 4, "indisch", ["mittag", "abend"]]);
});

pruefe("Zutaten werden dem Katalog zugeordnet", () => {
  const { rezept } = bau();
  gleich(rezept.zutaten.map((z) => z.zutat_id),
    ["ing_linsen_rot", "ing_kokosmilch", "ing_zwiebel", "ing_rapsoel", "ing_salz"]);
});

pruefe("Ernährungsform wird abgeleitet, nicht abgeschrieben", () => {
  gleich(bau().rezept.ernaehrungsform, ["vegan", "vegetarisch"]);
});

/* Genau das prüft der Validator später gegen dieselben Quellen: Wer die
   Deklaration von Hand tippt, vergisst sie irgendwann. */
pruefe("Allergene kommen aus den Zutaten", () => {
  const mitSoja = MD.replace("- 1 EL Öl", "- 200 g Tofu fest\n- 1 EL Öl");
  wahr(bau(mitSoja).rezept.allergene.includes("soja"), "Soja aus dem Tofu fehlt");
});

pruefe("Fleisch kippt die Ernährungsform", () => {
  const mitFleisch = MD.replace("- 2 Zwiebeln", "- 2 Zwiebeln\n- 300 g Hähnchenbrust");
  const formen = bau(mitFleisch).rezept.ernaehrungsform;
  wahr(formen.includes("mit_gefluegel") && !formen.includes("vegan"), `war ${formen.join(",")}`);
});

pruefe("Zeiten werden aus den Schritten gerechnet", () => {
  gleich(bau().rezept.gesamtzeit_min, { vorbereitung: 5, garzeit: 20, gesamt: 30 });
});

pruefe("Ersatz-Sektion wird zu substitutionen", () => {
  gleich(bau().rezept.substitutionen,
    [{ fehlt: "Kokosmilch", ersatz: "Sahne", hinweis: "Weniger süß" }]);
});

pruefe("Hinweise werden zum Hinweis am Rezept", () => {
  gleich(bau().rezept.naehrwert_einordnung.makro_hinweis, "Rote Linsen zerfallen absichtlich.");
});

pruefe("Fehlendes Nährwertprofil behauptet nichts", () => {
  const { rezept, warnungen } = bau();
  gleich(rezept.naehrwert_einordnung.profil, "ausgewogen");
  wahr(warnungen.some((w) => /Nährwertprofil/.test(w)), "keine Warnung zum Profil");
});

pruefe("Ohne Mahlzeit gibt es einen Fehler, kein Rezept", () => {
  const ohne = MD.replace("- **Mahlzeit:** mittag | abend\n", "");
  wahr(bau(ohne).fehler.some((f) => /Mahlzeit/.test(f)), "Fehler fehlt");
});

pruefe("Ohne zuordenbare Pflichtzutat gibt es einen Fehler", () => {
  const wirr = MD.replace(/- 200 g rote Linsen[\s\S]*?- Salz nach Bedarf/,
    "- 200 g Xylophonpaste\n- 1 Stk Nebelkerze");
  wahr(bau(wirr).fehler.some((f) => /Bestandsabgleich/.test(f)), "Fehler fehlt");
});

/* --------------------------------------------------------- Serialisierung */
beschreibe("Serialisierung");

pruefe("Das Literal lässt sich wieder einlesen", () => {
  const { rezept } = bau();
  rezept.id = "ALL-999";
  const zurueck = new Function(`return [${serialisiere(rezept)}][0]`)();
  gleich(zurueck.id, "ALL-999");
  gleich(zurueck.zutaten.length, rezept.zutaten.length);
  gleich(zurueck.schritte[1].dauer_sekunden, 1200);
  gleich(zurueck.gesamtzeit_min, rezept.gesamtzeit_min);
});

pruefe("Anführungszeichen im Text zerlegen das Literal nicht", () => {
  const { rezept } = bau(MD.replace("Abschmecken.", 'Mit "Salz" abschmecken \\ fertig.'));
  rezept.id = "ALL-999";
  const zurueck = new Function(`return [${serialisiere(rezept)}][0]`)();
  gleich(zurueck.schritte[2].text, 'Mit "Salz" abschmecken \\ fertig.');
});

pruefe("Optionale Zutaten behalten ihre Markierung", () => {
  const { rezept } = bau(MD.replace("- Salz nach Bedarf", "- Salz nach Bedarf (optional)"));
  rezept.id = "ALL-999";
  const zurueck = new Function(`return [${serialisiere(rezept)}][0]`)();
  gleich(zurueck.zutaten[4].optional, true);
});

pruefe("Einrückung passt zu den Blockdateien", () => {
  const { rezept } = bau();
  rezept.id = "ALL-999";
  const zeilen = serialisiere(rezept).split("\n");
  gleich([zeilen[0], zeilen[zeilen.length - 1]], ["  {", "  },"]);
  wahr(zeilen.every((z) => !/\t/.test(z)), "Tabulator im Literal");
});

/* ----------------------------------------------------------------- IDs */
beschreibe("ID-Vergabe");

pruefe("Die nächste Nummer folgt der höchsten vorhandenen", () => {
  const naechste = naechsteId('id: "ALL-007", id: "ALL-042", id: "TOF-100"', "ALL");
  gleich([naechste(1), naechste(2)], ["ALL-043", "ALL-044"]);
});

pruefe("Leerer Block fängt bei 001 an", () => {
  gleich(naechsteId("const REZEPTE_NEU = [];", "NEU")(1), "NEU-001");
});

/* ------------------------------------------------------------------ Ausgabe */
console.log(`${bestanden} Tests bestanden.`);
if (fehler.length) {
  console.log(`\n${fehler.length} Test(s) rot:`);
  for (const f of fehler) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Rezept-Import grün.");

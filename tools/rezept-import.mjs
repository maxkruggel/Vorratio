#!/usr/bin/env node
/* Vorratio Rezept-Import: Markdown aus docs/rezepte/ → Block-Datei in js/data/.

   Bis hierher war Schritt 2 aus docs/rezepte/README.md Handarbeit: Rezept lesen,
   Zutaten gegen den Katalog suchen, IDs vergeben, Allergene ableiten, Literal
   tippen. Bei ein paar Rezepten geht das, bei einer Recherche-Lieferung nicht.

   Der Import macht nur das Mechanische. Alles, was eine Behauptung wäre – ob ein
   Gericht proteinreich ist, welche Kategorie es trägt, wie eine unbekannte Zutat
   heißen soll –, wird gemeldet statt geraten. Der Trockenlauf ist die Vorgabe:
   Erst wenn der Bericht sauber aussieht, schreibt --schreiben wirklich.

   Aufruf:
     node tools/rezept-import.mjs                      Trockenlauf über docs/rezepte/*.md
     node tools/rezept-import.mjs --block=tofu         Zielblock für alle Dateien
     node tools/rezept-import.mjs --schreiben          eintragen, prüfen, MD wegräumen
     node tools/rezept-import.mjs pfad/zur/datei.md    einzelne Dateien

   Exit-Code 1 = mindestens ein Rezept ist nicht importierbar. */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { ZUTATEN, REZEPTE } from "../js/data/kerndb.js";
import { allergeneAusZutaten } from "../js/data/allergene.js";
import { tagsAusZutaten } from "../js/kochbuch.js";
import { findeZutat } from "../js/diktat.js";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const EINGANG = join(WURZEL, "docs", "rezepte");
const ERLEDIGT = join(EINGANG, "erledigt");

/* Die fünf Blockdateien. Der Kern-Block (RCP-/SNK-) fehlt bewusst: Er liegt
   inline in kerndb.js zwischen Zutaten, Preps und Techniken – da schreibt sich
   kein Werkzeug blind hinein. */
const BLOECKE = {
  alltag:      { praefix: "ALL", datei: "js/data/rezepte-alltag.js" },
  komplex:     { praefix: "KMX", datei: "js/data/rezepte-komplex.js" },
  tofu:        { praefix: "TOF", datei: "js/data/rezepte-tofu.js" },
  welt:        { praefix: "WLT", datei: "js/data/rezepte-welt.js" },
  fruehstueck: { praefix: "FRU", datei: "js/data/rezepte-fruehstueck.js" },
};

const EINHEITEN = new Set(["g", "kg", "ml", "l", "Stk", "EL", "TL", "Prise", "Bund",
  "Zehe", "Dose", "Pck", "Stange", "Rolle", "Würfel", "nach_Bedarf"]);
const SLOTS = new Set(["fruehstueck", "mittag", "abend", "snack"]);
const TIMER = new Set(["aktiv", "passiv", "ofen", "ruhen"]);
const SCHWIERIGKEIT = new Set(["einfach", "mittel", "fortgeschritten"]);
const PROFILE = new Set(["kohlenhydratreich", "proteinreich", "ballaststoffreich",
  "ausgewogen", "fettreich", "kalorienarm"]);

/* Gesprochene und geschriebene Einheiten meinen dasselbe – "2 Zehen Knoblauch"
   und "2 Zehe" sind eine Angabe. Kleingeschrieben nachgeschlagen. */
const EINHEIT_WORT = {
  g: "g", gr: "g", gramm: "g", kg: "kg", kilo: "kg", kilogramm: "kg",
  ml: "ml", l: "l", liter: "l",
  stk: "Stk", stück: "Stk", stücke: "Stk", stueck: "Stk", "stk.": "Stk",
  el: "EL", esslöffel: "EL", essloeffel: "EL", tl: "TL", teelöffel: "TL", teeloeffel: "TL",
  prise: "Prise", prisen: "Prise", bund: "Bund", zehe: "Zehe", zehen: "Zehe",
  dose: "Dose", dosen: "Dose", pck: "Pck", packung: "Pck", packungen: "Pck",
  päckchen: "Pck", paeckchen: "Pck", stange: "Stange", stangen: "Stange",
  rolle: "Rolle", rollen: "Rolle", würfel: "Würfel", wuerfel: "Würfel",
};

const BRUCH = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

/* Kategorie wird nicht erfunden: Entweder sie steht in der MD, oder sie wird an
   einem eindeutigen Merkmal abgelesen. Bleibt beides aus, gibt es eine Warnung
   statt einer Behauptung. */
const KATEGORIE_REGELN = [
  { re: /\b(suppe|eintopf|dal|ragout|topf)\b/i, kategorie: "Suppe/Eintopf" },
  { re: /\b(salat|bowl)\b/i, kategorie: "Salat" },
  { re: /\b(pasta|nudel|spaghetti|lasagne|penne|linguine)\b/i, kategorie: "Nudelgericht" },
  { re: /\b(auflauf|gratin)\b/i, kategorie: "Auflauf/Gratin" },
  { re: /\b(curry|pfanne|gebraten)\b/i, kategorie: "Pfannengericht" },
  { re: /\b(risotto|reis|pilaw|paella)\b/i, kategorie: "Reisgericht" },
  { re: /\b(wrap|burrito|taco)\b/i, kategorie: "Wrap" },
  { re: /\b(brot|brötchen|fladen|focaccia)\b/i, kategorie: "Backwaren" },
];

/* ------------------------------------------------------------- Werkzeug */
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const jsText = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function zahl(wort) {
  const w = String(wort).trim();
  if (BRUCH[w] != null) return BRUCH[w];
  const gemischt = w.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/);
  if (gemischt) return Number(gemischt[1]) + BRUCH[gemischt[2]];
  const bruch = w.match(/^(\d+)\/(\d+)$/);
  if (bruch) return Number(bruch[1]) / Number(bruch[2]);
  const n = Number(w.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* Nachkommastellen nur, wo sie etwas bedeuten – 0.5 bleibt, 2.0000001 nicht. */
const rundeMenge = (n) => (n == null ? null : Math.round(n * 100) / 100);

/* ----------------------------------------------------- Markdown zerlegen */
/* Die Vorlage aus docs/rezepte/README.md, tolerant gelesen: Reihenfolge der
   Meta-Zeilen egal, Überschriften mit oder ohne Doppelpunkt, Aufzählungszeichen
   "-" oder "*". Was nicht zu einer bekannten Sektion gehört, wird ignoriert –
   Fließtext zwischen den Blöcken ist erlaubt. */
function leseMarkdown(text) {
  const zeilen = text.split(/\r?\n/);
  const roh = { name: "", meta: {}, zutaten: [], schritte: [], ersatz: [], hinweise: [] };
  let sektion = "";

  for (const zeile of zeilen) {
    const t = zeile.trim();
    if (!t) continue;

    const h1 = t.match(/^#\s+(.*)$/);
    if (h1) { roh.name = h1[1].trim(); sektion = "kopf"; continue; }

    const h2 = t.match(/^#{2,}\s+(.*)$/);
    if (h2) {
      const titel = norm(h2[1]).replace(/:$/, "");
      if (/zutat/.test(titel)) sektion = "zutaten";
      else if (/schritt|zubereitung|anleitung/.test(titel)) sektion = "schritte";
      else if (/ersatz|substitut/.test(titel)) sektion = "ersatz";
      else if (/hinweis|notiz/.test(titel)) sektion = "hinweise";
      else sektion = "";
      continue;
    }

    /* Meta-Zeilen stehen im Kopf: "- **Portionen:** 2" */
    const meta = t.match(/^[-*]?\s*\*\*(.+?):?\*\*:?\s*(.*)$/);
    if (meta && (sektion === "kopf" || sektion === "")) {
      roh.meta[norm(meta[1]).replace(/:$/, "")] = meta[2].trim();
      continue;
    }

    const punkt = t.match(/^[-*]\s+(.*)$/);
    const nummer = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (sektion === "zutaten" && punkt) roh.zutaten.push(punkt[1].trim());
    else if (sektion === "schritte" && (nummer || punkt)) roh.schritte.push((nummer ? nummer[2] : punkt[1]).trim());
    else if (sektion === "ersatz" && punkt) roh.ersatz.push(punkt[1].trim());
    else if (sektion === "hinweise") roh.hinweise.push(t.replace(/^[-*]\s+/, ""));
  }
  return roh;
}

/* Eine Zutatenzeile: "200 g rote Linsen", "1 Dose Kokosmilch (400 ml)",
   "Salz nach Bedarf (optional)", "2 Zwiebeln". */
function leseZutat(zeile, warnung) {
  let rest = zeile;
  let optional = false;

  if (/\(\s*optional\s*\)|,\s*optional\b/i.test(rest)) {
    optional = true;
    rest = rest.replace(/\(\s*optional\s*\)|,\s*optional\b/i, " ").trim();
  }

  let menge = null;
  let einheit = null;

  if (/\bnach\s+bedarf\b/i.test(rest)) {
    einheit = "nach_Bedarf";
    rest = rest.replace(/\bnach\s+bedarf\b/i, " ").trim();
  }

  const mitZahl = rest.match(/^([\d.,/½¼¾⅓⅔⅛\s]+?)\s*(?:[–-]\s*([\d.,/½¼¾⅓⅔⅛]+))?\s+(.*)$/);
  if (mitZahl) {
    const untere = zahl(mitZahl[1]);
    if (untere != null) {
      if (mitZahl[2] != null && zahl(mitZahl[2]) != null) {
        warnung(`"${zeile}": Spanne angegeben – gebucht wird die untere Menge (${untere}).`);
      }
      menge = untere;
      rest = mitZahl[3].trim();
      const ersteWort = rest.split(/\s+/)[0];
      const treffer = EINHEIT_WORT[norm(ersteWort)];
      if (treffer) {
        einheit = treffer;
        rest = rest.slice(ersteWort.length).trim();
      } else if (!einheit) {
        einheit = "Stk";   // "2 Zwiebeln" ist eine Stückzahl
      }
    }
  }
  if (!einheit) einheit = menge == null ? "nach_Bedarf" : "Stk";

  /* Eine Klammer am Ende, die nur die Packungsgröße wiederholt ("(400 ml)"),
     gehört nicht in den Namen. Alles andere ("(TK oder frisch)") bleibt. */
  rest = rest.replace(/\s*\(\s*(?:ca\.\s*)?[\d.,]+\s*(?:g|kg|ml|l|Stk|Stück)\s*\)\s*$/i, "");
  const name = rest.replace(/^[,–-]\s*/, "").replace(/\s{2,}/g, " ").trim();

  return { menge: rundeMenge(menge), einheit, zutat_name: name, optional };
}

/* Eine Schrittzeile: "Zwiebel würfeln. (5 min, aktiv)" – die Klammer am Ende ist
   nur dann eine Timer-Angabe, wenn eine bekannte Timer-Art darin steht. Sonst
   bleibt sie Text ("(ca. 200 °C)"). */
function leseSchritt(zeile, nr) {
  let text = zeile.trim();
  let dauer = null;
  let typ = null;
  let name = null;

  const klammer = text.match(/\s*\(([^()]*)\)\s*$/);
  if (klammer) {
    const teile = klammer[1].split(",").map((s) => s.trim());
    const artIndex = teile.findIndex((s) => TIMER.has(norm(s)));
    if (artIndex >= 0) {
      typ = norm(teile[artIndex]);
      for (const teil of teile) {
        const zeit = teil.match(/^(?:ca\.\s*)?([\d.,]+)\s*(sek|sekunden|s|min|minuten|std|stunden|h)\b/i);
        if (zeit && dauer == null) {
          const wert = zahl(zeit[1]);
          const e = norm(zeit[2]);
          if (wert != null) dauer = Math.round(wert * (/^s/.test(e) ? 1 : /^(std|stunden|h)$/.test(e) ? 3600 : 60));
        }
        const zitat = teil.match(/^["„»'](.+)["“«']$/);
        if (zitat) name = zitat[1].trim();
      }
      text = text.slice(0, klammer.index).trim();
    }
  }

  const grad = text.match(/(\d{2,3})\s*°\s*C/);
  const schritt = { nr, text, dauer_sekunden: dauer, timer_typ: typ };
  if (grad) schritt.temperatur_c = Number(grad[1]);
  if (typ) {
    schritt.timer_name = name || timerName(text);
    schritt.name_abgeleitet = !name;
  }
  return schritt;
}

/* Der Timer-Name steht im Kochmodus über der Uhr – er soll benennen, worauf man
   wartet, nicht den Schritt wiederholen. Die Kern-DB macht das als Paar aus
   Sache und Tätigkeit: "Tofu wässern", "Teig quellen", "Mehl anschwitzen".
   Nachgebaut wird das aus dem ersten Teilsatz: erstes Wort + letztes Verb.
   "Zwiebeln und Knoblauch fein würfeln" → "Zwiebeln würfeln". Trifft es
   daneben, steht es im Bericht – abgeleitete Namen werden immer gemeldet. */
function timerName(text) {
  const worte = text.split(/[,.–—:;]/)[0].trim().split(/\s+/).filter(Boolean);
  if (!worte.length) return "Timer";
  // "ruhen lassen", "quellen lassen": das Hilfsverb benennt nichts.
  while (worte.length > 2 && /^(lassen|werden|ist|sind)$/i.test(worte[worte.length - 1])) worte.pop();
  const sache = worte[0].replace(/[.,;:]+$/, "");
  const tun = worte[worte.length - 1].replace(/[.,;:]+$/, "");
  const name = sache === tun ? sache : `${sache} ${tun}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/* ------------------------------------------------------- Rezept bauen */
function baueRezept(roh, opts) {
  const fehler = [];
  const warnungen = [];
  const warn = (t) => warnungen.push(t);

  if (!roh.name) fehler.push("Keine Überschrift (# Rezeptname) gefunden.");

  const meta = roh.meta;
  const hole = (...schluessel) => {
    for (const k of schluessel) if (meta[k]) return meta[k];
    return "";
  };

  const portionen = Number(String(hole("portionen")).match(/\d+/)?.[0] || 0) || 2;
  if (!hole("portionen")) warn("Portionen fehlen – 2 angenommen.");

  const gesamt = Number(String(hole("gesamtzeit", "zeit")).match(/\d+/)?.[0] || 0);

  let schwierigkeit = norm(hole("schwierigkeit")).split(/[|,/]/)[0].trim();
  if (!SCHWIERIGKEIT.has(schwierigkeit)) {
    if (schwierigkeit) warn(`Schwierigkeit "${schwierigkeit}" unbekannt – "einfach" gesetzt.`);
    else warn('Schwierigkeit fehlt – "einfach" gesetzt.');
    schwierigkeit = "einfach";
  }

  const cuisine = hole("küche", "kueche", "cuisine") || "international";
  if (!hole("küche", "kueche", "cuisine")) warn('Küche fehlt – "international" gesetzt.');

  const mahlzeitentyp = norm(hole("mahlzeit", "mahlzeitentyp", "slot"))
    .split(/[|,/]/).map((s) => s.trim())
    .map((s) => (s === "frühstück" ? "fruehstueck" : s))
    .filter((s) => SLOTS.has(s));
  if (!mahlzeitentyp.length) fehler.push("Mahlzeit fehlt oder unbekannt (fruehstueck|mittag|abend|snack).");

  /* --- Zutaten: Namen gegen den Katalog, mit derselben Funktion, die auch das
     Diktat benutzt. Die genannte Einheit schärft den Treffer (Dose → Konserve). */
  const zutaten = [];
  const abgleich = [];
  for (const zeile of roh.zutaten) {
    const z = leseZutat(zeile, warn);
    if (!z.zutat_name) { warn(`Zutatenzeile ohne Namen übersprungen: "${zeile}"`); continue; }
    if (!EINHEITEN.has(z.einheit)) { fehler.push(`Unbekannte Einheit "${z.einheit}" bei "${zeile}".`); continue; }
    const { zutat, basis } = findeZutat(z.zutat_name, z.einheit);
    const eintrag = { menge: z.menge, einheit: z.einheit, zutat_id: zutat ? zutat.id : null, zutat_name: z.zutat_name };
    if (z.optional) eintrag.optional = true;
    zutaten.push(eintrag);

    /* Die Zuordnung ist der Teil, der wirklich schiefgehen kann – ein falscher
       Treffer bucht später die falsche Zutat ab. Deshalb steht jede Zeile im
       Bericht, nicht nur die auffälligen. */
    const menge = `${z.menge == null ? "" : z.menge} ${z.einheit === "nach_Bedarf" ? "n. B." : z.einheit}`.trim();
    const ziel = zutat
      ? `${zutat.id}${norm(zutat.name) === norm(z.zutat_name) ? "" : ` (${zutat.name})`}${basis < 6 ? "  ← schwacher Treffer" : ""}`
      : "ohne zutat_id  ← nicht im Katalog, zählt nie für den Bestand";
    abgleich.push(`${menge} ${z.zutat_name}${z.optional ? " [optional]" : ""}  →  ${ziel}`);
  }
  const unbekannt = zutaten.filter((z) => !z.zutat_id).map((z) => z.zutat_name);
  if (!zutaten.length) fehler.push("Keine Zutaten gefunden.");
  if (unbekannt.length) warn(`${unbekannt.length} Zutat(en) ohne Katalogtreffer – entweder Schreibweise anpassen oder die Zutat in kerndb.js ZUTATEN aufnehmen.`);
  if (zutaten.length && !zutaten.some((z) => z.zutat_id && !z.optional)) {
    fehler.push("Keine einzige Pflichtzutat konnte zugeordnet werden – ohne zutat_id gibt es keinen Bestandsabgleich.");
  }

  /* --- Schritte */
  const schritte = roh.schritte.map((zeile, i) => leseSchritt(zeile, i + 1));
  if (!schritte.length) fehler.push("Keine Schritte gefunden.");
  for (const s of schritte) {
    if (s.timer_typ && !s.dauer_sekunden) {
      fehler.push(`Schritt ${s.nr}: Timer-Art "${s.timer_typ}" ohne Dauer.`);
    }
    if (s.name_abgeleitet) warn(`Schritt ${s.nr}: Timer-Name abgeleitet – "${s.timer_name}".`);
  }

  /* --- Zeiten: aktiv zählt als Vorbereitung, alles Wartende als Garzeit. Passt
     die Summe nicht zur angegebenen Gesamtzeit, wird das gemeldet, nicht
     stillschweigend geglättet. */
  const sek = (art) => schritte.filter((s) => art.includes(s.timer_typ)).reduce((a, s) => a + (s.dauer_sekunden || 0), 0);
  const vorbereitung = Math.round(sek(["aktiv"]) / 60);
  const garzeit = Math.round(sek(["passiv", "ofen", "ruhen"]) / 60);
  const summe = vorbereitung + garzeit;
  const gesamtzeit = gesamt || summe;
  if (!gesamtzeit) fehler.push("Gesamtzeit fehlt und lässt sich aus den Schritten nicht berechnen.");
  if (gesamt && summe > gesamt) warn(`Schritt-Summe (${summe} min) liegt über der angegebenen Gesamtzeit (${gesamt} min).`);

  /* --- Ernährungsform und Allergene werden abgeleitet, nicht übernommen. Genau
     das prüft der Validator später gegen dieselben Quellen. */
  const abgeleitet = tagsAusZutaten(zutaten.filter((z) => !z.optional));
  const ausIds = allergeneAusZutaten({ zutaten });
  const allergene = [...new Set([...abgeleitet.allergene, ...ausIds,
    ...norm(hole("allergene")).split(/[|,/]/).map((s) => s.trim()).filter(Boolean)])].sort();

  let profil = norm(hole("nährwert", "naehrwert", "nährwertprofil", "profil")) || opts.nw || "";
  if (!PROFILE.has(profil)) {
    if (profil) warn(`Nährwertprofil "${profil}" unbekannt – "ausgewogen" gesetzt.`);
    else warn('Nährwertprofil fehlt – "ausgewogen" gesetzt (neutral, keine Aussage). Besser: **Nährwert:** im Markdown.');
    profil = "ausgewogen";
  }

  let kategorie = hole("kategorie");
  if (!kategorie) {
    const heuHeu = `${roh.name} ${zutaten.map((z) => z.zutat_name).join(" ")}`;
    kategorie = KATEGORIE_REGELN.find((r) => r.re.test(heuHeu))?.kategorie
      || (mahlzeitentyp.length === 1 && mahlzeitentyp[0] === "fruehstueck" ? "Frühstück" : "")
      || (mahlzeitentyp.length === 1 && mahlzeitentyp[0] === "snack" ? "Snack" : "")
      || (schritte.some((s) => s.timer_typ === "ofen") ? "Ofengericht" : "")
      || "Hauptgericht";
    warn(`Kategorie abgeleitet: "${kategorie}".`);
  }

  const tags = norm(hole("tags")).split(/[|,/]/).map((s) => s.trim()).filter(Boolean);

  const substitutionen = roh.ersatz.map((zeile) => {
    const teile = zeile.split(/\s*(?:→|->|:)\s*/);
    if (teile.length < 2) { warn(`Ersatz-Zeile nicht lesbar: "${zeile}"`); return null; }
    const hinweisTeil = teile[1].match(/^(.*?)\s*\((.+)\)\s*$/);
    return {
      fehlt: teile[0].trim(),
      ersatz: (hinweisTeil ? hinweisTeil[1] : teile[1]).trim(),
      hinweis: hinweisTeil ? hinweisTeil[2].trim() : "",
    };
  }).filter(Boolean);

  const rezept = {
    id: "",   // wird beim Einfügen vergeben
    name: roh.name,
    typ: "rezept",
    kategorie,
    cuisine,
    mahlzeitentyp,
    portionen,
    schwierigkeit,
    zutaten,
    schritte,
    gesamtzeit_min: { vorbereitung, garzeit, gesamt: gesamtzeit },
    ernaehrungsform: abgeleitet.ernaehrungsform,
    allergene,
    naehrwert_einordnung: {
      kcal_pro_portion: null,
      profil,
      makro_hinweis: hole("makro-hinweis", "makro") || roh.hinweise.join(" ").trim() || "",
    },
    substitutionen,
    tags,
    quelle_typ: hole("quelle", "quelle_typ") || "etablierte_kochseite",
  };

  return { rezept, fehler, warnungen, abgleich };
}

/* ------------------------------------------------------ Serialisierung */
/* Die Blockdateien sind von Hand geschrieben und werden von Hand gelesen. Was
   hier herauskommt, muss dazwischen passen – gleiche Einrückung, gleiche
   Zeilenaufteilung, keine JSON-Anführungszeichen um Schlüssel. */
function serialisiere(r) {
  const zeilen = [];
  const feld = (k, v) => `${k}: ${v}`;
  const liste = (arr) => `[${arr.map(jsText).join(", ")}]`;

  zeilen.push("  {");
  zeilen.push(`    id: ${jsText(r.id)}, name: ${jsText(r.name)}, typ: ${jsText(r.typ)}, kategorie: ${jsText(r.kategorie)},`);
  zeilen.push(`    cuisine: ${jsText(r.cuisine)}, mahlzeitentyp: ${liste(r.mahlzeitentyp)}, portionen: ${r.portionen}, schwierigkeit: ${jsText(r.schwierigkeit)},`);

  zeilen.push("    zutaten: [");
  for (const z of r.zutaten) {
    const teile = [
      feld("menge", z.menge == null ? "null" : z.menge),
      feld("einheit", jsText(z.einheit)),
      feld("zutat_id", z.zutat_id ? jsText(z.zutat_id) : "null"),
      feld("zutat_name", jsText(z.zutat_name)),
    ];
    if (z.optional) teile.push("optional: true");
    zeilen.push(`      { ${teile.join(", ")} },`);
  }
  zeilen.push("    ],");

  zeilen.push("    schritte: [");
  for (const s of r.schritte) {
    const teile = [feld("nr", s.nr), feld("text", jsText(s.text)),
      feld("dauer_sekunden", s.dauer_sekunden == null ? "null" : s.dauer_sekunden)];
    if (s.temperatur_c) teile.push(feld("temperatur_c", s.temperatur_c));
    teile.push(feld("timer_typ", s.timer_typ ? jsText(s.timer_typ) : "null"));
    if (s.timer_name) teile.push(feld("timer_name", jsText(s.timer_name)));
    zeilen.push(`      { ${teile.join(", ")} },`);
  }
  zeilen.push("    ],");

  const g = r.gesamtzeit_min;
  zeilen.push(`    gesamtzeit_min: { vorbereitung: ${g.vorbereitung}, garzeit: ${g.garzeit}, gesamt: ${g.gesamt} },`);
  zeilen.push(`    ernaehrungsform: ${liste(r.ernaehrungsform)}, allergene: ${liste(r.allergene)},`);
  const n = r.naehrwert_einordnung;
  zeilen.push(`    naehrwert_einordnung: { kcal_pro_portion: null, profil: ${jsText(n.profil)}, makro_hinweis: ${jsText(n.makro_hinweis)} },`);
  if (r.substitutionen.length) {
    zeilen.push("    substitutionen: [");
    for (const s of r.substitutionen) {
      zeilen.push(`      { fehlt: ${jsText(s.fehlt)}, ersatz: ${jsText(s.ersatz)}, hinweis: ${jsText(s.hinweis)} },`);
    }
    zeilen.push("    ],");
  }
  zeilen.push(`    tags: ${liste(r.tags)}, quelle_typ: ${jsText(r.quelle_typ)},`);
  zeilen.push("  },");
  return zeilen.join("\n");
}

/* Nächste freie Nummer im Block – gelesen wird die Datei, nicht der Import:
   Wer zwischendurch von Hand eingetragen hat, soll nicht überschrieben werden. */
function naechsteId(text, praefix) {
  let max = 0;
  for (const m of text.matchAll(new RegExp(`id:\\s*"${praefix}-(\\d+)"`, "g"))) {
    max = Math.max(max, Number(m[1]));
  }
  return (nr) => `${praefix}-${String(max + nr).padStart(3, "0")}`;
}

function fuegeEin(dateiPfad, literale) {
  const text = readFileSync(dateiPfad, "utf8");
  const marker = text.lastIndexOf("\n];");
  if (marker < 0) throw new Error(`Ende des Rezept-Arrays in ${dateiPfad} nicht gefunden.`);
  const neu = `${text.slice(0, marker + 1)}${literale.join("\n")}\n${text.slice(marker + 1)}`;
  writeFileSync(dateiPfad, neu);
}

/* ----------------------------------------------------------------- CLI */
/* Nur beim direkten Aufruf. tools/test-rezept-import.mjs importiert dieselbe
   Datei und testet die Funktionen oben – ohne dass dabei etwas geschrieben
   wird oder ein Trockenlauf über docs/rezepte/ läuft. */
export { leseMarkdown, leseZutat, leseSchritt, timerName, baueRezept, serialisiere, naechsteId, BLOECKE };

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) hauptlauf();

function hauptlauf() {
  const argv = process.argv.slice(2);
  const schreiben = argv.includes("--schreiben");
  const blockFlag = argv.find((a) => a.startsWith("--block="))?.split("=")[1];
  const nwFlag = argv.find((a) => a.startsWith("--nw="))?.split("=")[1];
  const dateien = argv.filter((a) => !a.startsWith("--"));

  if (blockFlag && !BLOECKE[blockFlag]) {
    console.log(`Unbekannter Block "${blockFlag}". Möglich: ${Object.keys(BLOECKE).join(", ")}`);
    process.exit(1);
  }

  const quellen = dateien.length
    ? dateien
    : (existsSync(EINGANG) ? readdirSync(EINGANG).filter((f) => f.endsWith(".md") && f !== "README.md").map((f) => join(EINGANG, f)) : []);

  if (!quellen.length) {
    console.log("Keine Rezept-Markdowns gefunden (docs/rezepte/*.md).");
    process.exit(0);
  }

  const vorhandeneNamen = new Set(REZEPTE.map((r) => norm(r.name)));
  const proBlock = new Map();     // block → [{ rezept, quelle }]
  let fehlerhaft = 0;

  console.log(`${quellen.length} Datei(en) gelesen${schreiben ? "" : " – Trockenlauf, es wird nichts geschrieben"}.\n`);

  for (const pfad of quellen) {
    const roh = leseMarkdown(readFileSync(pfad, "utf8"));
    const { rezept, fehler, warnungen, abgleich } = baueRezept(roh, { nw: nwFlag });

    const block = norm(roh.meta.block) || blockFlag
      || (rezept.mahlzeitentyp.length === 1 && rezept.mahlzeitentyp[0] === "fruehstueck" ? "fruehstueck" : "alltag");
    if (!BLOECKE[block]) fehler.push(`Unbekannter Block "${block}" (möglich: ${Object.keys(BLOECKE).join(", ")}).`);
    if (vorhandeneNamen.has(norm(rezept.name))) fehler.push(`"${rezept.name}" steht schon in der Datenbank.`);

    console.log(`${basename(pfad)}  →  ${rezept.name || "(ohne Namen)"}`);
    if (BLOECKE[block]) {
      console.log(`  Block ${block} (${BLOECKE[block].praefix}-) · ${rezept.mahlzeitentyp.join("/")} · ${rezept.zutaten.length} Zutaten, ${rezept.schritte.length} Schritte, ${rezept.gesamtzeit_min.gesamt} min`);
      console.log(`  Abgeleitet: ${rezept.ernaehrungsform.join(", ")} · Allergene: ${rezept.allergene.join(", ") || "keine"}`);
      for (const a of abgleich) console.log(`    ${a}`);
    }
    for (const w of warnungen) console.log(`  ! ${w}`);
    for (const f of fehler) console.log(`  ✗ ${f}`);

    if (fehler.length) { fehlerhaft++; console.log(""); continue; }
    vorhandeneNamen.add(norm(rezept.name));
    if (!proBlock.has(block)) proBlock.set(block, []);
    proBlock.get(block).push({ rezept, quelle: pfad });
    console.log("");
  }

  const importierbar = [...proBlock.values()].reduce((a, l) => a + l.length, 0);
  console.log(`${importierbar} importierbar, ${fehlerhaft} mit Fehlern.`);

  if (!schreiben) {
    if (importierbar) console.log("Mit --schreiben eintragen (danach läuft der Validator automatisch).");
    process.exit(fehlerhaft ? 1 : 0);
  }

  if (!importierbar) process.exit(fehlerhaft ? 1 : 0);

  /* Schreiben, prüfen, wegräumen – in dieser Reihenfolge. Die Markdowns wandern
     erst nach erledigt/, wenn der Validator grün ist; bei Rot bleiben sie liegen,
     damit man den Block per git checkout verwerfen und neu ansetzen kann. */
  const geschrieben = [];
  for (const [block, eintraege] of proBlock) {
    const pfad = join(WURZEL, BLOECKE[block].datei);
    const naechste = naechsteId(readFileSync(pfad, "utf8"), BLOECKE[block].praefix);
    const literale = eintraege.map((e, i) => {
      e.rezept.id = naechste(i + 1);
      return serialisiere(e.rezept);
    });
    fuegeEin(pfad, literale);
    console.log(`\n${BLOECKE[block].datei}: ${eintraege.map((e) => e.rezept.id).join(", ")}`);
    geschrieben.push(...eintraege);
  }

  console.log("\nValidator:");
  try {
    console.log(execFileSync("node", [join(WURZEL, "tools", "validate-db.mjs")], { encoding: "utf8" }));
  } catch (e) {
    console.log(e.stdout || String(e));
    console.log("Validator rot – die Markdowns bleiben liegen. Block prüfen oder mit git checkout verwerfen.");
    process.exit(1);
  }

  mkdirSync(ERLEDIGT, { recursive: true });
  for (const e of geschrieben) {
    if (dirname(e.quelle) !== EINGANG) continue;   // fremde Pfade nicht verschieben
    renameSync(e.quelle, join(ERLEDIGT, basename(e.quelle)));
  }
  console.log(`${geschrieben.length} Markdown(s) nach docs/rezepte/erledigt/ verschoben.`);
  if (fehlerhaft) process.exit(1);
}

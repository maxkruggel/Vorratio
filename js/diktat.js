/* Vorratio Diktat (Doku Kap. 9, Ausbaustufe 4): Vorräte aufzählen statt
   antippen. Zwei Teile, bewusst getrennt:

   1. Aufnahme – die Web-Speech-API des Browsers (bei iOS läuft die Erkennung
      über Apple, bei Chrome über Google; nichts davon geht an Vorratio).
      Wo es sie nicht gibt, bleibt das Textfeld: Die Mikrofontaste der
      iOS-Tastatur diktiert genauso hinein.
   2. Auswertung – `parseDiktat()` liest den Text ohne Netz und ohne Key.
      Gesprochene Sprache ist ungenau, darum endet der Ablauf immer in einer
      Bestätigungsliste: Vorratio rät, der Mensch nickt ab.

   Toleranzprinzip (Kap. 5): "halb voll" ist eine gültige Antwort und wird als
   Anteil geführt, nicht in Scheingramm umgerechnet. */

import { ZUTATEN } from "./data/kerndb.js";

/* ------------------------------------------------------------- Aufnahme */
const SpeechRec = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

function diktatVerfuegbar() { return !!SpeechRec; }

const FEHLERTEXT = {
  "not-allowed": "Kein Zugriff aufs Mikrofon. Erlaub ihn in den Einstellungen – oder tipp den Text unten ein.",
  "service-not-allowed": "Die Spracherkennung ist auf diesem Gerät gesperrt. Tipp den Text unten ein.",
  "audio-capture": "Kein Mikrofon gefunden.",
  network: "Die Spracherkennung des Browsers braucht Netz. Ohne Verbindung tipp den Text ein.",
};

/* Startet die Aufnahme. `onText(fertig, zwischen)` läuft bei jedem Zwischen-
   ergebnis – der Aufrufer schreibt es direkt ins DOM, ohne Neuzeichnen.
   Rückgabe: { stop() } – stoppt und liefert das Ergebnis über onEnde. */
function starteDiktat({ onText, onFehler, onEnde }) {
  const rec = new SpeechRec();
  rec.lang = "de-DE";
  rec.continuous = true;
  rec.interimResults = true;

  let fertig = "";
  let gestoppt = false;
  let neustarts = 0;

  rec.onresult = (e) => {
    let zwischen = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const stueck = e.results[i][0].transcript.trim();
      if (e.results[i].isFinal) { if (stueck) fertig += (fertig ? " " : "") + stueck; }
      else zwischen += stueck + " ";
    }
    onText(fertig, zwischen.trim());
  };

  rec.onerror = (e) => {
    // Safari meldet jede Sprechpause als "no-speech" und jeden Stopp als
    // "aborted" – beides ist kein Fehler, sondern der Normalfall.
    if (e.error === "no-speech" || e.error === "aborted") return;
    gestoppt = true;
    onFehler(FEHLERTEXT[e.error] || "Die Spracherkennung hat abgebrochen.");
  };

  /* Safari beendet die Erkennung nach jeder längeren Pause von allein.
     Solange niemand gestoppt hat, wird weitergehört – sonst bricht das
     Diktat mitten im Aufzählen ab. Der Zähler ist die Notbremse gegen eine
     Endlosschleife, wenn der Neustart selbst scheitert. */
  rec.onend = () => {
    if (gestoppt || neustarts >= 60) { onEnde(fertig); return; }
    neustarts++;
    setTimeout(() => {
      if (gestoppt) { onEnde(fertig); return; }
      try { rec.start(); } catch { onEnde(fertig); }
    }, 250);
  };

  try {
    rec.start();
  } catch {
    gestoppt = true;
    onFehler("Die Spracherkennung ließ sich nicht starten.");
  }

  return {
    stop() {
      if (gestoppt) return;
      gestoppt = true;
      try { rec.stop(); } catch { onEnde(fertig); }
    },
  };
}

/* ---------------------------------------------------------- Wortmaterial */
const ZAHLWORT = {
  null: 0, kein: 0, keine: 0, keinen: 0,
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1,
  zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
  zehn: 10, elf: 11, zwoelf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15,
  sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20,
  dreissig: 30, vierzig: 40, fuenfzig: 50, hundert: 100, dutzend: 12,
  halb: 0.5, halbe: 0.5, halben: 0.5, halber: 0.5, halbes: 0.5,
  anderthalb: 1.5, eineinhalb: 1.5, zweieinhalb: 2.5, dreieinhalb: 3.5,
  // Mal-Wörter sind gesprochene Stückzahlen: "einmal Haferdrink",
  // "zweimal 700 ml passierte Tomaten".
  einmal: 1, zweimal: 2, dreimal: 3, viermal: 4, fuenfmal: 5,
  sechsmal: 6, siebenmal: 7, achtmal: 8, neunmal: 9, zehnmal: 10,
};

/* Halbe Sachen sind zweideutig – siehe gruppenAusZeile(). */
const HALB_WORT = new Set(["halb", "halbe", "halben", "halber", "halbes"]);

/* Einheiten, wie sie gesprochen werden. Reihenfolge zählt: längere Wörter
   zuerst, sonst schluckt "g" das "gramm". */
const EINHEIT_WORT = [
  [["kilogramm", "kilo", "kg"], "kg"],
  [["milliliter", "ml"], "ml"],
  [["gramm", "gr", "g"], "g"],
  [["liter", "ltr", "l"], "l"],
  [["dosen", "dose", "buechsen", "buechse"], "Dose"],
  [["packungen", "packung", "paeckchen", "pakete", "paket", "pack", "pck", "tueten", "tuete", "beutel"], "Pck"],
  [["glaeser", "glas"], "Glas"],
  [["becher"], "Becher"],
  [["flaschen", "flasche"], "Flasche"],
  [["bund", "buendel"], "Bund"],
  [["zehen", "zehe"], "Zehe"],
  [["stangen", "stange"], "Stange"],
  [["scheiben", "scheibe"], "Scheibe"],
  [["rollen", "rolle"], "Rolle"],
  [["stueck", "stk", "stueckchen"], "Stk"],
];
const EINHEIT_INDEX = {};
for (const [woerter, einheit] of EINHEIT_WORT) for (const w of woerter) EINHEIT_INDEX[w] = einheit;

/* Anteilsangaben – die ehrlichste Auskunft am Küchenschrank. Vom Genauen zum
   Groben geprüft: "halb voll" ist halb voll, nicht voll. */
const ANTEIL_MUSTER = [
  [/\b(dreiviertel|drei viertel|fast voll)\b/, 0.75],
  [/\b(halb voll|halb leer|halbe packung|zur haelfte|noch die haelfte|haelfte|halb)\b/, 0.5],
  [/\b(fast leer|kaum noch|ein rest|nur noch ein rest|neige|kleiner rest|rest)\b/, 0.15],
  [/\b(ein viertel|viertel|nur noch wenig)\b/, 0.25],
  [/\b(ungeoeffnet|ungebraucht|randvoll|voll)\b/, 1],
];

const LEER_MUSTER = /\b(leer|aufgebraucht|alle|ausgegangen|nichts mehr|keine mehr|kein mehr|nix mehr|fehlt|brauche ich|muss ich kaufen)\b/;

/* Zustandswörter gehören zur Aussage, nicht zum Artikelnamen – ohne sie
   heraus zu filtern sucht der Katalog nach "Nudeln alle". */
const ZUSTAND_WORT = new Set([
  "leer", "aufgebraucht", "alle", "ausgegangen", "nichts", "nix", "mehr", "fehlt",
  "fehlen", "brauche", "brauch", "kaufen", "muss", "voll", "randvoll", "ungeoeffnet",
  "ungebraucht", "halb", "halbe", "halben", "halber", "halbes", "haelfte", "viertel",
  "dreiviertel", "rest", "neige", "kaum", "fast", "uebrig", "noch", "da", "vorhanden",
  "vorraetig", "genug", "reichlich",
]);

/* Füllwörter, die nach dem Zerlegen keinen Artikelnamen ergeben. */
const FUELLWORT = new Set([
  "ich", "hab", "habe", "haben", "wir", "mir", "noch", "nur", "auch", "und", "dann",
  "ausserdem", "sowie", "da", "ist", "sind", "war", "waren", "es", "gibt", "liegt",
  "liegen", "steht", "stehen", "im", "in", "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines", "so", "etwa", "ungefaehr", "circa",
  "ca", "vielleicht", "glaube", "glaub", "denke", "denk", "mal", "schon", "ja", "nein",
  "von", "vom", "aber", "sehr", "ganz", "ziemlich", "richtig", "echt", "halt", "eben",
  "schrank", "kuehlschrank", "regal", "vorrat", "vorratio", "zuhause", "hause", "haus",
  // Was beim freien Sprechen mitkommt und in keiner Liste steht
  "also", "aehm", "aeh", "hm", "hmm", "oehm", "genau", "moment", "warte", "sekunde",
  "nen", "ne", "nem", "bisschen", "wenig", "viel", "paar", "ungefaehre", "grosse",
  "grosser", "grosses", "kleine", "kleiner", "kleines", "angebrochen", "angebrochene",
  "angebrochenes", "offene", "offenes", "neue", "neues", "neuer",
]);

/* Häufig gesprochene Kurzformen → Zutat der Kern-DB. Nur da nötig, wo das
   Wortmatching danebenläge: "Mehl" steckt in "Weizenmehl Type 405" drin,
   "Nudeln" gibt es dreimal. Der Treffer ist ein Bonus, kein Machtwort –
   eine genannte Einheit ("eine Dose Kichererbsen") sticht ihn aus. */
const ALIAS = {
  mehl: "ing_mehl_405", weizenmehl: "ing_mehl_405", reis: "ing_reis_weiss",
  nudeln: "ing_nudeln", pasta: "ing_nudeln", spaghetti: "ing_nudeln",
  milch: "ing_milch", hafermilch: "ing_haferdrink", oel: "ing_rapsoel",
  ei: "ing_ei", eier: "ing_ei", zwiebel: "ing_zwiebel", zwiebeln: "ing_zwiebel",
  kartoffeln: "ing_kartoffel", kartoffel: "ing_kartoffel", tomaten: "ing_tomate_frisch",
  tomate: "ing_tomate_frisch", linsen: "ing_linsen_rot", kichererbsen: "ing_kichererbsen_dose",
  bohnen: "ing_kidneybohnen_dose", mais: "ing_mais_dose", salz: "ing_salz",
  pfeffer: "ing_pfeffer", zucker: "ing_zucker", butter: "ing_butter",
  haferflocken: "ing_haferflocken", kaffee: "ing_kaffee", brot: "ing_brot",
  moehren: "ing_moehre", karotten: "ing_moehre", knoblauch: "ing_knoblauch",
  spinat: "ing_spinat", quark: "ing_quark", joghurt: "ing_joghurt_natur",
  kaese: "ing_schnittkaese", sahne: "ing_sahne", tofu: "ing_tofu_natur",
};

/* ------------------------------------------------------- Normalisierung */
function normText(s) {
  return String(s ?? "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9,.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Grober deutscher Wortstamm: Plural- und Beugungsendungen weg, damit
   "Zwiebeln" und "Zwiebel" dasselbe Wort sind. */
function stamm(w) {
  for (const endung of ["nen", "en", "er", "es", "n", "e", "s"]) {
    if (w.length - endung.length >= 4 && w.endsWith(endung)) return w.slice(0, -endung.length);
  }
  return w;
}

const wortliste = (s) => normText(s).split(/[^a-z0-9]+/).filter(Boolean);

/* Katalog einmal vorzerlegen – das Matching läuft je Diktatzeile darüber. */
const zerlege = (zutat) => ({ zutat, woerter: wortliste(zutat.name).filter((w) => w.length > 1) });
const KATALOG = ZUTATEN.map(zerlege);
const KATALOG_IDS = new Set(ZUTATEN.map((z) => z.id));

/* Der Zutatenkatalog ist ein Startpunkt, kein Käfig (siehe Freitext-Anlage im
   Vorrat). Beim Erkennen zählt darum mit, was der Haushalt selbst angelegt hat:
   Wer "Backoblaten" einmal aufgenommen hat, bekommt sie beim nächsten Diktat
   wiedererkannt – und sie trennen sich dann auch sauber von ihren Nachbarn,
   statt mit ihnen zu einem Eintrag zu verschmelzen. So wächst der Wortschatz
   mit dem Vorrat, ohne dass jemand eine Liste pflegen muss. */
function eigeneKandidaten(bestand) {
  const gesehen = new Set();
  const liste = [];
  for (const b of bestand) {
    if (!b?.zutat_id || !b.name || KATALOG_IDS.has(b.zutat_id) || gesehen.has(b.zutat_id)) continue;
    gesehen.add(b.zutat_id);
    liste.push(zerlege({ id: b.zutat_id, name: b.name, einheit: b.einheit, art: b.art, eigen: true }));
  }
  return liste;
}

/* Einheiten-Familie: nur echte Mengen-Einheiten dürfen einen Kandidaten
   ausschließen. "Glas", "Packung", "Becher" sagen nichts über die Führungsart
   und bleiben darum wertungsfrei. Gramm und Milliliter sind EINE Familie:
   "700 ml passierte Tomaten" meint dieselbe Zutat, auch wenn der Katalog sie
   in g führt – ml ≈ g liegt im Toleranzband (Kap. 5). */
const FAMILIE = { g: "schuett", kg: "schuett", ml: "schuett", l: "schuett", Stk: "Stk", Dose: "Dose", Zehe: "Zehe", Bund: "Bund", Stange: "Stange", Rolle: "Rolle" };

/* Wie gut deckt ein einzelnes gesprochenes Wort einen Kandidatennamen? */
function punkteFuerWort(w, st, kandidatWoerter) {
  let bester = 0;
  for (const kw of kandidatWoerter) {
    let p = 0;
    if (kw === w) p = 6;
    else if (stamm(kw) === st) p = 5;
    else if (w.length >= 4 && kw.includes(w)) p = 3;      // "mehl" in "weizenmehl"
    else if (kw.length >= 4 && w.includes(kw)) p = 3;
    else if (w.length >= 3 && kw.startsWith(w)) p = 2;
    if (p > bester) bester = p;
  }
  return bester;
}

/* Bester Treffer für einen gesprochenen Namen.
   `einheit` schärft die Auswahl ("zwei Dosen Tomaten" ≠ "zwei Tomaten"),
   `bekannt` bevorzugt, was schon im Vorrat liegt, `kandidaten` enthält neben
   dem Katalog auch die eigenen Artikel des Haushalts. */
function findeZutat(name, einheit, bekannt = new Set(), kandidaten = KATALOG) {
  const worte = wortliste(name).filter((w) => w.length > 1);
  if (!worte.length) return { zutat: null, punkte: 0 };
  const staemme = worte.map(stamm);
  const gesprocheneFamilie = FAMILIE[einheit] || null;

  let best = null;
  let bestPunkte = 0;
  let bestBasis = 0;      // Wortpunkte ohne Boni – sie entscheiden über "sicher"
  let bestWoerter = [];
  for (const eintrag of kandidaten) {
    let punkte = 0;
    for (let i = 0; i < worte.length; i++) punkte += punkteFuerWort(worte[i], staemme[i], eintrag.woerter);
    /* Der Alias entscheidet nur die nackte Kurzform ("Tomaten"). Sagt jemand
       mehr ("passierte Tomaten"), zählt allein, was wirklich dasteht. Er trägt
       auch allein: "Hafermilch" und "Haferdrink" haben kein Wort gemeinsam. */
    const aliasTreffer = worte.length === 1 && ALIAS[worte[0]] === eintrag.zutat.id;
    if (!punkte && !aliasTreffer) continue;
    const basis = aliasTreffer ? Math.max(punkte, 6) : punkte;
    if (aliasTreffer) punkte += 6;
    if (gesprocheneFamilie) {
      const kandidatFamilie = FAMILIE[eintrag.zutat.einheit] || null;
      if (kandidatFamilie === gesprocheneFamilie) punkte += 8;
      else if (kandidatFamilie) punkte -= 6;
    }
    if (bekannt.has(eintrag.zutat.id)) punkte += 2;
    // Gleichstand: der knappere Name ist der allgemeinere ("Nudeln" vor "Reisnudeln")
    if (punkte > bestPunkte || (punkte === bestPunkte && best && eintrag.zutat.name.length < best.name.length)) {
      bestPunkte = punkte;
      bestBasis = basis;
      best = eintrag.zutat;
      bestWoerter = eintrag.woerter;
    }
  }
  if (bestPunkte < 3) return { zutat: null, punkte: 0, basis: 0, woerter: [] };
  return { zutat: best, punkte: bestPunkte, basis: bestBasis, woerter: bestWoerter };
}

/* ------------------------------------------------------------- Zerlegung */
/* Manche Produktnamen tragen ihr "und" im Namen: "Erbsen und Möhren" ist die
   Dosen-Mischung, kein Aufzählungs-und. Geschützt wird nur, was so im Katalog
   oder im eigenen Bestand steht – jedes andere "und" trennt weiterhin. */
function undKomposita(kandidaten) {
  const paare = [];
  for (const k of kandidaten) {
    const undPos = k.woerter.indexOf("und");
    if (undPos > 0 && undPos < k.woerter.length - 1) {
      paare.push([stamm(k.woerter[undPos - 1]), stamm(k.woerter[undPos + 1])]);
    }
  }
  return paare;
}

function schuetzeKomposita(text, paare) {
  if (!paare.length) return text;
  return String(text ?? "").replace(/([\p{L}\p{N}-]+)(\s+)und(\s+)([\p{L}\p{N}-]+)/giu, (treffer, vor, w1, w2, nach) => {
    const links = stamm(normText(vor));
    const rechts = stamm(normText(nach));
    return paare.some(([a, b]) => a === links && b === rechts) ? `${vor}${w1}⁊${w2}${nach}` : treffer;
  });
}

/* Ein Diktat ist eine Aufzählung. Getrennt wird an dem, was Menschen beim
   Aufzählen sagen – Komma, Punkt, "und", "dann", "außerdem". Zahlen mit
   Dezimalkomma werden vorher geschützt, sonst zerfällt "1,5 kg"; geschützte
   Komposita-"und" (⁊) kommen nach dem Trennen zurück. */
function segmente(text, komposita = []) {
  const roh = schuetzeKomposita(String(text ?? ""), komposita)
    .replace(/(\d)[,.](\d)/g, "$1·$2")
    .split(/[,.;\n!?]+|\bund\b|\bdann\b|\bau(?:ß|ss)erdem\b|\bsowie\b|\bplus\b/i);
  return roh.map((s) => s.replace(/·/g, ",").replace(/⁊/g, "und").trim()).filter((s) => s.length > 1);
}

/* Wortpaare: normalisiert für die Logik, im Original für die Anzeige. Beides
   muss Wort für Wort zusammenpassen – der Nutzer soll unter dem erkannten
   Artikel das lesen, was er gesagt hat, nicht "kaese". */
function wortPaare(zeile) {
  // "500g" → "500 g", damit die Einheit ein eigenes Wort ist
  const vorbereitet = String(zeile ?? "").replace(/(\d)\s*(kg|g|ml|l|stk)\b/gi, "$1 $2 ");
  return vorbereitet.split(/\s+/)
    .map((roh) => ({
      roh: roh.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
      norm: normText(roh).replace(/^[.,;:!?-]+|[.,;:!?-]+$/g, ""),
    }))
    .filter((p) => p.roh && p.norm);
}

/* Ein Abschnitt kann mehrere Artikel enthalten – gesprochene Aufzählungen
   kommen oft ohne Satzzeichen an ("zwei Kilo Mehl eine Dose Mais"). Jede
   genannte Menge beginnt darum einen neuen Artikel. Der `kopf` merkt sich die
   dabei verbrauchten Wörter, damit unter dem Eintrag später wieder steht, was
   gesagt wurde. */
function gruppenAusZeile(zeile) {
  const worte = wortPaare(zeile);
  const gruppen = [];
  let akt = { menge: null, einheit: null, kopf: [], worte: [] };

  const abschliessen = () => {
    if (akt.menge != null || akt.einheit || akt.worte.length) gruppen.push(akt);
    akt = { menge: null, einheit: null, kopf: [], worte: [] };
  };

  for (let i = 0; i < worte.length; i++) {
    const w = worte[i].norm;
    /* "halb" ist beides: Menge in "ein halbes Kilo Mehl", Füllstand in
       "Mehl ist halb voll". Die Einheit dahinter entscheidet. */
    if (HALB_WORT.has(w)) {
      const folgt = worte[i + 1];
      if (folgt && EINHEIT_INDEX[folgt.norm]) {
        akt.menge = 0.5;
        akt.einheit = EINHEIT_INDEX[folgt.norm];
        akt.kopf.push(worte[i].roh, folgt.roh);
        i++;
      } else {
        akt.worte.push(worte[i]);
      }
      continue;
    }
    const alsZahl = /^\d+(?:[,.]\d+)?$/.test(w) ? Number(w.replace(",", ".")) : ZAHLWORT[w];
    if (alsZahl != null) {
      if (akt.worte.length) abschliessen();     // der vorige Artikel ist fertig
      if (akt.menge == null) {
        akt.menge = alsZahl;
        akt.kopf.push(worte[i].roh);
        const naechstes = worte[i + 1];
        if (naechstes && EINHEIT_INDEX[naechstes.norm]) {
          akt.einheit = EINHEIT_INDEX[naechstes.norm];
          akt.kopf.push(naechstes.roh);
          i++;
        }
        continue;
      }
      /* Zwei Mengen direkt hintereinander ("zweimal 700 ml Passata"):
         Stückzahl × Packungsgröße ist EINE Angabe, kein neuer Artikel. */
      const groesse = worte[i + 1];
      if (groesse && EINHEIT_INDEX[groesse.norm]) {
        akt.menge *= alsZahl;
        akt.einheit = EINHEIT_INDEX[groesse.norm];
        akt.kopf.push(worte[i].roh, groesse.roh);
        i++;
        continue;
      }
    }
    // Einheit ohne davorstehende Zahl ("Dose Mais") zählt als eine Einheit
    if (EINHEIT_INDEX[w]) {
      if (akt.einheit && akt.worte.length) abschliessen();
      if (!akt.einheit) {
        akt.einheit = EINHEIT_INDEX[w];
        if (akt.menge == null) akt.menge = 1;
        akt.kopf.push(worte[i].roh);
        continue;
      }
    }
    akt.worte.push(worte[i]);
  }
  abschliessen();
  return gruppen.filter((g) => g.worte.length);
}

/* Mehrere Artikel in einer Gruppe.

   Die iOS-Erkennung liefert "Salz Chiliflocken Sonnenblumenkerne" als einen
   Block. Ohne diese Zerlegung bliebe davon genau ein Artikel übrig: Der beste
   Gesamttreffer schluckt den Rest.

   Darum wird Wort für Wort das längste Fenster (bis drei Wörter) gesucht, das
   einen Katalognamen trifft. Bei Gleichstand gewinnt das kürzere – so bleibt
   "passierte Tomaten" zusammen, während "Salz Chiliflocken" auseinanderfällt:
   Für das Zweiwort-Fenster punktet nur eines der beiden Wörter, für das
   Einzelwort-Fenster ebenfalls.

   Zwei Regeln halten das ehrlich:
   - Ein Fenster darf nur starten, wo das erste Wort selbst im Katalog
     vorkommt. Sonst verschluckte "Haribo Schokoriegel Sonnenblumenkerne"
     die ersten beiden Wörter im Treffer des dritten.
   - Füll- und Zustandswörter ("ist", "fast leer") gehören zum zuletzt
     erkannten Artikel. Nur so lässt sich "Milch ist fast leer, Reis halb voll"
     ohne Komma noch richtig zuordnen. */
const MAX_FENSTER = 3;

const istBeiwerk = (w) => FUELLWORT.has(w) || ZUSTAND_WORT.has(w) || !!EINHEIT_INDEX[w] || ZAHLWORT[w] != null;

function teileArtikel(worte, einheit, bekannt, kandidaten) {
  const artikel = [];
  let rest = [];

  const restAbschliessen = () => {
    if (!rest.length) return;
    const { zutat, basis } = findeZutat(rest.map((p) => p.norm).join(" "), einheit, bekannt, kandidaten);
    artikel.push({ zutat: basis >= 3 ? zutat : null, worte: rest, anhang: [], sicher: false });
    rest = [];
  };
  const anhaengen = (paar) => {
    if (rest.length) { rest.push(paar); return; }
    if (artikel.length) artikel[artikel.length - 1].anhang.push(paar);
  };

  let i = 0;
  while (i < worte.length) {
    const wort = worte[i];
    // Am Wortanfang zählt nur, was ein Artikelname sein kann.
    if (istBeiwerk(wort.norm) || findeZutat(wort.norm, einheit, bekannt, kandidaten).basis < 5) {
      if (istBeiwerk(wort.norm)) anhaengen(wort);
      else rest.push(wort);
      i += 1;
      continue;
    }
    let bester = null;
    for (let len = Math.min(MAX_FENSTER, worte.length - i); len >= 1; len--) {
      const fenster = worte.slice(i, i + len);
      const { zutat, basis, woerter } = findeZutat(fenster.map((p) => p.norm).join(" "), einheit, bekannt, kandidaten);
      if (!zutat || basis < 5) continue;
      /* Der Treffer muss am ersten Wort des Fensters hängen, sonst zieht er
         sich Vorgänger ein, mit denen er nichts zu tun hat: "Backoblaten Maggi
         Zwiebelsuppe" träfe sonst als Ganzes "Maggi Zwiebelsuppe" – und die
         Backoblaten wären verschwunden. */
      if (len > 1 && punkteFuerWort(fenster[0].norm, stamm(fenster[0].norm), woerter) === 0) continue;
      // ">=" statt ">": die Schleife läuft von lang nach kurz, bei Gleichstand
      // soll das kürzere Fenster gewinnen.
      if (!bester || basis >= bester.basis) bester = { zutat, basis, len, worte: fenster };
    }
    restAbschliessen();
    artikel.push({ zutat: bester.zutat, worte: bester.worte, anhang: [], sicher: true });
    i += bester.len;
  }
  restAbschliessen();
  return artikel;
}

/* Diktattext → Vorschlagsliste. Rein lokal, kein Netz, kein Key.
   Ergebnis je Eintrag:
     { rohtext, name, zutat_id, menge, einheit, aktion, anteil, sicher } */
function parseDiktat(text, bestand = []) {
  const bekannt = new Set(bestand.map((b) => b.zutat_id));
  const kandidaten = [...KATALOG, ...eigeneKandidaten(bestand)];
  const eintraege = [];

  for (const zeile of segmente(text, undKomposita(kandidaten))) {
    for (const gruppe of gruppenAusZeile(zeile)) {
      const artikel = teileArtikel(gruppe.worte, gruppe.einheit, bekannt, kandidaten);

      artikel.forEach((a, i) => {
        const eigene = [...a.worte, ...a.anhang];
        /* Zustand wird je Artikel gelesen, nicht je Abschnitt: In
           "Milch ist fast leer, Reis halb voll" gehört jede Angabe zu ihrem
           eigenen Artikel. Reihenfolge mit Bedacht – "fast leer" ist ein
           Anteil, kein leeres Fach, und "halb voll" darf nicht als Menge 0,5
           durchrutschen. Eine echte Stückzahl (ab 2) sticht den Anteil aus. */
        const gesagt = eigene.map((p) => p.norm).join(" ");
        const leer = LEER_MUSTER.test(gesagt);
        const anteilTreffer = ANTEIL_MUSTER.find(([muster]) => muster.test(gesagt));
        // Menge und Einheit gelten dem zuerst genannten Artikel der Gruppe –
        // "zwei Dosen Tomaten, Mais" sagt nichts über die Menge Mais.
        const menge = i === 0 ? gruppe.menge : null;
        const einheit = i === 0 ? gruppe.einheit : null;

        let aktion = "vorraetig";
        if (anteilTreffer && (menge == null || menge <= 1)) aktion = "anteil";
        else if (leer) aktion = "leer";
        else if (menge != null) aktion = "menge";

        const rohtext = [...(i === 0 ? gruppe.kopf : []), ...eigene.map((p) => p.roh)].join(" ");
        eintraege.push({
          rohtext,
          name: a.zutat ? a.zutat.name : hoch(a.worte.map((p) => p.roh).join(" ")),
          zutat_id: a.zutat?.id || null,
          menge: aktion === "menge" ? menge : null,
          einheit: aktion === "menge" ? einheit : null,
          anteil: aktion === "anteil" ? anteilTreffer[1] : null,
          aktion,
          /* "sicher" heißt: der Name saß, nicht nur die Einheit passte. Alles
             andere klappt in der Bestätigungsliste die Zutatenwahl auf. */
          sicher: a.sicher,
        });
      });
    }
  }
  return eintraege;
}

const hoch = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Menschenlesbare Zusammenfassung eines Eintrags für die Bestätigungsliste. */
function diktatAnzeige(e) {
  if (e.aktion === "leer") return "leer";
  if (e.aktion === "anteil") return `noch etwa ${Math.round(e.anteil * 100)} %`;
  if (e.aktion === "menge") return `${trimZahl(e.menge)}${e.einheit ? ` ${e.einheit === "Stk" ? "×" : e.einheit}` : " ×"}`;
  return "vorrätig";
}

const trimZahl = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));

export { diktatVerfuegbar, starteDiktat, parseDiktat, diktatAnzeige };

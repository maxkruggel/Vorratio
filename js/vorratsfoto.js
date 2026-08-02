/* Vorratio – Schrankfoto (Kap. 4.2 / 7.6)

   Der vierte Erfassungsweg: Schubfach auf, ein Foto, fertig. Claude sieht auf
   dem Bild, WAS dasteht – ein Glas Gurken ist eindeutig. WIE VIEL drin ist,
   sieht ein Foto in aller Regel nicht (eine Mehltüte ist blickdicht). Genau
   dort hört das Modell auf und der Mensch übernimmt: Die Bestätigungsliste
   bringt jeden Artikel mit dem passenden Mengen-Bedienelement mit, ein Tap je
   Zeile. Lieber ein ehrliches „½ – bitte antippen" als eine erfundene Zahl
   (Toleranzprinzip, Kap. 5).

   Dieses Modul bleibt bewusst frei von DOM-Views und State: Bildaufbereitung
   und die Umrechnung der Modellantwort in Bestandseinträge sind pur und in
   tools/test-engine.mjs geprüft. Die Oberfläche liegt in app.js (Vorrat-Tab). */

import { ZUTAT_INDEX } from "./engine.js";

/* Mehr als drei Fächer auf einmal wird weder schnell noch genau: Jedes Bild
   kostet Tokens und Wartezeit, und die Liste danach will überblickbar bleiben. */
const MAX_FOTOS = 3;

/* Claude rechnet größere Bilder ohnehin auf diese Kantenlänge herunter – wer
   das volle iPhone-Foto (4032 px, mehrere MB) schickt, wartet nur länger auf
   denselben Blick. Nebenbei bleibt der base64-Block sicher unter dem 5-MB-Limit
   der API, und aus HEIC/PNG wird auf dem Weg ein JPEG. */
const MAX_KANTE = 1568;
const JPEG_QUALITAET = 0.82;

const BILD_TYPEN = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function ladeBild(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild konnte nicht gelesen werden.")); };
    img.src = url;
  });
}

function dateiBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* Foto → { base64, mediaType, vorschau }. `vorschau` ist dieselbe Data-URL,
   die auch verschickt wird – die Miniatur in der Liste zeigt damit exakt das
   Bild, das Claude gesehen hat, und nicht eine hübschere Fassung davon. */
async function verkleinereBild(file, maxKante = MAX_KANTE) {
  try {
    const bild = await ladeBild(file);
    const faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
    const w = Math.max(1, Math.round(bild.width * faktor));
    const h = Math.max(1, Math.round(bild.height * faktor));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bild, 0, 0, w, h);
    const daten = canvas.toDataURL("image/jpeg", JPEG_QUALITAET);
    const base64 = daten.split(",")[1];
    if (!base64) throw new Error("Canvas leer");
    return { base64, mediaType: "image/jpeg", vorschau: daten };
  } catch {
    /* Kein Canvas-Weg (Speicher, exotischer Browser): lieber das Originalbild
       schicken als die Funktion abbrechen. */
    const base64 = await dateiBase64(file);
    const mediaType = BILD_TYPEN.has(file.type) ? file.type : "image/jpeg";
    return { base64, mediaType, vorschau: `data:${mediaType};base64,${base64}` };
  }
}

/* ---------------------------------------------------------- Modellantwort */
const rund10 = (n) => Math.max(0, Math.round(n / 10) * 10);

/* Anteile kommen mal als 0,5 und mal als 50 (Prozent) zurück – beides landet
   hier im selben Bereich. Alles Unbrauchbare wird zu null, nie zu 0. */
function anteilNormiert(wert) {
  const n = Number(wert);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(1, n > 1 ? n / 100 : n);
}

function anzahlNormiert(wert) {
  const n = Number(wert);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(999, Math.round(n));
}

/* Erkannte Artikel → Bestandseinträge in der Führungsart der Zutat.

   `freieDaten(name)` liefert die Ersatzangaben für alles, was nicht im Katalog
   steht (app.js leitet sie aus dem Namen ab) – so bekommt auch ein selbst
   angelegter Artikel gleich das richtige Bedienelement.

   `nachfragen: true` heißt: Die Menge ist geraten, weil das Foto sie nicht
   hergibt. Die UI hebt genau diese Zeilen hervor. */
function fotoEintraege(artikel, freieDaten = () => ({})) {
  const eintraege = [];
  const index = new Map();

  for (const a of artikel || []) {
    const rohName = String(a?.name || "").trim();
    if (rohName.length < 2) continue;

    const kat = a?.zutat_id ? ZUTAT_INDEX[a.zutat_id] : null;
    const daten = kat || freieDaten(rohName) || {};
    const art = daten.art || "schuettgut";
    const packung = daten.packung || kat?.packung || (art === "schuettgut" ? 500 : null);
    const anzahl = anzahlNormiert(a?.anzahl);
    const fuellstand = anteilNormiert(a?.fuellstand);

    let menge = null;
    let nachfragen = false;
    if (art === "pauschal") {
      menge = null;                                   // da/leer – eine Menge gibt es nicht
    } else if (art === "zaehlbar") {
      menge = anzahl ?? 1;
      nachfragen = anzahl == null;                    // verdeckt gestapelt? dann zählt der Mensch
    } else {
      menge = rund10((fuellstand ?? 0.5) * (packung || 500));
      nachfragen = fuellstand == null;                // blickdichte Packung
    }

    const eintrag = {
      rohtext: String(a?.gesehen || rohName).trim(),
      name: kat?.name || rohName,
      zutat_id: kat?.id || null,
      kategorie: daten.kategorie || "trocken",
      art,
      einheit: daten.einheit || (art === "zaehlbar" ? "Stk" : "g"),
      packung,
      menge,
      nachfragen,
      sicher: !!kat && a?.sicher !== false,
      buchen: true,
      // Zeilen ohne sichere Zuordnung zeigen die Zutatenwahl gleich offen.
      offen: !kat || a?.sicher === false,
    };

    /* Zwei Fotos desselben Fachs (oder zwei Blickwinkel) nennen dieselbe Sache
       doppelt. Zusammenlegen statt zweimal listen: Zählbares addiert sich,
       beim Füllstand gewinnt der höhere Wert – der zweite Blick zeigt oft nur
       weniger vom selben Glas. */
    const schluessel = eintrag.zutat_id || eintrag.name.toLowerCase();
    const bisher = index.get(schluessel);
    if (bisher) {
      if (bisher.art === "zaehlbar") bisher.menge = (bisher.menge || 0) + (eintrag.menge || 0);
      else if (bisher.art === "schuettgut") bisher.menge = Math.max(bisher.menge || 0, eintrag.menge || 0);
      bisher.nachfragen = bisher.nachfragen && eintrag.nachfragen;
      if (eintrag.rohtext && !bisher.rohtext.includes(eintrag.rohtext)) {
        bisher.rohtext = `${bisher.rohtext} · ${eintrag.rohtext}`;
      }
      continue;
    }
    index.set(schluessel, eintrag);
    eintraege.push(eintrag);
  }

  return eintraege;
}

/* Führungsart wechseln, wenn im Ergebnis eine andere Zutat gewählt wird:
   Aus „3 Dosen" darf keine Menge „3 g" werden. */
function passeEintragAn(eintrag, daten) {
  const art = daten?.art || "schuettgut";
  const packung = daten?.packung || (art === "schuettgut" ? 500 : null);
  eintrag.art = art;
  eintrag.einheit = daten?.einheit || (art === "zaehlbar" ? "Stk" : "g");
  eintrag.kategorie = daten?.kategorie || eintrag.kategorie;
  eintrag.packung = packung;
  if (art === "pauschal") {
    eintrag.menge = null;
  } else if (art === "zaehlbar") {
    // Aus „380 g" dürfen keine 380 Dosen werden – eine gezählte Stückzahl
    // bleibt, alles andere fängt bei eins an.
    const n = Math.round(eintrag.menge || 1);
    eintrag.menge = n >= 1 && n <= 20 ? n : 1;
  } else {
    eintrag.menge = rund10((packung || 500) * 0.5);
  }
  return eintrag;
}

export { MAX_FOTOS, MAX_KANTE, verkleinereBild, fotoEintraege, passeEintragAn, rund10 };

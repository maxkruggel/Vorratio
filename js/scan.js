/* Vorratio Barcode-Scan (Kap. 6.3): Barcode → Open-Food-Facts-Live-Lookup →
   Mapping-Vorschlag auf zutat_id → Nutzer bestätigt → Bestandsbuchung.
   OFF-Regel: "1 API call = 1 real scan by a user" – genau so nutzen wir es.
   Kamera-Scan über die native BarcodeDetector-API, wo verfügbar;
   sonst manuelle EAN-Eingabe (iOS Safari hat keinen BarcodeDetector). */

import { ZUTATEN } from "./data/kerndb.js";

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";
const OFF_FIELDS = "product_name,product_name_de,brands,quantity,product_quantity,product_quantity_unit,categories_tags,nutriments,image_front_small_url";

/* Einzel-Lookup gegen die OFF-Live-API. */
async function lookupBarcode(ean) {
  const code = String(ean).replace(/\D/g, "");
  if (code.length < 8) throw new Error("Kein gültiger EAN-Code.");
  // Kein User-Agent-Header: Browser verbieten ihn (Forbidden Header Name) und
  // verwerfen ihn stillschweigend – gesetzt hätte er nur einen unnötigen
  // Preflight ausgelöst. Open Food Facts verlangt ihn nur serverseitig.
  const res = await fetch(`${OFF_URL}/${code}.json?fields=${OFF_FIELDS}`);
  if (!res.ok) throw new Error(`Open Food Facts nicht erreichbar (${res.status}).`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    gtin: code,
    name: p.product_name_de || p.product_name || "Unbekanntes Produkt",
    marke: (p.brands || "").split(",")[0].trim() || null,
    menge: p.product_quantity ? Number(p.product_quantity) : null,
    mengen_einheit: p.product_quantity_unit || null,
    menge_text: p.quantity || null,
    kategorien: p.categories_tags || [],
    bild: p.image_front_small_url || null,
  };
}

/* Fuzzy-Vorschlag: OFF-Produktname → normalisierte zutat_id.
   Bewusst simpel (Wortüberlappung) – der Nutzer bestätigt immer. */
const STOPWOERTER = new Set(["bio", "der", "die", "das", "und", "mit", "aus", "type", "extra", "fein", "frisch"]);

function normalisiere(s) {
  return s.toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWOERTER.has(w));
}

function vorschlagZutat(produktName) {
  const woerter = new Set(normalisiere(produktName));
  if (!woerter.size) return null;
  let best = null;
  let bestScore = 0;
  for (const z of ZUTATEN) {
    const zw = normalisiere(z.name);
    let score = 0;
    for (const w of zw) {
      for (const pw of woerter) {
        if (w === pw) score += 2;
        else if (w.startsWith(pw) || pw.startsWith(w)) score += 1;
      }
    }
    if (score > bestScore) { bestScore = score; best = z; }
  }
  return bestScore >= 2 ? best : null;
}

/* Kamera-Scan mit nativem BarcodeDetector (Chrome/Edge; iOS Safari: nein).
   Rückgabe: Promise<EAN-String>; stop() beendet den Stream. */
function kameraVerfuegbar() {
  return "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;
}

async function starteKameraScan(videoEl, onResult, onError) {
  let aktiv = true;
  let stream = null;
  try {
    const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a"] });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    const tick = async () => {
      if (!aktiv) return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes.length) {
          stop();
          onResult(codes[0].rawValue);
          return;
        }
      } catch { /* Frame noch nicht bereit */ }
      requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {
    stop();
    onError(e);
  }
  function stop() {
    aktiv = false;
    stream?.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
  }
  return { stop };
}

export { lookupBarcode, vorschlagZutat, kameraVerfuegbar, starteKameraScan };

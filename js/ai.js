/* Vorratio AI-Modul: Rezeptgenerierung + Bon-Scan über die Claude API.
   Rein clientseitig (wie Flora AI): Der API-Key liegt ausschließlich lokal auf
   diesem Gerät (localStorage) und geht nur an api.anthropic.com.
   Strukturierte Ausgaben (output_config.format) erzwingen Schema-Treue –
   generierte Rezepte sind direkt kochbar (Timer, Abbuchung, Filter). */

import { ZUTATEN } from "./data/kerndb.js";
import { ERNAEHRUNGSFORMEN, AUSSCHLUESSE, STILE, ZIELE, gewaehlteVorlieben } from "./data/profil.js";
import { allergeneFuerRezept } from "./data/allergene.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-5";

function headers(apiKey) {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    // Nötig für direkte Browser-Aufrufe (CORS-Opt-in der Claude API).
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

async function anfrage(apiKey, body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `API-Fehler ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error?.message) msg += `: ${err.error.message}`;
    } catch { /* Rohtext ignorieren */ }
    if (res.status === 401) msg = "API-Key ungültig – bitte im Profil prüfen.";
    if (res.status === 429) msg = "Rate-Limit erreicht – kurz warten und nochmal versuchen.";
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("Anfrage wurde vom Modell abgelehnt.");
  // Bricht die Antwort am Token-Limit ab, ist das JSON abgeschnitten. Ohne
  // diesen Zweig platzt JSON.parse mit "Unexpected end of JSON input" – eine
  // Meldung, mit der in der Küche niemand etwas anfangen kann.
  if (data.stop_reason === "max_tokens") {
    throw new Error("Die Antwort war zu lang und wurde abgeschnitten. Bitte noch einmal versuchen.");
  }
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Leere Antwort vom Modell.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Antwort des Modells war unvollständig. Bitte noch einmal versuchen.");
  }
}

/* ------------------------------------------------------------ Rezept-Schema */
const EINHEITEN = ["g", "kg", "ml", "l", "Stk", "EL", "TL", "Prise", "Bund", "Zehe", "Dose", "Pck", "Stange", "nach_Bedarf"];
const FORMEN_TAGS = ["vegan", "vegetarisch", "pescetarisch", "mit_fisch", "mit_fleisch", "mit_gefluegel"];
const ALLERGENE_TAGS = ["gluten", "laktose", "ei", "fisch", "krebstiere", "schalenfruechte", "erdnuss", "soja", "sesam", "senf", "sellerie", "sulfite"];

const REZEPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rezepte"],
  properties: {
    rezepte: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "kategorie", "cuisine", "mahlzeitentyp", "portionen", "schwierigkeit",
          "zutaten", "schritte", "gesamtzeit_min", "ernaehrungsform", "allergene", "makro_hinweis", "tags"],
        properties: {
          name: { type: "string" },
          kategorie: { type: "string" },
          cuisine: { type: "string" },
          mahlzeitentyp: { type: "array", items: { type: "string", enum: ["fruehstueck", "mittag", "abend", "snack"] } },
          portionen: { type: "integer" },
          schwierigkeit: { type: "string", enum: ["einfach", "mittel", "fortgeschritten"] },
          zutaten: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["menge", "einheit", "zutat_id", "zutat_name", "optional"],
              properties: {
                menge: { type: ["number", "null"] },
                einheit: { type: "string", enum: EINHEITEN },
                zutat_id: { type: ["string", "null"] },
                zutat_name: { type: "string" },
                optional: { type: "boolean" },
              },
            },
          },
          schritte: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["nr", "text", "dauer_sekunden", "temperatur_c", "timer_typ", "timer_name"],
              properties: {
                nr: { type: "integer" },
                text: { type: "string" },
                dauer_sekunden: { type: ["number", "null"] },
                temperatur_c: { type: ["number", "null"] },
                timer_typ: { type: ["string", "null"], enum: ["aktiv", "passiv", "ofen", "ruhen", null] },
                timer_name: { type: ["string", "null"] },
              },
            },
          },
          gesamtzeit_min: {
            type: "object",
            additionalProperties: false,
            required: ["vorbereitung", "garzeit", "gesamt"],
            properties: {
              vorbereitung: { type: "integer" },
              garzeit: { type: "integer" },
              gesamt: { type: "integer" },
            },
          },
          ernaehrungsform: { type: "array", items: { type: "string", enum: FORMEN_TAGS } },
          allergene: { type: "array", items: { type: "string", enum: ALLERGENE_TAGS } },
          makro_hinweis: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

/* Profilregeln aus Doku Kap. 6.1 (DGE/BfR/USDA-basiert) als Systemprompt. */
function systemPrompt(profil) {
  const form = ERNAEHRUNGSFORMEN.find((f) => f.id === profil.ernaehrungsform);
  const ausschluesse = (profil.ausschluesse || [])
    .map((id) => AUSSCHLUESSE.find((a) => a.id === id)?.name || id);
  // Freitext-Ausschlüsse ("Koriander", "Rosenkohl") gehören in den Prompt.
  // Ohne sie generiert das Modell munter Rezepte, die der Filter danach
  // wegwirft – der Nutzer wartet dann auf ein Ergebnis, das nie erscheint.
  const eigene = (profil.eigeneAusschluesse || []).map((e) => String(e).trim()).filter(Boolean);
  const stile = (profil.stile || []).map((id) => STILE.find((s) => s.id === id)?.name || id);
  const ziele = (profil.ziele || []).map((id) => ZIELE.find((z) => z.id === id)).filter(Boolean);
  // Achse 3: Lieblingszutaten der gewählten Ernährungsform (weiche Präferenz)
  const vorlieben = gewaehlteVorlieben(profil.ernaehrungsform, profil.vorlieben || []);
  const katalog = ZUTATEN.map((z) => `${z.id} = ${z.name}`).join("\n");

  return `Du bist der Rezeptgenerator der Vorrats-App Vorratio. Du erstellst alltagstaugliche,
anfängertaugliche Rezepte, die sich strikt am Vorratsbestand des Nutzers orientieren.

## Nutzerprofil (hart einhalten)
- Ernährungsform: ${form?.name || "Mischkost"} (${form?.kurz || ""})
- Harte Ausschlüsse (NIE verwenden, auch nicht in Spuren-relevanten Zutaten): ${ausschluesse.join(", ") || "keine"}${eigene.length ? `
- Persönlich abgelehnt (NIE verwenden, auch nicht als Garnitur oder Option): ${eigene.join(", ")}` : ""}
- Halal bedeutet zusätzlich: kein Schweinefleisch, keine Gelatine, kein Alkohol – auch nicht zum Ablöschen.
- Koscher bedeutet zusätzlich: kein Schweinefleisch, keine Meeresfrüchte, Fleisch und Milchprodukte nie im selben Gericht.
- Stil-Präferenzen (bevorzugen, nicht erzwingen): ${stile.join(", ") || "keine"}${vorlieben.length ? `
- Lieblingszutaten (mag der Nutzer besonders – möglichst in mindestens einem der Rezepte einsetzen, aber nicht in jedes hineinzwingen und nie auf Kosten der Bestandsdeckung): ${vorlieben.map((v) => v.name).join(", ")}` : ""}
${ziele.length ? `
## Ziele des Nutzers (weich einfließen lassen, wissenschaftlich fundiert – keine Heilsversprechen)
${ziele.map((z) => `- ${z.name}: ${z.ai}`).join("\n")}` : ""}

## Ernährungsregeln (DGE/BfR-basiert, quellenbelegt)
- Vegan: keinerlei Tierprodukte inkl. Honig. Jede Hauptmahlzeit mit Proteinquelle (Hülsenfrüchte/Tofu/Tempeh/Seitan), Getreide + Hülsenfrüchte kombinieren. Eisenreiche Gerichte IMMER mit Vitamin-C-Komponente (Paprika, Zitrone, Brokkoli). Kaffee/Schwarztee nie als Mahlzeitgetränk vorschlagen. Jodiertes Salz als Default, Algen nicht als Jod-/B12-Quelle.
- Vegetarisch: Eisen-Vitamin-C-Kopplung wie vegan; Milch/Ei als Protein-, B12- und Calciumquelle nutzen. Lacto = kein Ei, Ovo = keine Milchprodukte.
- Pescetarisch: Fisch aus der Positivliste bevorzugen (Lachs, Makrele, Hering, Kabeljau, Seelachs); große Raubfische (Thunfisch, Hai, Schwertfisch, Heilbutt, Rotbarsch, Aal) meiden (BfR 17/2024).
- Mischkost/Flexitarisch: überwiegend pflanzlich (DGE 2024: >75% pflanzlich, Fleisch/Wurst max. 300 g/Woche) – Fleisch sparsam und bewusst einsetzen.
- Kerntemperaturen sind Pflicht und dürfen USDA/FSIS-Minima nie unterschreiten: Geflügel 74 °C, Hackfleisch 71 °C, ganze Fleischstücke 63 °C + 3 Min Ruhe, Fisch 63 °C. Nenne sie im betreffenden Schritt (temperatur_c).

## Zutaten-Katalog (für den Bestandsabgleich)
Verwende für zutat_id NUR IDs aus dieser Liste. Für Zutaten ohne passende ID setze zutat_id auf null:
${katalog}

## Rezept-Anforderungen
- Bevorzuge stark die Zutaten aus dem BESTAND des Nutzers (siehe Anfrage). Wenige, gängige Zusatzzutaten sind erlaubt.
- Schritte: ein Handlungsschritt pro Eintrag, Imperativ, anfängertauglich (inkl. Basics wie "Reis abspülen").
- Timer: dauer_sekunden + timer_typ (aktiv = Nutzer arbeitet, passiv = köcheln, ofen = Backzeit, ruhen) + sprechender timer_name ("Nudeln kochen") überall, wo eine Wartezeit existiert. Schritte ohne Wartezeit: alle Timer-Felder null.
- Streue in 1–2 Schritte einen kurzen, lehrreichen Küchen-Tipp ein (Flora-Prinzip).
- ernaehrungsform: alle zutreffenden Tags. allergene: alle im Rezept enthaltenen.
- Erfinde keine Garzeiten – nutze etablierte Richtwerte.
- Antworte ausschließlich als JSON gemäß Schema, Texte auf Deutsch.`;
}

/* 3 neue Rezepte für den Slot generieren – orientiert am Bestand. */
async function generiereRezepte(apiKey, profil, bestand, slot, anzahl = 3) {
  const bestandListe = bestand.length
    ? bestand.map((b) => `- ${b.name} (${b.zutat_id}), verfügbar: ${b.menge ?? "vorrätig"} ${b.einheit}`).join("\n")
    : "- (Bestand leer – schlage einfache Basisrezepte mit wenigen, günstigen Zutaten vor)";
  const slotName = { fruehstueck: "Frühstück", mittag: "Mittagessen", abend: "Abendessen", snack: "Snacks & Süßes" }[slot] || slot;
  // Snack-Ecke (Recherche 4): eigene Rezeptfamilie außerhalb der Essenszeiten
  const snackHinweis = slot === "snack" ? `

Es geht um SNACKS für zwischendurch, unabhängig von den Mahlzeiten – süß oder herzhaft:
Eis/Sorbet/Nicecream, Eis am Stiel, Frozen-Joghurt-Bark, schokolierte Früchte, Fruchtleder,
Obst-/Gemüsechips, Energiebällchen, geröstete Kichererbsen, Popcorn, Blitzgebäck.
Lange passive Wartezeiten (Gefrieren, Dörren) sind okay – timer_typ "ruhen"/"ofen" nutzen.
Setze mahlzeitentyp exakt auf ["snack"].` : "";

  const data = await anfrage(apiKey, {
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: { type: "json_schema", schema: REZEPT_SCHEMA } },
    system: systemPrompt(profil),
    messages: [{
      role: "user",
      content: `Erstelle ${anzahl} unterschiedliche Rezepte für: ${slotName}.${snackHinweis}

AKTUELLER BESTAND:
${bestandListe}

Maximiere die Bestandsdeckung (möglichst wenig zukaufen), variiere Cuisine und Kategorie zwischen den ${anzahl} Vorschlägen.`,
    }],
  });

  const jetzt = Date.now();
  return (data.rezepte || []).slice(0, anzahl).map((r, i) => {
    const rezept = {
      ...r,
      id: `AI-${jetzt}-${i}`,
      typ: "rezept",
      quelle_typ: "ai_generiert",
      naehrwert_einordnung: { kcal_pro_portion: null, profil: "ausgewogen", makro_hinweis: r.makro_hinweis },
      substitutionen: [],
      erstellt: new Date(jetzt).toISOString(),
    };
    // Die Allergen-Selbstauskunft des Modells wird nicht geglaubt, sondern
    // gegen die Zutaten nachgerechnet und ergänzt. Ein vergessenes "gluten"
    // hätte bei Zöliakie echte Folgen – und der Filter greift auf genau
    // dieses Feld zu.
    rezept.allergene = [...allergeneFuerRezept(rezept)].sort();
    return rezept;
  });
}

/* ------------------------------------------------------------------ Bon-Scan */
const BON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["haendler", "artikel"],
  properties: {
    haendler: { type: ["string", "null"] },
    artikel: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["bon_text", "name", "zutat_id", "menge", "einheit", "lebensmittel"],
        properties: {
          bon_text: { type: "string" },
          name: { type: "string" },
          zutat_id: { type: ["string", "null"] },
          menge: { type: ["number", "null"] },
          einheit: { type: "string", enum: ["g", "ml", "Stk", "Dose", "Pck", "unbekannt"] },
          lebensmittel: { type: "boolean" },
        },
      },
    },
  },
};

/* Kassenbon-Foto → strukturierte Artikelliste mit zutat_id-Mapping (Kap. 7.3). */
async function scanBon(apiKey, imageBase64, mediaType) {
  const katalog = ZUTATEN.map((z) => `${z.id} = ${z.name}`).join("\n");
  return anfrage(apiKey, {
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: BON_SCHEMA } },
    system: `Du liest deutsche Kassenbons für die Vorrats-App Vorratio.
Extrahiere alle Artikel. Übersetze kryptische Bon-Bezeichnungen ("G&G WEIZENM. 405" → "Weizenmehl Type 405").
Mappe jeden Lebensmittel-Artikel auf eine zutat_id aus diesem Katalog (oder null, wenn nichts passt):
${katalog}
Schätze die Menge aus der Bon-Zeile (Packungsgröße, Multiplikatoren wie "2x"). Non-Food: lebensmittel=false.
Pfand, Rabatte und Summenzeilen sind KEINE Artikel.`,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: "Lies diesen Kassenbon und extrahiere die Artikel als JSON." },
      ],
    }],
  });
}

/* ------------------------------------------------------------ Barcode-Foto
   iOS Safari hat keinen BarcodeDetector – dort wäre der Kamera-Button tot.
   Fallback: Foto vom Strichcode, Claude liest die Ziffernfolge darunter ab.
   Danach läuft alles wie beim Live-Scan weiter (Open-Food-Facts-Lookup). */
const EAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ean"],
  properties: { ean: { type: ["string", "null"] } },
};

async function leseBarcodeVomFoto(apiKey, imageBase64, mediaType) {
  const data = await anfrage(apiKey, {
    model: MODEL,
    max_tokens: 300,
    output_config: { format: { type: "json_schema", schema: EAN_SCHEMA } },
    system: `Du liest Strichcodes auf Lebensmittelverpackungen.
Gib ausschließlich die Ziffernfolge zurück, die unter dem Strichcode gedruckt steht (EAN-13, EAN-8 oder UPC-A).
Nur Ziffern, keine Leer- oder Trennzeichen. Ist kein Strichcode erkennbar oder die Ziffern sind unleserlich: ean = null.`,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: "Welche Nummer steht unter diesem Strichcode?" },
      ],
    }],
  });
  const ean = String(data.ean || "").replace(/\D/g, "");
  return ean.length >= 8 ? ean : null;
}

export { generiereRezepte, scanBon, leseBarcodeVomFoto, MODEL };

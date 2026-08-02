/* Vorratio Kochbuch (Kap. 4.10): Rezepte aufheben, statt sie zu verlieren.

   Zwei Wege hinein: einen Vorschlag merken – aus der Kern-DB oder von Claude
   generiert – oder ein eigenes Rezept eintragen (Omas Zettel, Lieblingsessen).
   Gespeichert wird immer eine vollständige Kopie im Schema kruggel-recipe-db/v1.
   Das ist Absicht: Claude-Rezepte rotieren im AI-Pool (jüngste 24) und lassen
   sich im Profil löschen – eine Kopie im Kochbuch überlebt beides.

   Alles im Kochbuch ist ein vollwertiges Rezept: Profilfilter, Bestandsabgleich,
   Vorschläge, Kochmodus mit Timern und Abbuchung greifen unverändert. */

import { ZUTATEN } from "./data/kerndb.js";

/* --------------------------------------------------------------- Quellen */
const QUELLE_LABEL = { eigen: "eigenes Rezept", ai: "von claude", kern: "aus vorratio" };

const KOCHBUCH_FILTER = [
  { id: "alle", name: "Alle" },
  { id: "eigen", name: "Eigene" },
  { id: "ai", name: "Von Claude" },
  { id: "kern", name: "Aus Vorratio" },
];

function quelleVon(rezept) {
  if (rezept?.quelle_typ === "eigen") return "eigen";
  if (rezept?.quelle_typ === "ai_generiert") return "ai";
  return "kern";
}

/* ------------------------------------------------------------ Merkliste */
const buch = (s) => (s.kochbuch ||= []);

function istGemerkt(s, id) { return buch(s).some((r) => r.id === id); }

function findeGemerkt(s, id) { return buch(s).find((r) => r.id === id) || null; }

/* Kopie statt Verweis – siehe Modulkopf. Neuestes zuerst. */
function merken(s, rezept) {
  if (!rezept?.id || istGemerkt(s, rezept.id)) return false;
  buch(s).unshift({
    ...structuredClone(rezept),
    gespeichert: new Date().toISOString(),
    notiz: rezept.notiz || "",
  });
  return true;
}

function vergessen(s, id) {
  const i = buch(s).findIndex((r) => r.id === id);
  if (i < 0) return false;
  buch(s).splice(i, 1);
  return true;
}

function setzeNotiz(s, id, notiz) {
  const r = findeGemerkt(s, id);
  if (!r) return false;
  r.notiz = String(notiz || "").trim();
  return true;
}

/* Eigenes Rezept ersetzen (Bearbeiten) – Position im Buch bleibt erhalten. */
function ersetze(s, rezept) {
  const i = buch(s).findIndex((r) => r.id === rezept.id);
  if (i < 0) { buch(s).unshift(rezept); return; }
  buch(s)[i] = { ...rezept, gespeichert: buch(s)[i].gespeichert, notiz: buch(s)[i].notiz || rezept.notiz || "" };
}

/* Suche über Name, Küche, Kategorie, Tags und Zutaten – ein Suchfeld reicht. */
function passt(rezept, q) {
  if (!q) return true;
  const felder = [rezept.name, rezept.cuisine, rezept.kategorie, ...(rezept.tags || [])];
  if (felder.some((f) => String(f || "").toLowerCase().includes(q))) return true;
  return (rezept.zutaten || []).some((z) => String(z.zutat_name || "").toLowerCase().includes(q));
}

function kochbuchListe(s, { suche = "", quelle = "alle" } = {}) {
  const q = suche.trim().toLowerCase();
  return buch(s)
    .filter((r) => quelle === "alle" || quelleVon(r) === quelle)
    .filter((r) => passt(r, q));
}

/* „3× gekocht" auf der Kochbuch-Karte – aus der Historie, ohne Extra-Zähler. */
function gekochtAnzahl(s, id) {
  return (s.historie || []).filter((h) => h.rezeptId === id).length;
}

/* ---------------------------------------------------- Zutaten-Katalog
   Für den Bestandsabgleich zählt die zutat_id. Neben der Kern-Liste gehören
   darum auch selbst angelegte Vorratsartikel („frei_…") in die Vorschlagsliste
   des Editors – sonst ließe sich das eigene Rezept nie mit ihnen verrechnen. */
function katalogZutaten(s) {
  const namen = new Set(ZUTATEN.map((z) => z.name.toLowerCase()));
  const eigene = (s.bestand || [])
    .filter((b) => b.zutat_id && !namen.has(String(b.name).toLowerCase()) && !ZUTATEN.some((z) => z.id === b.zutat_id))
    .map((b) => ({ id: b.zutat_id, name: b.name }));
  return [...ZUTATEN.map((z) => ({ id: z.id, name: z.name })), ...eigene];
}

/* Freitext → zutat_id. Bewusst streng: nur ein eindeutiger Namenstreffer wird
   verknüpft. Lieber „zählt nicht für den Bestand" als eine falsche Abbuchung. */
function zutatIdFuer(name, katalog) {
  const q = String(name || "").trim().toLowerCase();
  if (!q) return null;
  const kurz = (n) => n.toLowerCase().split(/[(/]/)[0].trim();
  const treffer = katalog.find((z) => z.name.toLowerCase() === q) || katalog.find((z) => kurz(z.name) === q);
  return treffer?.id || null;
}

/* ------------------------------------------ Ernährungsform & Allergene
   Beides muss stimmen, sonst filtert die Engine falsch: Ernährungsform steuert,
   wem das Rezept überhaupt vorgeschlagen wird, Allergene sind harte Ausschlüsse.
   Vorratio leitet beides aus den Zutaten ab und legt es als Vorschlag vor –
   die letzte Entscheidung trifft der Mensch über die Chips im Editor. */
const ZUTAT_MUSTER = [
  { re: /haehnchen|hähnchen|huhn|hühner|pute|gefluegel|geflügel|ente/, form: "mit_gefluegel" },
  { re: /hack|rind|schwein|speck|schinken|salami|chorizo|wurst|lamm|fleisch|kassler/, form: "mit_fleisch" },
  { re: /lachs|fisch|thunfisch|hering|makrele|kabeljau|sardell|anchovis|scholle|forelle/, form: "mit_fisch", allergen: "fisch" },
  { re: /garnele|shrimp|krabbe|hummer|scampi/, form: "mit_fisch", allergen: "krebstiere" },
  { re: /muschel|tintenfisch|calamari|austern/, form: "mit_fisch", allergen: "weichtiere" },
  { re: /milch|sahne|butter|joghurt|quark|kaese|käse|parmesan|feta|mozzarella|schmand|creme fraiche|crème fraîche|ghee|molke/,
    nicht: /hafermilch|sojamilch|mandelmilch|kokosmilch|reismilch|pflanzendrink|hafer-drink|margarine|kokosjoghurt|sojajoghurt/,
    allergen: "laktose", tierisch: true },
  { re: /ing_ei\b|\bei\b|\beier\b|eigelb|eiweiss|eiweiß|mayonnaise/, allergen: "ei", tierisch: true },
  { re: /honig/, tierisch: true },
  { re: /mehl|nudel|pasta|spaghetti|brot|baguette|toast|couscous|bulgur|grieß|griess|paniermehl|semmelbrösel|tortilla|wrap|hafer|dinkel|weizen|roggen|gerste|seitan|panko/,
    nicht: /buchweizen|maismehl|reismehl|kichererbsenmehl|mandelmehl|glutenfrei/,
    allergen: "gluten" },
  { re: /soja|tofu|tempeh|edamame|miso/, allergen: "soja" },
  { re: /erdnuss|erdnüsse|erdnuesse/, allergen: "erdnuss" },
  { re: /nuss|nüsse|nuesse|mandel|cashew|pistazie|hasel|walnuss|pekan|pinienkern/,
    nicht: /erdnuss|erdnüsse|erdnuesse|muskatnuss|kokosnuss/,
    allergen: "schalenfruechte" },
  { re: /sesam|tahin/, allergen: "sesam" },
  { re: /senf/, allergen: "senf" },
  { re: /sellerie/, allergen: "sellerie" },
];

function tagsAusZutaten(zutaten = []) {
  const formen = new Set();
  const allergene = new Set();
  let tierisch = false;
  for (const z of zutaten) {
    const text = `${z.zutat_id || ""} ${z.zutat_name || ""}`.toLowerCase();
    if (!text.trim()) continue;
    for (const m of ZUTAT_MUSTER) {
      if (!m.re.test(text)) continue;
      if (m.nicht?.test(text)) continue;
      if (m.form) { formen.add(m.form); tierisch = true; }
      if (m.allergen) allergene.add(m.allergen);
      if (m.tierisch) tierisch = true;
    }
  }
  // Geflügel gilt in der Kern-DB immer auch als Fleisch – gleiche Schreibweise halten.
  if (formen.has("mit_gefluegel")) formen.add("mit_fleisch");
  const ernaehrungsform = [...formen];
  if (formen.has("mit_fisch") && !formen.has("mit_fleisch")) ernaehrungsform.unshift("pescetarisch");
  if (!formen.has("mit_fisch") && !formen.has("mit_fleisch")) {
    ernaehrungsform.push("vegetarisch");
    if (!tierisch) ernaehrungsform.unshift("vegan");
  }
  return { ernaehrungsform, allergene: [...allergene] };
}

/* ------------------------------------------------------- Eigenes Rezept */
const EDITOR_EINHEITEN = ["g", "ml", "Stk", "EL", "TL", "Prise", "Dose", "Pck", "Bund", "Zehe", "Stange", "nach_Bedarf"];
const MAHLZEITEN = [
  { id: "fruehstueck", name: "Frühstück" },
  { id: "mittag", name: "Mittag" },
  { id: "abend", name: "Abend" },
  { id: "snack", name: "Snack" },
];
const SCHWIERIGKEITEN = ["einfach", "mittel", "fortgeschritten"];

const leereZutat = () => ({ menge: "", einheit: "g", zutat_name: "", optional: false });
const leererSchritt = () => ({ text: "", minuten: "", timer_name: "" });

function leererEntwurf() {
  return {
    id: null, name: "", kategorie: "", cuisine: "",
    mahlzeitentyp: ["mittag", "abend"], portionen: 2, schwierigkeit: "einfach", zeit: "",
    zutaten: [leereZutat(), leereZutat(), leereZutat()],
    schritte: [leererSchritt(), leererSchritt()],
    ernaehrungsform: [], allergene: [], tagsManuell: false,
    hinweis: "", notiz: "",
  };
}

/* Bearbeiten: gespeichertes Rezept zurück in die Editor-Form übersetzen. */
function entwurfAus(rezept) {
  return {
    id: rezept.id,
    name: rezept.name || "",
    kategorie: rezept.kategorie || "",
    cuisine: rezept.cuisine || "",
    mahlzeitentyp: [...(rezept.mahlzeitentyp || [])],
    portionen: rezept.portionen || 2,
    schwierigkeit: rezept.schwierigkeit || "einfach",
    zeit: rezept.gesamtzeit_min?.gesamt || "",
    zutaten: (rezept.zutaten || []).map((z) => ({
      menge: z.menge ?? "", einheit: z.einheit || "g", zutat_name: z.zutat_name || "", optional: !!z.optional,
    })).concat(leereZutat()),
    schritte: (rezept.schritte || []).map((s) => ({
      text: s.text || "",
      minuten: s.dauer_sekunden ? Math.round(s.dauer_sekunden / 60) : "",
      timer_name: s.timer_name || "",
    })).concat(leererSchritt()),
    ernaehrungsform: [...(rezept.ernaehrungsform || [])],
    allergene: [...(rezept.allergene || [])],
    tagsManuell: true,          // Bestehendes nicht ungefragt überschreiben
    hinweis: rezept.naehrwert_einordnung?.makro_hinweis || "",
    notiz: rezept.notiz || "",
  };
}

const zahl = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* Was der Editor an Zeilen liefert, wird hier auf das Rezeptschema normalisiert. */
function entwurfZutaten(entwurf, katalog) {
  return (entwurf.zutaten || [])
    .map((z) => ({
      menge: zahl(z.menge),
      einheit: z.einheit || "nach_Bedarf",
      zutat_id: zutatIdFuer(z.zutat_name, katalog),
      zutat_name: String(z.zutat_name || "").trim(),
      optional: !!z.optional,
    }))
    .filter((z) => z.zutat_name);
}

function entwurfSchritte(entwurf) {
  return (entwurf.schritte || [])
    .map((s) => ({ text: String(s.text || "").trim(), min: zahl(s.minuten), name: String(s.timer_name || "").trim() }))
    .filter((s) => s.text)
    .map((s, i) => ({
      nr: i + 1,
      text: s.text,
      dauer_sekunden: s.min ? Math.round(s.min * 60) : null,
      temperatur_c: null,
      timer_typ: s.min ? "aktiv" : null,
      timer_name: s.min ? (s.name || `Schritt ${i + 1}`) : null,
    }));
}

/* Fehlt etwas Unverzichtbares? Liefert Klartext für den Nutzer, nicht true/false. */
function entwurfFehler(entwurf, katalog) {
  if (!String(entwurf.name || "").trim()) return "Gib dem Rezept einen Namen.";
  if (!entwurfZutaten(entwurf, katalog).length) return "Trag mindestens eine Zutat ein.";
  if (!entwurfSchritte(entwurf).length) return "Trag mindestens einen Schritt ein.";
  return null;
}

function eigenesRezept(entwurf, katalog) {
  const zutaten = entwurfZutaten(entwurf, katalog);
  const schritte = entwurfSchritte(entwurf);
  const auto = tagsAusZutaten(zutaten);
  const formen = entwurf.tagsManuell ? entwurf.ernaehrungsform : auto.ernaehrungsform;
  const garzeit = Math.round(schritte.reduce((n, s) => n + (s.dauer_sekunden || 0), 0) / 60);
  const gesamt = zahl(entwurf.zeit) ? Math.round(zahl(entwurf.zeit)) : Math.max(5, garzeit + 5);
  return {
    id: entwurf.id || `EIG-${Date.now()}`,
    name: String(entwurf.name).trim(),
    typ: "rezept",
    kategorie: String(entwurf.kategorie || "").trim() || "Eigenes Rezept",
    cuisine: String(entwurf.cuisine || "").trim(),
    mahlzeitentyp: entwurf.mahlzeitentyp.length ? [...entwurf.mahlzeitentyp] : ["mittag", "abend"],
    portionen: Math.max(1, Number(entwurf.portionen) || 2),
    schwierigkeit: SCHWIERIGKEITEN.includes(entwurf.schwierigkeit) ? entwurf.schwierigkeit : "einfach",
    zutaten,
    schritte,
    gesamtzeit_min: { vorbereitung: Math.max(0, gesamt - garzeit), garzeit, gesamt },
    // Ohne Form-Tag wäre das Rezept für jedes Profil unsichtbar – Mischkost als Auffangnetz.
    ernaehrungsform: formen.length ? formen : ["mit_fleisch", "mit_gefluegel"],
    allergene: entwurf.tagsManuell ? [...entwurf.allergene] : auto.allergene,
    naehrwert_einordnung: {
      kcal_pro_portion: null, profil: "ausgewogen",
      makro_hinweis: String(entwurf.hinweis || "").trim(),
    },
    substitutionen: [], tags: [],
    quelle_typ: "eigen",
    gespeichert: new Date().toISOString(),
    notiz: String(entwurf.notiz || "").trim(),
  };
}

export {
  KOCHBUCH_FILTER, QUELLE_LABEL, quelleVon,
  istGemerkt, findeGemerkt, merken, vergessen, setzeNotiz, ersetze,
  kochbuchListe, gekochtAnzahl, katalogZutaten,
  EDITOR_EINHEITEN, MAHLZEITEN, SCHWIERIGKEITEN,
  leererEntwurf, entwurfAus, entwurfFehler, eigenesRezept, tagsAusZutaten,
  leereZutat, leererSchritt,
};

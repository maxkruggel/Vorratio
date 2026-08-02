/* Vorratio – Vorrats-Generator (offline).
   Baut aus dem tatsächlichen Bestand neue, kochbare Rezepte zusammen: ohne
   API-Key, ohne Netz, deterministisch pro Seed. Gegenstück zu ai.js – dort
   schreibt Claude ein freies Rezept, hier kombiniert die App vorhandene
   Zutaten nach festen Küchenmustern (Pfanne, Eintopf, Blech, Suppe, Bowl,
   Pasta, Salat) und erzeugt dasselbe Schema kruggel-recipe-db/v1.

   Das Ergebnis ist bewusst kein Kunstwerk, sondern ein belastbarer Vorschlag:
   Garzeiten und Reihenfolgen stammen aus den Grundtechniken (TECH/PREP), die
   Mengen aus den üblichen Portionsgrößen. Jedes erzeugte Rezept durchläuft
   danach denselben Profilfilter wie die Kern-Datenbank. */

import { ZUTATEN } from "./data/kerndb.js";
import { rezeptErlaubt } from "./engine.js";
import { allergeneFuerRezept } from "./data/allergene.js";

const IDX = Object.fromEntries(ZUTATEN.map((z) => [z.id, z]));

/* ------------------------------------------------------------ Rollen-Tabelle
   Welche Funktion hat eine Zutat im Gericht? Eine Zutat kann mehrere Rollen
   haben (Lauch ist Gemüse und Aromat) – die Templates greifen gezielt zu. */
const ROLLEN = {
  basis: {
    ing_reis_weiss: { g: 200, prep: "quellen", zeit: 1200 },
    ing_reis_basmati: { g: 200, prep: "quellen", zeit: 1080 },
    ing_reis_vollkorn: { g: 200, prep: "quellen", zeit: 2100 },
    ing_sushireis: { g: 200, prep: "quellen", zeit: 1200 },
    ing_risottoreis: { g: 200, prep: "quellen", zeit: 1200 },
    ing_nudeln: { g: 250, prep: "kochen", zeit: 600 },
    ing_reisnudeln: { g: 200, prep: "quellen", zeit: 300 },
    ing_ramen_nudeln: { g: 200, prep: "kochen", zeit: 240 },
    ing_udon: { g: 200, prep: "kochen", zeit: 480 },
    ing_glasnudeln: { g: 150, prep: "quellen", zeit: 480 },
    ing_kartoffel: { g: 600, prep: "kochen", zeit: 1500 },
    ing_suesskartoffel: { g: 500, prep: "ofen", zeit: 1800 },
    ing_couscous: { g: 200, prep: "quellen", zeit: 480 },
    ing_bulgur: { g: 200, prep: "quellen", zeit: 900 },
    ing_quinoa: { g: 180, prep: "kochen", zeit: 900 },
    ing_polenta: { g: 180, prep: "kochen", zeit: 900 },
    ing_gnocchi: { g: 400, prep: "braten", zeit: 480 },
    ing_spaetzle: { g: 300, prep: "braten", zeit: 300 },
  },
  protein: {
    ing_tofu_fest: { menge: 1, einheit: "Pck", form: ["vegan", "vegetarisch"], hart: true, kurz: "Tofu", name: "fester Tofu" },
    ing_tofu_natur: { menge: 1, einheit: "Pck", form: ["vegan", "vegetarisch"], hart: true, kurz: "Tofu", name: "Tofu natur" },
    ing_tofu_seiden: { menge: 1, einheit: "Pck", form: ["vegan", "vegetarisch"], weich: true, kurz: "Seidentofu", name: "Seidentofu" },
    ing_raeuchertofu: { menge: 1, einheit: "Pck", form: ["vegan", "vegetarisch"], hart: true, kurz: "Räuchertofu", name: "Räuchertofu" },
    ing_tempeh: { menge: 1, einheit: "Pck", form: ["vegan", "vegetarisch"], hart: true, kurz: "Tempeh", name: "Tempeh" },
    ing_seitan: { menge: 1, einheit: "Pck", form: ["vegan", "vegetarisch"], hart: true, kurz: "Seitan", name: "Seitan" },
    ing_sojagranulat: { menge: 120, einheit: "g", form: ["vegan", "vegetarisch"], einweichen: true, kurz: "Soja", name: "Sojagranulat" },
    ing_edamame: { menge: 200, einheit: "g", form: ["vegan", "vegetarisch"], schnell: true, kurz: "Edamame", name: "Edamame" },
    ing_linsen_rot: { menge: 180, einheit: "g", form: ["vegan", "vegetarisch"], koch: 600, kurz: "Linsen", name: "rote Linsen" },
    ing_linsen_braun: { menge: 180, einheit: "g", form: ["vegan", "vegetarisch"], koch: 1500, kurz: "Linsen", name: "Tellerlinsen" },
    ing_belugalinsen: { menge: 180, einheit: "g", form: ["vegan", "vegetarisch"], koch: 1200, kurz: "Belugalinsen", name: "Belugalinsen" },
    ing_kichererbsen_dose: { menge: 1, einheit: "Dose", form: ["vegan", "vegetarisch"], schnell: true, kurz: "Kichererbsen", name: "Kichererbsen" },
    ing_kidneybohnen_dose: { menge: 1, einheit: "Dose", form: ["vegan", "vegetarisch"], schnell: true, kurz: "Kidneybohnen", name: "Kidneybohnen" },
    ing_bohnen_schwarz_dose: { menge: 1, einheit: "Dose", form: ["vegan", "vegetarisch"], schnell: true, kurz: "Bohnen", name: "schwarze Bohnen" },
    ing_kidney_trocken: { menge: 1, einheit: "Dose", form: ["vegan", "vegetarisch"], schnell: true, kurz: "Bohnen", name: "weiße Bohnen" },
    ing_ei: { menge: 3, einheit: "Stk", form: ["vegetarisch"], allergen: ["ei"], weich: true, kurz: "Ei", name: "Eier" },
    ing_feta: { menge: 1, einheit: "Pck", form: ["vegetarisch"], allergen: ["laktose"], weich: true, kurz: "Feta", name: "Feta" },
    ing_halloumi: { menge: 1, einheit: "Pck", form: ["vegetarisch"], allergen: ["laktose"], hart: true, kurz: "Halloumi", name: "Halloumi" },
    ing_mozzarella: { menge: 1, einheit: "Pck", form: ["vegetarisch"], allergen: ["laktose"], weich: true, kurz: "Mozzarella", name: "Mozzarella" },
    ing_haehnchenbrust: { menge: 2, einheit: "Stk", form: ["mit_gefluegel", "mit_fleisch"], kern: 74, hart: true, kurz: "Hähnchen", name: "Hähnchenbrustfilet" },
    ing_haehnchenkeule: { menge: 3, einheit: "Stk", form: ["mit_gefluegel", "mit_fleisch"], kern: 74, hart: true, kurz: "Hähnchen", name: "Hähnchenkeulen" },
    ing_gefluegel_hack: { menge: 400, einheit: "g", form: ["mit_gefluegel", "mit_fleisch"], kern: 74, hack: true, kurz: "Geflügelhack", name: "Geflügelhack" },
    ing_hackfleisch_rind: { menge: 400, einheit: "g", form: ["mit_fleisch"], kern: 71, hack: true, kurz: "Hack", name: "Rinderhack" },
    ing_hackfleisch_gemischt: { menge: 400, einheit: "g", form: ["mit_fleisch"], kern: 71, hack: true, kurz: "Hack", name: "Hackfleisch" },
    ing_rindergulasch: { menge: 600, einheit: "g", form: ["mit_fleisch"], kern: 63, schmoren: 5400, kurz: "Rind", name: "Schmorfleisch vom Rind" },
    ing_schweineschulter: { menge: 600, einheit: "g", form: ["mit_fleisch"], kern: 63, schmoren: 5400, kurz: "Schwein", name: "Schweineschulter" },
    ing_lamm: { menge: 600, einheit: "g", form: ["mit_fleisch"], kern: 63, schmoren: 5400, kurz: "Lamm", name: "Lammfleisch" },
    ing_lachs: { menge: 2, einheit: "Stk", form: ["pescetarisch", "mit_fisch"], allergen: ["fisch"], kern: 63, weich: true, kurz: "Lachs", name: "Lachsfilet" },
    ing_kabeljau: { menge: 3, einheit: "Stk", form: ["pescetarisch", "mit_fisch"], allergen: ["fisch"], kern: 63, weich: true, kurz: "Kabeljau", name: "Kabeljaufilet" },
    ing_garnelen: { menge: 300, einheit: "g", form: ["pescetarisch"], allergen: ["krebstiere"], schnell: true, kurz: "Garnelen", name: "Garnelen" },
    ing_thunfisch_dose: { menge: 1, einheit: "Dose", form: ["pescetarisch", "mit_fisch"], allergen: ["fisch"], schnell: true, kurz: "Thunfisch", name: "Thunfisch" },
  },
  gemuese: {
    ing_broccoli: { menge: 1, einheit: "Stk", zeit: 420 },
    ing_moehre: { menge: 2, einheit: "Stk", zeit: 480 },
    ing_paprika: { menge: 2, einheit: "Stk", zeit: 360 },
    ing_zucchini: { menge: 2, einheit: "Stk", zeit: 300 },
    ing_aubergine: { menge: 1, einheit: "Stk", zeit: 600 },
    ing_champignons: { menge: 250, einheit: "g", zeit: 420 },
    ing_shiitake: { menge: 200, einheit: "g", zeit: 420 },
    ing_blumenkohl: { menge: 1, einheit: "Stk", zeit: 600 },
    ing_weisskohl: { menge: 1, einheit: "Stk", zeit: 600 },
    ing_chinakohl: { menge: 1, einheit: "Stk", zeit: 300 },
    ing_pak_choi: { menge: 2, einheit: "Stk", zeit: 240 },
    ing_spinat: { menge: 300, einheit: "g", zeit: 180 },
    ing_mangold: { menge: 300, einheit: "g", zeit: 300 },
    ing_gruenkohl: { menge: 300, einheit: "g", zeit: 900 },
    ing_rosenkohl: { menge: 400, einheit: "g", zeit: 900 },
    ing_kohlrabi: { menge: 2, einheit: "Stk", zeit: 480 },
    ing_pastinake: { menge: 2, einheit: "Stk", zeit: 600 },
    ing_rote_bete: { menge: 2, einheit: "Stk", zeit: 1200 },
    ing_kuerbis: { menge: 1, einheit: "Stk", zeit: 900 },
    ing_fenchel: { menge: 1, einheit: "Stk", zeit: 600 },
    ing_spargel: { menge: 400, einheit: "g", zeit: 480 },
    ing_bohnen_gruen: { menge: 300, einheit: "g", zeit: 480 },
    ing_erbsen_tk: { menge: 200, einheit: "g", zeit: 240 },
    ing_gemuese_tk: { menge: 400, einheit: "g", zeit: 420 },
    ing_mais_dose: { menge: 1, einheit: "Dose", zeit: 180 },
    ing_lauch: { menge: 1, einheit: "Stange", zeit: 360 },
    ing_sellerie: { menge: 1, einheit: "Stk", zeit: 480 },
    ing_sprossen: { menge: 150, einheit: "g", zeit: 60 },
  },
  roh: {
    ing_gurke: { menge: 1, einheit: "Stk" },
    ing_tomate_frisch: { menge: 3, einheit: "Stk" },
    ing_roemersalat: { menge: 1, einheit: "Stk" },
    ing_radieschen: { menge: 1, einheit: "Bund" },
    ing_avocado: { menge: 1, einheit: "Stk" },
    ing_paprika: { menge: 1, einheit: "Stk" },
    ing_moehre: { menge: 2, einheit: "Stk" },
    ing_apfel: { menge: 1, einheit: "Stk" },
  },
  aroma: {
    ing_zwiebel: { menge: 1, einheit: "Stk", name: "Zwiebel" },
    ing_schalotte: { menge: 2, einheit: "Stk", name: "Schalotten" },
    ing_knoblauch: { menge: 3, einheit: "Zehe", name: "Knoblauch" },
    ing_ingwer: { menge: 20, einheit: "g", name: "Ingwer" },
    ing_chili_frisch: { menge: 1, einheit: "Stk", name: "Chili" },
    ing_fruehlingszwiebel: { menge: 1, einheit: "Bund", name: "Frühlingszwiebeln" },
  },
  fluessig: {
    ing_tomate_dose: { menge: 1, einheit: "Dose", name: "Tomaten (Dose)", art: "tomatig" },
    ing_passierte_tomaten: { menge: 400, einheit: "g", name: "Passierte Tomaten", art: "tomatig" },
    ing_kokosmilch: { menge: 1, einheit: "Dose", name: "Kokosmilch", art: "cremig" },
    ing_sahne: { menge: 150, einheit: "ml", name: "Sahne", art: "cremig", allergen: ["laktose"] },
    ing_haferdrink: { menge: 200, einheit: "ml", name: "Hafercuisine", art: "cremig" },
    ing_gemuesebruehe: { menge: 600, einheit: "ml", name: "Gemüsebrühe", art: "klar" },
  },
  fett: {
    ing_olivenoel: { menge: 3, einheit: "EL", name: "Olivenöl" },
    ing_rapsoel: { menge: 3, einheit: "EL", name: "Rapsöl" },
    ing_sesamoel: { menge: 1, einheit: "EL", name: "Sesamöl", allergen: ["sesam"] },
    ing_butter: { menge: 30, einheit: "g", name: "Butter", allergen: ["laktose"] },
    ing_butterschmalz: { menge: 30, einheit: "g", name: "Butterschmalz", allergen: ["laktose"] },
  },
  saeure: {
    ing_zitrone: { menge: 1, einheit: "Stk", name: "Zitrone" },
    ing_limette: { menge: 1, einheit: "Stk", name: "Limette" },
    ing_essig: { menge: 1, einheit: "EL", name: "Essig" },
    ing_balsamico: { menge: 1, einheit: "EL", name: "Balsamico" },
    ing_reisessig: { menge: 1, einheit: "EL", name: "Reisessig" },
  },
  kraut: {
    ing_petersilie: { menge: 1, einheit: "Bund", name: "Petersilie" },
    ing_basilikum: { menge: 1, einheit: "Bund", name: "Basilikum" },
    ing_koriander: { menge: 1, einheit: "Bund", name: "Koriander" },
    ing_minze: { menge: 1, einheit: "Bund", name: "Minze" },
    ing_dill: { menge: 1, einheit: "Bund", name: "Dill" },
    ing_schnittlauch: { menge: 1, einheit: "Bund", name: "Schnittlauch" },
  },
  topping: {
    ing_parmesan: { menge: 40, einheit: "g", name: "Parmesan", allergen: ["laktose"] },
    ing_reibekaese: { menge: 60, einheit: "g", name: "geriebener Käse", allergen: ["laktose"] },
    ing_hefeflocken: { menge: 2, einheit: "EL", name: "Hefeflocken" },
    ing_sesamsamen: { menge: 1, einheit: "EL", name: "Sesam", allergen: ["sesam"] },
    ing_erdnuesse: { menge: 40, einheit: "g", name: "Erdnüsse", allergen: ["erdnuss"] },
    ing_mandeln: { menge: 40, einheit: "g", name: "Mandeln", allergen: ["schalenfruechte"] },
    ing_walnuesse: { menge: 40, einheit: "g", name: "Walnüsse", allergen: ["schalenfruechte"] },
    ing_sonnenblumenkerne: { menge: 2, einheit: "EL", name: "Sonnenblumenkerne" },
  },
};

/* Würzrichtungen: bestimmen Name, Küche und die Gewürzschritte. Jede Richtung
   braucht mindestens eine Leitzutat aus `leit`, sonst wird sie nicht gewählt. */
const RICHTUNGEN = [
  {
    id: "mediterran", cuisine: "mediterran", label: "Mediterran",
    leit: ["ing_oregano", "ing_kraeuter_provence", "ing_thymian", "ing_rosmarin", "ing_basilikum"],
    wuerze: ["ing_oregano", "ing_kraeuter_provence", "ing_thymian"],
    tags: ["mediterran"], saeure: ["ing_zitrone", "ing_balsamico", "ing_essig"],
  },
  {
    id: "indisch", cuisine: "indisch", label: "Indisch",
    leit: ["ing_currypulver", "ing_garam_masala", "ing_kurkuma", "ing_currypaste"],
    wuerze: ["ing_currypulver", "ing_garam_masala", "ing_kurkuma", "ing_kreuzkuemmel"],
    tags: [], saeure: ["ing_zitrone", "ing_limette"],
  },
  {
    id: "asiatisch", cuisine: "asiatisch", label: "Asiatisch",
    leit: ["ing_sojasauce", "ing_misopaste", "ing_gochujang", "ing_currypaste", "ing_fischsauce"],
    wuerze: ["ing_sojasauce", "ing_sesamoel", "ing_ingwer"],
    tags: [], saeure: ["ing_limette", "ing_reisessig"],
  },
  {
    id: "orientalisch", cuisine: "levantinisch", label: "Orientalisch",
    leit: ["ing_ras_el_hanout", "ing_harissa", "ing_kreuzkuemmel", "ing_tahin"],
    wuerze: ["ing_ras_el_hanout", "ing_kreuzkuemmel", "ing_paprikapulver"],
    tags: [], saeure: ["ing_zitrone"],
  },
  {
    id: "mexikanisch", cuisine: "mexikanisch", label: "Mexikanisch",
    leit: ["ing_pimenton", "ing_chiliflocken", "ing_kreuzkuemmel", "ing_sriracha"],
    wuerze: ["ing_kreuzkuemmel", "ing_pimenton", "ing_chiliflocken"],
    tags: [], saeure: ["ing_limette"],
  },
  {
    id: "deutsch", cuisine: "deutsch", label: "Bodenständig",
    leit: ["ing_senf", "ing_lorbeer", "ing_kreuzkuemmel", "ing_paprikapulver"],
    wuerze: ["ing_paprikapulver", "ing_lorbeer", "ing_senf"],
    tags: [], saeure: ["ing_essig"],
  },
];

/* ------------------------------------------------------------------ Zufall
   FNV-1a wie in der Engine: gleicher Seed → gleiche Rezepte, "neu würfeln"
   zählt den Seed hoch. */
function rng(seed) {
  let h = 2166136261 ^ seed;
  return () => {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    h ^= h >>> 15;
    return ((h >>> 0) % 100000) / 100000;
  };
}
const waehle = (liste, r) => liste[Math.floor(r() * liste.length) % liste.length];
function waehleMehrere(liste, anzahl, r) {
  const pool = [...liste];
  const out = [];
  while (pool.length && out.length < anzahl) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/* Bestand → verfügbare IDs. "pauschal"-Artikel gelten als da, solange sie
   nicht ausdrücklich auf leer stehen (Toleranzprinzip aus der Engine). */
function verfuegbar(bestand) {
  const ids = new Set();
  for (const b of bestand) {
    if (!b.zutat_id) continue;
    if (b.art === "pauschal") { if (b.menge !== 0) ids.add(b.zutat_id); continue; }
    if (b.menge == null || b.menge > 0) ids.add(b.zutat_id);
  }
  // Grundausstattung (Salz, Pfeffer, Öl …) zählt immer als vorhanden
  for (const z of ZUTATEN) if (z.basis) ids.add(z.id);
  return ids;
}

const inRolle = (rolle, ids) => Object.keys(ROLLEN[rolle]).filter((id) => ids.has(id));
const zutat = (id, spec, extra = {}) => ({
  menge: spec.menge ?? null,
  einheit: spec.einheit ?? "nach_Bedarf",
  zutat_id: id,
  zutat_name: spec.name || IDX[id]?.name || id,
  optional: false,
  ...extra,
});

/* ---------------------------------------------------------------- Templates
   Jedes Template liefert { name, kategorie, zutaten, schritte, zeit, tags }.
   Die Schrittfolgen bilden die Grundtechniken ab (anbraten → ablöschen →
   garen → abschmecken) und tragen überall dort Timer, wo gewartet wird. */

function schritt(nr, text, dauer = null, typ = null, name = null, temp = null) {
  return { nr, text, dauer_sekunden: dauer, temperatur_c: temp, timer_typ: dauer ? typ : null, timer_name: dauer ? name : null };
}

function proteinSchritte(pid, pspec, ab, richtung) {
  // Liefert [vorbereitende Schritte], gibt die Garlogik je Proteintyp vor.
  const texte = [];
  if (pspec.hart && pid.startsWith("ing_tofu") || pid === "ing_raeuchertofu" || pid === "ing_tempeh") {
    texte.push(["Tofu zwischen Küchenpapier pressen, damit er Wasser verliert – nur trockener Tofu wird knusprig.", 900, "ruhen", "Tofu pressen"]);
    texte.push(["Tofu würfeln und in heißem Öl rundum goldbraun braten, dann herausnehmen.", 600, "aktiv", "Tofu braten"]);
  } else if (pspec.hack) {
    texte.push([`${pspec.name} krümelig anbraten, bis die Flüssigkeit verdampft ist und es wirklich brät.`, 480, "aktiv", "Hack anbraten"]);
    texte.push([`Durchgaren – ${pspec.kern} °C Kerntemperatur sind Pflicht.`, null, null, null, pspec.kern]);
  } else if (pspec.schmoren) {
    texte.push([`${pspec.name} in große Würfel schneiden, trockentupfen und portionsweise scharf anbraten.`, 720, "aktiv", "Fleisch anbraten"]);
  } else if (pspec.koch) {
    texte.push([`${pspec.name} abspülen und in reichlich Wasser garen. Salz erst gegen Ende zugeben.`, pspec.koch, "passiv", "Hülsenfrüchte garen"]);
  } else if (pspec.einweichen) {
    texte.push(["Sojagranulat in heißer Brühe einweichen und danach kräftig ausdrücken – ausgedrückt brät es, nass dünstet es nur.", 900, "passiv", "Granulat einweichen"]);
    texte.push(["Granulat in heißem Öl braun braten.", 480, "aktiv", "Granulat braten"]);
  } else if (pspec.kern && pspec.hart) {
    texte.push([`${pspec.name} trockentupfen, salzen und in heißem Öl scharf anbraten.`, 600, "aktiv", "Anbraten"]);
    texte.push([`Kerntemperatur prüfen: mindestens ${pspec.kern} °C.`, null, null, null, pspec.kern]);
  } else if (pspec.weich && pspec.kern) {
    texte.push([`${pspec.name} erst zum Schluss einlegen und bei kleiner Hitze ziehen lassen, bis es glasig-blättrig ist (${pspec.kern} °C).`, 480, "passiv", "Fisch pochieren", pspec.kern]);
  } else if (pspec.schnell) {
    texte.push([`${pspec.name} abtropfen lassen und erst in den letzten Minuten zugeben.`, 300, "passiv", "Erwärmen"]);
  } else {
    texte.push([`${pspec.name} vorbereiten und bereitstellen.`, null, null, null]);
  }
  return texte;
}

function baueRezept(template, ids, r, profilName) {
  const richtungen = RICHTUNGEN.filter((ri) => ri.leit.some((l) => ids.has(l)));
  const richtung = richtungen.length ? waehle(richtungen, r) : RICHTUNGEN[0];

  const fettIds = inRolle("fett", ids);
  const aromaIds = inRolle("aroma", ids);
  const proteinIds = inRolle("protein", ids);
  const gemueseIds = inRolle("gemuese", ids);
  const basisIds = inRolle("basis", ids);
  const fluessigIds = inRolle("fluessig", ids);
  const krautIds = inRolle("kraut", ids);
  const toppingIds = inRolle("topping", ids);
  const rohIds = inRolle("roh", ids);

  const t = template(
    { richtung, fettIds, aromaIds, proteinIds, gemueseIds, basisIds, fluessigIds, krautIds, toppingIds, rohIds },
    ids, r,
  );
  if (!t) return null;

  // Eine Zutat kann in zwei Rollen landen (Ingwer als Aromat und als Würze,
  // Sesamöl als Fett und als Würze) – in der Zutatenliste steht sie einmal.
  const gesehen = new Set();
  t.zutaten = t.zutaten.filter((z) => {
    if (gesehen.has(z.zutat_id)) return false;
    gesehen.add(z.zutat_id);
    return true;
  });

  const formen = t.formen;
  const gesamt = Math.round(t.zeit / 60);
  const id = `GEN-${Math.abs(hash(t.name + formen.join() + t.zutaten.map((z) => z.zutat_id).join()))}`;

  const rezept = {
    id,
    name: t.name,
    typ: "rezept",
    kategorie: t.kategorie,
    cuisine: richtung.cuisine,
    mahlzeitentyp: t.slots,
    portionen: 3,
    schwierigkeit: t.schritte.length > 8 ? "mittel" : "einfach",
    zutaten: t.zutaten,
    schritte: t.schritte.map((s, i) => ({ ...s, nr: i + 1 })),
    gesamtzeit_min: { vorbereitung: 15, garzeit: Math.max(5, gesamt - 15), gesamt: Math.max(20, gesamt) },
    ernaehrungsform: formen,
    allergene: [],
    naehrwert_einordnung: {
      kcal_pro_portion: null,
      profil: t.profil,
      makro_hinweis: t.hinweis,
    },
    substitutionen: t.substitutionen || [],
    tags: [...new Set([...(t.tags || []), ...richtung.tags, "aus-vorrat"])],
    quelle_typ: "vorrat_generiert",
    erzeugt_fuer: profilName || null,
    erstellt: new Date().toISOString(),
  };
  // Allergene aus den Zutaten ableiten – dieselbe Tabelle, gegen die auch die
  // Kern-DB und die AI-Rezepte geprüft werden (js/data/allergene.js).
  rezept.allergene = [...allergeneFuerRezept(rezept)].sort();
  return rezept;
}

function hash(str) {
  let h = 0;
  for (const c of str) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return h;
}

/* Gemeinsamer Baustein: Aromaten anschwitzen. */
function aromaBlock(ctx, r, zutaten, schritte) {
  const fett = ctx.fettIds.length ? waehle(ctx.fettIds, r) : "ing_olivenoel";
  zutaten.push(zutat(fett, ROLLEN.fett[fett] || { menge: 2, einheit: "EL" }));
  const aromaten = waehleMehrere(ctx.aromaIds, 2, r);
  for (const a of aromaten) zutaten.push(zutat(a, ROLLEN.aroma[a]));
  if (aromaten.length) {
    const namen = aromaten.map((a) => ROLLEN.aroma[a].name).join(" und ");
    schritte.push(schritt(0, `${namen} fein schneiden und in Öl glasig dünsten – das ist die Aromabasis, die trägt das ganze Gericht.`, 300, "aktiv", "Aromaten dünsten"));
  }
  return { fett, aromaten };
}

function wuerzBlock(ctx, ids, r, zutaten, schritte, textZusatz = "") {
  const gew = ctx.richtung.wuerze.filter((w) => ids.has(w));
  if (!gew.length) return;
  for (const g of gew) zutaten.push(zutat(g, { menge: 1, einheit: "TL", name: IDX[g]?.name || g }));
  const namen = gew.map((g) => IDX[g]?.name || g).join(", ");
  schritte.push(schritt(0, `${namen} zugeben und kurz mitrösten, bis es duftet. Trockenes Anrösten löst deutlich mehr Aroma als das bloße Einrühren.${textZusatz}`, 60, "aktiv", "Gewürze rösten"));
}

function saeureBlock(ctx, ids, r, zutaten, schritte) {
  const kandidaten = ctx.richtung.saeure.filter((s) => ids.has(s));
  if (!kandidaten.length) return;
  const s = waehle(kandidaten, r);
  zutaten.push(zutat(s, ROLLEN.saeure[s]));
  schritte.push(schritt(0, `Zum Schluss mit ${ROLLEN.saeure[s].name} und Salz abschmecken. Die Säure am Ende ist das, was ein Gericht rund macht – und sie verbessert die Eisenaufnahme aus Hülsenfrüchten und Gemüse.`));
}

function krautBlock(ctx, r, zutaten, schritte) {
  if (!ctx.krautIds.length) return;
  const k = waehle(ctx.krautIds, r);
  zutaten.push(zutat(k, ROLLEN.kraut[k]));
  schritte.push(schritt(0, `${ROLLEN.kraut[k].name} grob hacken und erst über das fertige Gericht geben.`));
}

const TEMPLATES = {
  pfanne(ctx, ids, r) {
    if (!ctx.proteinIds.length || ctx.gemueseIds.length < 1) return null;
    const pid = waehle(ctx.proteinIds, r);
    const pspec = ROLLEN.protein[pid];
    if (pspec.schmoren) return null;
    const gem = waehleMehrere(ctx.gemueseIds, 2, r);
    const bid = ctx.basisIds.length ? waehle(ctx.basisIds, r) : null;

    const zutaten = [];
    const schritte = [];
    zutaten.push(zutat(pid, pspec));
    for (const g of gem) zutaten.push(zutat(g, ROLLEN.gemuese[g]));
    if (bid) zutaten.push(zutat(bid, { menge: ROLLEN.basis[bid].g, einheit: "g" }));

    if (bid) schritte.push(schritt(0, `${IDX[bid].name} nach Grundrezept garen und beiseitestellen.`, ROLLEN.basis[bid].zeit, "passiv", `${IDX[bid].name} garen`));
    for (const [text, dauer, typ, name, temp] of proteinSchritte(pid, pspec, null, ctx.richtung)) {
      schritte.push(schritt(0, text, dauer, typ, name, temp));
    }
    aromaBlock(ctx, r, zutaten, schritte);
    wuerzBlock(ctx, ids, r, zutaten, schritte);
    const gemZeit = Math.max(...gem.map((g) => ROLLEN.gemuese[g].zeit));
    schritte.push(schritt(0, `${gem.map((g) => IDX[g].name).join(" und ")} in gleich große Stücke schneiden und bei hoher Hitze braten – festes Gemüse zuerst, weiches später.`, gemZeit, "aktiv", "Gemüse braten"));
    schritte.push(schritt(0, "Alles zusammenführen und einmal kräftig durchschwenken.", 120, "aktiv", "Durchschwenken"));
    saeureBlock(ctx, ids, r, zutaten, schritte);
    krautBlock(ctx, r, zutaten, schritte);

    return {
      name: `${pspec.kurz}-Pfanne ${ctx.richtung.label.toLowerCase()}`,
      kategorie: "Pfannengericht", slots: ["mittag", "abend"],
      zutaten, schritte,
      zeit: schritte.reduce((s, x) => s + (x.dauer_sekunden || 0), 0) + 600,
      formen: pspec.form,
      profil: "proteinreich",
      hinweis: "Aus deinem Bestand kombiniert: eine Proteinquelle, zwei Gemüse und eine klare Würzrichtung.",
      tags: ["aus-vorrat", "schnell"],
    };
  },

  eintopf(ctx, ids, r) {
    if (!ctx.proteinIds.length || !ctx.fluessigIds.length) return null;
    const pid = waehle(ctx.proteinIds, r);
    const pspec = ROLLEN.protein[pid];
    const fid = waehle(ctx.fluessigIds, r);
    const fspec = ROLLEN.fluessig[fid];
    const gem = waehleMehrere(ctx.gemueseIds, 2, r);
    if (!gem.length) return null;

    const zutaten = [zutat(pid, pspec), zutat(fid, fspec)];
    for (const g of gem) zutaten.push(zutat(g, ROLLEN.gemuese[g]));
    const schritte = [];

    aromaBlock(ctx, r, zutaten, schritte);
    wuerzBlock(ctx, ids, r, zutaten, schritte);
    for (const [text, dauer, typ, name, temp] of proteinSchritte(pid, pspec, null, ctx.richtung)) {
      schritte.push(schritt(0, text, dauer, typ, name, temp));
    }
    schritte.push(schritt(0, `${gem.map((g) => IDX[g].name).join(" und ")} in Stücke schneiden und kurz mitbraten.`, 300, "aktiv", "Gemüse anbraten"));
    schritte.push(schritt(0, `${fspec.name} angießen und aufkochen.`, 180, "aktiv", "Angießen"));
    const schmorZeit = pspec.schmoren || 1500;
    const koechelTipp = pspec.schmoren
      ? "Es soll leise blubbern, nicht sprudeln – zu viel Hitze macht Schmorfleisch zäh statt zart."
      : "Es soll leise blubbern, nicht sprudeln – sprudelnd kochend zerfällt das Gemüse zu Brei.";
    schritte.push(schritt(0, `Zugedeckt bei kleiner Hitze köcheln lassen. ${koechelTipp}`, schmorZeit, "passiv", "Eintopf köcheln", pspec.schmoren ? 95 : null));
    if (fspec.art === "cremig") schritte.push(schritt(0, `${fspec.name} nicht mehr kochen lassen, sonst flockt sie aus.`));
    saeureBlock(ctx, ids, r, zutaten, schritte);
    krautBlock(ctx, r, zutaten, schritte);

    return {
      name: `${pspec.kurz}-Eintopf ${ctx.richtung.label.toLowerCase()}`,
      kategorie: "Suppe/Eintopf", slots: ["mittag", "abend"],
      zutaten, schritte,
      zeit: schritte.reduce((s, x) => s + (x.dauer_sekunden || 0), 0) + 600,
      formen: pspec.form,
      profil: "ballaststoffreich",
      hinweis: "Ein-Topf-Gericht aus dem Bestand – lässt sich gut in doppelter Menge kochen und einfrieren.",
      tags: ["one-pot", "mealprep"],
    };
  },

  blech(ctx, ids, r) {
    if (ctx.gemueseIds.length < 2) return null;
    const gem = waehleMehrere(ctx.gemueseIds, 3, r);
    const pid = ctx.proteinIds.length ? waehle(ctx.proteinIds, r) : null;
    const pspec = pid ? ROLLEN.protein[pid] : null;
    if (pspec && pspec.schmoren) return null;

    const zutaten = [];
    for (const g of gem) zutaten.push(zutat(g, ROLLEN.gemuese[g]));
    if (pid) zutaten.push(zutat(pid, pspec));
    const schritte = [];
    const fett = ctx.fettIds.length ? waehle(ctx.fettIds, r) : "ing_olivenoel";
    zutaten.push(zutat(fett, ROLLEN.fett[fett] || { menge: 3, einheit: "EL" }));

    schritte.push(schritt(0, "Ofen auf 210 °C vorheizen.", 600, "ofen", "Ofen vorheizen", 210));
    schritte.push(schritt(0, `${gem.map((g) => IDX[g].name).join(", ")} in gleich große Stücke schneiden. Gleich groß ist wichtiger als klein – sonst wird das eine matschig, während das andere noch roh ist.`, 600, "aktiv", "Gemüse schneiden"));
    wuerzBlock(ctx, ids, r, zutaten, schritte, " Die Gewürze hier gleich mit dem Öl vermischen.");
    schritte.push(schritt(0, "Alles mit Öl und Salz mischen und in EINER Lage aufs Blech geben – gestapeltes Gemüse dünstet, statt zu rösten.", 240, "aktiv", "Blech belegen"));
    schritte.push(schritt(0, "Im Ofen rösten und nach der Hälfte einmal wenden.", 1500, "ofen", "Gemüse rösten", 210));
    if (pid) {
      schritte.push(schritt(0, `${pspec.name} vorbereiten, würzen und in den letzten 20 Minuten mit aufs Blech geben.`, 1200, "ofen", `${pspec.name} mitgaren`, pspec.kern || null));
    }
    saeureBlock(ctx, ids, r, zutaten, schritte);
    if (ctx.toppingIds.length) {
      const t = waehle(ctx.toppingIds, r);
      zutaten.push(zutat(t, ROLLEN.topping[t]));
      schritte.push(schritt(0, `${ROLLEN.topping[t].name} über das fertige Blech geben.`));
    }

    return {
      name: `Ofenblech mit ${gem.map((g) => IDX[g].name.split(" ")[0]).join(", ")}`,
      kategorie: "Ofengericht", slots: ["mittag", "abend"],
      zutaten, schritte,
      zeit: schritte.reduce((s, x) => s + (x.dauer_sekunden || 0), 0) + 300,
      formen: pspec ? pspec.form : ["vegan", "vegetarisch"],
      profil: "ballaststoffreich",
      hinweis: "Ein Blech, wenig Aufwand, viel Gemüse – die einfachste Art, den Frischebestand abzuarbeiten.",
      tags: ["mealprep", "one-pot"],
    };
  },

  suppe(ctx, ids, r) {
    if (ctx.gemueseIds.length < 2 || !ids.has("ing_gemuesebruehe")) return null;
    const gem = waehleMehrere(ctx.gemueseIds, 2, r);
    const zutaten = gem.map((g) => zutat(g, ROLLEN.gemuese[g]));
    zutaten.push(zutat("ing_gemuesebruehe", ROLLEN.fluessig.ing_gemuesebruehe));
    const schritte = [];

    aromaBlock(ctx, r, zutaten, schritte);
    schritte.push(schritt(0, `${gem.map((g) => IDX[g].name).join(" und ")} klein schneiden und kurz mitbraten – anbraten statt nur kochen gibt der Suppe deutlich mehr Tiefe.`, 360, "aktiv", "Gemüse anbraten"));
    wuerzBlock(ctx, ids, r, zutaten, schritte);
    schritte.push(schritt(0, "Brühe angießen und alles weich kochen.", Math.max(...gem.map((g) => ROLLEN.gemuese[g].zeit)) + 600, "passiv", "Suppe kochen"));
    schritte.push(schritt(0, "Fein pürieren – oder nur die Hälfte, wenn etwas Struktur bleiben soll.", 180, "aktiv", "Pürieren"));
    if (ctx.fluessigIds.includes("ing_kokosmilch")) {
      zutaten.push(zutat("ing_kokosmilch", { menge: 150, einheit: "ml", name: "Kokosmilch" }));
      schritte.push(schritt(0, "Kokosmilch einrühren und nur noch erwärmen.", 180, "passiv", "Verfeinern"));
    }
    saeureBlock(ctx, ids, r, zutaten, schritte);
    krautBlock(ctx, r, zutaten, schritte);

    return {
      name: `${gem.map((g) => IDX[g].name.split(" ")[0]).join("-")}-Suppe`,
      kategorie: "Suppe/Eintopf", slots: ["mittag", "abend"],
      zutaten, schritte,
      zeit: schritte.reduce((s, x) => s + (x.dauer_sekunden || 0), 0) + 300,
      formen: ["vegan", "vegetarisch"],
      profil: "kalorienarm",
      hinweis: "Reste-Suppe: Fast jedes Gemüse aus dem Vorrat passt hier hinein. Mit Linsen oder Tofu wird sie zur Hauptmahlzeit.",
      tags: ["budget", "resteverwertung", "one-pot"],
    };
  },

  pasta(ctx, ids, r) {
    if (!ids.has("ing_nudeln")) return null;
    const sauceId = ["ing_passierte_tomaten", "ing_tomate_dose", "ing_sahne", "ing_haferdrink"].find((s) => ids.has(s));
    if (!sauceId) return null;
    const gem = waehleMehrere(ctx.gemueseIds, 2, r);
    if (!gem.length) return null;

    const zutaten = [zutat("ing_nudeln", { menge: 300, einheit: "g", name: "Nudeln" }), zutat(sauceId, ROLLEN.fluessig[sauceId])];
    for (const g of gem) zutaten.push(zutat(g, ROLLEN.gemuese[g]));
    const schritte = [];

    aromaBlock(ctx, r, zutaten, schritte);
    schritte.push(schritt(0, `${gem.map((g) => IDX[g].name).join(" und ")} klein schneiden und anbraten.`, Math.max(...gem.map((g) => ROLLEN.gemuese[g].zeit)), "aktiv", "Gemüse braten"));
    wuerzBlock(ctx, ids, r, zutaten, schritte);
    schritte.push(schritt(0, `${ROLLEN.fluessig[sauceId].name} angießen und die Sauce einkochen lassen.`, 900, "passiv", "Sauce einkochen"));
    schritte.push(schritt(0, "Nudeln in reichlich Salzwasser al dente kochen und eine Tasse Kochwasser aufheben.", 600, "aktiv", "Nudeln kochen"));
    schritte.push(schritt(0, "Nudeln mit einem Schöpfer Kochwasser in der Sauce schwenken – die Stärke im Wasser bindet die Sauce an die Nudeln.", 120, "aktiv", "Schwenken"));
    if (ctx.toppingIds.length) {
      const t = waehle(ctx.toppingIds, r);
      zutaten.push(zutat(t, ROLLEN.topping[t]));
      schritte.push(schritt(0, `Mit ${ROLLEN.topping[t].name} servieren.`));
    }
    krautBlock(ctx, r, zutaten, schritte);

    const cremig = ["ing_sahne", "ing_haferdrink"].includes(sauceId);
    return {
      name: `Pasta mit ${gem.map((g) => IDX[g].name.split(" ")[0]).join(" und ")}`,
      kategorie: "Nudelgericht", slots: ["mittag", "abend"],
      zutaten, schritte,
      zeit: schritte.reduce((s, x) => s + (x.dauer_sekunden || 0), 0) + 300,
      formen: sauceId === "ing_sahne" ? ["vegetarisch"] : ["vegan", "vegetarisch"],
      profil: "kohlenhydratreich",
      hinweis: cremig ? "Cremige Sauce – mit Hülsenfrüchten oder Tofu wird die Proteinseite runder."
        : "Tomatenbasis aus dem Vorrat; mit Linsen oder Tofu wird daraus eine vollwertige Hauptmahlzeit.",
      tags: ["schnell", "budget"],
    };
  },

  bowl(ctx, ids, r) {
    if (!ctx.basisIds.length || !ctx.proteinIds.length || ctx.rohIds.length < 2) return null;
    const bid = waehle(ctx.basisIds, r);
    const pid = waehle(ctx.proteinIds, r);
    const pspec = ROLLEN.protein[pid];
    if (pspec.schmoren) return null;
    const roh = waehleMehrere(ctx.rohIds, 3, r);

    const zutaten = [zutat(bid, { menge: ROLLEN.basis[bid].g, einheit: "g" }), zutat(pid, pspec)];
    for (const g of roh) zutaten.push(zutat(g, ROLLEN.roh[g]));
    const schritte = [];

    schritte.push(schritt(0, `${IDX[bid].name} nach Grundrezept garen und ausdampfen lassen.`, ROLLEN.basis[bid].zeit, "passiv", `${IDX[bid].name} garen`));
    for (const [text, dauer, typ, name, temp] of proteinSchritte(pid, pspec, null, ctx.richtung)) {
      schritte.push(schritt(0, text, dauer, typ, name, temp));
    }
    wuerzBlock(ctx, ids, r, zutaten, schritte);
    schritte.push(schritt(0, `${roh.map((g) => IDX[g].name).join(", ")} in feine Streifen oder Würfel schneiden.`, 480, "aktiv", "Rohkost schneiden"));
    saeureBlock(ctx, ids, r, zutaten, schritte);
    schritte.push(schritt(0, "Alle Komponenten nebeneinander in die Schüssel setzen statt sie zu vermischen – so bleibt jede Zutat für sich schmeckbar."));
    if (ctx.toppingIds.length) {
      const t = waehle(ctx.toppingIds, r);
      zutaten.push(zutat(t, ROLLEN.topping[t]));
      schritte.push(schritt(0, `Mit ${ROLLEN.topping[t].name} bestreuen.`));
    }

    return {
      name: `${pspec.kurz}-Bowl mit ${IDX[bid].name.split(" ")[0]}`,
      kategorie: "Bowl", slots: ["mittag", "abend"],
      zutaten, schritte,
      zeit: schritte.reduce((s, x) => s + (x.dauer_sekunden || 0), 0) + 300,
      formen: pspec.form,
      profil: "ausgewogen",
      hinweis: "Bowl-Prinzip: eine Getreidebasis, eine Proteinquelle, viel Rohkost, eine säurebetonte Sauce.",
      tags: ["mealprep", "high-protein"],
    };
  },

  salat(ctx, ids, r) {
    if (ctx.rohIds.length < 3 || !ctx.proteinIds.length) return null;
    const roh = waehleMehrere(ctx.rohIds, 3, r);
    const proteine = ctx.proteinIds.filter((p) => ROLLEN.protein[p].schnell || ROLLEN.protein[p].hart);
    if (!proteine.length) return null;
    const pid = waehle(proteine, r);
    const pspec = ROLLEN.protein[pid];

    const zutaten = [zutat(pid, pspec)];
    for (const g of roh) zutaten.push(zutat(g, ROLLEN.roh[g]));
    const schritte = [];
    const fett = ctx.fettIds.length ? waehle(ctx.fettIds, r) : "ing_olivenoel";
    zutaten.push(zutat(fett, ROLLEN.fett[fett] || { menge: 3, einheit: "EL" }));

    schritte.push(schritt(0, `${roh.map((g) => IDX[g].name).join(", ")} waschen und in mundgerechte Stücke schneiden.`, 480, "aktiv", "Gemüse schneiden"));
    for (const [text, dauer, typ, name, temp] of proteinSchritte(pid, pspec, null, ctx.richtung)) {
      schritte.push(schritt(0, text, dauer, typ, name, temp));
    }
    saeureBlock(ctx, ids, r, zutaten, schritte);
    schritte.push(schritt(0, "Öl, Säure, Salz und Pfeffer zu einem Dressing verrühren, bis es sichtbar emulgiert.", 120, "aktiv", "Dressing rühren"));
    schritte.push(schritt(0, "Erst kurz vor dem Servieren mischen – zu früh angemacht fällt der Salat zusammen."));
    krautBlock(ctx, r, zutaten, schritte);

    return {
      name: `${pspec.kurz}-Salat aus dem Vorrat`,
      kategorie: "Salat", slots: ["mittag"],
      zutaten, schritte,
      zeit: schritte.reduce((s, x) => s + (x.dauer_sekunden || 0), 0) + 300,
      formen: pspec.form,
      profil: "kalorienarm",
      hinweis: "Leichte Mahlzeit; die Proteinkomponente macht aus der Beilage ein Hauptgericht.",
      tags: ["schnell", "low-carb"],
    };
  },
};

const TEMPLATE_ORDER = ["pfanne", "eintopf", "blech", "pasta", "bowl", "suppe", "salat"];

/* Öffentliche API: liefert bis zu `anzahl` neue Rezepte aus dem Bestand,
   gefiltert gegen das Profil (gleiche Regeln wie die Kern-Datenbank). */
function generiereAusVorrat(profil, bestand, slot = "mittag", anzahl = 3, seed = 0) {
  const ids = verfuegbar(bestand);
  const r = rng(seed || 1);
  const out = [];
  const gesehen = new Set();

  // Mehrere Runden über die Templates, damit auch bei schmalem Bestand
  // genug Varianten entstehen (andere Würzrichtung, anderes Gemüse).
  for (let runde = 0; runde < 8 && out.length < anzahl; runde++) {
    for (const key of TEMPLATE_ORDER) {
      if (out.length >= anzahl) break;
      let rezept;
      try {
        rezept = baueRezept(TEMPLATES[key], ids, r, profil.name);
      } catch {
        rezept = null;
      }
      if (!rezept) continue;
      if (gesehen.has(rezept.id)) continue;
      if (!rezept.mahlzeitentyp.includes(slot) && slot !== "snack") {
        rezept.mahlzeitentyp = [...new Set([...rezept.mahlzeitentyp, slot])];
      }
      if (!rezeptErlaubt(rezept, profil)) continue;
      gesehen.add(rezept.id);
      out.push(rezept);
    }
  }
  return out;
}

/* Wie viele Rollen deckt der Bestand ab? Steuert die Hinweise in der UI:
   unter 3 belegten Rollen lohnt sich das Generieren noch nicht. */
function vorratsTiefe(bestand) {
  const ids = verfuegbar(bestand);
  const rollen = ["protein", "gemuese", "basis", "aroma", "fluessig"];
  const belegt = rollen.filter((rolle) => inRolle(rolle, ids).length > 0);
  return { belegt: belegt.length, gesamt: rollen.length, fehlend: rollen.filter((x) => !belegt.includes(x)) };
}

export { generiereAusVorrat, vorratsTiefe };

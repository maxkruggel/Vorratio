#!/usr/bin/env node
/* Vorratio Datenbank-Validator.
   Prüft die Rezeptdatenbank gegen das Schema kruggel-recipe-db/v1, bevor sie
   in der App landet: doppelte IDs, unbekannte zutat_id, Pflichtfelder,
   Timer-Konsistenz, Ernährungsform-Plausibilität (z. B. "vegan" trotz Milch).

   Aufruf: node tools/validate-db.mjs   ·  Exit-Code 1 = Fehler gefunden. */

import { ZUTATEN, REZEPTE, PREPS, BASES } from "../js/data/kerndb.js";

const fehler = [];
const warnung = [];
const err = (id, text) => fehler.push(`${id}: ${text}`);
const warn = (id, text) => warnung.push(`${id}: ${text}`);

const ZUTAT_IDS = new Set(ZUTATEN.map((z) => z.id));
const EINHEITEN = new Set(["g", "kg", "ml", "l", "Stk", "EL", "TL", "Prise", "Bund",
  "Zehe", "Dose", "Pck", "Stange", "Rolle", "Würfel", "nach_Bedarf"]);
const FORMEN = new Set(["vegan", "vegetarisch", "pescetarisch", "mit_fisch", "mit_fleisch", "mit_gefluegel"]);
const ALLERGENE = new Set(["gluten", "laktose", "ei", "fisch", "krebstiere", "weichtiere",
  "schalenfruechte", "erdnuss", "soja", "sesam", "senf", "sellerie", "sulfite", "lupinen"]);
const SLOTS = new Set(["fruehstueck", "mittag", "abend", "snack"]);
const TIMER = new Set(["aktiv", "passiv", "ofen", "ruhen"]);
const SCHWIERIGKEIT = new Set(["einfach", "mittel", "fortgeschritten"]);
const PROFILE = new Set(["kohlenhydratreich", "proteinreich", "ballaststoffreich",
  "ausgewogen", "fettreich", "kalorienarm"]);

/* Zutaten, die eine Ernährungsform ausschließen – fängt Copy-Paste-Fehler ab,
   die sonst erst beim Nutzer mit der falschen Ernährungsform auffallen. */
const TIERISCH = {
  vegan: ["ing_ei", "ing_milch", "ing_sahne", "ing_butter", "ing_joghurt_natur", "ing_parmesan",
    "ing_feta", "ing_mozzarella", "ing_quark", "ing_schmand", "ing_frischkaese", "ing_schnittkaese",
    "ing_reibekaese", "ing_honig", "ing_mascarpone", "ing_ricotta", "ing_halloumi", "ing_ziegenkaese",
    "ing_butterschmalz", "ing_haehnchenbrust", "ing_hackfleisch_rind", "ing_lachs", "ing_speck",
    "ing_schinken", "ing_wuerstchen", "ing_thunfisch_dose", "ing_gefluegel_hack", "ing_rindergulasch",
    "ing_rindersteak", "ing_schweineschulter", "ing_haehnchenkeule", "ing_haehnchen_ganz",
    "ing_entenbrust", "ing_lamm", "ing_hackfleisch_gemischt", "ing_kabeljau", "ing_garnelen",
    "ing_miesmuscheln", "ing_forelle", "ing_sardellen", "ing_mayonnaise", "ing_hefe_frisch"],
  vegetarisch: ["ing_haehnchenbrust", "ing_hackfleisch_rind", "ing_lachs", "ing_speck", "ing_schinken",
    "ing_wuerstchen", "ing_thunfisch_dose", "ing_gefluegel_hack", "ing_rindergulasch", "ing_rindersteak",
    "ing_schweineschulter", "ing_haehnchenkeule", "ing_haehnchen_ganz", "ing_entenbrust", "ing_lamm",
    "ing_hackfleisch_gemischt", "ing_kabeljau", "ing_garnelen", "ing_miesmuscheln", "ing_forelle",
    "ing_sardellen"],
};

/* Zutat → Allergen, das dann im Rezept deklariert sein muss. */
const ALLERGEN_QUELLE = {
  gluten: ["ing_nudeln", "ing_mehl_405", "ing_mehl_1050", "ing_dinkelmehl", "ing_lasagneplatten",
    "ing_semmelbroesel", "ing_seitan", "ing_seitan_gluten", "ing_couscous", "ing_bulgur",
    "ing_hartweizengriess", "ing_roggenmehl", "ing_ramen_nudeln", "ing_udon", "ing_filoteig",
    "ing_blaetterteig", "ing_pizzateig", "ing_toastbrot", "ing_spaetzle"],
  laktose: ["ing_milch", "ing_sahne", "ing_butter", "ing_joghurt_natur", "ing_parmesan", "ing_feta",
    "ing_mozzarella", "ing_quark", "ing_schmand", "ing_frischkaese", "ing_schnittkaese",
    "ing_reibekaese", "ing_mascarpone", "ing_ricotta", "ing_halloumi", "ing_ziegenkaese"],
  ei: ["ing_ei"],
  soja: ["ing_tofu_natur", "ing_tofu_fest", "ing_tofu_seiden", "ing_raeuchertofu", "ing_tempeh",
    "ing_sojagranulat", "ing_edamame", "ing_sojadrink", "ing_sojasauce", "ing_misopaste",
    "ing_sojajoghurt"],
  fisch: ["ing_lachs", "ing_kabeljau", "ing_forelle", "ing_thunfisch_dose", "ing_sardellen", "ing_fischsauce"],
  weichtiere: ["ing_miesmuscheln"],
  krebstiere: ["ing_garnelen"],
  sesam: ["ing_tahin", "ing_sesamoel", "ing_sesamsamen"],
  erdnuss: ["ing_erdnuesse", "ing_erdnussmus"],
  schalenfruechte: ["ing_mandeln", "ing_walnuesse", "ing_cashewkerne", "ing_mandelmus"],
  senf: ["ing_senf", "ing_senfkoerner"],
  sellerie: ["ing_sellerie"],
};

for (const r of REZEPTE) {
  const id = r.id || "(ohne ID)";

  for (const feld of ["id", "name", "typ", "kategorie", "cuisine", "portionen", "schwierigkeit",
    "zutaten", "schritte", "gesamtzeit_min", "ernaehrungsform", "allergene", "tags", "quelle_typ"]) {
    if (r[feld] === undefined) err(id, `Pflichtfeld fehlt: ${feld}`);
  }
  if (!SCHWIERIGKEIT.has(r.schwierigkeit)) err(id, `unbekannte schwierigkeit "${r.schwierigkeit}"`);
  if (!Array.isArray(r.mahlzeitentyp) || !r.mahlzeitentyp.length) err(id, "mahlzeitentyp fehlt oder leer");
  for (const m of r.mahlzeitentyp || []) if (!SLOTS.has(m)) err(id, `unbekannter mahlzeitentyp "${m}"`);
  for (const f of r.ernaehrungsform || []) if (!FORMEN.has(f)) err(id, `unbekannte ernaehrungsform "${f}"`);
  for (const a of r.allergene || []) if (!ALLERGENE.has(a)) err(id, `unbekanntes Allergen "${a}"`);
  if (!(r.ernaehrungsform || []).length) err(id, "ernaehrungsform ist leer");

  const g = r.gesamtzeit_min || {};
  if (typeof g.gesamt !== "number" || g.gesamt <= 0) err(id, "gesamtzeit_min.gesamt fehlt");

  const profil = r.naehrwert_einordnung?.profil;
  if (!profil) err(id, "naehrwert_einordnung.profil fehlt");
  else if (!PROFILE.has(profil)) err(id, `unbekanntes Nährwertprofil "${profil}"`);

  // Optionale Zutaten fließen nicht in die Form-/Allergenprüfung ein: Rezepte
  // wie "Chili sin/con Carne" führen das Fleisch bewusst als Option.
  const zutatIds = [];
  for (const z of r.zutaten || []) {
    if (!z.zutat_name) err(id, "Zutat ohne zutat_name");
    if (!EINHEITEN.has(z.einheit)) err(id, `unbekannte Einheit "${z.einheit}" bei ${z.zutat_name}`);
    if (z.zutat_id != null) {
      if (!ZUTAT_IDS.has(z.zutat_id)) err(id, `unbekannte zutat_id "${z.zutat_id}" (${z.zutat_name})`);
      else if (!z.optional) zutatIds.push(z.zutat_id);
    }
  }
  if (!zutatIds.length) err(id, "kein einziger Bestandsabgleich möglich (alle zutat_id null)");

  for (const [form, verboten] of Object.entries(TIERISCH)) {
    if (!(r.ernaehrungsform || []).includes(form)) continue;
    const treffer = zutatIds.filter((zid) => verboten.includes(zid));
    if (treffer.length) err(id, `als "${form}" markiert, enthält aber ${treffer.join(", ")}`);
  }

  for (const [allergen, quellen] of Object.entries(ALLERGEN_QUELLE)) {
    const drin = zutatIds.some((zid) => quellen.includes(zid));
    if (drin && !(r.allergene || []).includes(allergen)) {
      warn(id, `Allergen "${allergen}" nicht deklariert (Quelle im Rezept vorhanden)`);
    }
  }

  const schritte = r.schritte || [];
  if (!schritte.length) err(id, "keine Schritte");
  schritte.forEach((s, i) => {
    if (s.nr !== i + 1) err(id, `Schritt-Nummerierung springt bei Position ${i + 1} (nr=${s.nr})`);
    if (!s.text) err(id, `Schritt ${s.nr} ohne Text`);
    if (s.timer_typ != null && !TIMER.has(s.timer_typ)) err(id, `Schritt ${s.nr}: unbekannter timer_typ "${s.timer_typ}"`);
    if (s.timer_typ && !s.dauer_sekunden) err(id, `Schritt ${s.nr}: timer_typ ohne dauer_sekunden`);
    if (s.dauer_sekunden && !s.timer_typ) err(id, `Schritt ${s.nr}: dauer_sekunden ohne timer_typ`);
    if (s.timer_typ && !s.timer_name) err(id, `Schritt ${s.nr}: Timer ohne timer_name`);
  });

  for (const sub of r.substitutionen || []) {
    if (!sub.fehlt || !sub.ersatz) err(id, "Substitution ohne fehlt/ersatz");
  }
}

/* Doppelte IDs über alle Inhaltstypen hinweg. */
const alleIds = [...REZEPTE, ...PREPS, ...BASES].map((x) => x.id);
const gesehen = new Set();
for (const id of alleIds) {
  if (gesehen.has(id)) fehler.push(`Doppelte ID: ${id}`);
  gesehen.add(id);
}
const zutatGesehen = new Set();
for (const z of ZUTATEN) {
  if (zutatGesehen.has(z.id)) fehler.push(`Doppelte Zutaten-ID: ${z.id}`);
  zutatGesehen.add(z.id);
}

/* Kennzahlen, damit man den Umfang auf einen Blick sieht. */
const zaehle = (fn) => REZEPTE.reduce((acc, r) => {
  for (const k of [].concat(fn(r))) acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
const tofuRezepte = REZEPTE.filter((r) => r.zutaten.some((z) =>
  ["ing_tofu_natur", "ing_tofu_fest", "ing_tofu_seiden", "ing_raeuchertofu", "ing_tempeh",
    "ing_seitan", "ing_seitan_gluten", "ing_sojagranulat", "ing_edamame"].includes(z.zutat_id)));

console.log(`Zutaten:  ${ZUTATEN.length}`);
console.log(`Rezepte:  ${REZEPTE.length}`);
console.log(`Preps/Bases: ${PREPS.length}/${BASES.length}`);
console.log(`Schwierigkeit: ${JSON.stringify(zaehle((r) => r.schwierigkeit))}`);
console.log(`Slots:         ${JSON.stringify(zaehle((r) => r.mahlzeitentyp))}`);
console.log(`Ernährungsform:${JSON.stringify(zaehle((r) => r.ernaehrungsform))}`);
console.log(`Küchen:        ${Object.keys(zaehle((r) => r.cuisine)).length}`);
console.log(`Mit Tofu/Tempeh/Seitan/Soja: ${tofuRezepte.length}`);
console.log(`Ø Schritte: ${(REZEPTE.reduce((s, r) => s + r.schritte.length, 0) / REZEPTE.length).toFixed(1)}`);

if (warnung.length) {
  console.log(`\n${warnung.length} Warnung(en):`);
  for (const w of warnung) console.log(`  ! ${w}`);
}
if (fehler.length) {
  console.log(`\n${fehler.length} Fehler:`);
  for (const f of fehler) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\nAlles sauber.");

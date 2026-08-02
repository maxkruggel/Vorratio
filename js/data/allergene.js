/* Vorratio – Allergene & religiöse Merkmale als eine Quelle der Wahrheit.

   Warum diese Datei existiert: Die harten Profilfilter (Achse 2) dürfen sich
   nicht auf das `allergene`-Feld eines Rezepts verlassen. Bei Kern-Rezepten ist
   es gepflegt, bei AI-Rezepten ist es die Selbstauskunft des Modells und bei
   generierten Rezepten wurde es früher an drei Stellen parallel hergeleitet.
   Ein vergessenes oder falsches Feld hätte bei Zöliakie oder Erdnussallergie
   echte Folgen – deshalb leitet die App die Allergene zusätzlich aus den
   Zutaten ab und filtert gegen die Vereinigung aus beidem.

   Drei Ebenen, absteigend zuverlässig:
   1. ZUTAT_ALLERGENE – zutat_id → Allergene (Kern-DB, exakt)
   2. NAME_MUSTER     – Namensmuster für Zutaten ohne zutat_id (AI/Freitext)
   3. rezept.allergene – Deklaration im Datensatz (wird nie allein geglaubt)

   Grundsatz überall: im Zweifel sperren. Ein zu Unrecht ausgeblendetes Rezept
   kostet Auswahl, ein zu Unrecht gezeigtes kostet mehr. */

/* ---------------------------------------------------------- Zutat → Allergen
   EU-14-Kennzeichnung. Konservativ gesetzt, wo Produkte in Deutschland
   üblicherweise das Allergen enthalten (Gemüsebrühe → Sellerie, Hafer →
   Gluten wegen Mischkontamination, Sojasauce → Weizen). */
const ZUTAT_ALLERGENE = {
  // Gluten
  ing_nudeln: ["gluten"],
  ing_mehl_405: ["gluten"],
  ing_mehl_1050: ["gluten"],
  ing_dinkelmehl: ["gluten"],
  ing_roggenmehl: ["gluten"],
  ing_lasagneplatten: ["gluten"],
  ing_semmelbroesel: ["gluten"],
  ing_hartweizengriess: ["gluten"],
  ing_couscous: ["gluten"],
  ing_bulgur: ["gluten"],
  ing_ramen_nudeln: ["gluten"],
  ing_udon: ["gluten"],
  ing_spaetzle: ["gluten"],
  ing_gnocchi: ["gluten"],
  ing_filoteig: ["gluten"],
  ing_blaetterteig: ["gluten"],
  ing_pizzateig: ["gluten"],
  ing_toastbrot: ["gluten"],
  ing_knaeckebrot: ["gluten"],
  ing_brot: ["gluten"],
  ing_sauerteig: ["gluten"],
  ing_tortillas: ["gluten"],
  ing_muesli: ["gluten"],
  ing_haferflocken: ["gluten"],          // Hafer: in DE praktisch immer mischkontaminiert
  ing_haferdrink: ["gluten"],
  ing_seitan: ["gluten"],
  ing_seitan_gluten: ["gluten"],
  // Milch
  ing_milch: ["laktose"],
  ing_sahne: ["laktose"],
  ing_butter: ["laktose"],
  ing_butterschmalz: ["laktose"],
  ing_joghurt_natur: ["laktose"],
  ing_quark: ["laktose"],
  ing_schmand: ["laktose"],
  ing_frischkaese: ["laktose"],
  ing_schnittkaese: ["laktose"],
  ing_reibekaese: ["laktose"],
  ing_parmesan: ["laktose"],
  ing_feta: ["laktose"],
  ing_mozzarella: ["laktose"],
  ing_mascarpone: ["laktose"],
  ing_ricotta: ["laktose"],
  ing_halloumi: ["laktose"],
  ing_ziegenkaese: ["laktose"],
  // Ei
  ing_ei: ["ei"],
  ing_mayonnaise: ["ei", "senf"],
  // Soja
  ing_tofu_natur: ["soja"],
  ing_tofu_fest: ["soja"],
  ing_tofu_seiden: ["soja"],
  ing_raeuchertofu: ["soja"],
  ing_tempeh: ["soja"],
  ing_sojagranulat: ["soja"],
  ing_sojadrink: ["soja"],
  ing_sojajoghurt: ["soja"],
  ing_edamame: ["soja"],
  ing_sojasauce: ["soja", "gluten"],     // klassisch mit Weizen gebraut
  ing_misopaste: ["soja", "gluten"],     // Gerstenmiso ist der Regelfall
  ing_mayonnaise_vegan: ["soja", "senf"],
  // Fisch, Krebs- & Weichtiere
  ing_lachs: ["fisch"],
  ing_kabeljau: ["fisch"],
  ing_forelle: ["fisch"],
  ing_thunfisch_dose: ["fisch"],
  ing_sardellen: ["fisch"],
  ing_fischsauce: ["fisch"],
  ing_garnelen: ["krebstiere"],
  ing_miesmuscheln: ["weichtiere"],
  ing_austernsauce: ["weichtiere", "gluten"],
  // Schalenfrüchte & Erdnuss
  ing_mandeln: ["schalenfruechte"],
  ing_mandelmus: ["schalenfruechte"],
  ing_walnuesse: ["schalenfruechte"],
  ing_cashewkerne: ["schalenfruechte"],
  ing_erdnuesse: ["erdnuss"],
  ing_erdnussmus: ["erdnuss"],
  // Sesam
  ing_tahin: ["sesam"],
  ing_sesamoel: ["sesam"],
  ing_sesamsamen: ["sesam"],
  // Senf
  ing_senf: ["senf"],
  ing_senfkoerner: ["senf"],
  // Sellerie – Brühen enthalten in Deutschland fast immer Sellerie
  ing_sellerie: ["sellerie"],
  ing_gemuesebruehe: ["sellerie"],
  ing_huehnerbruehe: ["sellerie"],
  ing_rinderbruehe: ["sellerie"],
  // Sulfite
  ing_rotwein: ["sulfite"],
  ing_weisswein: ["sulfite"],
  ing_balsamico: ["sulfite"],
  ing_rosinen: ["sulfite"],
  ing_backpflaumen: ["sulfite"],
};

/* Zutaten, die als Grundausstattung in fast jedem Rezept stecken. Für die
   Laufzeit-Filterung zählen sie voll mit (Sellerie-Allergie ist real), aber der
   Datenbank-Validator verlangt für sie keine Deklaration im Rezept – sonst
   stünde bei fast jedem Rezept dieselbe Warnung. */
const BASIS_QUELLEN = new Set(["ing_gemuesebruehe", "ing_huehnerbruehe", "ing_rinderbruehe"]);

/* --------------------------------------------------- Schwein & Alkohol (halal/koscher)
   Eigene Achse neben den Allergenen: nicht gesundheitlich, aber genauso hart. */
const SCHWEIN_IDS = new Set([
  "ing_speck", "ing_schinken", "ing_wuerstchen", "ing_schweineschulter", "ing_hackfleisch_gemischt",
]);

const ALKOHOL_IDS = new Set([
  "ing_rotwein", "ing_weisswein", "ing_mirin",
]);

/* ------------------------------------------------------------- Namensmuster
   Greift für Zutaten ohne zutat_id: AI-Rezepte und selbst angelegte Freitext-
   Zutaten. Bewusst breit – lieber ein Rezept zu viel aussortieren.

   Zwei Schreibweisen sind erlaubt:
   · String  = Teilstring, für Muster, die in Komposita stecken dürfen
               ("milch" trifft "Vollmilchschokolade", "hafer" trifft "Haferdrink")
   · RegExp  = für kurze oder mehrdeutige Muster, die als Teilstring falsch
               anschlagen würden. "ei" steckt in Reis, Fleisch und Weizen –
               deshalb nur als ganzes Wort. */
const NAME_MUSTER = {
  gluten: ["weizen", "dinkel", "roggen", "gerste", "hafer", "grieß", "griess", "couscous", "bulgur",
    "nudel", "pasta", "spaghetti", "penne", "lasagne", "brot", "brötchen", "broetchen", "toast",
    "semmel", "paniermehl", "panade", "mehl", "teig", "seitan", "cracker", "keks", "zwieback",
    "malz", "sojasauce", "sojasoße", "sojasosse", "miso", "gnocchi", "spätzle", "spaetzle",
    "müsli", "muesli", "knäcke", "knaecke", "wrap", "bagel", "croissant", "baguette",
    /\bbier\b/],
  laktose: ["milch", "sahne", "butter", "käse", "kaese", "joghurt", "quark", "schmand",
    "parmesan", "feta", "mozzarella", "mascarpone", "ricotta", "halloumi", "molke",
    "crème fraîche", "creme fraiche", "ghee", "skyr"],
  ei: ["mayonnaise", "majonäse", "aioli", "meringue", "baiser", "omelett", "rührei", "ruehrei",
    /\bei(er|gelb|weiß|weiss|klar)?\b/],
  soja: ["soja", "tofu", "tempeh", "edamame", "miso", "tamari"],
  fisch: ["fisch", "lachs", "kabeljau", "forelle", "hering", "makrele", "sardelle",
    "anchovis", "seelachs", "dorsch", "zander", "sardine", "worcester", /\bwels\b/],
  krebstiere: ["garnele", "shrimp", "krabbe", "hummer", "languste", "krebs", "scampi"],
  weichtiere: ["muschel", "tintenfisch", "calamari", "octopus", "krake", "auster", "schnecke", "sepia"],
  schalenfruechte: ["mandel", "walnuss", "walnüsse", "walnuesse", "cashew", "haselnuss", "haselnüsse",
    "pistazie", "pekan", "macadamia", "paranuss", "marzipan", "nougat", "nuss", "nüsse", "nuesse"],
  erdnuss: ["erdnuss", "erdnüsse", "erdnuesse", "peanut", "satay", "saté"],
  sesam: ["sesam", "tahin", "tahini", "hummus", "halva"],
  senf: ["senf", "dijon", "mostrich"],
  sellerie: ["sellerie", "brühe", "bruehe", "brühwürfel", "gemüsefond", "gemuesefond", /\bfond\b/],
  sulfite: ["sekt", "prosecco", "sherry", "portwein", "balsamico", "trockenfrüchte",
    "trockenfruechte", "rosinen", "sultanine", "backpflaume", /\bwein\b/, /\brotwein\b/,
    /\bweißwein\b/, /\bweisswein\b/],
  lupinen: ["lupine"],
};

const SCHWEIN_MUSTER = ["schwein", "speck", "schinken", "bacon", "salami", "wurst", "würstchen",
  "wuerstchen", "pancetta", "prosciutto", "chorizo", "serrano", "lardo", "kasseler", "gelatine",
  "schmalz", "eisbein", "haxe", "kotelett"];

const ALKOHOL_MUSTER = ["sekt", "prosecco", "champagner", "cognac", "whisky", "whiskey", "wodka",
  "vodka", "likör", "likoer", "amaretto", "sherry", "portwein", "marsala", "calvados", "grappa",
  "pernod", "mirin", "brandy", "weinbrand", "cidre",
  /\bwein\b/, /\brotwein\b/, /\bweißwein\b/, /\bweisswein\b/, /\bkochwein\b/, /\bbier\b/,
  /\brum\b/, /\bsake\b/];

/* -------------------------------------------------------------- Auswertung */

/* Falsche Freunde: Wörter, die ein Muster enthalten, ohne es zu meinen.
   Kokosmilch ist keine Milch, die Erdnuss ist eine Hülsenfrucht und keine
   Schalenfrucht, Reisnudeln sind glutenfrei. Ohne diese Entschärfung sperrt
   der Filter genau die Rezepte weg, die Allergikern bleiben – die Liste ist
   deshalb Teil der Sicherheitslogik, nicht Kosmetik.
   Reihenfolge zählt: erst Erdnuss auflösen, dann die Butter-Regel. */
const FALSCHE_FREUNDE = [
  [/erdn(uss|üsse|uesse)/g, "peanut"],                 // Hülsenfrucht, keine Schalenfrucht
  [/kokosnuss/g, "kokos"],                             // in der EU keine kennzeichnungspflichtige Schalenfrucht
  [/muskatnuss/g, "muskat"],                           // Gewürz
  [/butterschmalz/g, "butterfett"],                    // Milchfett, kein Schweineschmalz
  [/(peanut|kokos|kakao|mandel|cashew)butter/g, "$1mus"],
  // Pflanzendrinks und -alternativen sind keine Milchprodukte
  [/(kokos|hafer|soja|mandel|reis|cashew|erbsen|dinkel|pflanzen)(nuss)?milch/g, "$1drink"],
  [/(kokos|hafer|soja|mandel|cashew|pflanzen)joghurt/g, "$1creme"],
  [/(tofu|cashew|hefe|mandel|pflanzen|vegane[rs]?)[- ]?(feta|ricotta|parmesan|mozzarella|frischkäse|käse)/g, "$1ersatz"],
  [/vegane[rs]?[- ]?mayonnaise/g, "veganmayo"],
  // Glutenfreie Träger, die Muster für glutenhaltige tragen
  [/(reisband|reis|glas)nudeln?/g, "$1band"],
  [/(kichererbsen|reis|mais|buchweizen|mandel|kokos|kastanien|hirse|teff|soja)mehl/g, "$1schrot"],
  [/mehlig/g, "weich"],                                // "mehligkochende Kartoffeln"
];

/* Suchtext eines Rezepts: Name + alle Zutatennamen, klein. Deckt die Zutaten
   ohne zutat_id ab (AI, Freitext) und fängt Komposita mit ab. */
function rezeptText(rezept) {
  const zutaten = (rezept.zutaten || []).map((z) => z.zutat_name || "").join(" ");
  let text = `${rezept.name || ""} ${zutaten}`.toLowerCase();
  for (const [muster, ersatz] of FALSCHE_FREUNDE) text = text.replace(muster, ersatz);
  return text;
}

/* Ein Muster (String = Teilstring, RegExp = wortgenau) gegen den Text prüfen. */
const trifft = (text, muster) => (muster instanceof RegExp ? muster.test(text) : text.includes(muster));

/* Alle Allergene eines Rezepts: Deklaration ∪ aus zutat_id abgeleitet ∪ aus
   Namen erkannt. Optionale Zutaten zählen mit – wer eine Allergie hat, soll
   ein Rezept nicht erst im Detail als unpassend entlarven müssen. */
function allergeneFuerRezept(rezept) {
  const treffer = new Set(rezept.allergene || []);
  for (const z of rezept.zutaten || []) {
    for (const a of ZUTAT_ALLERGENE[z.zutat_id] || []) treffer.add(a);
  }
  const text = rezeptText(rezept);
  for (const [allergen, muster] of Object.entries(NAME_MUSTER)) {
    if (treffer.has(allergen)) continue;
    if (muster.some((m) => trifft(text, m))) treffer.add(allergen);
  }
  return treffer;
}

/* Nur die aus den Zutaten ableitbaren Allergene (ohne Namensmuster) – für den
   Datenbank-Validator, der die Deklaration der Kern-DB gegenprüft. */
function allergeneAusZutaten(rezept, { mitBasis = true } = {}) {
  const treffer = new Set();
  for (const z of rezept.zutaten || []) {
    if (z.optional) continue;
    if (!mitBasis && BASIS_QUELLEN.has(z.zutat_id)) continue;
    for (const a of ZUTAT_ALLERGENE[z.zutat_id] || []) treffer.add(a);
  }
  return treffer;
}

/* Enthält das Rezept Schweinefleisch? (zutat_id oder Name) */
function enthaeltSchwein(rezept) {
  if ((rezept.zutaten || []).some((z) => SCHWEIN_IDS.has(z.zutat_id))) return true;
  const text = rezeptText(rezept);
  return SCHWEIN_MUSTER.some((m) => trifft(text, m));
}

/* Enthält das Rezept Alkohol? Auch dann, wenn er verkocht wird – das ist eine
   Gewissensfrage, keine Frage des Restalkohols, also entscheidet der Nutzer
   nicht das Rezept. */
function enthaeltAlkohol(rezept) {
  if ((rezept.zutaten || []).some((z) => ALKOHOL_IDS.has(z.zutat_id))) return true;
  const text = rezeptText(rezept);
  return ALKOHOL_MUSTER.some((m) => trifft(text, m));
}

export {
  ZUTAT_ALLERGENE, NAME_MUSTER, SCHWEIN_IDS, ALKOHOL_IDS, BASIS_QUELLEN,
  allergeneFuerRezept, allergeneAusZutaten, enthaeltSchwein, enthaeltAlkohol,
};

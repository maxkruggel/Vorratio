/* Vorratio Ernährungsprofil – fünf unabhängige Achsen (Recherche 1, DGE/BfR-basiert)
   Achse 1: Ernährungsform (genau eine) · Achse 2: Ausschlüsse (mehrfach) ·
   Achse 3: Vorlieben je Form (optional, mehrfach) · Achse 4: Stil (optional,
   mehrfach) · Achse 5: Ziele (optional, mehrfach) */

/* Reihenfolge bewusst von rein pflanzlich nach oben: vegan → vegetarisch →
   überwiegend pflanzlich → die übrigen vegetarischen Spielarten → flexitarisch
   → Mischkost. Eine gemeinsame Liste, keine Gruppen-Zwischenüberschriften. */
const ERNAEHRUNGSFORMEN = [
  { id: "vegan",          name: "Vegan",                    kurz: "Ausschließlich pflanzlich, inkl. ohne Honig" },
  { id: "ovo_lacto",      name: "Vegetarisch",              kurz: "Pflanzlich + Milch + Ei – kein Fleisch, kein Fisch" },
  { id: "pflanzenbasiert", name: "Überwiegend pflanzlich",  kurz: "Pflanzen im Mittelpunkt, Tierisches selten & bewusst" },
  { id: "lacto",          name: "Lacto-vegetarisch",        kurz: "Pflanzlich + Milch – kein Ei, Fleisch, Fisch" },
  { id: "ovo",            name: "Ovo-vegetarisch",          kurz: "Pflanzlich + Ei – keine Milch, Fleisch, Fisch" },
  { id: "pescetarier",    name: "Pescetarisch",             kurz: "Pflanzlich + Fisch, Milch, Ei – kein Fleisch" },
  { id: "flexitarier",    name: "Flexitarisch",             kurz: "Viel pflanzlich, bewusst wenig Fleisch" },
  { id: "mischkost",      name: "Mischkost / omnivor",      kurz: "Alles – Fleisch, Fisch, Milch, Ei" },
];

// Welche Rezept-Tags (kruggel-recipe-db/v1: vegan | vegetarisch | pescetarisch |
// mit_fisch | mit_fleisch | mit_gefluegel) darf jede Form sehen?
// Ovo/Lacto werden zusätzlich über Zutaten-Allergene (laktose/ei) geschärft.
const FORM_ERLAUBT = {
  mischkost:      ["vegan", "vegetarisch", "pescetarisch", "mit_fisch", "mit_fleisch", "mit_gefluegel"],
  flexitarier:    ["vegan", "vegetarisch", "pescetarisch", "mit_fisch", "mit_fleisch", "mit_gefluegel"],
  pescetarier:    ["vegan", "vegetarisch", "pescetarisch", "mit_fisch"],
  ovo_lacto:      ["vegan", "vegetarisch"],
  lacto:          ["vegan", "vegetarisch"],   // + Filter: kein Ei
  ovo:            ["vegan", "vegetarisch"],   // + Filter: keine Milch
  vegan:          ["vegan"],
  pflanzenbasiert: ["vegan", "vegetarisch"],
};

const AUSSCHLUESSE = [
  // EU-14-orientierte Allergene/Intoleranzen (harte Filter)
  { id: "gluten",          name: "Gluten / Zöliakie",     gruppe: "allergie" },
  { id: "laktose",         name: "Laktose / Milch",       gruppe: "allergie" },
  { id: "ei",              name: "Ei",                    gruppe: "allergie" },
  { id: "fisch",           name: "Fisch",                 gruppe: "allergie" },
  { id: "krebstiere",      name: "Krebstiere",            gruppe: "allergie" },
  { id: "schalenfruechte", name: "Nüsse (Schalenfrüchte)", gruppe: "allergie" },
  { id: "erdnuss",         name: "Erdnüsse",              gruppe: "allergie" },
  { id: "soja",            name: "Soja",                  gruppe: "allergie" },
  { id: "sesam",           name: "Sesam",                 gruppe: "allergie" },
  { id: "senf",            name: "Senf",                  gruppe: "allergie" },
  { id: "sellerie",        name: "Sellerie",              gruppe: "allergie" },
  { id: "sulfite",         name: "Sulfite",               gruppe: "allergie" },
  { id: "lupinen",         name: "Lupinen",               gruppe: "allergie" },
  { id: "weichtiere",      name: "Weichtiere",            gruppe: "allergie" },
  // Religiös-kulturelle Regeln (quer zu allen Formen)
  { id: "halal",           name: "Halal",                 gruppe: "religioes" },
  { id: "koscher",         name: "Koscher",               gruppe: "religioes" },
];

/* Achse 3: Vorlieben – „Was magst du besonders?"
   Bewusst KEINE gemeinsame Liste und kein gemeinsamer Text für alle Formen:
   Wer vegan isst, wird nach der Proteinquelle gefragt, Pescetarier nach dem
   Fisch, Mischköstler nach dem, was am häufigsten auf dem Teller landet. Die
   IDs sind formübergreifend identisch, damit eine Vorliebe beim Formwechsel
   erhalten bleibt, solange sie zur neuen Form passt (Tofu bleibt Tofu).
   `allergene` blendet Optionen aus, die zu den Ausschlüssen (Achse 2) im
   Widerspruch stehen; `verbergen_bei` deckt halal/koscher ab.
   Rückkopplung: weicher Bonus im Vorschlags-Score (engine.js) und Systemprompt
   der AI-Rezeptgenerierung (ai.js) – nichts wird verboten oder ausgefiltert. */
const VORLIEBEN_KATALOG = {
  tofu: {
    name: "Tofu", kurz: "Natur, geräuchert, mariniert – nimmt jede Würze an",
    zutaten: ["ing_tofu_natur", "ing_tofu_fest", "ing_tofu_seiden", "ing_raeuchertofu"],
    muster: ["tofu"], allergene: ["soja"],
  },
  tempeh: {
    name: "Tempeh", kurz: "Fermentiert, nussig, bissfest – proteinreicher als Tofu",
    zutaten: ["ing_tempeh"], muster: ["tempeh"], allergene: ["soja"],
  },
  seitan: {
    name: "Seitan", kurz: "Weizeneiweiß, faserig – die fleischnahe Textur",
    zutaten: ["ing_seitan", "ing_seitan_gluten"], muster: ["seitan"], allergene: ["gluten"],
  },
  huelsenfruechte: {
    name: "Hülsenfrüchte", kurz: "Linsen, Kichererbsen, Bohnen – Protein und Ballaststoffe",
    zutaten: ["ing_linsen_rot", "ing_linsen_braun", "ing_belugalinsen", "ing_kichererbsen_trocken",
      "ing_kichererbsen_dose", "ing_kidneybohnen_dose", "ing_bohnen_schwarz_dose", "ing_kidney_trocken",
      "ing_bohnen_weiss_trocken", "ing_erbsen_getrocknet", "ing_erbsen_tk", "ing_edamame", "ing_hummus"],
    muster: ["linsen", "kichererbsen", "bohnen", "erbsen", "edamame", "hummus"], allergene: [],
  },
  nuesse_kerne: {
    name: "Nüsse, Kerne & Mus", kurz: "Walnüsse, Mandeln, Tahin, Erdnussmus – Fett mit Aroma",
    zutaten: ["ing_walnuesse", "ing_mandeln", "ing_cashewkerne", "ing_erdnuesse", "ing_erdnussmus",
      "ing_mandelmus", "ing_tahin", "ing_sonnenblumenkerne", "ing_leinsamen", "ing_chiasamen"],
    muster: ["nuss", "nüsse", "mandel", "cashew", "tahin", "kerne", "leinsamen", "chia"],
    allergene: ["schalenfruechte", "erdnuss"],
  },
  pflanzendrink: {
    name: "Pflanzendrink & Pflanzenjoghurt", kurz: "Hafer, Soja & Co. – für Müsli, Sauce, Backteig",
    zutaten: ["ing_haferdrink", "ing_sojadrink", "ing_sojajoghurt"],
    muster: ["haferdrink", "pflanzenjoghurt", "sojadrink"], allergene: [],
  },
  ei: {
    name: "Eier", kurz: "Rührei, pochiert, im Teig – schnelles Protein",
    zutaten: ["ing_ei"], muster: ["eier", "rührei", "omelett"], allergene: ["ei"],
  },
  kaese: {
    name: "Käse", kurz: "Feta, Mozzarella, Hartkäse – Würze und Bindung",
    zutaten: ["ing_feta", "ing_mozzarella", "ing_parmesan", "ing_schnittkaese", "ing_reibekaese",
      "ing_frischkaese", "ing_halloumi", "ing_ziegenkaese", "ing_ricotta", "ing_mascarpone"],
    muster: ["käse", "feta", "mozzarella", "parmesan", "halloumi", "ricotta", "mascarpone"], allergene: ["laktose"],
  },
  joghurt_quark: {
    name: "Joghurt & Quark", kurz: "Für Dips, Dressings und Frühstück",
    zutaten: ["ing_joghurt_natur", "ing_quark", "ing_schmand"],
    muster: ["joghurt", "quark", "schmand", "crème fraîche"], allergene: ["laktose"],
  },
  fisch_fett: {
    name: "Fetter Seefisch", kurz: "Lachs, Makrele, Hering – die Omega-3-Quelle",
    zutaten: ["ing_lachs", "ing_forelle"], muster: ["lachs", "makrele", "hering", "forelle"], allergene: ["fisch"],
  },
  fisch_mager: {
    name: "Magerer Fisch & Dosenfisch", kurz: "Kabeljau, Seelachs, Thunfisch aus der Dose",
    zutaten: ["ing_kabeljau", "ing_thunfisch_dose", "ing_sardellen"],
    muster: ["kabeljau", "seelachs", "thunfisch", "dorsch", "sardelle"], allergene: ["fisch"],
  },
  meeresfruechte: {
    name: "Meeresfrüchte", kurz: "Garnelen und Miesmuscheln – schnell gegart, wenig Aufwand",
    zutaten: ["ing_garnelen", "ing_miesmuscheln"], muster: ["garnele", "muschel"],
    allergene: ["krebstiere", "weichtiere"],
  },
  gefluegel: {
    name: "Geflügel", kurz: "Hähnchenbrust und Geflügelhack – mager und schnell",
    zutaten: ["ing_haehnchenbrust", "ing_haehnchenkeule", "ing_haehnchen_ganz", "ing_entenbrust", "ing_gefluegel_hack"],
    muster: ["hähnchen", "geflügel", "pute", "ente"], allergene: [],
  },
  rind: {
    name: "Rind & Hackfleisch", kurz: "Bolognese, Chili, Gulasch, Steak",
    zutaten: ["ing_hackfleisch_rind", "ing_rindergulasch", "ing_rindersteak"],
    muster: ["hackfleisch", "rind", "gulasch"], allergene: [],
  },
  schwein_wurst: {
    name: "Schwein, Speck & Wurst", kurz: "Speck, Schinken, Würstchen – als Würze eingesetzt",
    zutaten: ["ing_speck", "ing_schinken", "ing_wuerstchen", "ing_schweineschulter", "ing_hackfleisch_gemischt"],
    muster: ["speck", "schinken", "würstchen", "bacon", "schwein"],
    allergene: [], verbergen_bei: ["halal", "koscher"],
  },
  pilze: {
    name: "Pilze", kurz: "Champignons & Co. – herzhafte Tiefe ohne Fleisch",
    zutaten: ["ing_champignons", "ing_shiitake"], muster: ["champignon", "pilz", "shiitake"], allergene: [],
  },
  ofengemuese: {
    name: "Ofen- & Wurzelgemüse", kurz: "Kürbis, Süßkartoffel, Blumenkohl, Rote Bete – ein Blech, fertig",
    zutaten: ["ing_kuerbis", "ing_suesskartoffel", "ing_blumenkohl", "ing_rote_bete", "ing_pastinake", "ing_moehre"],
    muster: ["kürbis", "süßkartoffel", "blumenkohl", "rote bete", "pastinake", "ofen"], allergene: [],
  },
  vollkorn: {
    name: "Vollkorn & Körner", kurz: "Naturreis, Bulgur, Quinoa, Couscous, Hafer",
    zutaten: ["ing_reis_vollkorn", "ing_bulgur", "ing_quinoa", "ing_couscous", "ing_haferflocken", "ing_mehl_1050", "ing_dinkelmehl"],
    muster: ["vollkorn", "bulgur", "quinoa", "couscous", "hafer", "naturreis"], allergene: [],
  },
  pasta_kartoffel: {
    name: "Pasta & Kartoffeln", kurz: "Der sättigende Klassiker – Nudeln, Gnocchi, Kartoffeln",
    zutaten: ["ing_nudeln", "ing_lasagneplatten", "ing_kartoffel", "ing_gnocchi", "ing_spaetzle"],
    muster: ["nudel", "pasta", "kartoffel", "gnocchi", "spätzle", "lasagne"], allergene: [],
  },
};

/* Je Form: eigene Frage, eigener Einstiegstext, eigene Auswahl, eigener
   Abschluss-Hinweis. Tofu steht bewusst in jeder Liste – er funktioniert
   in jeder Ernährungsform als Proteinquelle. */
const VORLIEBEN_JE_FORM = {
  vegan: {
    frage: "was ist dein protein?",
    intro: "Rein pflanzlich steht und fällt eine Mahlzeit mit der Proteinquelle. Sag uns, womit du am liebsten kochst – das kommt dann öfter dran.",
    optionen: ["tofu", "tempeh", "seitan", "huelsenfruechte", "nuesse_kerne", "pflanzendrink", "ofengemuese", "vollkorn"],
    hinweis: "Getreide und Hülsenfrüchte in einer Mahlzeit ergänzen sich in den Aminosäuren – vorratio kombiniert das in den Vorschlägen automatisch.",
  },
  ovo_lacto: {
    frage: "was macht bei dir satt?",
    intro: "Ohne Fleisch und Fisch tragen andere Zutaten die Mahlzeit. Was davon magst du wirklich gern?",
    optionen: ["ei", "kaese", "joghurt_quark", "tofu", "huelsenfruechte", "pilze", "ofengemuese", "vollkorn"],
    hinweis: "Milch und Ei decken B12 und Calcium meist ab – Eisen aus Hülsenfrüchten wird mit Vitamin C (Paprika, Zitrone) deutlich besser aufgenommen.",
  },
  pflanzenbasiert: {
    frage: "was steht bei dir im mittelpunkt?",
    intro: "Pflanzen sind die Basis, Tierisches bleibt die Ausnahme. Wähle, was den Teller bei dir trägt – und was du dir bewusst gönnst.",
    optionen: ["tofu", "tempeh", "huelsenfruechte", "ofengemuese", "vollkorn", "nuesse_kerne", "kaese", "ei"],
    hinweis: "Je pflanzlicher die Basis, desto wichtiger sind ein paar verlässliche Proteinquellen – deshalb steht Tofu hier gleich an erster Stelle.",
  },
  lacto: {
    frage: "was darf oft auf den teller?",
    intro: "Milchprodukte sind gesetzt, Ei ist raus. Was davon magst du besonders?",
    optionen: ["kaese", "joghurt_quark", "tofu", "huelsenfruechte", "pilze", "ofengemuese", "vollkorn"],
    hinweis: "Ohne Ei übernehmen Hülsenfrüchte, Tofu und Milchprodukte den Proteinpart – Rezepte mit Ei blendet vorratio ohnehin aus.",
  },
  ovo: {
    frage: "was magst du besonders?",
    intro: "Ei ja, Milchprodukte nein. Sag uns, worauf du am liebsten zurückgreifst.",
    optionen: ["ei", "tofu", "huelsenfruechte", "nuesse_kerne", "pflanzendrink", "pilze", "ofengemuese"],
    hinweis: "Ohne Milchprodukte lohnt der Blick aufs Calcium: angereicherte Pflanzendrinks, Calcium-Tofu, Grünkohl und Brokkoli sind die verlässlichen Quellen.",
  },
  pescetarier: {
    frage: "was kommt bei dir aus dem wasser?",
    intro: "Fisch ist deine Ausnahme vom Pflanzlichen – und nicht jeder Fisch ist gemeint. Wähle, was dir schmeckt.",
    optionen: ["fisch_fett", "fisch_mager", "meeresfruechte", "tofu", "huelsenfruechte", "ei", "kaese", "ofengemuese"],
    hinweis: "1–2 Portionen Fisch pro Woche, davon einmal fettreicher Seefisch (DGE). Große Raubfische wie Thunfisch, Schwertfisch oder Heilbutt besser selten – Methylquecksilber (BfR 17/2024).",
  },
  flexitarier: {
    frage: "wovon gern etwas mehr?",
    intro: "Fleisch bewusst und selten – umso mehr zählt, was an den anderen Tagen läuft. Was davon magst du?",
    optionen: ["gefluegel", "fisch_fett", "tofu", "huelsenfruechte", "kaese", "ei", "ofengemuese", "vollkorn"],
    hinweis: "An fleischfreien Tagen tragen Hülsenfrüchte und Tofu die Mahlzeit – vorratio schlägt sie dir dann bevorzugt vor.",
  },
  mischkost: {
    frage: "was landet am häufigsten auf deinem teller?",
    intro: "Bei dir ist alles erlaubt – deshalb ist umso interessanter, was du wirklich gern isst.",
    optionen: ["gefluegel", "rind", "schwein_wurst", "fisch_fett", "meeresfruechte", "kaese", "ei", "tofu", "huelsenfruechte", "pasta_kartoffel"],
    hinweis: "DGE 2024: max. 300 g Fleisch und Wurst pro Woche, über 75 % pflanzlich. vorratio gewichtet deine Vorlieben, hält die Vorschläge aber in dieser Balance.",
  },
};

/* Optionen einer Form, gefiltert gegen die Ausschlüsse (Achse 2) – wer Soja
   ausschließt, bekommt Tofu gar nicht erst angeboten. Freitext-Ausschlüsse
   ("Rosenkohl", "Pilze") werden gegen Name und Suchmuster geprüft. */
function vorliebenFuerForm(formId, ausschluesse = [], eigeneAusschluesse = []) {
  const konfig = VORLIEBEN_JE_FORM[formId] || VORLIEBEN_JE_FORM.mischkost;
  const eigene = eigeneAusschluesse
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length >= 3);
  const optionen = konfig.optionen
    .map((id) => ({ id, ...VORLIEBEN_KATALOG[id] }))
    .filter((v) => v.name)
    .filter((v) => !(v.allergene || []).some((a) => ausschluesse.includes(a)))
    .filter((v) => !(v.verbergen_bei || []).some((a) => ausschluesse.includes(a)))
    .filter((v) => !eigene.some((t) => v.name.toLowerCase().includes(t) || (v.muster || []).some((m) => m.includes(t))));
  return { ...konfig, optionen };
}

/* Gewählte Vorlieben als Katalogeinträge – Reihenfolge wie in der Form. */
function gewaehlteVorlieben(formId, ids = []) {
  const konfig = VORLIEBEN_JE_FORM[formId] || VORLIEBEN_JE_FORM.mischkost;
  return konfig.optionen.filter((id) => ids.includes(id)).map((id) => ({ id, ...VORLIEBEN_KATALOG[id] }));
}

/* Achse 3b: Stil-Präferenzen. Ein Stil wirkt nur, wenn Rezepte den passenden
   Tag tragen – der Score-Bonus in engine.js greift über `tags`. Keto und Paleo
   standen hier zur Wahl, ohne dass ein einziges Rezept die Tags trug: Die
   Auswahl hat also nichts bewirkt. Sie bleiben vorerst draußen, bis die
   Rezeptdatenbank sie tatsächlich bedienen kann. Wer sie wieder aufnimmt,
   sollte vorher Rezepte entsprechend taggen – sonst ist es wieder eine
   Option ohne Wirkung. */
const STILE = [
  { id: "mediterran",   name: "Mediterran",   hinweis: null },
  { id: "high-protein", name: "High-Protein", hinweis: null },
  { id: "low-carb",     name: "Low-Carb",     hinweis: "Auf ausreichend Ballaststoffe achten (Vollkorn, Hülsenfrüchte, Gemüse)." },
];

/* Achse 4: Ziele – nur Ziele, die (a) wissenschaftlich belegt über Ernährung
   beeinflussbar sind und (b) in der App rückkoppelbar: `bevorzugt`/`meidet`
   koppeln an naehrwert_einordnung.profil + Rezept-Tags (→ Vorschlags-Score in
   engine.js), `ai` fließt in den Systemprompt der Rezeptgenerierung (ai.js).
   Weiche Präferenzen, keine Verbote. Der `hinweis` benennt ehrlich die
   Evidenzlage (DGE, EFSA, ISSN 2017, DIETFITS 2018, PREDIMED/MIND) –
   inkl. dessen, was NICHT belegt ist (z. B. Spot Reduction). */
const ZIELE = [
  {
    id: "energie",
    name: "Mehr Energie",
    kurz: "Weniger Tiefs nach dem Essen, gleichmäßiger durch den Tag",
    evidenz: "hoch",
    hinweis: "Energietiefs entstehen vor allem durch Blutzuckerspitzen nach zucker- und weißmehlreichen Mahlzeiten. Gut belegt helfen: Vollkorn und Hülsenfrüchte (niedrige glykämische Last), regelmäßige Mahlzeiten und ausreichend Trinken (~1,5 l/Tag, DGE). Bei anhaltender Müdigkeit auch die Eisenversorgung ärztlich prüfen lassen – nicht auf Verdacht supplementieren.",
    bevorzugt: { profile: ["ballaststoffreich", "ausgewogen"], tags: [] },
    meidet: { profile: ["fettreich"] },
    ai: "Bevorzuge Vollkorn und Hülsenfrüchte (niedrige glykämische Last) und sättigende, aber nicht schwere Gerichte; vermeide zuckerlastige Rezepte und sehr fettreiche Mahlzeiten.",
  },
  {
    id: "abnehmen",
    name: "Abnehmen",
    kurz: "Sättigende, kalorienbewusste Rezepte werden bevorzugt",
    evidenz: "hoch",
    hinweis: "Entscheidend ist ein moderates Kaloriendefizit – die Diätform ist zweitrangig (Low-Carb vs. Low-Fat: bei gleichem Defizit gleiche Abnahme, u. a. DIETFITS 2018). Protein und Ballaststoffe sättigen pro Kalorie am besten. Vorratio bevorzugt darum kalorienärmere, protein- und ballaststoffreiche Rezepte – ohne Verbote.",
    bevorzugt: { profile: ["kalorienarm", "proteinreich", "ballaststoffreich"], tags: [] },
    meidet: { profile: ["fettreich"] },
    ai: "Kalorienbewusste Rezepte mit hohem Protein- und Ballaststoffanteil und viel Gemüse (geringe Energiedichte); Frittiertes und sehr Fettreiches meiden, keine Crash-Diät-Rhetorik.",
  },
  {
    id: "muskeln",
    name: "Fitter werden / Muskelaufbau",
    kurz: "Proteinreiche Rezepte als Baumaterial fürs Training",
    evidenz: "hoch",
    hinweis: "Fitter wirst du durchs Training – die Ernährung liefert das Baumaterial: 1,2–2,0 g Protein pro kg Körpergewicht und Tag (ISSN 2017, DGE-Position Sport), sinnvoll über die Mahlzeiten verteilt (~20–40 g pro Mahlzeit). Vorratio bevorzugt proteinreiche Rezepte.",
    bevorzugt: { profile: ["proteinreich"], tags: ["high-protein"] },
    meidet: { profile: [] },
    ai: "Jede Hauptmahlzeit mit 20–40 g Protein (Hülsenfrüchte, Tofu, Fisch, Geflügel, Magerquark, Eier); Kohlenhydrate als Trainingsenergie einplanen.",
  },
  {
    id: "bauch",
    name: "Flacherer Bauch",
    kurz: "Ehrliche Variante: Energiebilanz + blähungsarm essen",
    evidenz: "mittel",
    hinweis: "Ehrlich: Gezielt am Bauch abnehmen („Spot Reduction“) ist wissenschaftlich widerlegt – Bauchfett reagiert nur auf die Gesamt-Energiebilanz, wie beim Ziel Abnehmen. Zusätzlich gegen Blähbauch belegt: Ballaststoffe langsam steigern, ausreichend trinken, sehr fettige und stark verarbeitete Mahlzeiten reduzieren.",
    bevorzugt: { profile: ["kalorienarm", "ballaststoffreich"], tags: [] },
    meidet: { profile: ["fettreich"] },
    ai: "Wie beim Abnehmen (Energiebilanz zählt); zusätzlich blähungsarm kochen: Ballaststoffe moderat dosieren, nichts extrem Fettiges oder stark Verarbeitetes.",
  },
  {
    id: "fokus",
    name: "Mehr Konzentration",
    kurz: "Stabiler Blutzucker, Omega-3, genug trinken",
    evidenz: "mittel",
    hinweis: "Das Gehirn mag stabilen Blutzucker: Vollkorn statt Zuckerspitzen. Schon ~2 % Flüssigkeitsdefizit verschlechtert die Konzentration messbar (EFSA-Referenz: ~2 l Wasser/Tag über Getränke und Essen). Am besten belegt sind außerdem Omega-3 über fetten Seefisch (DGE: 1–2 Portionen Fisch/Woche) und ein mediterranes Ernährungsmuster (PREDIMED-/MIND-Daten).",
    bevorzugt: { profile: ["ausgewogen", "ballaststoffreich"], tags: [] },
    meidet: { profile: ["fettreich"] },
    ai: "Niedrig-glykämische Basis (Vollkorn), regelmäßig fetten Seefisch (Omega-3) und mediterrane Muster einstreuen; mittags keine schweren, sehr fettreichen Gerichte.",
  },
  {
    id: "verdauung",
    name: "Gesunde Verdauung",
    kurz: "Ballaststoffreiche Rezepte werden bevorzugt",
    evidenz: "hoch",
    hinweis: "Der am besten belegte Hebel: mindestens 30 g Ballaststoffe am Tag (DGE-Referenzwert) aus Vollkorn, Hülsenfrüchten, Gemüse und Obst – plus ausreichend trinken. Die Menge langsam steigern, sonst drohen anfangs Blähungen.",
    bevorzugt: { profile: ["ballaststoffreich"], tags: [] },
    meidet: { profile: [] },
    ai: "Ballaststoffreich kochen (Vollkorn, Hülsenfrüchte, Gemüse); den DGE-Richtwert von 30 g Ballaststoffen am Tag mitdenken.",
  },
];

// App-Level-Hinweise je Ernährungsform (KEINE Rezeptregeln, keine medizinische
// Beratung – Quelle: DGE-Positionspapier 13.06.2024, DGE-FBDG 2024, BfR 17/2024)
const FORM_HINWEISE = {
  vegan: [
    "Vitamin B12 ist bei veganer Ernährung nur über ein Präparat sicher zu decken – das lässt sich nicht über Rezepte lösen. Bitte ärztlich beraten lassen (DGE-Position 2024).",
    "Jodiertes Speisesalz verwenden. Algen sind KEINE planbare Jod- oder B12-Quelle (stark schwankende Gehalte, inaktive B12-Analoga).",
    "Eisen: pflanzliches Eisen wird 3–4× besser aufgenommen, wenn Vitamin C mit auf dem Teller ist – Vorratio berücksichtigt das in den Vorschlägen. Kaffee/Schwarztee besser ~1 h von eisenreichen Mahlzeiten trennen.",
    "Für langkettige Omega-3 (EPA/DHA) ist Mikroalgenöl empfehlenswert; Leinöl/Walnüsse liefern die Vorstufe ALA. Vitamin D im Winter beachten.",
  ],
  vegetarisch: [
    "Milchprodukte und Eier decken B12 und Calcium meist ab. Eisen und Zink über Hülsenfrüchte/Vollkorn + Vitamin-C-Kombination optimieren.",
    "Jodiertes Speisesalz verwenden (kein Seefisch als Jodquelle); Vitamin D im Winter beachten.",
  ],
  ovo: [
    "Ohne Milchprodukte besonders auf Calcium achten: angereicherte Pflanzendrinks, Calcium-Tofu, Grünkohl/Brokkoli, calciumreiches Mineralwasser (> 150 mg Ca/l).",
    "B12 ist über Ei allein nicht sicher planbar – Versorgung im Blick behalten und ggf. ärztlich prüfen lassen.",
  ],
  pescetarier: [
    "DGE: 1–2 Portionen Fisch pro Woche, davon 70 g fettreicher Seefisch (Lachs, Makrele, Hering).",
    "Große Raubfische (Thunfisch, Hai, Schwertfisch, Heilbutt, Rotbarsch, Aal) wegen Methylquecksilber meiden bzw. selten essen – in der Schwangerschaft/Stillzeit besonders wichtig (BfR 17/2024). Auf Nachhaltigkeitssiegel achten.",
  ],
  mischkost: [
    "DGE-Empfehlung 2024: Fleisch/Wurst max. 300 g pro Woche, über 75 % der Ernährung pflanzlich, 5 Portionen Obst/Gemüse am Tag, 1–2 Portionen Fisch pro Woche.",
    "Jodiertes Speisesalz als Standard; Ballaststoffe über Vollkorn und Hülsenfrüchte.",
  ],
  sonderfaelle: "Schwangerschaft, Stillzeit, Kinder/Jugendliche und Senioren sind Sonderfälle – Vorratio ersetzt keine ärztliche oder qualifizierte Ernährungsberatung.",
};

function hinweiseFuerForm(formId) {
  switch (formId) {
    case "vegan": return FORM_HINWEISE.vegan;
    case "ovo": return FORM_HINWEISE.ovo;
    case "ovo_lacto":
    case "lacto":
    case "pflanzenbasiert": return FORM_HINWEISE.vegetarisch;
    case "pescetarier": return FORM_HINWEISE.pescetarier;
    default: return FORM_HINWEISE.mischkost;
  }
}

export {
  ERNAEHRUNGSFORMEN, FORM_ERLAUBT, AUSSCHLUESSE, STILE, ZIELE, FORM_HINWEISE, hinweiseFuerForm,
  VORLIEBEN_KATALOG, VORLIEBEN_JE_FORM, vorliebenFuerForm, gewaehlteVorlieben,
};

/* Vorratio Ernährungsprofil – vier unabhängige Achsen (Recherche 1, DGE/BfR-basiert)
   Achse 1: Ernährungsform (genau eine) · Achse 2: Ausschlüsse (mehrfach) ·
   Achse 3: Stil (optional, mehrfach) · Achse 4: Ziele (optional, mehrfach) */

const ERNAEHRUNGSFORMEN = [
  { id: "mischkost",      name: "Mischkost / omnivor",      kurz: "Alles – Fleisch, Fisch, Milch, Ei" },
  { id: "flexitarier",    name: "Flexitarisch",             kurz: "Überwiegend pflanzlich, bewusst wenig Fleisch" },
  { id: "pescetarier",    name: "Pescetarisch",             kurz: "Pflanzlich + Fisch, Milch, Ei – kein Fleisch" },
  { id: "ovo_lacto",      name: "Vegetarisch (ovo-lacto)",  kurz: "Pflanzlich + Milch + Ei – kein Fleisch/Fisch" },
  { id: "lacto",          name: "Lacto-vegetarisch",        kurz: "Pflanzlich + Milch – kein Ei, Fleisch, Fisch" },
  { id: "ovo",            name: "Ovo-vegetarisch",          kurz: "Pflanzlich + Ei – keine Milch, Fleisch, Fisch" },
  { id: "vegan",          name: "Vegan",                    kurz: "Ausschließlich pflanzlich, inkl. ohne Honig" },
  { id: "pflanzenbasiert", name: "Überwiegend pflanzenbasiert", kurz: "Pflanzenzentriert, Tierprodukte selten & bewusst" },
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

const STILE = [
  { id: "mediterran",   name: "Mediterran",   hinweis: null },
  { id: "high-protein", name: "High-Protein", hinweis: null },
  { id: "low-carb",     name: "Low-Carb",     hinweis: "Auf ausreichend Ballaststoffe achten (Vollkorn, Hülsenfrüchte, Gemüse)." },
  { id: "keto",         name: "Keto",         hinweis: "Sehr restriktiv, Langzeitevidenz begrenzt – als Alltagskost nur mit Bedacht (DGEM/PRIO 2022)." },
  { id: "paleo",        name: "Paleo",        hinweis: "Schließt ganze Lebensmittelgruppen aus (Vollkorn, Hülsenfrüchte) – widerspricht DGE-Empfehlungen." },
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

export { ERNAEHRUNGSFORMEN, FORM_ERLAUBT, AUSSCHLUESSE, STILE, ZIELE, FORM_HINWEISE, hinweiseFuerForm };

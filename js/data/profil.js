/* Vorratio Ernährungsprofil – drei unabhängige Achsen (Recherche 1, DGE/BfR-basiert)
   Achse 1: Ernährungsform (genau eine) · Achse 2: Ausschlüsse (mehrfach) · Achse 3: Stil (optional, mehrfach) */

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

export { ERNAEHRUNGSFORMEN, FORM_ERLAUBT, AUSSCHLUESSE, STILE, FORM_HINWEISE, hinweiseFuerForm };

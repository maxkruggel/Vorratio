/* Vorratio Substitutions-Datenbank – Schema vorratio-substitutions-db/v1
   Pflanzliche Alternativen zu tierischen Zutaten (Recherche Substitutionen, Stand 08/2026).
   Quellen: DGE-Positionspapier 2024, Stiftung Warentest 3/2025, ProVeg, milch.info,
   Hersteller-/Händlerangaben (Nischenprodukte ggf. gegen Open Food Facts abgleichen).

   Prinzipien:
   - Ei ist FUNKTIONSBASIERT modelliert (binden / lockern / aufschlagen / Hauptzutat /
     Geschmack) – es gibt keinen 1:1-Allrounder. Alle anderen Zutaten zutatenbasiert.
     `funktion_frage` sagt in einem Satz, WANN dieser Datensatz gilt – ohne ihn steht
     im Wissen-Tab fünfmal „Ei" und niemand weiß, welche Karte die eigene ist.
   - prioritaet 1 = neutralste/verlässlichste Alternative (bei Milchprodukten meist Soja:
     einzige proteinstarke Basis, ~3,5 g Protein/100 ml – Kuhmilch ebenbürtig).
   - geeignet_fuer filtert nach Anwendungsfall (Rezept-Kontext), zutat_ids koppelt an die
     normalisierte Zutatenliste der Kern-DB (Bestandsabgleich).
   - Allergie-Filterung läuft über die basis (BASIS_ALLERGENE) bzw. explizites
     alternativen[].allergene – harte Filter wie überall in Vorratio. */

const SUB_SCHEMA_VERSION = "vorratio-substitutions-db/v1";
const SUB_STAND = "2026-08-01";

// Anzeigenamen der Kategorien und Anwendungsfälle
const SUB_KATEGORIEN = {
  milchprodukt: "Milchprodukte", kaese: "Käse", ei: "Ei",
  fleisch_wurst: "Fleisch & Wurst", fisch: "Fisch & Meer", sonstiges: "Sonstiges",
};

const SUB_ANWENDUNGEN = {
  backen: "Backen", kochen_erhitzen: "Kochen/Erhitzen", kalt_dessert: "Kalt/Dessert",
  aufschlagen: "Aufschlagen", binden: "Binden", ueberbacken_schmelzen: "Überbacken/Schmelzen",
  braten: "Braten", streuen: "Streuen", suessen: "Süßen", gelieren: "Gelieren",
};

// Allergene je Basis (EU-14, IDs aus profil.js AUSSCHLUESSE) – harte Filter.
// Explizites alternativen[].allergene überschreibt diese Zuordnung.
const BASIS_ALLERGENE = {
  soja: ["soja"], tofu: ["soja"], tempeh: ["soja"],
  cashew: ["schalenfruechte"], mandel: ["schalenfruechte"],
  weizen_seitan: ["gluten"], lupine: ["lupinen"],
  hafer: [], kokos: [], erbsenprotein: [], jackfruit: [], reis: [], kartoffel: [],
  getreide: [], samen: [], frucht: [], alge: [], sonstiges: [],
};

const SUBSTITUTIONEN = [

  // ------------------------------------------------------------ Milchprodukte
  {
    id: "sub_joghurt_natur", original_zutat: "Joghurt (Natur)", kategorie: "milchprodukt",
    zutat_ids: ["ing_joghurt_natur"],
    alternativen: [
      { alternative_name: "Sojajoghurt Natur", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Neutralste Wahl, für herzhaft und süß; am stabilsten beim leichten Erhitzen. Beim starken Kochen kann jeder Pflanzenjoghurt ausflocken – erst gegen Ende zugeben, nicht kochen.",
        naehrwert_hinweis: "Proteinreichste Basis, ~4,4 g/100 g (vergleichbar Kuhmilchjoghurt); oft mit Calcium/B12/Vit. D angereichert.",
        handelsprodukte_beispiele: [
          { produkt: "Vemondo Soja Classic Natur", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
          { produkt: "Alpro Soja Natur", marke: "Alpro", laeden: ["Rewe", "Edeka", "Kaufland", "Aldi Süd"], eigenmarke: false },
          { produkt: "My Veggie Natur Soja", marke: "My Veggie", laeden: ["Edeka"], eigenmarke: true },
        ], prioritaet: 1 },
      { alternative_name: "Kokosjoghurt Natur", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen"], ungeeignet_fuer: ["kochen_erhitzen"],
        hinweise: "Cremig, schmeckt nach Kokos – passt zu Dessert/Süß, weniger zu pikanten Gerichten.",
        naehrwert_hinweis: "Wenig Protein (0,7–1,0 g/100 g), mehr Fett (7,7–8,9 g/100 g).",
        handelsprodukte_beispiele: [
          { produkt: "So good so veggie Kokos Natur", marke: "Andros", laeden: ["Rewe", "Edeka"], eigenmarke: false },
          { produkt: "Food for Future Kokos Natur", marke: "Food for Future", laeden: ["Penny", "Rewe"], eigenmarke: true },
        ], prioritaet: 2 },
      { alternative_name: "Haferjoghurt Natur", basis: "hafer", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert"], ungeeignet_fuer: ["kochen_erhitzen"],
        hinweise: "Dünner, für kalte Anwendungen; teils intensiver Eigengeschmack. Sojafrei.",
        naehrwert_hinweis: "Kaum Protein (~0,5 g/100 g), oft ohne Calciumzusatz.",
        handelsprodukte_beispiele: [
          { produkt: "Hafer Jogu Natur", marke: "The Vegan Cow", laeden: ["Bioladen", "Online"], eigenmarke: false },
          { produkt: "enerBio Hafer Natur", marke: "enerBio", laeden: ["dm"], eigenmarke: true },
        ], prioritaet: 3 },
    ],
    quelle: ["Stiftung Warentest 3/2025", "ProVeg", "VeganBlatt"], stand: SUB_STAND,
  },
  {
    id: "sub_joghurt_griechisch", original_zutat: "Joghurt griechischer Art", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Soja Greek Style", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Dickere, cremigere Sojavariante; für Dips, Tzatziki, Bowls. Alternativ Sojajoghurt Natur 2–3 h abtropfen lassen.",
        naehrwert_hinweis: "Höherer Protein-/Fettgehalt als Natur.",
        handelsprodukte_beispiele: [
          { produkt: "Alpro Greek Style", marke: "Alpro", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_milch", original_zutat: "Milch", kategorie: "milchprodukt",
    zutat_ids: ["ing_milch"],
    alternativen: [
      { alternative_name: "Sojadrink (ungesüßt)", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["backen", "kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Backtechnisch verlässlichste Wahl (Protein bindet, gibt Volumen); gut aufschäumbar; stabil beim Kochen.",
        naehrwert_hinweis: "~3,5 g Protein/100 ml, dem Kuhmilchgehalt ebenbürtig; auf Calcium-/B12-Anreicherung achten.",
        handelsprodukte_beispiele: [
          { produkt: "Alpro Soja Original", marke: "Alpro", laeden: ["Rewe", "Edeka", "Kaufland", "Aldi Süd"], eigenmarke: false },
          { produkt: "Vemondo Sojadrink", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
        ], prioritaet: 1 },
      { alternative_name: "Haferdrink", basis: "hafer", verhaeltnis: "1:1",
        geeignet_fuer: ["backen", "kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Mild-süßlich; für saftige Teige; Barista-Variante schäumt für Kaffee. Zucker im Rezept ggf. um 5–10 % reduzieren.",
        naehrwert_hinweis: "Kaum Protein; oft mit Calcium angereichert.",
        handelsprodukte_beispiele: [
          { produkt: "Oatly Haferdrink / Barista", marke: "Oatly", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Vemondo Barista Hafer", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
          { produkt: "MyVay / GutBio Haferdrink", marke: "Aldi-Eigenmarke", laeden: ["Aldi Nord", "Aldi Süd"], eigenmarke: true },
        ], prioritaet: 2 },
      { alternative_name: "Mandeldrink", basis: "mandel", verhaeltnis: "1:1",
        geeignet_fuer: ["backen", "kalt_dessert"], ungeeignet_fuer: ["kochen_erhitzen"],
        hinweise: "Leichtes Nussaroma; kann bei starker Hitze/im Kaffee ausflocken.",
        naehrwert_hinweis: "Wenig Protein.",
        handelsprodukte_beispiele: [
          { produkt: "Alpro Mandel", marke: "Alpro", laeden: ["Rewe", "Edeka"], eigenmarke: false },
        ], prioritaet: 3 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_schlagsahne", original_zutat: "Schlagsahne (aufschlagbar)", kategorie: "milchprodukt",
    zutat_ids: ["ing_sahne"],
    alternativen: [
      { alternative_name: "Vegane Schlagcreme (Spezialprodukt)", basis: "sonstiges", verhaeltnis: "1:1",
        geeignet_fuer: ["aufschlagen", "backen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Nur eigens entwickelte Schlagcremes werden wirklich fest (hoher Anteil gesättigter Fette). Vor dem Aufschlagen gut kühlen; ggf. veganes Sahnesteif (Agar/Pektin) zusetzen. Kann nicht überschlagen werden.",
        naehrwert_hinweis: "Fettreich; ohne Cholesterin.",
        handelsprodukte_beispiele: [
          { produkt: "Schlagfix Schlagcreme", marke: "Schlagfix (Leha)", laeden: ["Bioladen", "Online", "Rewe"], eigenmarke: false },
          { produkt: "Soyatoo Soja-/Reis-Schlagcreme", marke: "Soyatoo", laeden: ["Bioladen", "Online"], eigenmarke: false },
          { produkt: "Rama Schlagcreme", marke: "Rama", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Oatly Hafer-Schlagcreme", marke: "Oatly", laeden: ["Rewe", "Edeka"], eigenmarke: false },
        ], prioritaet: 1 },
      { alternative_name: "Gekühlte Kokoscreme (feste Dose)", basis: "kokos", verhaeltnis: "nur fester Anteil",
        geeignet_fuer: ["aufschlagen", "kalt_dessert"], ungeeignet_fuer: ["neutral_geschmack"],
        hinweise: "Dose über Nacht kühlen, nur den festen Teil aufschlagen; schmeckt nach Kokos.",
        naehrwert_hinweis: "Sehr fettreich.", handelsprodukte_beispiele: [], prioritaet: 2 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_kochsahne", original_zutat: "Kochsahne / Sahne zum Kochen", kategorie: "milchprodukt",
    zutat_ids: ["ing_sahne"],
    alternativen: [
      { alternative_name: "Pflanzliche Cuisine/Kochcreme", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kochen_erhitzen", "backen"], ungeeignet_fuer: ["aufschlagen"],
        hinweise: "Cremig für Soßen/Suppen/Aufläufe; wird NICHT steif. Sojabasis am hitzestabilsten, Hafer/Reis mild.",
        naehrwert_hinweis: "Weniger Fett als Milchsahne; ohne Cholesterin.",
        handelsprodukte_beispiele: [
          { produkt: "Alpro Soja Kochcreme (Cuisine)", marke: "Alpro", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Vemondo Cuisine", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_saure_sahne", original_zutat: "Saure Sahne", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Sojajoghurt Natur (+ Zitrone)", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Dips/Toppings; ggf. abtropfen lassen und mit Zitronensaft säuern.",
        naehrwert_hinweis: "Proteinreich (Soja).",
        handelsprodukte_beispiele: [
          { produkt: "Alpro/Vemondo Sojajoghurt Natur", marke: "Alpro/Vemondo", laeden: ["Rewe", "Lidl"], eigenmarke: false },
        ], prioritaet: 1 },
      { alternative_name: "Cashew-Sour-Cream (DIY)", basis: "cashew", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Eingeweichte Cashews + Zitronensaft + Salz + Wasser pürieren; sojafrei, sehr cremig.",
        naehrwert_hinweis: "Fett aus Nüssen.", handelsprodukte_beispiele: [], prioritaet: 2 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_schmand", original_zutat: "Schmand", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Cashewmus-Creme (DIY)", basis: "cashew", verhaeltnis: "1:1",
        geeignet_fuer: ["kochen_erhitzen", "kalt_dessert", "backen"], ungeeignet_fuer: [],
        hinweise: "Cashewmus + Wasser + Zitronensaft + Salz mixen. Für Flammkuchen, Pizza bianca, Soßen. Höherer Fettgehalt (20–30 %) wie Schmand.",
        naehrwert_hinweis: "Nussbasiert, cholesterinfrei.",
        handelsprodukte_beispiele: [
          { produkt: "Bedda Frischcreme (als Schmand-Ersatz)", marke: "bedda", laeden: ["Rewe", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
      { alternative_name: "Veganer Frischkäse / Soja-Cuisine", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Als schnelle Kochalternative.", handelsprodukte_beispiele: [], prioritaet: 2 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_creme_fraiche", original_zutat: "Crème fraîche", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Cashewcreme (DIY, fettreich)", basis: "cashew", verhaeltnis: "1:1",
        geeignet_fuer: ["kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Wie Schmand-DIY, aber fester/fettreicher (30–40 % Fett-Äquivalent). Ohne Stabilisatoren kann sich die Masse absetzen – frisch verwenden.",
        handelsprodukte_beispiele: [
          { produkt: "Alnatura Frischcreme / Bedda Frischcreme", marke: "Alnatura/bedda", laeden: ["Alnatura", "dm", "Rewe"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_quark", original_zutat: "Quark", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Abgetropfter Sojajoghurt Natur", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["backen", "kalt_dessert", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Sojajoghurt 2–3 h im Sieb/Mulltuch abtropfen → quarkähnliche Konsistenz, neutral. Ideal für Käsekuchen, Aufläufe, Dips.",
        naehrwert_hinweis: "Proteinreich; magerquarkähnlich.",
        handelsprodukte_beispiele: [
          { produkt: "Vemondo Soja Classic Natur", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
          { produkt: "Made with Luve Skyr/Quark-Style (Lupine)", marke: "Made with Luve", laeden: ["Rewe", "Edeka"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_skyr", original_zutat: "Skyr", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganer Skyr-Style", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen"], ungeeignet_fuer: [],
        hinweise: "Proteinreicher, dickerer Sojajoghurt. Für Frühstücksbowls, Dips.",
        naehrwert_hinweis: "Alpro Skyr Style ~5,8 g Protein/100 g; Sojade ~7 g/100 g (proteinreichste Option).",
        handelsprodukte_beispiele: [
          { produkt: "Alpro Skyr Style Natur", marke: "Alpro", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Sojade Soja Skyr-Alternative (Bio)", marke: "Sojade", laeden: ["Bioladen", "Alnatura", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
      { alternative_name: "Abgetropfter Sojajoghurt (DIY)", basis: "soja", verhaeltnis: "Volumen ~halbiert",
        geeignet_fuer: ["kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Über Nacht abseihen verdoppelt fast den Proteingehalt.",
        handelsprodukte_beispiele: [], prioritaet: 2 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_buttermilch", original_zutat: "Buttermilch", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Sojadrink + Säure (DIY)", basis: "soja", verhaeltnis: "250 ml Sojadrink + 1 EL Zitronensaft/Essig",
        geeignet_fuer: ["backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Ungesüßten Sojadrink verwenden; kurz ziehen lassen bis es leicht andickt. Sojabasis flockt am zuverlässigsten (hoher Proteingehalt); Hafer/Mandel weniger geeignet. Säure + Natron im Teig = fluffig.",
        naehrwert_hinweis: "Proteinreich (Soja).", handelsprodukte_beispiele: [], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_kefir", original_zutat: "Kefir", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganer Soja-Kefir", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen"], ungeeignet_fuer: [],
        hinweise: "Fertigprodukt oder DIY (Sojadrink + Wasserkefir-/Kefirkultur, 24–48 h). Sojamilch fermentiert am cremigsten.",
        handelsprodukte_beispiele: [
          { produkt: "Sojade Soja Kefir-Alternative Natur (Bio)", marke: "Sojade", laeden: ["Bioladen", "Alnatura", "Rewe"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_butter", original_zutat: "Butter", kategorie: "milchprodukt",
    zutat_ids: ["ing_butter"],
    alternativen: [
      { alternative_name: "Veganer Butterblock/Streichfett", basis: "sonstiges", verhaeltnis: "1:1 (100 g Block ≥75 % Fett = 100 g Butter)",
        geeignet_fuer: ["backen", "kochen_erhitzen", "braten", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Fester Block (kalt) für Mürbeteig/Blätterteig; Streichfett fürs Brot. Nicht jede Margarine ist vegan – Zutatenliste prüfen. Alternativ 100 g Butter ≈ 80 ml Öl.",
        naehrwert_hinweis: "Cholesterinfrei; Palmöl-Anteil beachten.",
        handelsprodukte_beispiele: [
          { produkt: "Alsan-S / Alsan Bio", marke: "Alsan", laeden: ["Bioladen", "Rewe", "Edeka"], eigenmarke: false },
          { produkt: "Naturli Vegan Block / Streichfett", marke: "Naturli", laeden: ["Rewe", "Edeka", "dm"], eigenmarke: false },
          { produkt: "Rama 100% pflanzlich / Sooo Buttrig", marke: "Rama", laeden: ["Rewe", "Edeka", "Kaufland", "Aldi Süd"], eigenmarke: false },
          { produkt: "Violife Vioblock", marke: "Violife", laeden: ["Rewe", "Edeka"], eigenmarke: false },
          { produkt: "Vemondo Vegane Margarine", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
          { produkt: "Bellasan Margarine", marke: "Bellasan", laeden: ["Aldi Nord", "Aldi Süd"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_ghee", original_zutat: "Ghee / Butterschmalz", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganes Butterschmalz / raffiniertes Kokosöl", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen", "backen"], ungeeignet_fuer: [],
        hinweise: "Hoch erhitzbar. Raffiniertes Kokosöl ist geschmacksneutral; spezielle Produkte imitieren Butteraroma.",
        handelsprodukte_beispiele: [
          { produkt: "Butasan veganes Butterschmalz", marke: "Butasan", laeden: ["Bioladen", "Online"], eigenmarke: false },
          { produkt: "Schmelzfein", marke: "Landkost", laeden: ["Online", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_kondensmilch", original_zutat: "Kondensmilch (gezuckert)", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Vegane gezuckerte Kokos-Kondensmilch", basis: "kokos", verhaeltnis: "1:1 (400 g)",
        geeignet_fuer: ["backen", "kalt_dessert", "suessen"], ungeeignet_fuer: [],
        hinweise: "Kommerziell erhältlich (Nature's Charm) oder DIY: Vollfett-Kokosmilch + Zucker 30–45 Min. einkochen bis Volumen halbiert. Leichte Kokosnote.",
        handelsprodukte_beispiele: [
          { produkt: "Nature's Charm Gesüßte Kondens Kokosmilch", marke: "Nature's Charm", laeden: ["Kaufland", "Online", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_milchpulver", original_zutat: "Milchpulver", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Soja-/Kokos-/Reispulver", basis: "soja", verhaeltnis: "produktabhängig anpassen",
        geeignet_fuer: ["backen", "suessen"], ungeeignet_fuer: [],
        hinweise: "Als Andickmittel/Milchpulverersatz. Achtung: manche Kokosmilchpulver enthalten Natriumkaseinat (Milcheiweiß – nicht vegan) – Zutaten prüfen.",
        handelsprodukte_beispiele: [
          { produkt: "Kokosmilchpulver (div.)", marke: "Die Grüne Essenz u.a.", laeden: ["Online", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_mascarpone", original_zutat: "Mascarpone", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Vegane Mascarpone-Crème", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Tiramisu/Cremes. DIY: eingeweichte Cashews + Zitronensaft + wenig Pflanzendrink pürieren.",
        handelsprodukte_beispiele: [
          { produkt: "Schlagfix Crème (wie Mascarpone)", marke: "Schlagfix", laeden: ["Rewe", "Online"], eigenmarke: false },
          { produkt: "Züger Bio MascarVone vegan", marke: "Züger", laeden: ["Rewe", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_ricotta", original_zutat: "Ricotta", kategorie: "milchprodukt",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Tofu-Ricotta (DIY)", basis: "tofu", verhaeltnis: "1:1",
        geeignet_fuer: ["backen", "kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Fester Tofu zerbröseln + Hefeflocken + Zitronensaft + Salz (+ helles Miso) mixen. Für Lasagne, Cannelloni, Füllungen. Cremiger mit Cashew-/Seidentofu-Mix.",
        naehrwert_hinweis: "Proteinreich (Tofu).",
        handelsprodukte_beispiele: [
          { produkt: "New Roots Ricotta-Alternative", marke: "New Roots", laeden: ["Bioladen", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },

  // -------------------------------------------------------------------- Käse
  {
    id: "sub_parmesan", original_zutat: "Hartkäse / Parmesan", kategorie: "kaese",
    zutat_ids: ["ing_parmesan"],
    alternativen: [
      { alternative_name: "Cashew-Hefeflocken-Parmesan (DIY)", basis: "cashew", verhaeltnis: "1:1 (streuen)",
        geeignet_fuer: ["streuen", "kalt_dessert"], ungeeignet_fuer: ["ueberbacken_schmelzen"],
        hinweise: "Cashews (oder Mandeln) + Hefeflocken + Salz + Knoblauchpulver fein mixen. Schmilzt nicht, streut aber wie geriebener Parmesan. Hefeflocken liefern Umami/Käsenote.",
        naehrwert_hinweis: "Nussbasiert; B12 nur wenn Hefeflocken angereichert.",
        handelsprodukte_beispiele: [
          { produkt: "Violife Just Like Parmesan", marke: "Violife", laeden: ["Rewe", "Edeka", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_reibekaese", original_zutat: "Reibekäse / Schmelzkäse zum Überbacken", kategorie: "kaese",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganer Pizzaschmelz / Reibegenuss", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["ueberbacken_schmelzen", "backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Pizza/Aufläufe/Gratins. Schmilzt und zieht teils Fäden. Meist auf Kokosöl+Stärke; Wilmersburger schmilzt besonders gleichmäßig. DIY-Cashew-Parmesan schmilzt NICHT – zum Überbacken nur Kaufprodukte.",
        naehrwert_hinweis: "Fettreich (Kokosöl, gesättigte Fette); kaum Protein.",
        handelsprodukte_beispiele: [
          { produkt: "Simply V Reibegenuss", marke: "Simply V", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Violife gerieben (Mozzarella-Geschmack)", marke: "Violife", laeden: ["Rewe", "Edeka"], eigenmarke: false },
          { produkt: "Wilmersburger Pizzaschmelz", marke: "Wilmersburger", laeden: ["Bioladen", "Online"], eigenmarke: false },
          { produkt: "Vehappy Herzstücke Reibeschmelz", marke: "Vehappy", laeden: ["Edeka"], eigenmarke: true },
          { produkt: "K-take it veggie Reibeschmelz", marke: "K-take it veggie", laeden: ["Kaufland"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_frischkaese", original_zutat: "Frischkäse", kategorie: "kaese",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganer Streich-/Frischkäse", basis: "mandel", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen", "kochen_erhitzen", "streuen"], ungeeignet_fuer: [],
        hinweise: "Als Aufstrich, in Pasta-Soßen, als Füllung. Mandel-/Cashewbasis kommt dem Original am nächsten. DIY: eingeweichte Cashews + Zitronensaft + Hefe + Salz.",
        handelsprodukte_beispiele: [
          { produkt: "Simply V Streichgenuss", marke: "Simply V", laeden: ["Rewe", "Edeka", "Kaufland", "Aldi Süd"], eigenmarke: false },
          { produkt: "Violife Creamy Original", marke: "Violife", laeden: ["Rewe", "Edeka"], eigenmarke: false },
          { produkt: "Philadelphia Pflanzlich", marke: "Philadelphia", laeden: ["Rewe", "Edeka"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_feta", original_zutat: "Feta / Hirtenkäse", kategorie: "kaese",
    zutat_ids: ["ing_feta"],
    alternativen: [
      { alternative_name: "Veganer Feta-Block (Salzlake)", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Salate, Ofengerichte. DIY: marinierter fester Tofu (Zitrone, Salz, Kräuter, Öl).",
        handelsprodukte_beispiele: [
          { produkt: "Violife Just Like Feta / Greek White Block", marke: "Violife", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "bedda Feta-Style in Salzlake", marke: "bedda", laeden: ["Rewe", "Bioladen"], eigenmarke: false },
          { produkt: "K-take it veggie Hirtenkäse", marke: "K-take it veggie", laeden: ["Kaufland"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_mozzarella", original_zutat: "Mozzarella", kategorie: "kaese",
    zutat_ids: ["ing_mozzarella"],
    alternativen: [
      { alternative_name: "Veganer Mozzarella", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["ueberbacken_schmelzen", "backen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Für Pizza/Caprese. Kokos- oder Mandelbasis; schmilzt, zieht teils leicht Fäden.",
        handelsprodukte_beispiele: [
          { produkt: "bedda Mozzarella (Kokosbasis)", marke: "bedda", laeden: ["Rewe", "Bioladen"], eigenmarke: false },
          { produkt: "Simply V Mozzarella-Style", marke: "Simply V", laeden: ["Rewe", "Edeka"], eigenmarke: false },
          { produkt: "Mondarella Veganer Mozzarella (Mandel)", marke: "Mondarella", laeden: ["Kaufland", "Rewe"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_halloumi", original_zutat: "Halloumi / Grillkäse", kategorie: "kaese",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganer Grillkäse", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Bratfest, behält Form. Alternativ: marinierter, gepresster fester Tofu.",
        handelsprodukte_beispiele: [
          { produkt: "bedda Grill-/Halloumi-Style", marke: "bedda", laeden: ["Rewe", "Bioladen"], eigenmarke: false },
          { produkt: "Violife Mediterranean (Grill)", marke: "Violife", laeden: ["Rewe", "Edeka"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },

  // -------------------------------------------------- Ei (funktionsbasiert)
  {
    id: "sub_ei_binden", original_zutat: "Ei", kategorie: "ei",
    funktion: "binden", funktion_name: "Binden",
    funktion_frage: "Das Ei hält die Masse zusammen: Bratlinge, Frikadellen, Burger, Brot- und Mürbeteig.",
    zutat_ids: ["ing_ei"],
    alternativen: [
      { alternative_name: "Leinsamen-Ei", basis: "samen", verhaeltnis: "1 Ei = 1 EL geschrotete Leinsamen + 3 EL Wasser",
        geeignet_fuer: ["binden", "backen"], ungeeignet_fuer: [],
        hinweise: "5–10 Min. quellen lassen. Für Brot, herzhaftes Gebäck, Bratlinge, Burger. Neutral, leicht nussig; liefert Omega-3.",
        handelsprodukte_beispiele: [], prioritaet: 1 },
      { alternative_name: "Chia-Ei", basis: "samen", verhaeltnis: "1 Ei = 1 EL Chiasamen + 3 EL Wasser",
        geeignet_fuer: ["binden", "backen"], ungeeignet_fuer: [],
        hinweise: "Bindet stark, zieht viel Wasser; für Kekse/Muffins.",
        handelsprodukte_beispiele: [], prioritaet: 2 },
      { alternative_name: "Kichererbsen-/Sojamehl", basis: "getreide", verhaeltnis: "1 Ei = 2 EL Mehl + 2 EL Wasser",
        geeignet_fuer: ["binden", "backen"], ungeeignet_fuer: [],
        hinweise: "Proteinreich; für Scones, Kekse. Bei Soja-Ausschluss Kichererbsenmehl verwenden.",
        handelsprodukte_beispiele: [], prioritaet: 3 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_ei_lockern", original_zutat: "Ei", kategorie: "ei",
    funktion: "lockern_backen", funktion_name: "Lockern & Backen",
    funktion_frage: "Das Ei macht den Teig locker und saftig: Rührkuchen, Muffins, Pancakes, Waffeln.",
    zutat_ids: ["ing_ei"],
    alternativen: [
      { alternative_name: "Apfelmus", basis: "frucht", verhaeltnis: "1 Ei = 80 g Apfelmus",
        geeignet_fuer: ["backen", "binden"], ungeeignet_fuer: [],
        hinweise: "Geschmacksneutral, macht Rührteig saftig; für fast alle Kuchen.",
        handelsprodukte_beispiele: [], prioritaet: 1 },
      { alternative_name: "Reife Banane", basis: "frucht", verhaeltnis: "1 Ei = ½ zerdrückte Banane",
        geeignet_fuer: ["backen", "binden"], ungeeignet_fuer: [],
        hinweise: "Eigengeschmack Banane; für Pancakes, Bananenbrot.",
        handelsprodukte_beispiele: [], prioritaet: 2 },
      { alternative_name: "Natron + Essig", basis: "sonstiges", verhaeltnis: "1 Ei = 1 TL Natron + 1 EL Essig",
        geeignet_fuer: ["backen"], ungeeignet_fuer: [],
        hinweise: "Macht Teig luftig; Essig schmeckt nicht durch.",
        handelsprodukte_beispiele: [], prioritaet: 3 },
      { alternative_name: "Ei-Ersatzpulver", basis: "getreide", verhaeltnis: "nach Packung (meist 1 Ei = ~2 EL Pulver + Wasser)",
        geeignet_fuer: ["backen", "binden"], ungeeignet_fuer: [],
        hinweise: "Neutral, aus Stärke/Backtriebmittel; für Volumen.",
        handelsprodukte_beispiele: [
          { produkt: "Ei-Ersatz Pulver", marke: "z.B. Vegan Egg / MyEy / Bio-Eigenmarken", laeden: ["dm", "Rewe", "Bioladen", "Alnatura"], eigenmarke: false },
        ], prioritaet: 4 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_ei_hauptzutat", original_zutat: "Ei", kategorie: "ei",
    funktion: "hauptzutat_ruehrei_omelett", funktion_name: "Hauptzutat (Rührei/Omelett)",
    funktion_frage: "Das Ei ist das Gericht, nicht die Zutat: Rührei, Omelett, Quiche, Eiersalat.",
    zutat_ids: ["ing_ei"],
    alternativen: [
      { alternative_name: "Seidentofu + Kala Namak", basis: "tofu", verhaeltnis: "60 g Seidentofu ≈ 1 Ei",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Rührei/Omelett/Quiche. Kala Namak (Schwarzsalz) liefert den typischen Ei-/Schwefelgeschmack. Kurkuma für Farbe.",
        naehrwert_hinweis: "Proteinreich.",
        handelsprodukte_beispiele: [
          { produkt: "Veganes Rührei (Fertigprodukt)", marke: "z.B. Vemondo / Simply V", laeden: ["Lidl", "Rewe", "Edeka"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_ei_aufschlagen", original_zutat: "Ei / Eiweiß", kategorie: "ei",
    funktion: "aufschlagen_eischnee", funktion_name: "Aufschlagen / Eischnee",
    funktion_frage: "Es soll Schaum entstehen, der stehen bleibt: Eischnee, Baiser, Mousse, Cremes.",
    zutat_ids: ["ing_ei"],
    alternativen: [
      { alternative_name: "Aquafaba (Kichererbsenwasser)", basis: "sonstiges", verhaeltnis: "~40 g Aquafaba ≈ 1 Ei (3 EL ≈ 1 Eiweiß)",
        geeignet_fuer: ["aufschlagen", "backen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Abtropfwasser aus Kichererbsendose 5–10 Min. steif schlagen. Für Baiser, Macarons, Mousse, Cremes.",
        handelsprodukte_beispiele: [], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_ei_geschmack", original_zutat: "Ei-Geschmack", kategorie: "ei",
    funktion: "ei_geschmack", funktion_name: "Ei-Geschmack",
    funktion_frage: "Die Funktion übernimmt schon etwas anderes – es fehlt nur der Ei-Geschmack: veganer Eiersalat, Mayo, Rührtofu.",
    zutat_ids: ["ing_ei"],
    alternativen: [
      { alternative_name: "Kala Namak (Schwarzsalz)", basis: "sonstiges", verhaeltnis: "nach Geschmack (Prise)",
        geeignet_fuer: ["braten", "kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Schwefelhaltiges Salz mit Ei-Aroma; sparsam dosieren. Für Rührei, veganen Eiersalat, Mayo.",
        handelsprodukte_beispiele: [
          { produkt: "Kala Namak", marke: "div.", laeden: ["Bioladen", "dm", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },

  // ---------------------------------------------------------- Fleisch & Wurst
  {
    id: "sub_hackfleisch", original_zutat: "Hackfleisch", kategorie: "fleisch_wurst",
    zutat_ids: ["ing_hackfleisch_rind"],
    alternativen: [
      { alternative_name: "Veganes Hack (Soja/Erbse)", basis: "soja", verhaeltnis: "ca. 2:3 (⅓ weniger nötig, da kein Bratverlust)",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Bolognese, Chili sin Carne, Lasagne. Frisch (Kühlregal) oder Trockengranulat (Sojaschnetzel einweichen).",
        naehrwert_hinweis: "Sojaprotein, ~18 g Protein/100 g (z. B. Rügenwalder ~18 g); fettarm.",
        handelsprodukte_beispiele: [
          { produkt: "Veganes Mühlen Hack", marke: "Rügenwalder Mühle", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Next Level / Vemondo Hack", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
          { produkt: "Garden Gourmet Sensational Hack", marke: "Garden Gourmet", laeden: ["Rewe", "Edeka"], eigenmarke: false },
          { produkt: "dmBio Veggie Hack (Trockengranulat)", marke: "dmBio", laeden: ["dm"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_geschnetzeltes", original_zutat: "Geschnetzeltes", kategorie: "fleisch_wurst",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Sojaschnetzel / Erbsen-Geschnetzeltes / Seitan", basis: "soja", verhaeltnis: "1:1 (Trockensoja ~1:2,5 nach Einweichen)",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Einweichen, gut abtropfen/ausdrücken, würzen, anbraten. Nimmt Marinaden gut auf.",
        naehrwert_hinweis: "Proteinreich.",
        handelsprodukte_beispiele: [
          { produkt: "Sojageschnetzeltes / Sojawürfel", marke: "Veganz / Rinatura / KoRo", laeden: ["Rewe", "dm", "Bioladen", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_steak", original_zutat: "Steak / Filet-artige Stücke", kategorie: "fleisch_wurst",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Seitan-Steak / Erbsenprotein-Filet", basis: "weizen_seitan", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Fleischähnliche, faserige Textur; gut marinierbar. Alternativ marinierte Austernpilze/Kräuterseitlinge.",
        handelsprodukte_beispiele: [
          { produkt: "Vegini / Wheaty / Like Meat Filetstücke", marke: "Vegini/Wheaty/Like Meat", laeden: ["Rewe", "Edeka", "Kaufland", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_speck", original_zutat: "Speck / Bacon", kategorie: "fleisch_wurst",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Räuchertofu / veganer Bacon", basis: "tofu", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Räuchertofu dünn schneiden und knusprig braten – für Pasta, Eintopf, Rührei. Rauchig durch Flüssigrauch/Räuchersalz. DIY-Bacon aus Reispapier + Marinade (Sojasauce, Ahornsirup, Rauchsalz, Paprika).",
        naehrwert_hinweis: "Räuchertofu proteinreich, fettarm.",
        handelsprodukte_beispiele: [
          { produkt: "Räuchertofu", marke: "Taifun / Eigenmarken", laeden: ["Rewe", "Edeka", "dm", "Alnatura"], eigenmarke: false },
          { produkt: "Veganer Bacon", marke: "Wheaty / Vivera", laeden: ["Bioladen", "Rewe", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_wurst", original_zutat: "Wurst / Aufschnitt", kategorie: "fleisch_wurst",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganer Aufschnitt / vegane Wurst", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Breites Sortiment (Salami-, Schinken-, Lyoner-Style, Bratwurst). Basis Soja/Weizen/Erbse.",
        handelsprodukte_beispiele: [
          { produkt: "Vegane Mühlen Aufschnitt/Wurst", marke: "Rügenwalder Mühle", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Vemondo Aufschnitt/Levervurst", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
          { produkt: "K-take it veggie Aufschnitt", marke: "K-take it veggie", laeden: ["Kaufland"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_haehnchen", original_zutat: "Hähnchen", kategorie: "fleisch_wurst",
    zutat_ids: ["ing_haehnchenbrust"],
    alternativen: [
      { alternative_name: "Veganes Hähnchen (Soja/Erbse/Seitan)", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Als Filetstücke, Nuggets, Geschnetzeltes. Grobe Sojaschnetzel gut abspülen (entfernt Sojageschmack), mit Geflügelgewürz würzen.",
        naehrwert_hinweis: "Proteinreich.",
        handelsprodukte_beispiele: [
          { produkt: "Like Chicken / Chicken-Style Stücke", marke: "Like Meat", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Garden Gourmet Filetstücke", marke: "Garden Gourmet", laeden: ["Rewe", "Edeka"], eigenmarke: false },
          { produkt: "Vemondo Chicken-Style", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_gulasch", original_zutat: "Gulasch", kategorie: "fleisch_wurst",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Sojawürfel / Seitan / Jackfruit", basis: "soja", verhaeltnis: "1:1 (Trockensoja ~1:2,5)",
        geeignet_fuer: ["kochen_erhitzen", "braten"], ungeeignet_fuer: [],
        hinweise: "Sojawürfel einweichen und schmoren – nehmen Sauce/Gewürze gut auf. Jackfruit für zupfige Textur, Seitan für Biss.",
        handelsprodukte_beispiele: [
          { produkt: "Grobe Sojawürfel / Soja Big Chunks", marke: "KoRo / Vantastic Foods", laeden: ["Online", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },

  // ------------------------------------------------------ Fisch & Meeresfrüchte
  {
    id: "sub_fischfilet", original_zutat: "Fischfilet", kategorie: "fisch",
    zutat_ids: ["ing_lachs"],
    alternativen: [
      { alternative_name: "Veganes Filet (Tofu/Weizen + Algen)", basis: "tofu", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Nori/Wakame liefern Meeresgeschmack. Auch vegane Fischstäbchen als Ersatz.",
        handelsprodukte_beispiele: [
          { produkt: "Vegane Fischstäbchen / Filet", marke: "Iglo Green Cuisine / SoFine", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "The Wonder Vegane Fischstäbchen", marke: "Mein Veggie Tag", laeden: ["Aldi Süd", "Aldi Nord"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_thunfisch", original_zutat: "Thunfisch", kategorie: "fisch",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Veganer Thunfisch (Erbse/Kichererbse/Algen)", basis: "erbsenprotein", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Salat, Sandwich, Pizza. DIY: zerdrückte Kichererbsen/Jackfruit + vegane Mayo + Noripulver + Zitrone.",
        handelsprodukte_beispiele: [
          { produkt: "TU-NAH Dose", marke: "BettaF!sh", laeden: ["Edeka", "Online"], eigenmarke: false },
          { produkt: "Thun-Visch / Vuna", marke: "Garden Gourmet / Followfish", laeden: ["Rewe", "Edeka"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_lachs", original_zutat: "Lachs / Räucherlachs", kategorie: "fisch",
    zutat_ids: ["ing_lachs"],
    alternativen: [
      { alternative_name: "Karottenlachs (DIY) / veganer Räucherlachs", basis: "sonstiges", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Karotten in Algen-/Rauchmarinade einlegen. Fertigprodukte auf Basis Karotte/Tomate.",
        handelsprodukte_beispiele: [
          { produkt: "Räucherlachs aus Pflanzen", marke: "Revo", laeden: ["Rewe"], eigenmarke: false },
          { produkt: "Vegan Smoked Salmon", marke: "Vantastic Foods", laeden: ["Online", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_garnelen", original_zutat: "Garnelen", kategorie: "fisch",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Vegane Shrimps (Konjak/Erbse)", basis: "sonstiges", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Bissfeste Textur aus Konjak/Erbsenprotein; für Pfannengerichte, Curry, Pasta.",
        handelsprodukte_beispiele: [
          { produkt: "Vegane Shrimps", marke: "Vegan Zeastar / Vantastic Foods", laeden: ["Online", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_fischsauce", original_zutat: "Fischsauce", kategorie: "fisch",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Vegane Fischsauce / Sojasauce + Algen", basis: "soja", verhaeltnis: "1:1",
        geeignet_fuer: ["kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "DIY: Sojasauce + Noristückchen/getrocknete Pilze ziehen lassen (Umami/Meeresnote). Kommerzielle vegane Fischsaucen im Asia-/Bioladen.",
        handelsprodukte_beispiele: [
          { produkt: "Vegan Fish Sauce", marke: "div. (Asia-Sortiment)", laeden: ["Online", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },

  // --------------------------------------------------------------- Sonstiges
  {
    id: "sub_honig", original_zutat: "Honig", kategorie: "sonstiges",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Agavendicksaft", basis: "sonstiges", verhaeltnis: "1:1 (etwas süßer)",
        geeignet_fuer: ["suessen", "kalt_dessert", "kochen_erhitzen"], ungeeignet_fuer: ["backen"],
        hinweise: "Neutral-süß, gut für Getränke/Desserts; zum Backen wegen hohem Fruchtzucker (schnelle Bräunung) nur bedingt. Regional: Zuckerrüben-/Apfelsirup.",
        handelsprodukte_beispiele: [
          { produkt: "Agavendicksaft", marke: "div. / Eigenmarken", laeden: ["Rewe", "Edeka", "dm", "Aldi Süd", "Lidl"], eigenmarke: false },
          { produkt: "Ohnig / Ohne Honig", marke: "Veganz", laeden: ["Rewe", "Edeka", "Bioladen"], eigenmarke: false },
        ], prioritaet: 1 },
      { alternative_name: "Ahornsirup", basis: "sonstiges", verhaeltnis: "1:1",
        geeignet_fuer: ["suessen", "backen", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Karamellig; für Pancakes, Marinaden, Backen. Importware.",
        handelsprodukte_beispiele: [], prioritaet: 2 },
      { alternative_name: "Zuckerrübensirup", basis: "sonstiges", verhaeltnis: "1:1",
        geeignet_fuer: ["suessen", "backen"], ungeeignet_fuer: [],
        hinweise: "Regional, kräftig; als Aufstrich und zum Backen/Kochen.",
        handelsprodukte_beispiele: [], prioritaet: 3 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_gelatine", original_zutat: "Gelatine", kategorie: "sonstiges",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Agar-Agar", basis: "alge", verhaeltnis: "6 Blatt Gelatine ≈ 1 TL (4 g) Agar-Agar für 500 g Creme; ~1 gestr. TL / 500 ml Flüssigkeit",
        geeignet_fuer: ["gelieren", "kalt_dessert", "backen"], ungeeignet_fuer: [],
        hinweise: "Muss kurz aufgekocht werden (geliert beim Abkühlen); NICHT 1:1 tauschen. Nicht mit rohem Kiwi/Ananas oder Schokolade kombinieren (Gelierwirkung gestört). Geliertest empfohlen.",
        handelsprodukte_beispiele: [
          { produkt: "Agar-Agar", marke: "Dr. Oetker / RUF / Bio-Eigenmarken", laeden: ["Rewe", "Edeka", "dm", "Kaufland"], eigenmarke: false },
        ], prioritaet: 1 },
      { alternative_name: "Pektin", basis: "frucht", verhaeltnis: "nach Packung",
        geeignet_fuer: ["gelieren"], ungeeignet_fuer: [],
        hinweise: "Für Marmelade/Gelee/Tortenguss (Gelierzucker).",
        handelsprodukte_beispiele: [], prioritaet: 2 },
      { alternative_name: "Johannisbrotkern-/Guarkernmehl", basis: "sonstiges", verhaeltnis: "sparsam",
        geeignet_fuer: ["gelieren", "binden"], ungeeignet_fuer: [],
        hinweise: "Zum Andicken; kalt einsetzbar.",
        handelsprodukte_beispiele: [], prioritaet: 3 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_mayonnaise", original_zutat: "Mayonnaise", kategorie: "sonstiges",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Vegane Mayonnaise", basis: "erbsenprotein", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Auf Ackerbohnen-/Sojaprotein + Öl; cremig wie Original. DIY mit Sojadrink + Öl + Senf + Zitrone.",
        handelsprodukte_beispiele: [
          { produkt: "Thomy Vegane Mayonnaise (ohne Ei)", marke: "Thomy", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
          { produkt: "Vemondo Vegane Mayo", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_worcestershire", original_zutat: "Worcestershiresauce", kategorie: "sonstiges",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Vegane Worcestersauce", basis: "soja", verhaeltnis: "1:1 (sparsam)",
        geeignet_fuer: ["kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Original enthält meist Sardellen/Anchovis (nicht vegan!). Einige Marken sind vegan – Zutatenliste/V-Label prüfen (variiert je Charge). DIY: Sojasauce + Essig + Tamarinde + Zucker/Melasse + Gewürze aufkochen.",
        handelsprodukte_beispiele: [
          { produkt: "Worcestersauce (vegane Varianten)", marke: "Sanchon / Ostmann / Kattus / Maitre Marcel", laeden: ["Bioladen", "Edeka", "Rewe"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_schmalz", original_zutat: "Schmalz", kategorie: "sonstiges",
    zutat_ids: [],
    alternativen: [
      { alternative_name: "Kokosfett / veganes Schmalz (Griebenschmalz-Style)", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "backen", "kochen_erhitzen", "kalt_dessert"], ungeeignet_fuer: [],
        hinweise: "Kokosfett zum Braten/Backen. Für Aufstrich: veganes Griebenschmalz mit Zwiebel/Apfel/Röststoffen.",
        handelsprodukte_beispiele: [
          { produkt: "Veganes Schmalz / Griebenschmalz-Style", marke: "Landkost / Bioladen-Marken", laeden: ["Bioladen", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_bruehe", original_zutat: "Fleisch-/Hühnerbrühe", kategorie: "sonstiges",
    zutat_ids: ["ing_huehnerbruehe"],
    alternativen: [
      { alternative_name: "Vegane Gemüsebrühe", basis: "getreide", verhaeltnis: "1:1 (z. B. 1 Würfel / 0,5 l Wasser)",
        geeignet_fuer: ["kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Für Suppen/Soßen/Risotto. Hefeextrakt (vegan) liefert Umami; hefefreie Varianten verfügbar. ACHTUNG: 'Alnatura Hühner Brühe' enthält echtes Hühnerpulver – NICHT vegan; auf V-Label achten.",
        handelsprodukte_beispiele: [
          { produkt: "Gemüsebouillon ohne Hefeextrakt", marke: "Alnatura", laeden: ["dm", "Edeka", "Alnatura"], eigenmarke: true },
          { produkt: "Knorr Bio Gemüse Bouillon (V-Label)", marke: "Knorr", laeden: ["Rewe", "Kaufland", "Edeka"], eigenmarke: false },
          { produkt: "Vegane Chikn-Style / Beefy-Style Brühe", marke: "Meatless Heaven", laeden: ["Online"], eigenmarke: false },
          { produkt: "GutBio / BioNaturally Gemüsebrühe", marke: "Aldi/Lidl-Eigenmarke", laeden: ["Aldi Nord", "Aldi Süd", "Lidl"], eigenmarke: true },
        ], prioritaet: 1 },
    ], stand: SUB_STAND,
  },

  // ------------------------------------------------------- Tofu (Gegenrichtung)
  /* Diese drei Datensätze verlassen bewusst das Grundmuster "pflanzlich statt
     tierisch": Sie beantworten die andere Frage, nämlich was man kocht, wenn
     das Rezept Tofu verlangt und keiner im Kühlschrank liegt. Ohne sie bleibt
     der Ersatz-Teaser im Rezept-Detail bei jedem Tofu-Rezept leer.
     Wichtig ist die Sortentrennung: Fester Tofu und Seidentofu sind
     unterschiedliche Zutaten und untereinander KEIN Ersatz (siehe TIP-015). */
  {
    id: "sub_tofu_fest", original_zutat: "Tofu (fest/extra fest)", kategorie: "sonstiges",
    zutat_ids: ["ing_tofu_fest", "ing_tofu_natur"],
    alternativen: [
      { alternative_name: "Tempeh", basis: "tempeh", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: ["kalt_dessert"],
        hinweise: "Fester Biss, nussig-herber Eigengeschmack. Vor dem Braten 10 Min dämpfen oder blanchieren nimmt die Bitterkeit. Braucht kein Pressen.",
        naehrwert_hinweis: "Mehr Protein und Ballaststoffe als Tofu (~19 g/100 g), weil die ganze Bohne fermentiert wird.",
        handelsprodukte_beispiele: [
          { produkt: "Tempeh Natur", marke: "Alnatura", laeden: ["dm", "Alnatura", "Edeka"], eigenmarke: true },
          { produkt: "Bio-Tempeh", marke: "Lord of Tofu / Vantastic Foods", laeden: ["Bioladen", "Online"], eigenmarke: false },
        ], prioritaet: 1 },
      { alternative_name: "Räuchertofu", basis: "tofu", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: ["kalt_dessert"],
        hinweise: "Fester und würziger als Naturtofu, muss nicht gepresst werden. Bringt Rauchgeschmack mit – in mild gewürzten Gerichten dominiert er.",
        handelsprodukte_beispiele: [
          { produkt: "Räuchertofu Natur", marke: "Taifun", laeden: ["Rewe", "Edeka", "dm", "Bioladen"], eigenmarke: false },
          { produkt: "Vemondo Räuchertofu", marke: "Vemondo", laeden: ["Lidl"], eigenmarke: true },
        ], prioritaet: 2 },
      { alternative_name: "Seitan", basis: "weizen_seitan", verhaeltnis: "1:1",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: ["kalt_dessert"],
        hinweise: "Der fleischigste Biss von allen, saugt Marinade gut auf. Enthält Gluten – bei Zöliakie ausgeschlossen.",
        naehrwert_hinweis: "Sehr proteinreich (~25 g/100 g), aber arm an Lysin.",
        handelsprodukte_beispiele: [
          { produkt: "Seitan Natur", marke: "Wheaty", laeden: ["Bioladen", "Rewe"], eigenmarke: false },
        ], prioritaet: 3 },
      { alternative_name: "Kichererbsen", basis: "sonstiges", verhaeltnis: "1 Dose (240 g Abtropfgewicht) für 200 g Tofu",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Der Vorratsjoker: kein Kühlschrank nötig. Andere Textur, aber in Currys, Pfannen und Bowls ein vollwertiger Proteinträger. Abgespült und trocken getupft werden sie im Ofen knusprig.",
        handelsprodukte_beispiele: [
          { produkt: "Kichererbsen aus der Dose", marke: "Eigenmarken", laeden: ["Aldi", "Lidl", "Rewe", "Edeka", "Penny"], eigenmarke: true },
        ], prioritaet: 4 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_tofu_seiden", original_zutat: "Seidentofu", kategorie: "sonstiges",
    zutat_ids: ["ing_tofu_seiden"],
    alternativen: [
      { alternative_name: "Cashewcreme (eingeweicht, püriert)", basis: "cashew", verhaeltnis: "100 g Cashews + 100 ml Wasser für 200 g Seidentofu",
        geeignet_fuer: ["kalt_dessert", "backen", "kochen_erhitzen", "binden"], ungeeignet_fuer: [],
        hinweise: "Mindestens 2 h einweichen und sehr lange pürieren, sonst bleibt es körnig. Neutraler als Kokos, cremiger als Joghurt.",
        naehrwert_hinweis: "Deutlich fettreicher als Seidentofu, dafür ebenso cremig.",
        handelsprodukte_beispiele: [
          { produkt: "Cashewkerne natur", marke: "Eigenmarken", laeden: ["Aldi", "Lidl", "Rewe", "dm"], eigenmarke: true },
        ], prioritaet: 1 },
      { alternative_name: "Kokoscreme (fester Teil der Kokosmilch)", basis: "kokos", verhaeltnis: "1:1",
        geeignet_fuer: ["kalt_dessert", "backen"], ungeeignet_fuer: [],
        hinweise: "Für Mousse und Desserts. Bringt deutlichen Kokosgeschmack mit und ist im Kühlschrank fester als Seidentofu – vor dem Pürieren kurz temperieren lassen.",
        handelsprodukte_beispiele: [
          { produkt: "Kokosmilch 60 % / Kokoscreme", marke: "Eigenmarken", laeden: ["Aldi", "Lidl", "Rewe", "Edeka"], eigenmarke: true },
        ], prioritaet: 2 },
      { alternative_name: "Sojajoghurt Natur", basis: "soja", verhaeltnis: "1:1, für Dressings und Dips",
        geeignet_fuer: ["kalt_dessert", "binden"], ungeeignet_fuer: ["backen"],
        hinweise: "Dünner und säuerlicher als Seidentofu – gut für Dressings, zu flüssig für Mousse und Cheesecake.",
        handelsprodukte_beispiele: [
          { produkt: "Alpro Soja Natur", marke: "Alpro", laeden: ["Rewe", "Edeka", "Kaufland"], eigenmarke: false },
        ], prioritaet: 3 },
      { alternative_name: "Avocado", basis: "frucht", verhaeltnis: "1 reife Avocado für 200 g Seidentofu",
        geeignet_fuer: ["kalt_dessert"], ungeeignet_fuer: ["backen", "kochen_erhitzen"],
        hinweise: "Nur für Schokomousse und Ähnliches, wo Kakao den Eigengeschmack überdeckt. Muss wirklich reif sein.",
        handelsprodukte_beispiele: [], prioritaet: 4 },
    ], stand: SUB_STAND,
  },
  {
    id: "sub_raeuchertofu", original_zutat: "Räuchertofu", kategorie: "sonstiges",
    zutat_ids: ["ing_raeuchertofu"],
    alternativen: [
      { alternative_name: "Fester Tofu + geräuchertes Paprikapulver", basis: "tofu", verhaeltnis: "1:1 plus 1 TL Paprikapulver je 200 g",
        geeignet_fuer: ["braten", "kochen_erhitzen"], ungeeignet_fuer: [],
        hinweise: "Kommt der Rauchnote nahe, wenn der Tofu vorher gepresst und kräftig angebraten wird. Etwas Sojasauce ersetzt die Würze.",
        handelsprodukte_beispiele: [], prioritaet: 1 },
      { alternative_name: "Geräucherter Tempeh", basis: "tempeh", verhaeltnis: "1:1",
        geeignet_fuer: ["braten"], ungeeignet_fuer: [],
        hinweise: "Kräftiger im Eigengeschmack, fester im Biss – für Speckersatz in Pfannen und Salaten die beste Wahl.",
        handelsprodukte_beispiele: [
          { produkt: "Tempeh geräuchert", marke: "Lord of Tofu", laeden: ["Bioladen", "Online"], eigenmarke: false },
        ], prioritaet: 2 },
    ], stand: SUB_STAND,
  },
];

export { SUB_SCHEMA_VERSION, SUB_STAND, SUB_KATEGORIEN, SUB_ANWENDUNGEN, BASIS_ALLERGENE, SUBSTITUTIONEN };

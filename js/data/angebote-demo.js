/* Vorratio Demo-Angebote für den Angebots-Crawl (Kap. 7.4).
   Realistischer Wochenprospekt-Querschnitt über fünf Ketten, damit Matching und
   Markt-Empfehlung ohne Live-API (Marktguru-Keys) komplett testbar sind.
   Preise sind fiktive, aber plausible Aktionspreise; gueltigBis = null → immer gültig.
   Die letzten Einträge sind bewusste Fast-Treffer (Reiswaffeln, Milchschokolade,
   Butterkekse …), an denen das Matching sich beweisen muss. */

const DEMO_ANGEBOTE = [
  // --- Edeka ---
  { produkt: "Spaghetti No. 5", marke: "Barilla", beschreibung: "Hartweizengrieß", preis: 0.99, altpreis: 1.79, mengeText: "500 g", markt: "Edeka", gueltigBis: null },
  { produkt: "H-Milch 3,5 %", marke: "Gut & Günstig", beschreibung: "haltbare Vollmilch", preis: 0.95, altpreis: 1.15, mengeText: "1 l", markt: "Edeka", gueltigBis: null },
  { produkt: "Eier aus Freilandhaltung", marke: "Gut & Günstig", beschreibung: "Größe M–L, 10 Stück", preis: 2.49, altpreis: 2.99, mengeText: "10 Stk", markt: "Edeka", gueltigBis: null },
  { produkt: "Rinderhackfleisch", marke: "", beschreibung: "frisch, max. 20 % Fett", preis: 4.44, altpreis: 5.55, mengeText: "500 g", markt: "Edeka", gueltigBis: null },
  { produkt: "Bananen", marke: "Chiquita", beschreibung: "", preis: 1.19, altpreis: 1.69, mengeText: "1 kg", markt: "Edeka", gueltigBis: null },
  { produkt: "Deutsche Markenbutter", marke: "Gut & Günstig", beschreibung: "mild gesäuert", preis: 1.39, altpreis: 1.99, mengeText: "250 g", markt: "Edeka", gueltigBis: null },
  { produkt: "Basmati Reis", marke: "Oryza", beschreibung: "Duftreis", preis: 2.22, altpreis: 3.29, mengeText: "1 kg", markt: "Edeka", gueltigBis: null },
  { produkt: "Gehackte Tomaten", marke: "Mutti", beschreibung: "Polpa", preis: 0.88, altpreis: 1.29, mengeText: "400 g", markt: "Edeka", gueltigBis: null },
  { produkt: "Kernige Haferflocken", marke: "Kölln", beschreibung: "", preis: 1.11, altpreis: 1.49, mengeText: "500 g", markt: "Edeka", gueltigBis: null },
  { produkt: "Paprika rot", marke: "", beschreibung: "Klasse I", preis: 1.99, altpreis: 2.79, mengeText: "500 g", markt: "Edeka", gueltigBis: null },

  // --- Rewe ---
  { produkt: "Penne Rigate", marke: "De Cecco", beschreibung: "Pasta di Gragnano", preis: 1.29, altpreis: 1.99, mengeText: "500 g", markt: "Rewe", gueltigBis: null },
  { produkt: "Frische Vollmilch 3,5 %", marke: "ja!", beschreibung: "", preis: 1.05, altpreis: null, mengeText: "1 l", markt: "Rewe", gueltigBis: null },
  { produkt: "Hähnchenbrustfilet", marke: "", beschreibung: "frisch, Teilstücke", preis: 5.55, altpreis: 7.29, mengeText: "600 g", markt: "Rewe", gueltigBis: null },
  { produkt: "Lachsfilet", marke: "Followfish", beschreibung: "ASC, tiefgekühlt", preis: 4.99, altpreis: 6.49, mengeText: "250 g", markt: "Rewe", gueltigBis: null },
  { produkt: "Naturjoghurt 3,5 %", marke: "ja!", beschreibung: "", preis: 0.85, altpreis: null, mengeText: "500 g", markt: "Rewe", gueltigBis: null },
  { produkt: "Zucchini", marke: "", beschreibung: "Klasse I", preis: 0.79, altpreis: 1.29, mengeText: "Stück", markt: "Rewe", gueltigBis: null },
  { produkt: "Speisezwiebeln", marke: "", beschreibung: "", preis: 1.29, altpreis: 1.79, mengeText: "2 kg", markt: "Rewe", gueltigBis: null },
  { produkt: "Olivenöl nativ extra", marke: "Bertolli", beschreibung: "", preis: 5.99, altpreis: 8.99, mengeText: "500 ml", markt: "Rewe", gueltigBis: null },
  { produkt: "Äpfel Elstar", marke: "", beschreibung: "aus Deutschland", preis: 1.79, altpreis: 2.49, mengeText: "1 kg", markt: "Rewe", gueltigBis: null },

  // --- Lidl ---
  { produkt: "Spaghetti", marke: "Combino", beschreibung: "", preis: 0.79, altpreis: 0.99, mengeText: "500 g", markt: "Lidl", gueltigBis: null },
  { produkt: "Frische Weidemilch 3,8 %", marke: "Milbona", beschreibung: "", preis: 0.99, altpreis: 1.19, mengeText: "1 l", markt: "Lidl", gueltigBis: null },
  { produkt: "Speisekartoffeln", marke: "", beschreibung: "vorwiegend festkochend", preis: 2.49, altpreis: 3.49, mengeText: "5 kg", markt: "Lidl", gueltigBis: null },
  { produkt: "Rispentomaten", marke: "", beschreibung: "Klasse I", preis: 1.66, altpreis: 2.22, mengeText: "500 g", markt: "Lidl", gueltigBis: null },
  { produkt: "Weizenmehl Type 405", marke: "Belbake", beschreibung: "", preis: 0.69, altpreis: 0.89, mengeText: "1 kg", markt: "Lidl", gueltigBis: null },
  { produkt: "Rapsöl", marke: "Vita D'or", beschreibung: "raffiniert", preis: 1.99, altpreis: 2.79, mengeText: "1 l", markt: "Lidl", gueltigBis: null },
  { produkt: "Hähnchenbrustfilet", marke: "Metzgerfrisch", beschreibung: "", preis: 4.99, altpreis: 6.19, mengeText: "600 g", markt: "Lidl", gueltigBis: null },
  { produkt: "Feta", marke: "Eridanous", beschreibung: "griechischer Schafskäse g.U.", preis: 1.79, altpreis: 2.29, mengeText: "200 g", markt: "Lidl", gueltigBis: null },
  { produkt: "Beerenmix", marke: "Freshona", beschreibung: "tiefgekühlt", preis: 2.49, altpreis: 2.99, mengeText: "500 g", markt: "Lidl", gueltigBis: null },
  { produkt: "Bio-Bananen", marke: "", beschreibung: "Fairtrade", preis: 1.29, altpreis: 1.59, mengeText: "1 kg", markt: "Lidl", gueltigBis: null },

  // --- Penny ---
  { produkt: "Fusilli", marke: "Mondo Italiano", beschreibung: "Nudeln aus Hartweizen", preis: 0.89, altpreis: 1.19, mengeText: "500 g", markt: "Penny", gueltigBis: null },
  { produkt: "H-Milch 3,5 %", marke: "Penny", beschreibung: "", preis: 0.89, altpreis: null, mengeText: "1 l", markt: "Penny", gueltigBis: null },
  { produkt: "Eier aus Bodenhaltung", marke: "", beschreibung: "Größe M, 10 Stück", preis: 1.99, altpreis: 2.49, mengeText: "10 Stk", markt: "Penny", gueltigBis: null },
  { produkt: "Zucker", marke: "", beschreibung: "raffiniert", preis: 1.09, altpreis: 1.39, mengeText: "1 kg", markt: "Penny", gueltigBis: null },
  { produkt: "Möhren", marke: "", beschreibung: "im Beutel", preis: 0.99, altpreis: 1.49, mengeText: "1 kg", markt: "Penny", gueltigBis: null },
  { produkt: "Mozzarella", marke: "San Fabio", beschreibung: "in Lake", preis: 0.99, altpreis: 1.29, mengeText: "125 g", markt: "Penny", gueltigBis: null },
  { produkt: "Kokosmilch", marke: "Bamboo Garden", beschreibung: "", preis: 1.49, altpreis: 1.99, mengeText: "400 ml", markt: "Penny", gueltigBis: null },

  // --- Aldi Nord ---
  { produkt: "Langkorn-Spitzenreis", marke: "Bon-Ri", beschreibung: "", preis: 1.79, altpreis: 2.19, mengeText: "1 kg", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Frische Vollmilch", marke: "Milsani", beschreibung: "3,5 % Fett", preis: 0.95, altpreis: 1.09, mengeText: "1 l", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Deutsche Markenbutter", marke: "Milsani", beschreibung: "", preis: 1.29, altpreis: 1.79, mengeText: "250 g", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Rinderhackfleisch", marke: "Meine Metzgerei", beschreibung: "", preis: 3.99, altpreis: 4.99, mengeText: "400 g", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Paprika-Mix", marke: "", beschreibung: "rot/gelb/grün", preis: 1.79, altpreis: 2.49, mengeText: "500 g", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Salatgurke", marke: "", beschreibung: "Klasse I", preis: 0.59, altpreis: 0.89, mengeText: "Stück", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Passierte Tomaten", marke: "Cucina Nobile", beschreibung: "", preis: 0.65, altpreis: 0.85, mengeText: "500 g", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Kidneybohnen", marke: "", beschreibung: "in der Dose", preis: 0.59, altpreis: 0.79, mengeText: "400 g", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Erdnüsse geröstet & gesalzen", marke: "", beschreibung: "", preis: 1.49, altpreis: 1.99, mengeText: "200 g", markt: "Aldi Nord", gueltigBis: null },

  // --- Fast-Treffer: dürfen NICHT matchen (Prüfsteine fürs Matching) ---
  { produkt: "Reiswaffeln", marke: "", beschreibung: "mit Meersalz", preis: 0.99, altpreis: null, mengeText: "130 g", markt: "Rewe", gueltigBis: null },
  { produkt: "Milchschokolade", marke: "Choceur", beschreibung: "Alpenmilch", preis: 1.19, altpreis: null, mengeText: "200 g", markt: "Aldi Nord", gueltigBis: null },
  { produkt: "Butterkekse", marke: "Leibniz", beschreibung: "", preis: 1.49, altpreis: 1.99, mengeText: "200 g", markt: "Penny", gueltigBis: null },
  { produkt: "Erdnussbutter", marke: "Calvé", beschreibung: "creamy", preis: 2.79, altpreis: 3.49, mengeText: "350 g", markt: "Rewe", gueltigBis: null },
  { produkt: "Apfelsaft naturtrüb", marke: "", beschreibung: "Direktsaft", preis: 1.29, altpreis: 1.79, mengeText: "1 l", markt: "Edeka", gueltigBis: null },
];

export { DEMO_ANGEBOTE };

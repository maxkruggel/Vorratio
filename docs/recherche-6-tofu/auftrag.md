# Auftrag 24 — Tofu: Grundlagen, Basistechniken und Rezeptdatensatz

**Projekt:** Vorratio
**Auftragsnummer:** 24 (Zusatzauftrag außerhalb der 23er-Kernreihe)
**Kurzname:** tofu-rezepte
**Datum:** 02.08.2026
**Status:** abgeschlossen (Top 20 vollständig, T21–T60 als Stub)

## Ziel

Die populärsten Tofu-Rezepte aus dem Web crawlen und als importierbaren Datensatz für Vorratio aufbereiten – inklusive Sortenkunde, Basistechniken, Haltbarkeitsdaten für die Vorratslogik und Substitutionen.

## Scope

**Enthalten:**

- Grundlagenblock: Tofusorten, Verwendung, reale Erhältlichkeit im deutschen Handel, Haltbarkeit/Lagerung/Verderbserkennung, Nährwerte je 100 g
- 12 wiederverwendbare Basistechniken als eigenständige Entitäten (Pressen, Coating, Braten, Krümeln, Seidentofu-Handling etc.)
- 60 Rezeptdatensätze, international breit: chinesisch, japanisch, koreanisch, thailändisch, vietnamesisch, indisch, europäisch/deutsch, amerikanisch, Dessert/Seidentofu, Aufstriche
- Priorisierung: Top 20 als Startdatensatz mit vollständigen Schritten und Timern, T21–T60 als nachladbare Erweiterung
- Substitutionen in beide Richtungen: Tofu als Ersatz (Ei, Ricotta, Feta, Hack, Sahne, Paneer) und Ersatz für Tofu
- Zutaten-Kombinationsmatrix je Rezeptgruppe für die bestandsbasierte Vorschlagslogik
- Tipps als ausspielbare Ein- bis Zweizeiler

**Nicht enthalten:**

- Preise, Bezugsquellen, Produktebene-Nährwerte einzelner Marken
- Rezepte ohne Tofu
- Konservierungshandwerk (Auftrag 23)
- Gerätespezifische Umrechnungen (Auftrag 21)

## Anforderungen an das Ergebnis

- Ausgabe als JSON, ohne Nacharbeit importierbar
- `tofu_sorte` als hartes Match-Kriterium gegen den Bestand
- Kochschritte anfängertauglich formuliert – kein vorausgesetztes Wissen, kein Foodblogger-Vorspann
- Timer maschinenlesbar in Sekunden, mit sprechendem Label
- Schritte verweisen per `basistechnik_ref` auf die zentralen Techniken statt sie zu duplizieren
- Nährwerte pro Portion mit ausgewiesener Berechnungsgrundlage
- Keine wörtliche Übernahme von Rezepttexten – Quellen ausschließlich als Herkunftsangabe

## Quellenrahmen

Deutschsprachig: Chefkoch, Eat this!, Zucker&Jagdwurst, Bianca Zapatka, Utopia, EDEKA, smarticular, Verbraucherzentrale, BZfE.
International: Woks of Life, Serious Eats, Just One Cookbook, Maangchi, Korean Bapsang, Hot Thai Kitchen, Omnivore's Cookbook, Minimalist Baker, Hungry Huy, Holy Cow Vegan, RecipeTin Japan, Red House Spice.
Nährwerte: USDA FoodData Central (FDC 172475, FDC 172448), Open Food Facts als Ergänzung.

## Abhängigkeiten

- Auftrag 01 (Austausch-Matrix): Substitutionsblock hier ist tofu-spezifische Vertiefung, `sub_id`-Vergabe muss dort anschlussfähig bleiben
- Auftrag 02 (Umrechnung): Stückgewichte/Gebindegrößen für Tofu (200 g, 250 g, 400 g, 500 g Blöcke)
- Auftrag 04 (Garzeiten): Brat-, Ofen-, Airfryer- und Frittierzeiten aus den Basistechniken übernehmen
- Auftrag 05 (Haltbarkeit): Der Lagerungsblock hier ist die Detailfassung für die Produktgruppe Tofu
- Auftrag 17 (Kochschritte): `step_`-IDs perspektivisch gegen die zentrale Schritt-DB mappen

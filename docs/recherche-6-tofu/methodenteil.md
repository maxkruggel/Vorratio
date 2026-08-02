# Methodenteil — Auftrag 24 Tofu

## Vorgehen

1. **Popularitätsermittlung**: Abgleich der Rezeptbestände reichweitenstarker deutscher und internationaler Portale. Als populär gilt, was in mehreren voneinander unabhängigen Sammlungen auftaucht und dort hohe Bewertungszahlen trägt. Ergebnis: eine klare Häufung auf rund 20 Kerngerichte.
2. **Küchenraster**: Bewusste Verteilung über neun Küchen, damit die App nicht in eine Richtung kippt. Innerhalb jeder Küche wurden die jeweils bekanntesten Tofugerichte gezogen.
3. **Mengenharmonisierung**: Wo Quellen abweichen, wurde ein Standardwert gesetzt, der im Mittelfeld der gefundenen Angaben liegt und für Haushaltsportionen funktioniert. Beispiele: Tamarindenpaste im Pad Thai (Spanne 3–4 EL, gesetzt 3,5), Doubanjiang im Mapo (Spanne 2–3 EL, gesetzt 2), Sojajoghurt im Rührtofu (Spanne 3–4 EL, gesetzt 3,5).
4. **Neuformulierung**: Sämtliche Schritte wurden aus der Sache heraus neu geschrieben, anfängertauglich und ohne vorausgesetztes Wissen. Kein Satz stammt wörtlich aus einer Quelle. Quellenangaben sind Herkunftsnachweise.
5. **Technik-Extraktion**: Wiederkehrende Handgriffe wurden aus den Rezepten herausgezogen und als 12 Basistechniken normiert, damit sie nicht 60-fach dupliziert werden. Rezeptschritte verweisen per `basistechnik_ref`.
6. **Nährwerte**: Berechnung aus den Zutatenmengen auf Basis der USDA-Referenzwerte für die jeweilige Tofusorte plus Standardwerte für Begleitzutaten. Anschließende Plausibilitätsprüfung gegen die Angaben der Ursprungsrezepte.

## Quellenlage und Konfidenz

**Hoch** — mehrfach unabhängig bestätigt, quantifizierte Angaben:
Sortenkunde, Lagerung und Verderbserkennung, Basistechniken, Nährwerte fester Tofu (USDA FDC 172475 und 172448), T01–T13, T15, T18, T19.

**Mittel** — Einzelquelle oder harmonisiert aus abweichenden Angaben:
T14, T16, T17, T20, Nährwerte Räuchertofu (herstellerabhängig, Richtwert), Nährwerte Seidentofu (Spanne je nach Wassergehalt).

**Niedrig / Gerüst** — bewusst als Stub angelegt:
T21–T60. Diese 40 Rezepte tragen Name, Küche, Kategorie, `tofu_sorte`, Schwierigkeit, Zeitrahmen und Leitquelle, aber keine ausformulierten Schritte und keine Mengen. Sie sind als Katalog- und Suchgerüst nutzbar, nicht als Kochanleitung.

## Bekannte Lücken

- Bei einigen Rezeptkarten (unter anderem Bianca Zapatka, Korean Bapsang) ließen sich die strukturierten Mengenangaben nicht vollständig auslesen. Diese Werte wurden über gleichwertige, quantifizierte Quellen (EDEKA, smarticular, Utopia, Vegan Heaven) abgesichert.
- Räuchertofu-Nährwerte schwanken je Hersteller erheblich. Für die App-Anzeige sind Produktwerte über Open Food Facts vorzuziehen.
- Der Calciumgehalt hängt stark vom Gerinnungsmittel ab. Calciumsulfat-Tofu liegt mit 683 mg pro 100 g weit über Nigari-Tofu mit 201 mg. Die deutschen Handelsprodukte deklarieren das Gerinnungsmittel nicht immer, deshalb ist die Anzeige als Spanne sinnvoller als ein Einzelwert.
- Fettwerte frittierter Rezepte (T03, T07, T11, T59) sind naturgemäß unscharf, weil die Ölaufnahme von Temperatur und Panade abhängt. Angesetzt wurde eine Aufnahme im mittleren Bereich.

## Prüfschritte vor dem Livegang

1. `tofu_sorte` gegen die Bestandslogik testen: Bei reinem Seidentofu-Bestand dürfen ausschließlich seiden-Rezepte vorgeschlagen werden.
2. Timer-Labels im Kochmodus auf Verständlichkeit prüfen – sie werden vorgelesen beziehungsweise angezeigt.
3. Stub-Rezepte im UI als solche kennzeichnen oder aus dem Kochmodus ausschließen, solange keine Schritte hinterlegt sind.
4. Nährwerte durchgängig als „ca." ausweisen.
5. `substitutionen` gegen den Bestand aus Auftrag 01 mappen, damit keine doppelten `sub_id` entstehen.

## Nachbearbeitungsregel

Sobald ein Stub-Rezept in die meistgeklickten Vorschläge aufsteigt, wird es auf denselben Detailgrad wie T01–T20 gehoben: vollständige Zutatenliste mit Mengen, ausformulierte Schritte, Timer, Nährwerte, Variationen.

# Ernährungsformen als Zielgruppen-Presets für die App „Restlos” – wissenschaftlich fundierte Recherche

## TL;DR

- Für die App sind sieben echte Ernährungsformen als Presets sinnvoll: Mischkost/omnivor, Flexitarier, Pescetarier, Ovo-Lacto-Vegetarier, Lacto-Vegetarier, Ovo-Vegetarier und Veganer; überwiegend pflanzenbasiert/„plant-based” ist als achtes, weiches Preset sinnvoll. Allergien/Intoleranzen, religiös-kulturelle Regeln (halal, koscher) und Diät-/Ernährungsstile (Low-Carb, Keto, Paleo, mediterran, High-Protein, Intervallfasten, Clean Eating) sind KEINE Ernährungsformen in diesem Sinn, sondern separate Profil-Dimensionen bzw. Filter.
- Der kritischste ernährungsphysiologische Punkt ist die vegane Ernährung: Vitamin B12 ist nur über ein Präparat sicher zu decken (DGE-Positionspapier vom 13.06.2024) – das ist NICHT über Rezepte lösbar und gehört als App-Hinweis, nicht als Rezeptregel. Jod, Eisen, Calcium, Zink, Selen, Vitamin D, Riboflavin (Vitamin B2), langkettige Omega-3 (EPA/DHA), Protein und neu Vitamin A sind laut DGE (potenziell) kritisch.
- Für die AI-Rezeptgenerierung lassen sich klare, quellenbelegte Regeln ableiten (z. B. Eisen-Mahlzeiten immer mit Vitamin-C-Komponente; Getreide + Hülsenfrüchte kombinieren; jodiertes Speisesalz als Default; Fleisch/Wurst max. 300 g/Woche bei Mischkost gemäß DGE-Empfehlungen „Gut essen und trinken” 2024). Supplemente, Schwangerschaft/Stillzeit und Kinder müssen als Sonderfälle mit Verweis auf ärztliche Beratung nur hinweisend behandelt werden.

## Key Findings

1. **Taxonomie:** Es gibt einen abgestuften „Verzichts-Gradienten” von omnivor über flexitarisch, pescetarisch, die drei vegetarischen Untertypen bis vegan. Nur diese Achse gehört in das Preset „Ernährungsform”. Alles andere (Allergien, Religion, Diätstile) sind orthogonale Profil-Dimensionen und müssen getrennt modelliert werden, sonst entstehen widersprüchliche Kombinationen.
1. **Verbreitung Deutschland:** Laut BMEL-Ernährungsreport 2024 (forsa, ~1.000 Befragte, Erhebung 15.–26. Mai 2024) ernähren sich 41 % flexitarisch, 8 % vegetarisch und 2 % vegan; der Flexitarier-Anteil sank von 46 % (2023) auf 41 %. Das Max-Rubner-Institut (nemo-Erwachsene, 3.155 Befragte, 18–80 J., Erhebung Sept.–Nov. 2024, veröffentlicht 15.08.2025) kommt zu: „Rund vier Prozent ernähren sich nach eigenen Angaben vegetarisch, zwei Prozent pescetarisch und etwa ein Prozent vegan.” Die Zahlen schwanken je nach Erhebungsmethode erheblich.
1. **DGE-Kehrtwende 2024:** Die DGE bewertet in ihrer Pressemeldung vom 13.06.2024 eine gut geplante vegane Ernährung für gesunde Erwachsene erstmals als gesundheitsfördernd – zwingende Bedingung bleibt ein B12-Präparat und die bewusste Deckung der übrigen kritischen Nährstoffe. Für Kinder, Jugendliche, Schwangere, Stillende und Senioren gibt es weder eine Empfehlung dafür noch dagegen.
1. **Bioverfügbarkeit ist der Hebel:** Pflanzliches Nicht-Häm-Eisen wird deutlich schlechter absorbiert (2–20 %) als Häm-Eisen (15–35 %); Vitamin C zur Mahlzeit steigert die Aufnahme um das 3- bis 4-Fache (bereits 25–75 mg Vitamin C reichen), Phytate/Polyphenole/Calcium hemmen sie. Für Rezepte ist die Kombination wichtiger als der reine Nährstoffgehalt.
1. **B12 und Algen/Spirulina:** Fermentierte Lebensmittel, Spirulina, Chlorella und Afa liefern KEIN verlässliches, bioverfügbares B12 – das ist von DGE und amtlicher Lebensmittelüberwachung (CVUA/UA-BW) klar belegt und muss in der App eindeutig kommuniziert werden.
1. **Fisch/Pescetarier:** DGE empfiehlt 1–2 Portionen Fisch/Woche, davon 70 g fettreicher Seefisch (Lachs, Makrele, Hering); die BfR-Stellungnahme Nr. 17/2024 (28.05.2024, Basis BfR-MEAL-Studie) weist die höchsten Methylquecksilber-Gehalte in Thunfisch, Dornhai und Rotbarsch aus und rät besonders Schwangeren/Stillenden vom Verzehr solcher Raubfische ab.

## Details

### (a) Übersicht / Taxonomie aller Formen und Abgrenzung separater Profil-Dimensionen

**Echte Ernährungsformen (Preset „Ernährungsform” – genau eine Auswahl):**

|Preset                                                |Isst                                                                             |Lässt weg                                                    |
|------------------------------------------------------|---------------------------------------------------------------------------------|-------------------------------------------------------------|
|Mischkost / omnivor („normal”)                        |alles, inkl. Fleisch, Fisch, Milch, Ei                                           |nichts prinzipiell                                           |
|Flexitarier                                           |überwiegend pflanzlich + gelegentlich Fleisch/Fisch in bewusst gewählter Qualität|häufiges/tägliches Fleisch                                   |
|Pescetarier                                           |pflanzlich + Fisch/Meeresfrüchte + Milch + Ei                                    |Fleisch von Land-/Warmblütern (Rind, Schwein, Geflügel)      |
|Ovo-Lacto-Vegetarier („klassisch vegetarisch”)        |pflanzlich + Milch + Ei + Honig                                                  |Fleisch, Fisch                                               |
|Lacto-Vegetarier                                      |pflanzlich + Milch(-produkte)                                                    |Fleisch, Fisch, Ei                                           |
|Ovo-Vegetarier                                        |pflanzlich + Ei                                                                  |Fleisch, Fisch, Milch(-produkte)                             |
|Veganer                                               |ausschließlich pflanzlich                                                        |alle Tierprodukte inkl. Honig                                |
|(optional) überwiegend pflanzenbasiert / „plant-based”|ganz überwiegend pflanzlich, Tierprodukte selten und bewusst                     |– weiches Preset, ähnlich Flexitarier, aber pflanzenzentriert|

„Vegetarier” ist der Oberbegriff; ovo-lacto ist der mit Abstand häufigste Untertyp, ovo-vegetarisch ist selten. Pescetarier gelten fachlich streng genommen nicht als Vegetarier (Verzehr von Fisch).

**Separate Profil-Dimensionen (NICHT als Ernährungsform modellieren):**

- **Allergien/Intoleranzen** (Gluten/Zöliakie, Laktose, Nussallergie, Sojaallergie u. a.): harte Ausschlussfilter, die mit JEDER Ernährungsform kombinierbar sein müssen. Sie definieren keine Zielgruppe, sondern verbotene Zutaten.
- **Religiös-kulturelle Regeln** (halal, koscher): ebenfalls Ausschluss-/Regelfilter, die quer zu allen Formen liegen.
- **Ernährungsstile/Diäten** (High-Protein, Low-Carb, Keto, Paleo, mediterran, Intervallfasten, Clean Eating): Makronährstoff- bzw. Lebensmittel-Präferenzen, die mit den Ernährungsformen kombinierbar sind (z. B. „vegan + Low-Carb”). Als optionale Filter sinnvoll, nicht als Grundform.

Empfehlung: Datenmodell mit drei unabhängigen Achsen – (1) Ernährungsform (Radio-Auswahl), (2) Ausschlüsse (Allergien/Religion, Mehrfachauswahl), (3) Stil-Präferenz (optional, Mehrfachauswahl).

### DGE-Referenzwerte für Erwachsene (Basis für alle Nährstoff-Aussagen)

Quelle: DGE/ÖGE-Referenzwerte (dge.de/wissenschaft/referenzwerte).

|Nährstoff    |Referenzwert Erwachsene                                                                                          |Anmerkung                                                  |
|-------------|-----------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------|
|Protein      |0,8 g/kg Körpergewicht/Tag (19–65 J.); 1,0 g/kg ab 65 J.                                                         |DGE-Leitlinie Protein                                      |
|Eisen        |Frauen menstruierend 16 mg/Tag, postmenopausal 14 mg, Männer 11 mg/Tag  (überarbeitet 03/2024); Schwangere 27 mg |mittlere reale Zufuhr Frauen ~9,6 mg (NVS II)              |
|Calcium      |1.000 mg/Tag (ab 19 J.)                                                                                          |Jugendliche 13–18 J.: 1.200 mg                             |
|Jod          |150 µg/Tag (Erwachsene; aktualisiert 2025)                                                                       |Höchstmenge gesamt 500 µg/Tag                              |
|Zink         |Männer 11/14/16 mg, Frauen 7/8/10 mg (je nach niedriger/mittlerer/hoher Phytatzufuhr)                            |vollwertige Ernährung = mittlere Stufe                     |
|Selen        |Männer 70 µg/Tag, Frauen 60 µg/Tag                                                                               |Schätzwert                                                 |
|Vitamin B12  |4,0 µg/Tag                                                                                                       |Schwangere 4,5; Stillende 5,5 µg                           |
|Vitamin D    |20 µg/Tag (= 800 IE, bei fehlender Eigensynthese)                                                                |nur Schätzwert bei fehlender Hautsynthese                  |
|Omega-3 (ALA)|0,5 % der Energiezufuhr (Richtwert)                                                                              |für EPA/DHA keine generelle Zufuhrempfehlung für Erwachsene|

### (b) Steckbriefe je Ernährungsform

#### Mischkost / omnivor

- **Definition:** Keine prinzipiellen Ausschlüsse; die DGE-Empfehlungen „Gut essen und trinken” (03/2024) gelten explizit für gesunde Erwachsene (18–65 J.), die sich mit Mischkost inkl. Fleisch und Fisch ernähren.
- **Verbreitung:** In Deutschland die Mehrheit; der BMEL-Report 2024 weist Flexitarier (41 %) getrennt aus, klassifiziert aber keine explizite „Allesesser”-Restkategorie – ein separater Mischköstler-Prozentwert wird nicht ausgewiesen.
- **Kritische/typische Punkte:** Neue DGE-Food-Based-Dietary-Guidelines 2024: „Wenn Sie Fleisch und Wurst essen, dann nicht mehr als 300 g pro Woche”, 1 Ei/Woche, 2 Portionen Milch(-produkte)/Tag, 5 Portionen Obst/Gemüse/Tag, 1–2 Portionen Fisch/Woche (1 Portion ≈ 120 g); > 75 % der Ernährung pflanzlich, < 25 % tierisch. Typische Defizite/Überschüsse: zu viel gesättigtes Fett und Fleisch, oft zu wenig Ballaststoffe; Jod und Vitamin D sind auch bei Mischkost in Deutschland kritisch (Jodmangelgebiet; ~60 % unzureichende Vitamin-D-Versorgung nach DGE).
- **Supplemente:** Grundsätzlich keine, außer Vitamin D im Winterhalbjahr (Okt.–April) bei fehlender Hautsynthese; Jod über Jodsalz.
- **Lebensmittelstrategie/Einkauf:** Jodsalz als Haushaltsstandard, fettreicher Seefisch 1×/Woche, reichlich Vollkorn/Hülsenfrüchte für Ballaststoffe, pflanzliche Öle.

#### Flexitarier

- **Definition:** „Flexible Vegetarier”; überwiegend pflanzlich mit bewusst reduziertem, qualitätsorientiertem Fleischkonsum. Keine festen Regeln zum Ausmaß.
- **Verbreitung:** Größte relevante Gruppe – 41 % laut BMEL-Ernährungsreport 2024 (2023: 46 %).
- **Kritische Nährstoffe:** In der Praxis kaum eigene Defizite, da tierische Quellen weiterhin vorkommen; Orientierung wie Mischkost (Jod, Vitamin D, Ballaststoffe).
- **Supplemente:** Wie Mischkost.
- **Strategie:** Ideale Zielgruppe für „Fleisch reduzieren”-Rezepte; Hülsenfrüchte/Tofu als Fleischersatz an fleischfreien Tagen.

#### Pescetarier

- **Definition:** Pflanzlich + Fisch/Meeresfrüchte + Milch + Ei, kein Fleisch von Landtieren.
- **Verbreitung:** Kleine Gruppe; MRI/nemo (2024/2025) beziffert sie mit rund 2 %.
- **Kritische Nährstoffe:** Weitgehend gut versorgt (Fisch liefert Jod, Selen, Vitamin D, EPA/DHA, hochwertiges Protein). Eisen-/Zinkzufuhr etwas beachten, da kein Fleisch.
- **Schadstoffe/Nachhaltigkeit:** Die BfR-Stellungnahme Nr. 17/2024 (28.05.2024, Basis BfR-MEAL-Studie) misst die höchsten Methylquecksilber-Gehalte in Thunfisch, Dornhai und Rotbarsch; behördlich wird zusätzlich vom Verzehr großer, alt werdender Raubfische wie Hai, Schwertfisch, Heilbutt und Aal abgeraten. Seelachs ist gering belastet, trägt aber wegen des hohen Verzehrs am meisten zur Bevölkerungs-Exposition bei. Der EFSA-Richtwert liegt bei 1,3 µg Methylquecksilber/kg Körpergewicht/Woche. Für Schwangere/Stillende gilt die Warnung verschärft (irreversible neurologische Schäden beim Fötus möglich). Nachhaltigkeit: überfischte Bestände – Siegel (MSC/ASC/Bio) und Alternativen aus Aquakultur (Karpfen, Wels, Tilapia in Kreislaufanlagen) bevorzugen.
- **Empfehlung:** DGE 1–2 Portionen/Woche, davon 70 g fettreicher Seefisch (Lachs, Makrele, Hering; 100 g Hering ≈ 3.000 mg EPA+DHA). Rund 250 mg EPA+DHA/Tag gelten als ausreichend.

#### Ovo-Lacto-Vegetarier (klassisch)

- **Definition:** Pflanzlich + Ei + Milch(-produkte) + Honig; kein Fleisch/Fisch.
- **Verbreitung:** Häufigster vegetarischer Typ; Gesamt-Vegetarier 8 % (BMEL 2024) bzw. ~4 % (MRI/nemo).
- **Kritische Nährstoffe (reduziert ggü. vegan):** Eisen und Zink (Bioverfügbarkeit), Jod (kein Seefisch), langkettige Omega-3 (EPA/DHA, außer über Ei), teils Vitamin D. B12 und Calcium sind über Milch/Ei meist gedeckt.
- **Supplemente:** In der Regel keine zwingenden; Jodsalz, ggf. Vitamin D im Winter.
- **Strategie:** Milchprodukte (Quark, Skyr) und Ei als hochwertige Protein-/B12-/Calciumquellen; Eisen wie bei vegan über Vitamin-C-Kombination optimieren.

#### Lacto-Vegetarier

- **Definition:** Pflanzlich + Milch(-produkte), kein Ei, kein Fleisch/Fisch.
- **Kritische Nährstoffe:** Wie ovo-lacto, zusätzlich Wegfall von Ei als Quelle für Protein und Omega-3; Milch deckt Calcium, B12 und Jod (Milch ist relevante Jodquelle) weiterhin ab.
- **Supplemente:** Meist keine zwingenden; Jodsalz, ggf. Vitamin D.

#### Ovo-Vegetarier

- **Definition:** Pflanzlich + Ei, keine Milch(-produkte), kein Fleisch/Fisch. Seltene Form.
- **Kritische Nährstoffe:** Calcium besonders beachten (Wegfall Milch als Hauptquelle → wie vegan über pflanzliche Quellen/angereicherte Drinks/calciumreiches Mineralwasser decken); B12 nur teilweise über Ei (nicht ausreichend planbar), daher B12 im Blick behalten; Jod (kein Seefisch, keine Milch).
- **Supplemente:** Calcium- und Jodversorgung prüfen, B12 ggf. kontrollieren.

#### Veganer

- **Definition:** Ausschließlich pflanzlich, keinerlei Tierprodukte inkl. Honig.
- **Verbreitung:** 2 % (BMEL 2024); MRI/nemo ~1 %.
- **Kritische Nährstoffe (DGE-Positionspapier, Ernährungs Umschau 7/2024, veröffentlicht 13.06.2024):** Vitamin B12 (kritischster Nährstoff) sowie potenziell kritisch: Jod, Protein/unentbehrliche Aminosäuren, langkettige Omega-3 (EPA/DHA), Vitamin D, Vitamin B2 (Riboflavin), Calcium, Eisen, Zink und Selen; neu wird auch Vitamin A als gegebenenfalls kritisch eingeschätzt.
- **Konsens-Supplemente:** B12 dauerhaft und zwingend als Präparat (Nährstoff nicht über Rezepte lösbar). Jod: jodiertes Speisesalz nutzen; wenn nicht genügend jodhaltige Lebensmittel, in ärztlicher Absprache täglich 100 µg Jod als Präparat. Vitamin D: bei fehlender Eigensynthese (Winter) Präparat in Höhe des Referenzwerts (20 µg). Omega-3: Mikroalgenöl (EPA/DHA) empfehlenswert.
- **Gesundheitliche Einordnung:** DGE 2024: tendenziell bessere kardiometabolische Werte (BMI, LDL, Cholesterin, Nüchternblutzucker), Hinweise auf Vorteile bei Gesamtsterblichkeit/Krebs; aber potenziell schlechtere Knochengesundheit und höheres Frakturrisiko. Academy of Nutrition and Dietetics (Melina/Craig/Levin 2016, J Acad Nutr Diet 116(12):1970–1980): gut geplante vegetarische/vegane Kost ist für alle Lebensphasen geeignet und gesundheitlich vorteilhaft – Veganer brauchen verlässliche B12-Quellen (angereicherte Lebensmittel/Supplemente).

### (c) Konkrete Lebensmittelstrategien für Rezepte (nährstoffspezifisch)

**Protein (pflanzlich, Gehalt pro 100 g Rohware):** Sojabohnen ~36 g; Süßlupine ~36 g; Seitan (Weizeneiweiß) ~25–28 g; Linsen (trocken) ~24 g; Kidneybohnen/Kichererbsen (trocken) ~21–24 g; Tempeh ~19 g; Tofu ~12–15 g; Haferflocken ~13 g. Soja und Sojaprodukte (Tofu, Tempeh) sowie Quinoa liefern alle unentbehrlichen Aminosäuren. **Kombinationsregel:** Getreide + Hülsenfrüchte ergänzen sich im Aminosäureprofil (z. B. Linsen + Reis, Hummus + Vollkornbrot, Bohnen + Mais). Bei Vegetariern zusätzlich Quark/Skyr/Ei als vollständige Proteinquellen. Der DGE-Proteinbedarf (0,8 g/kg) ist auch vegan/vegetarisch bei geeigneter Auswahl deckbar.

**Eisen (Nicht-Häm):** Quellen z. B. Linsen, Kichererbsen, Tofu, Kürbiskerne, Haferflocken (~4,5–5,4 mg/100 g), Vollkorn. Absorption Nicht-Häm-Eisen nur 2–20 % (vs. Häm 15–35 %). **Fördern:** Vitamin C (bereits 25–75 mg, z. B. Paprika, Zitrusfrüchte, Brokkoli) zur Mahlzeit → 3- bis 4-fache Aufnahme; organische Säuren, Beta-Carotin. Die DGE (FAQ Eisen) empfiehlt ausdrücklich Vitamin-C-reiche Lebensmittel zu eisenhaltigen Mahlzeiten. **Hemmen:** Phytate (Getreide/Hülsenfrüchte), Polyphenole/Tannine (Kaffee, schwarzer/grüner Tee), Calcium. **Rezept-Maßnahmen:** Einweichen, Keimen, Fermentieren senkt Phytatgehalt; Kaffee/Tee zeitlich ~1 h von eisenreichen Mahlzeiten trennen; Kräutertee statt Schwarztee zur Mahlzeit.

**Calcium:** Angereicherte Pflanzendrinks (auf Calciumzusatz achten), Calcium-Tofu (mit Calciumsulfat), oxalatarmes grünes Gemüse (Grünkohl, Pak Choi, Brokkoli – hohe Bioverfügbarkeit), Sesam/Tahin, Mandeln, Mohn; calciumreiches Mineralwasser (DGE: > 150 mg Ca/l; gut bioverfügbar). Spinat/Rhabarber trotz Gehalt wegen Oxalat wenig verwertbar. Aufnahme pro Mahlzeit auf ~500 mg begrenzt → über den Tag verteilen.

**Jod:** Jodiertes Speisesalz als Default; damit hergestellte Lebensmittel. Algen nur mit deklariertem Jodgehalt – BfR: Jodgehalt in getrockneten Algen schwankt extrem (5–11.000 mg/kg Trockengewicht), getrocknete Algenprodukte ≥ 20 mg/kg gelten als geeignet, die Gesundheit zu schädigen; Höchstmenge gesamt 500 µg/Tag, davon max. 200 µg aus Algen. Für Rezepte: Algen NICHT als planbare Jodquelle einsetzen.

**Zink:** Vollkorn, Hülsenfrüchte, Kürbis-/Sonnenblumenkerne, Nüsse; Bioverfügbarkeit sinkt mit Phytatgehalt → Einweichen/Keimen/Fermentieren (Sauerteig) verbessert Aufnahme. Referenzwert phytatabhängig (Frauen 7–10 mg, Männer 11–16 mg).

**Omega-3:** ALA aus Leinöl (~53 g/100 g), Leinsamen (geschrotet), Chiasamen, Walnüssen, Rapsöl. Umwandlung ALA → EPA gering (< 10 %), → DHA sehr gering (< 1 %). Für verlässliche EPA/DHA-Versorgung bei Veganern/Vegetariern Mikroalgenöl (direkt EPA/DHA, schadstoffarm). Rezept-Hinweis: Leinöl nicht erhitzen; Leinsamen geschrotet verwenden.

**Vitamin B12:** Nur über Supplement oder angereicherte Produkte. **Klarstellung:** Fermentierte Lebensmittel (Sauerkraut), Spirulina, Chlorella, Afa und Nori sind KEINE verlässlichen Quellen – sie enthalten meist inaktive Analoga, die echtes B12 sogar blockieren können. Über Rezepte NICHT lösbar.

### (d) Belegte Einkaufsempfehlungen je Form (Auszug)

- **Veganer:** mit Calcium (und idealerweise Jod) angereicherte Pflanzendrinks, Calcium-Tofu/Tempeh, Hülsenfrüchte, Vollkorn, Nüsse/Samen (Sesam/Tahin, Kürbiskerne, Leinsamen), Mikroalgenöl (EPA/DHA), jodiertes Speisesalz, calciumreiches Mineralwasser, B12-Präparat, ggf. Vitamin D (Winter) und Jodpräparat (ärztliche Absprache). Begründung: deckt B12 (Präparat), Jod, Calcium, Eisen/Zink (Hülsenfrüchte/Vollkorn), EPA/DHA (Algenöl) – exakt die von der DGE 2024 benannten kritischen Nährstoffe.
- **Vegetarier (ovo-lacto):** zusätzlich Milchprodukte (Quark, Skyr, Käse) und Eier als Protein-/B12-/Calciumquelle; Jodsalz; Eisen weiter über pflanzliche Quellen + Vitamin C.
- **Pescetarier:** fettreicher Seefisch 1×/Woche (Lachs, Makrele, Hering), fettarmer Seefisch (Kabeljau, Seelachs) 1×/Woche; große Raubfische (Thunfisch, Hai, Schwertfisch, Heilbutt, Rotbarsch, Aal) meiden bzw. selten; Fisch mit Nachhaltigkeitssiegel.
- **Mischkost/Flexitarier:** Jodsalz, Fisch, reichlich Gemüse/Vollkorn/Hülsenfrüchte; Fleisch/Wurst max. 300 g/Woche.

### (e) Ernährungsstile als Filter-Kandidaten (kompakte Evidenz-Einordnung)

|Stil           |Kurzdefinition                                                                          |Wissenschaftliche Einordnung                                                                                                                                     |Als Rezeptfilter sinnvoll?                       |
|---------------|----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------|
|Mediterran     |viel Gemüse, Olivenöl, Vollkorn, Hülsenfrüchte, Fisch, wenig rotes Fleisch              |gut belegte Vorteile für Herz-Kreislauf; kompatibel mit DGE-Prinzipien                                                                                           |Ja – gut umsetzbar, unkritisch                   |
|High-Protein   |erhöhter Proteinanteil                                                                  |DGE-Leitlinie Protein: für Gesunde ist eine Zufuhr > 0,8 g/kg unkritisch für die Nieren; sinnvoll v. a. bei Sport/Alter                                          |Ja – als Makro-Präferenz                         |
|Low-Carb       |reduzierte Kohlenhydrate (ohne Ketose)                                                  |kann kurzfristig beim Gewicht helfen; DGE priorisiert Qualität der KH statt pauschaler Reduktion                                                                 |Ja – als Präferenz, mit Hinweis auf Ballaststoffe|
|Keto           |5–10 % KH, 70–75 % Fett, Ketose                                                         |therapeutisch etabliert (z. B. Epilepsie); als Alltagskost restriktiv, Langzeitevidenz begrenzt; DGEM/PRIO-Stellungnahme 2022: onkologische Datenlage uneindeutig|Nur mit Vorsicht/Hinweis                         |
|Paleo          |„steinzeitlich”: Fleisch, Fisch, Obst, Gemüse, Nüsse; keine Getreide/Hülsenfrüchte/Milch|DGE bewertet kritisch; Ausschluss ganzer Lebensmittelgruppen (Vollkorn, Hülsenfrüchte) widerspricht Empfehlungen                                                 |Eingeschränkt                                    |
|Intervallfasten|zeitlich begrenzte Nahrungsaufnahme                                                     |DGE: kann zur Gewichtsregulation beitragen, keine Überlegenheit ggü. anderer Kalorienreduktion belegt; betrifft Timing, nicht Rezepte                            |Kaum – eher App-Timing als Rezeptfilter          |
|Clean Eating   |möglichst unverarbeitete Lebensmittel                                                   |kein einheitlicher wissenschaftlicher Standard, Marketing-Begriff                                                                                                |Nur als weiche Präferenz                         |

Fazit für die App: Mediterran, High-Protein und Low-Carb sind die belastbarsten Filter-Kandidaten; Keto/Paleo nur mit Warnhinweis; Intervallfasten/Clean Eating gehören eher nicht in die Rezeptlogik.

### Übersetzung in App-Presets und AI-Rezeptregeln

**Vegan – Rezeptregeln:**

1. Keine Tierprodukte (harte Regel inkl. Honig).
1. Jede Hauptmahlzeit mit definiertem Proteinziel (Hülsenfrüchte/Tofu/Tempeh/Seitan) und Getreide-Hülsenfrucht-Kombination.
1. Eisenreiche Gerichte immer mit Vitamin-C-Komponente (Paprika, Zitrone, Brokkoli); Kaffee/schwarzen Tee nicht als Mahlzeitgetränk vorschlagen.
1. Jodiertes Speisesalz als Default; Algen nicht als Jod-/B12-Quelle einsetzen.
1. Leinöl/Walnüsse für ALA einbauen; Mikroalgenöl empfehlen (Einkaufshinweis).
1. **App-Hinweis statt Rezeptregel:** B12 zwingend supplementieren – nicht über Rezepte lösbar.

**Vegetarisch (ovo-lacto/lacto/ovo):** wie vegan bzgl. Eisen/Vitamin C und Getreide+Hülsenfrucht; Milch/Ei als Protein-, B12- und Calciumquelle nutzen; bei ovo-vegetarisch Calcium über pflanzliche Quellen/Mineralwasser absichern.

**Pescetarier:** Fisch 1–2×/Woche einplanen, davon 1× fettreicher Seefisch; große Raubfische (Thunfisch etc.) meiden bzw. auf seltene Frequenz limitieren; Nachhaltigkeits-/Siegelhinweis.

**Mischkost/Flexitarier:** Fleisch/Wurst max. 300 g/Woche, 1 Ei/Woche, > 75 % pflanzlich; Jodsalz-Default; Ballaststoffe über Vollkorn/Hülsenfrüchte.

**Wo die App nur hinweisen, nicht empfehlen sollte (Haftung/Seriosität):**

- **Supplemente** (B12, Jod, Vitamin D, Algenöl): als neutraler Hinweis mit Verweis auf ärztliche/qualifizierte Beratung, keine Dosierungs-„Verordnung”.
- **Schwangerschaft/Stillzeit, Säuglinge, Kinder/Jugendliche, Senioren:** als Sonderfälle kennzeichnen; für vegane Ernährung in diesen Gruppen gibt die DGE weder Empfehlung dafür noch dagegen und verlangt fundierte Kenntnisse/ärztliche Begleitung. App: klarer Verweis auf ärztliche Beratung, keine eigenständige Empfehlung.
- Fisch-/Quecksilber-Warnung für Schwangere/Stillende als Hinweis integrieren.

## Recommendations

1. **Datenmodell mit drei getrennten Achsen umsetzen** (Ernährungsform / Ausschlüsse / Stil-Präferenz). Sofort-Schritt: die sieben Kern-Presets + „plant-based” anlegen; Allergien, halal/koscher und Diätstile als separate Filter. Benchmark zum Umsteuern: Wenn Nutzertests widersprüchliche Kombinationen erzeugen (z. B. „vegan + Fischregel”), Achsentrennung nachschärfen.
1. **B12 und Jod als App-Level-Hinweise (nicht Rezeptregeln) implementieren** – für vegane und teils vegetarische Profile. Diese sind ernährungsphysiologisch nicht über Rezepte lösbar. Verweis auf ärztliche Beratung.
1. **Eisen-Vitamin-C-Kopplung und Getreide-Hülsenfrucht-Kombination als harte AI-Regeln** für vegan/vegetarisch codieren; Kaffee/Tee aus Mahlzeitvorschlägen bei eisenkritischen Profilen ausschließen. Einweichen/Keimen/Fermentieren als Zubereitungshinweise ausgeben.
1. **Fisch-Logik für Pescetarier** mit BfR-Positivliste (Lachs, Makrele, Hering, Kabeljau, Seelachs) und Negativliste (Thunfisch, Dornhai/Hai, Schwertfisch, Heilbutt, Rotbarsch, Aal) hinterlegen; Schwangerschafts-Sonderhinweis.
1. **Mischkost an DGE-2024-FBDG ausrichten** (300 g Fleisch/Woche, > 75 % pflanzlich) – als Default-Portionslogik im Rezeptgenerator.
1. **Ernährungsstile als optionale Filter** einführen, priorisiert mediterran/High-Protein/Low-Carb; Keto/Paleo nur mit Evidenz-Warnhinweis; Intervallfasten als Timing-Feature statt Rezeptfilter.
1. **Sonderfälle (Schwangerschaft/Stillzeit/Kinder/Senioren)** als „nur Hinweis”-Zone mit ärztlichem Verweis; keine automatisierten Nährstoff-Empfehlungen.

## Caveats

- **Prevalenzzahlen schwanken methodenabhängig stark:** BMEL/forsa (Selbstauskunft, ~1.000 Befragte, Mai 2024) liefert 41/8/2 %, MRI/nemo (3.155 Befragte, Sept.–Nov. 2024) eher ~1 % vegan / ~2 % pescetarisch / ~4 % vegetarisch, Allensbach nochmals andere Werte. Für die App als Größenordnung, nicht als exakte Marktzahl verwenden.
- **Referenzwerte sind teils in Aktualisierung:** Jod wurde 2025 auf 150 µg/Tag angepasst; Eisen/Phosphor/Fluorid 03/2024;  ältere Quellen nennen abweichende Werte. Im Zweifel das dge.de-Referenzwerte-Tool als Single Source of Truth nutzen.
- **Nährstoffgehalte pro 100 g variieren** je nach Sorte/Zubereitung/Nährwerttabelle (roh vs. gekocht); die genannten Werte sind Orientierungswerte.
- **Die DGE-Bewertung der veganen Ernährung als gesundheitsfördernd gilt ausdrücklich nur für gesunde Erwachsene** und ist an Supplementierung/Planung gebunden; für vulnerable Gruppen bleibt die Datenlage begrenzt.
- Die App ersetzt keine individuelle Ernährungs-/ärztliche Beratung; alle Supplement- und Sonderfall-Aussagen sind Hinweise, keine medizinischen Empfehlungen.

## Quellenverzeichnis (Direktlinks)

- DGE-Positionspapier vegane Ernährung, Neubewertung 2024 (Übersicht): <https://www.dge.de/wissenschaft/stellungnahmen-und-positionspapiere/positionen/neubewertung-der-position-zu-veganer-ernaehrung/>
- DGE-Pressemeldung „Neues Positionspapier zu veganer Ernährung” (13.06.2024): <https://www.dge.de/presse/meldungen/2024/positionspapier-zu-veganer-ernaehrung/>
- DGE-Positionspapier Langversion (Ernährungs Umschau 7/2024, PDF): <https://ernaehrungs-umschau.de/fileadmin/Ernaehrungs-Umschau/pdfs/pdf_2024/07_24/DGE_Position_Vegan_2024_Langversion.pdf>
- DGE FAQ vegane Ernährung / B12 (Protein und B12): <https://www.dge.de/presse/meldungen/pressearchiv/woher-bekommen-veganer-protein-und-vitamin-b12/>
- DGE-Empfehlungen „Gut essen und trinken” (FBDG 2024): <https://www.dge.de/presse/meldungen/2024/gut-essen-und-trinken-dge-stellt-neue-lebensmittelbezogene-ernaehrungsempfehlungen-fuer-deutschland-vor/>
- DGE FAQ lebensmittelbezogene Ernährungsempfehlungen: <https://www.dge.de/gesunde-ernaehrung/faq/lebensmittelbezogene-ernaehrungsempfehlungen-dge/>
- DGE „Fisch jede Woche”: <https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-empfehlungen/fisch/>
- DGE Referenzwerte (Übersicht): <https://www.dge.de/wissenschaft/referenzwerte/>
- DGE FAQ Eisen: <https://www.dge.de/gesunde-ernaehrung/faq/eisen/>
- DGE-Pressemeldung überarbeitete Referenzwerte Eisen/Phosphor/Fluorid (03/2024): <https://www.dge.de/presse/meldungen/2024/dge-veroeffentlicht-ueberarbeitete-referenzwerte-fuer-eisen-phosphor-und-fluorid/>
- DGE FAQ Jod: <https://www.dge.de/gesunde-ernaehrung/faq/jod/>
- DGE FAQ Zink: <https://www.dge.de/gesunde-ernaehrung/faq/ausgewaehlte-fragen-und-antworten-zu-zink/>
- DGE Referenzwert Vitamin D / FAQ: <https://www.dge.de/wissenschaft/referenzwerte/vitamin-d/> und <https://www.dge.de/gesunde-ernaehrung/faq/vitamin-d/>
- DGE-Leitlinie Protein: <https://www.dge.de/wissenschaft/dge-leitlinien/leitlinie-protein/>
- DGE „Flexitarier – die flexiblen Vegetarier”: <https://www.dge.de/wissenschaft/fachinformationen/flexitarier-die-flexiblen-vegetarier/>
- BfR FAQ Methylquecksilber in Fisch (Schwangere/Stillende): <https://www.bfr.bund.de/assets/01_Ver%C3%B6ffentlichungen/FAQ_deutsch/methylquecksilber-warum-schwangere-und-stillende-manche-arten-von-fisch-meiden-sollten.pdf>
- BfR-Stellungnahme Gesundheitliche Risiken durch zu hohen Jodgehalt in getrockneten Algen (PDF): <https://www.bfr.bund.de/cm/343/gesundheitliche_risiken_durch_zu_hohen_jodgehalt_in_getrockneten_algen.pdf>
- Amtliche Lebensmittelüberwachung UA-BW zu B12 in Spirulina/Chlorella/Afa: <https://www.ua-bw.de/pub/beitrag.asp?subid=0&Thema_ID=2&ID=3102>
- Verbraucherzentrale: vegane Ernährung – sinnvolle Nahrungsergänzung (B12/Jod): <https://www.verbraucherzentrale.de/wissen/lebensmittel/nahrungsergaenzungsmittel/vegane-ernaehrung-welche-nahrungsergaenzung-ist-sinnvoll-13323>
- Academy of Nutrition and Dietetics, Position Vegetarian Diets (2016), J Acad Nutr Diet: <https://www.jandonline.org/article/S2212-2672(16)31192-3/abstract>
- DGEM/PRIO-Stellungnahme ketogene/kohlenhydratarme Diäten (Ernährungs Umschau 7/2022, PDF): <https://ernaehrungs-umschau.de/fileadmin/Ernaehrungs-Umschau/pdfs/pdf_2022/07_22/EU07_2022_M368_M373_de.pdf>
- Statistisches Bundesamt (Destatis), Fleischersatz-/Verzehrszahlen 2024: <https://www.destatis.de/DE/Presse/Pressemitteilungen/Zahl-der-Woche/2025/PD25_21_p002.html>
- BMEL-Ernährungsreport 2024 (forsa; 41 % flexitarisch, 8 % vegetarisch, 2 % vegan)
- Max-Rubner-Institut, nationales Ernährungsmonitoring (nemo), Erhebung Sept.–Nov. 2024 (~1 % vegan, ~2 % pescetarisch, ~4 % vegetarisch)
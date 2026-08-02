# Icon-Brief: Produkt-Icons für den Vorrat

Stand: 02.08.2026 · Auftraggeber: Max Kruggel · Umsetzung: Claude Code

Das **UI-Icon-Set** aus der Claude-Design-Übergabe ist gebaut und liegt in
`js/icons.js` (Tabbar, Aktionen, Inhalt, Marke). Offen ist der zweite Teil aus
Doku Kap. 8: **Produkt-Icons je Zutat** für die Vorrats- und Rezeptlisten –
laut Doku „eigene, stilistisch coole Produkt-Icons […] statt Produktfotos".

Dieses Dokument ist die Arbeitsliste dafür: **87 Icons für alle 92 Zutaten**
der Kern-DB. Die Zuordnung unten ist vollständig und überschneidungsfrei
geprüft; jede Zutat bekommt ihr eigenes Motiv, bis auf 5 bewusste
Zusammenlegungen (Abschnitt 5).

---

## 1. Stilvorgaben (hart – bestehendes Set fortschreiben)

Die Produkt-Icons müssen neben den UI-Icons bestehen können, gleiche Bauart:

- **Raster:** `viewBox="0 0 24 24"`, optisch zentriert, ~2 px Luft zum Rand.
- **Strich:** `stroke-width="1.6"`, `stroke-linecap="round"`,
  `stroke-linejoin="round"`. Konturen laufen über `stroke="currentColor"`,
  nie über eine feste Farbe.
- **Duotone:** genau **eine** tragende Fläche je Icon, ausgezeichnet mit
  `class="duo"`. Die Füllung kommt aus CSS (`--duo`), damit sie im Kontext
  umschaltet (Karte, Akzentfläche, Dark Mode). Keine `fill`-Attribute im SVG.
- **Weitere Klassen**, falls gebraucht: `.ink` (Fläche in currentColor),
  `.ring` (gedämpfte Kontur), `.on` (Kontrastfarbe auf gefüllter Form).
- **Keine** Verläufe, Schatten, Transparenzen, Texte oder `<image>`.
- **Erkennbar bei 24 px.** Im Zweifel weniger Details: die Icons laufen in der
  Vorratsliste in Zeilenhöhe, nicht als Illustration.

Referenz zum Abgucken: `js/icons.js`, z. B. `vorrat` (Vorratsglas) und
`tipp` (Glühbirne) – beide zeigen Kontur + genau eine `.duo`-Fläche.

## 2. Zeichenprinzipien (weich – sie halten das Set zusammen)

1. **Motiv ist das Lebensmittel, nicht die Verpackung.** Dose, Glas und
   Packung sind schon über die Mengen-UI abgebildet (Zähler,
   Silhouetten-Regler, Vorrätig/Leer). Ausnahme sind Produkte, die *durch*
   ihr Gefäß definiert sind – Pasten, Öle, Gewürzgläser: da ist das Gefäß
   das Erkennungsmerkmal.
2. **Silhouette zuerst.** Ein Icon muss als ausgefüllte Fläche allein noch
   lesbar sein. Binnendetails (Rillen, Adern, Punkte) kommen danach und nur,
   solange sie bei 24 px nicht zulaufen.
3. **Gefäß + Erkennungsmarke.** Wo mehrere Zutaten sich eine Gefäßform teilen
   (Pasten, Öle, Gewürzgläser), bleibt das Gefäß gleich und eine kleine Marke
   davor macht den Unterschied: Olive an der Ölflasche, Chilischote am
   Currypasten-Glas, halbe Paprika am Paprikapulver-Glas.
4. **Paare nie gleich bauen.** Wo zwei Zutaten nebeneinander im Vorrat stehen
   können (`zwiebel`/`fruehlingszwiebel`, `nudeln`/`reisnudeln`,
   `kidneybohnen`/`bohnen_schwarz`, `gemuesebruehe`/`huehnerbruehe`),
   muss der Unterschied in der **Silhouette** liegen, nicht nur im Detail.
5. **Eine Blickrichtung pro Gruppe.** Gemüse und Obst in Seitenansicht,
   Gefäße frontal, Schnittflächen nur da, wo sie das Motiv tragen
   (`zitrusfrucht`, `tomaten_gehackt`, `hartkaese`).

## 3. Technische Einbindung

- Neue Datei **`js/icons-produkte.js`**, gleiche Struktur wie `js/icons.js`:
  ein `PFADE`-Objekt plus `export function produktIcon(name, size = 24)`.
  `js/icons.js` bleibt unangetastet – UI und Produkt sind zwei Sets.
- Dazu die Zuordnung **`zutat_id → Icon-Name`** aus Abschnitt 6 als
  `ZUTAT_ICON`-Map exportieren, mit Fallback auf ein neutrales
  `platzhalter`-Icon, wenn eine Zutat (z. B. aus einem AI-Rezept) nicht in
  der Map steht.
- Einbauorte: Bestandszeile (`vorratZeile()` in `js/app.js`), Erfassen-Chips,
  Zutaten-Checkliste im Rezept-Detail, Einkaufslisten-Zeilen.
- `sw.js`: neue Datei in den Shell-Cache aufnehmen und `CACHE` hochzählen.
- Kein Sprite, kein Build-Step – Inline-SVG als String, wie das bestehende Set.

## 4. Vorschlag zum Vorgehen

87 Icons sind zu viel für einen Rutsch. Sinnvolle Reihenfolge, je Gruppe ein
Durchgang – nach jedem Durchgang eine Kontaktbogen-Seite rendern und
gegenprüfen, ob die Gruppe in sich stimmig ist und zu den schon gebauten passt:

1. **Getreide & Beilagen** (9)
2. **Hülsenfrüchte** (6)
3. **Gemüse** (17)
4. **Obst** (6)
5. **Kühlregal & Protein** (12)
6. **Öl, Essig & Flüssiges** (6)
7. **Pasten & Muse** (7)
8. **Brühe, Süßes & Backen** (6)
9. **Nüsse & Kokos** (4)
10. **Gewürze – getrocknet & gemahlen** (10)
11. **Frische Kräuter** (4)

Zuerst die Gruppen mit den klarsten Silhouetten (Gemüse, Obst), zuletzt die,
die vom System „Gefäß + Marke" leben (Pasten, Gewürze) – dann steht das
Vokabular schon, an dem sie sich ausrichten.

## 5. Die 5 Zusammenlegungen

Alles andere ist 1:1. Diese fünf teilen sich ein Icon, jeweils mit Grund –
wer eine davon anders will, entscheidet das vor dem Zeichnen:

| Icon | Zutaten | Warum zusammen |
|---|---|---|
| `reis` | Weißer Reis (Langkorn) + Basmatireis | Basmati **ist** ein weißer Langkornreis – in einer Strichzeichnung dieselbe Form. Vollkornreis hat ein eigenes Icon. |
| `mehl` | Weizenmehl Type 405 + Weizenmehl Type 1050 | Type 405 und 1050 unterscheiden sich nur im Ausmahlungsgrad, also in der Farbe. Duotone hat pro Icon genau eine Fläche – der Unterschied wäre nicht darstellbar. |
| `kichererbsen` | Kichererbsen getrocknet + Kichererbsen (Dose) | Gleiche Frucht, einmal getrocknet und einmal in der Dose. Die Verpackung zeigt schon die Mengen-UI. |
| `tomaten_gehackt` | Tomaten (Dose, stückig) + Passierte Tomaten | Stückige Dosentomaten und Passata sind derselbe Verarbeitungsgrad; getrennt wären es zwei identische Schnittansichten. |
| `zitrusfrucht` | Zitronen + Limetten | Zitrone und Limette haben in Kontur dieselbe Silhouette. Unterscheidbar nur über Farbe oder Größe – beides trägt bei 24 px nicht. |

---

## 6. Die 87 Icons

### Getreide & Beilagen (9)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 1 | `reis` | Flache Schale in Kontur, darin ein gehäufter Kornberg als `.duo`-Fläche; zwei, drei einzelne Körner als Kontur darüber. | Weißer Reis (Langkorn) `ing_reis_weiss`<br>Basmatireis `ing_reis_basmati` |
| 2 | `reis_vollkorn` | Gleiche Schale, aber der Kornberg ist von einzelnen Kornkonturen durchbrochen und jedes Korn trägt einen Spelzstrich – liest neben `reis` sichtbar rauer. | Vollkornreis/Naturreis `ing_reis_vollkorn` |
| 3 | `nudeln` | Bund aus vier langen Spaghetti, oben leicht gefächert, unten von einer Banderole (`.duo`) zusammengehalten. | Nudeln (Hartweizen) `ing_nudeln` |
| 4 | `reisnudeln` | Flaches Nudelnest: gewellte, breite Bänder in Kontur über einer ovalen `.duo`-Grundfläche – bewusst breiter und welliger als `nudeln`. | Reisnudeln `ing_reisnudeln` |
| 5 | `haferflocken` | Schale in Kontur, randvoll gefüllt (`.duo`), drei Flockenovale als Kontur obenauf. | Haferflocken `ing_haferflocken` |
| 6 | `mehl` | Papiertüte mit umgeschlagener Oberkante (Tütenkörper `.duo`), davor ein kleiner Mehlhaufen mit zwei Staubpunkten. | Weizenmehl Type 405 `ing_mehl_405`<br>Weizenmehl Type 1050 `ing_mehl_1050` |
| 7 | `brot` | Baguette in Schrägansicht mit drei diagonalen Einschnitten; Krume `.duo`, Kruste Kontur. | Brot/Baguette `ing_brot` |
| 8 | `tortilla` | Zwei versetzt gestapelte Kreise, der obere leicht angehoben; der untere ist `.duo`. | Tortillas/Wraps `ing_tortillas` |
| 9 | `popcornmais` | Ein aufgeplatztes Popcorn (wolkige Kontur, Kern `.duo`) mit zwei ungepoppten Körnern daneben. | Popcorn-Mais `ing_popcornmais` |

### Hülsenfrüchte (6)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 10 | `linsen` | Drei überlappende flache Scheiben von der Seite, die mittlere `.duo` – die einzige flach-runde Form im Set. | Rote Linsen `ing_linsen_rot` |
| 11 | `kichererbsen` | Drei runde Erbsen mit dem typischen Spitzchen oben, die vordere `.duo`. | Kichererbsen getrocknet `ing_kichererbsen_trocken`<br>Kichererbsen (Dose) `ing_kichererbsen_dose` |
| 12 | `kidneybohnen` | Zwei nierenförmig gebogene Bohnen, übereinandergelegt; die untere `.duo`. | Kidneybohnen (Dose) `ing_kidneybohnen_dose` |
| 13 | `bohnen_schwarz` | Drei kleine, gleichmäßige Ovale im Dreieck; das mittlere `.duo` – kompakter und runder als `kidneybohnen`. | Schwarze Bohnen (Dose) `ing_bohnen_schwarz_dose` |
| 14 | `mais` | Kolben mit angedeuteten Kornreihen, ein Hüllblatt seitlich abgeklappt (`.duo`). | Mais (Dose) `ing_mais_dose` |
| 15 | `erbsen` | Geöffnete Schote in Kontur mit drei Kugeln darin; die Schote ist `.duo`. | Erbsen (TK) `ing_erbsen_tk` |

### Gemüse (17)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 16 | `kartoffel` | Unregelmäßiges Oval (`.duo`) mit zwei, drei Augen als Kontur-Punkten. | Kartoffeln `ing_kartoffel` |
| 17 | `zwiebel` | Bauchige Zwiebel mit zwei senkrechten Schalenlinien und kurzem Trieb oben; Körper `.duo`. | Zwiebeln `ing_zwiebel` |
| 18 | `fruehlingszwiebel` | Zwei lange, schmale Halme mit weißem Zwiebelfuß unten; nur der Fuß ist `.duo`. | Frühlingszwiebeln `ing_fruehlingszwiebel` |
| 19 | `knoblauch` | Knolle von vorn mit angedeuteten Zehen-Trennlinien und Stielspitze; Knolle `.duo`. | Knoblauch `ing_knoblauch` |
| 20 | `brokkoli` | Wolkiger Röschenkopf (`.duo`) auf kurzem Strunk mit zwei Blattansätzen. | Brokkoli `ing_broccoli` |
| 21 | `moehre` | Schräg liegende Möhre mit zwei Querrillen, oben drei Grünblätter; Wurzel `.duo`. | Möhren/Karotten `ing_moehre` |
| 22 | `paprika` | Bauchige Frucht mit zwei Wölbungen unten und gekrümmtem Stiel; Körper `.duo`. | Paprika `ing_paprika` |
| 23 | `zucchini` | Längliches, leicht gebogenes Gemüse mit kurzem Stiel; Körper `.duo`, ein Glanzstrich als Kontur. | Zucchini `ing_zucchini` |
| 24 | `aubergine` | Bauchiger Körper mit ausladendem Kelch obenauf; Körper `.duo`, Kelch nur Kontur. | Aubergine `ing_aubergine` |
| 25 | `lauch` | Senkrechte Stange: unten Schaft mit Wurzelfransen, oben zwei auseinanderlaufende Blätter; Schaft `.duo`. | Lauch `ing_lauch` |
| 26 | `gurke` | Langgestreckte, leicht gebogene Gurke mit Punktnoppen; Körper `.duo`. | Gurke `ing_gurke` |
| 27 | `tomate` | Runde Frucht mit fünfzackigem Kelch und kurzem Stiel; Frucht `.duo`. | Tomaten (frisch) `ing_tomate_frisch` |
| 28 | `tomaten_gehackt` | Halbierte Tomate von der Schnittfläche her, Kammern als Konturlinien; Schnittfläche `.duo` – die Schnittansicht setzt sie neben die ganze `tomate`. | Tomaten (Dose, stückig) `ing_tomate_dose`<br>Passierte Tomaten `ing_passierte_tomaten` |
| 29 | `salat` | Kopf aus drei gewellten, übereinanderliegenden Blättern; das hinterste `.duo`. | Römersalat `ing_roemersalat` |
| 30 | `spinat` | Zwei gestielte, herzförmige Blätter mit Mittelrippe; das größere `.duo`. | Blattspinat (frisch/TK) `ing_spinat` |
| 31 | `ingwer` | Knollige, verzweigte Wurzel mit zwei Abgängen; Hauptknolle `.duo`. | Ingwer `ing_ingwer` |
| 32 | `olive` | Zwei Oliven, eine mit Blatt am Stiel; die vordere `.duo` mit ausgestochenem Kern als Kreisloch. | Oliven `ing_oliven` |

### Obst (6)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 33 | `zitrusfrucht` | Halbierte Frucht von vorn: Kreis mit sechs Segmentlinien und Randschale; Fruchtfleisch `.duo`. | Zitronen `ing_zitrone`<br>Limetten `ing_limette` |
| 34 | `apfel` | Klassische Apfelsilhouette mit Kerbe oben, Stiel und einem Blatt; Frucht `.duo`. | Äpfel `ing_apfel` |
| 35 | `apfelmus` | Bauchiges Schraubglas mit Deckelrand, Füllstand bis zwei Drittel (`.duo`), auf dem Deckel ein kleiner Apfelstiel. | Apfelmus (Glas) `ing_apfelmus` |
| 36 | `banane` | Einzelne gebogene Banane mit abgesetztem Stielende; Frucht `.duo`. | Bananen `ing_banane` |
| 37 | `beeren` | Drei Beeren im Dreieck, eine mit Kelchblättchen; die vordere `.duo`. | Beeren (TK) `ing_beeren_tk` |
| 38 | `dattel` | Zwei längliche, leicht gerunzelte Früchte, überlappend; die vordere `.duo`. | Datteln (entsteint) `ing_datteln` |

### Kühlregal & Protein (12)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 39 | `ei` | Ei in Seitenansicht, daneben eine aufgeschlagene Hälfte mit Dotter; Dotter `.duo`. | Eier (Größe M) `ing_ei` |
| 40 | `butter` | Angeschnittener Block mit seitlich abgezogenem Papier; Butterkörper `.duo`. | Butter `ing_butter` |
| 41 | `milch` | Giebelkarton mit Faltkante und Ausgießlasche; Körper `.duo`. | Milch `ing_milch` |
| 42 | `sahne` | Kleiner Becher mit ausgestelltem Rand und aufgesetzter Sahnetupfe; Becher `.duo`. | Sahne `ing_sahne` |
| 43 | `joghurt` | Runder Becher mit halb abgezogener Deckelfolie, davor ein Löffel; Becher `.duo`. | Naturjoghurt `ing_joghurt_natur` |
| 44 | `hartkaese` | Keilstück mit Rinde und drei kleinen Löchern; Schnittfläche `.duo`. | Parmesan/Hartkäse `ing_parmesan` |
| 45 | `feta` | Würfelblock in leichter Aufsicht mit abgebröckelter Kante; Oberseite `.duo`. | Feta `ing_feta` |
| 46 | `mozzarella` | Kugel in flacher Schale mit Flüssigkeitslinie; Kugel `.duo`. | Mozzarella `ing_mozzarella` |
| 47 | `tofu` | Quader in Aufsicht mit Schnittkante und feinem Rasterpunkt; Oberseite `.duo`. | Tofu natur `ing_tofu_natur` |
| 48 | `gefluegel` | Filetstück in Tropfenform mit einer Faserlinie; Fleisch `.duo`. | Hähnchenbrustfilet `ing_haehnchenbrust` |
| 49 | `hackfleisch` | Häufchen aus drei gewundenen Hacksträngen; der mittlere `.duo`. | Rinderhackfleisch `ing_hackfleisch_rind` |
| 50 | `fisch` | Filet im Schrägschnitt mit drei Muskelbögen und Hautstreifen; Filet `.duo`, Haut Kontur. | Lachsfilet `ing_lachs` |

### Öl, Essig & Flüssiges (6)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 51 | `olivenoel` | Schlanke Flasche mit langem Hals und Ausgießer, auf dem Etikettenfeld eine Olive; Inhalt `.duo`. | Olivenöl `ing_olivenoel` |
| 52 | `rapsoel` | Gleiche Flaschenform, Etikettenfeld leer, dafür ein Tropfen am Ausgießer; Inhalt `.duo`. | Rapsöl/neutrales Öl `ing_rapsoel` |
| 53 | `sesamoel` | Kleinere, gedrungenere Flasche, drei Sesamkörner neben dem Hals; Inhalt `.duo`. | Sesamöl `ing_sesamoel` |
| 54 | `kokosoel` | Weithalsglas mit Schraubdeckel statt Flasche, Inhalt fest bis zum Rand (`.duo`), kleine Kokoshalbschale auf dem Deckel. | Kokosöl `ing_kokosoel` |
| 55 | `essig` | Schlanke Flasche mit Bügelverschluss, zwei Blasenpunkte im Inhalt; Inhalt `.duo`. | Essig `ing_essig` |
| 56 | `sojasauce` | Kleine Tischflasche mit weit ausgestelltem Boden und kurzem Hals; Inhalt `.duo`. | Sojasauce `ing_sojasauce` |

### Pasten & Muse (7)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 57 | `tomatenmark` | Zusammengedrückte Tube mit gefaltetem Ende und Schraubkappe, ein Klecks tritt aus (`.duo`). | Tomatenmark `ing_tomatenmark` |
| 58 | `misopaste` | Kleine Schale mit gehäufter Paste (`.duo`), darin ein Holzlöffel schräg steckend. | Misopaste `ing_misopaste` |
| 59 | `currypaste` | Niedriges Schraubglas, Füllstand halbhoch (`.duo`), davor eine kleine Chilischote als Kontur. | Currypaste `ing_currypaste` |
| 60 | `gochujang` | Rechteckiger Becher mit Foliendeckel und gewölbtem Rand; Inhalt `.duo`, Deckel Kontur. | Gochujang `ing_gochujang` |
| 61 | `tahin` | Hohes Glas mit dünnem Faden, der sich obenauf zu einer Spirale legt; Inhalt `.duo`. | Tahin (Sesammus) `ing_tahin` |
| 62 | `erdnussmus` | Bauchiges Glas mit breitem Deckel, ein Messer steckt schräg darin; Inhalt `.duo`. | Erdnussmus/-butter `ing_erdnussmus` |
| 63 | `senf` | Gedrungene Quetschflasche mit Spitzverschluss und einem Klecks daneben; Inhalt `.duo`. | Senf `ing_senf` |

### Brühe, Süßes & Backen (6)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 64 | `gemuesebruehe` | Würfel in Schrägansicht mit Prägerille, darauf ein kleines Blatt; Oberseite `.duo`. | Gemüsebrühe (Pulver/Fond) `ing_gemuesebruehe` |
| 65 | `huehnerbruehe` | Gleicher Würfel, statt des Blatts eine Federkontur obenauf; Oberseite `.duo`. | Hühnerbrühe `ing_huehnerbruehe` |
| 66 | `honig` | Bauchiges Honigglas mit Deckel, darin Wabenmuster; Inhalt `.duo`, Waben Kontur. | Honig `ing_honig` |
| 67 | `zucker` | Zwei gestapelte Würfel in Schrägansicht, daneben ein Streuhäufchen; der untere Würfel `.duo`. | Zucker `ing_zucker` |
| 68 | `hefe` | Kleines Tütchen mit gezackter Aufreißkante, unten ein Häufchen Granulat; Tütenkörper `.duo`. | Trockenhefe `ing_trockenhefe` |
| 69 | `schokolade` | Angebrochene Tafel: drei Rippen in Kontur, ein abgebrochenes Stück versetzt daneben (`.duo`). | Zartbitterschokolade `ing_schoko_zartbitter` |

### Nüsse & Kokos (4)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 70 | `erdnuss` | Erdnussschale in Achterform mit Netzstruktur; Schale `.duo`. | Erdnüsse `ing_erdnuesse` |
| 71 | `mandel` | Zwei Mandeln in Tropfenform, überlappend, mit Mittelrille; die vordere `.duo`. | Mandeln/Nüsse (gemischt) `ing_mandeln` |
| 72 | `kokos` | Halbe Kokosnuss von vorn: äußere Schale Kontur, Fruchtfleischring `.duo`, drei Raspelstreifen daneben. | Kokosraspel `ing_kokosraspel` |
| 73 | `kokosmilch` | Gleiche Kokoshälfte, aber mit Tropfen darunter und Flüssigkeitslinie; Fruchtfleisch `.duo`. | Kokosmilch (Dose) `ing_kokosmilch` |

### Gewürze – getrocknet & gemahlen (10)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 74 | `salz` | Streuer mit gewölbtem Kopf und drei Löchern, unten Füllstand (`.duo`), zwei Körner fallen heraus. | Salz (jodiert) `ing_salz` |
| 75 | `pfeffer` | Mühle mit abgesetztem Kopf und Kurbel; Korpus `.duo`. | Pfeffer `ing_pfeffer` |
| 76 | `currypulver` | Gewürzglas mit Streueinsatz, davor ein gehäufter Löffel Pulver (`.duo`). | Currypulver `ing_currypulver` |
| 77 | `kreuzkuemmel` | Fünf längliche, längs gerillte Samen locker gestreut; der größte `.duo`. | Kreuzkümmel `ing_kreuzkuemmel` |
| 78 | `paprikapulver` | Gewürzglas wie `currypulver`, als Marke davor eine halbe Paprikaschote in Kontur; Glasinhalt `.duo`. | Paprikapulver `ing_paprikapulver` |
| 79 | `chiliflocken` | Schote mit gebogener Spitze und Stiel, daneben drei Flocken; Schote `.duo`. | Chiliflocken `ing_chiliflocken` |
| 80 | `muskat` | Ovale Nuss mit Maserung, daneben eine kleine Reibe; Nuss `.duo`. | Muskat `ing_muskat` |
| 81 | `zimt` | Zwei gerollte Stangen, eine frontal mit Spiralquerschnitt (`.duo`). | Zimt `ing_zimt` |
| 82 | `oregano` | Kurzer Zweig mit gegenständigen, leicht eingerollten Blättchen (getrocknet); zwei Blätter `.duo`. | Oregano `ing_oregano` |
| 83 | `kraeuter_provence` | Drei verschiedene kurze Zweige gebündelt, unten mit Band; das Band `.duo`. | Kräuter der Provence `ing_kraeuter_provence` |

### Frische Kräuter (4)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 84 | `petersilie` | Drei fein gezackte, flach ausgebreitete Blätter am gemeinsamen Stiel; das mittlere `.duo`. | Petersilie `ing_petersilie` |
| 85 | `basilikum` | Zwei breite, ovale Blätter mit deutlicher Mittelrippe an aufrechtem Stiel; das größere `.duo`. | Basilikum `ing_basilikum` |
| 86 | `koriander` | Rundlich gelappte Blätter mit gewellter Kante, fächerförmig; das vordere `.duo`. | Koriander `ing_koriander` |
| 87 | `minze` | Zwei spitz zulaufende Blätter mit gesägtem Rand, gegenständig am Stiel; das größere `.duo`. | Minze `ing_minze` |

---

## 7. Abnahme

- Alle 87 Icons in Light **und** Dark rendern, bei 24 px und bei 44 px.
- Jede der 92 Zutaten zeigt ein Icon, keine fällt auf den Platzhalter.
- Keine harten Farben im SVG: `grep -E 'fill="#|stroke="#' js/icons-produkte.js`
  muss leer bleiben (Ausnahme: keine).
- Genau eine `.duo`-Fläche je Icon.
- Die Paare aus Prinzip 4 nebeneinander prüfen – wenn sie sich bei 24 px nicht
  auf einen Blick unterscheiden, ist eines von beiden neu zu zeichnen.

**Summe:** 87 Icons für 92 Zutaten, 5 Zusammenlegungen. Die Zuordnung ist
maschinell geprüft – jede `zutat_id` aus `js/data/kerndb.js` kommt genau
einmal vor.

Wächst die Kern-DB (Doku Kap. 9, Punkt 8: Ausbau auf 300–500 Rezepte), kommen
neue Zutaten dazu. Dann gilt: erst prüfen, ob eine bestehende Form trägt, und
nur bei echtem Bedarf ein Icon ergänzen.

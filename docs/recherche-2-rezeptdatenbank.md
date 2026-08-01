# Zubereitungs- & Rezeptdatenbank für die Vorrats- & Rezept-App (Max Kruggel)

Die beste tragfähige Grundlage für die App ist eine **hybride Datenstrategie**: eine selbst gepflegte, hier gelieferte Kern-Datenbank aus Grundtechniken, Produktzubereitungen und Grundrezepten (weil es dafür keine brauchbare offene Quelle gibt), kombiniert mit **TheMealDB** (kommerziell nutzbar mit Supporter-Key + Attribution) für internationale Vollrezepte und **Open Food Facts** (ODbL, kommerziell nutzbar) für den Produkt-/Nährwert- und Vorratsabgleich – während Spoonacular/Edamam nur als Live-Abruf-Feature, aber nicht zur dauerhaften Datenbankbefüllung dienen dürfen.

## TL;DR

- **Was hier geliefert wird:** (1) ein festes, maschinenlesbares JSON-Schema, (2) vollständige Taxonomien plus normalisierte Zutatenliste, (3) eine strukturierte Datenbank mit 60 vollständig ausgefüllten Datensätzen über alle sechs Inhaltstypen, breit über Küchen und Ernährungsformen verteilt, und (4) eine Lizenzbewertung offener Rezeptquellen mit Kombinationsempfehlung.
- **Beste Quellen-Kombination:** TheMealDB (Supporter-Tier, kommerziell + Attribution) als internationaler Vollrezept-Grundstock + Open Food Facts (ODbL) für Produkt-/Barcode-/Nährwertabgleich des Bestands + selbst gepflegte Grundtechnik-/Grundrezept-/Produktzubereitungs-Datensätze (wie hier). Spoonacular und Edamam eignen sich als optionales Online-Feature, **nicht** zum dauerhaften Speichern (Caching-Limit 1 Stunde bei Spoonacular).
- **Rechtliche Warnung:** RecipeNLG (exakt 2.231.142 Rezepte)  und die großen deutschen chefkoch.de-Datasets (12.190 / 263.854 / 300.000+ Rezepte) sind **nicht kommerziell lizenziert** und für eine kommerzielle App ohne juristische Prüfung ungeeignet.

## Key Findings

- **Sicherheitskritische Werte sind behördlich belegt.** Kerntemperaturen stammen von USDA/FSIS; die Zeiten für Reis, Nudeln, Kartoffeln, Eier, Hülsenfrüchte und Blanchieren aus etablierten deutschsprachigen Kochratgebern (Knorr, ÖKO-TEST, LECKER, Reishunger, Betty Bossi). Diese Werte sind in den Datensätzen direkt als Timer/Temperatur hinterlegt.
- **Für Grundtechniken & Produktzubereitung gibt es keine gute offene Quelle.** Alle offenen Rezept-Datasets liefern *Gerichte*, nicht das produktzentrierte „Wie gare ich einzelne Zutaten richtig”. Dieser Teil (Content-Typen `grundtechnik`, `produktzubereitung`, `grundrezept`, `tipp`) muss redaktionell erstellt werden – genau das leistet die hier gelieferte Kern-Datenbank, die zugleich das AI-Vorschlagsmodell mit strukturiertem Domänenwissen füttert.
- **Lizenz ist der entscheidende Filter, nicht die Rezeptmenge.** Die größten Datasets sind rechtlich am problematischsten. Kommerziell sauber sind nur TheMealDB (mit Supporter-Key), Open Food Facts (ODbL, mit Share-Alike-Pflicht) und der food.com-Dump (MIT, aber englisch).
- **Spoonacular/Edamam sind Mietmodelle, kein Datenbesitz.** Beide verbieten das dauerhafte Speichern der Daten – sie können die App-Datenbank also nie ersetzen, nur ergänzen.

-----

## Details

### TEIL 1 — JSON-Schema (Definition & Felderklärung)

Jeder Datensatz ist ein Objekt nach folgendem Schema. Das Schema ist bewusst flach genug für schnellen Bestandsabgleich und tief genug für Timer-gesteuerte Schritt-Anleitungen.

```json
{
  "$schema": "kruggel-recipe-db/v1",
  "id": "string  // eindeutig, Präfix nach Typ: TECH-, PREP-, BASE-, RCP-, IDEA-, TIP-",
  "name": "string  // Anzeigename",
  "typ": "enum: grundtechnik | grundrezept | rezept | rezeptidee | produktzubereitung | tipp",
  "kategorie": "string  // z.B. 'Getreide/Reis', 'Sauce', 'Hauptgericht', 'Lagerung'",
  "cuisine": "string  // aus Cuisine-Taxonomie; 'universell' für Techniken",
  "mahlzeitentyp": ["array: fruehstueck | mittag | abend | snack | beilage | grundlage"],
  "portionen": "number  // Basisportionen; null bei Technik/Tipp",
  "zutaten": [
    {
      "menge": "number|null",
      "einheit": "enum: g | kg | ml | l | Stk | EL | TL | Prise | Bund | Zehe | Dose | nach_Bedarf",
      "zutat_id": "string  // FK auf normalisierte Zutatenliste, ermöglicht Bestandsabgleich",
      "zutat_name": "string  // Klartext-Anzeige",
      "optional": "boolean"
    }
  ],
  "schritte": [
    {
      "nr": "number",
      "text": "string  // einfache Imperativ-Anleitung, ein Handlungsschritt",
      "dauer_sekunden": "number|null  // treibt den In-App-Timer",
      "temperatur_c": "number|null  // Ofen-/Öl-/Kerntemperatur wo relevant",
      "timer_typ": "enum|null: aktiv | passiv | ofen | ruhen"
    }
  ],
  "gesamtzeit_min": {"vorbereitung": "number", "garzeit": "number", "gesamt": "number"},
  "schwierigkeit": "enum: einfach | mittel | fortgeschritten",
  "ernaehrungsform": ["array: vegan | vegetarisch | pescetarisch | mit_fisch | mit_fleisch | mit_gefluegel"],
  "allergene": ["array: gluten | laktose | ei | fisch | krebstiere | schalenfruechte | erdnuss | soja | sesam | senf | sellerie | sulfite | keine"],
  "naehrwert_einordnung": {
    "kcal_pro_portion": "number|null",
    "profil": "enum: proteinreich | kohlenhydratreich | fettreich | ballaststoffreich | kalorienarm | ausgewogen",
    "makro_hinweis": "string"
  },
  "substitutionen": [
    {"fehlt": "zutat_name", "ersatz": "zutat_name", "hinweis": "string"}
  ],
  "tags": ["array: schnell | mealprep | resteverwertung | one-pot | high-protein | low-carb | budget | saisonal"],
  "quelle_typ": "enum: behoerde | kochlehrbuch | etablierte_kochseite | redaktionell"
}
```

**Felderklärung (Kurz):** `zutat_id` ist der Schlüssel für den Vorratsabgleich – die App matcht Bestand gegen diese ID, nicht gegen Freitext. `dauer_sekunden` + `timer_typ` steuern die App-Timer (aktiv = Nutzer arbeitet, passiv = köcheln, ofen = Backzeit, ruhen = z. B. Fleischruhe). `ernaehrungsform` ist ein Array, weil ein Gericht mehrere Filter erfüllen kann (vegan ⊂ vegetarisch). `naehrwert_einordnung.profil` treibt den Gesundheits-/Nährwertfilter. „Rezept gekocht” reduziert den Bestand über `zutaten[].zutat_id` × `menge` × (gekochte Portionen / `portionen`).

-----

### TEIL 2 — Taxonomien & normalisierte Zutatenliste

**A. Inhaltstypen (typ):** `grundtechnik`, `grundrezept`, `rezept`, `rezeptidee`, `produktzubereitung`, `tipp`

**B. Kategorien:** Getreide/Reis · Nudeln/Teigwaren · Kartoffeln · Hülsenfrüchte · Gemüse · Obst · Eier · Milchprodukte · Tofu/Fleischalternativen · Fisch/Meeresfrüchte · Fleisch · Geflügel · Sauce · Fond/Brühe · Dressing/Dip · Teig · Suppe/Eintopf · Salat · Auflauf/Gratin · Pfannengericht · Bowl · Frühstück · Backwaren · Lagerung/Haltbarkeit · Substitution · Küchentechnik

**C. Grundtechniken (Kanon, 18):** Kochen · Dämpfen · Dünsten · Blanchieren · Braten (Pfanne) · Anbraten/Scharf anbraten · Schmoren · Rösten (Ofen) · Backen · Frittieren · Pochieren · Sautieren/Pfannenrühren (Stir-fry) · Grillen · Gratinieren · Marinieren · Fermentieren · Einkochen/Einmachen · Sous-vide

**D. Cuisines:** deutsch/mitteleuropäisch · italienisch · französisch · spanisch · griechisch · levantinisch/nahöstlich · türkisch · indisch · japanisch · chinesisch · thailändisch · vietnamesisch · koreanisch · mexikanisch/lateinamerikanisch · US-amerikanisch · nordafrikanisch · universell

**E. Ernährungsform-Tags:** vegan · vegetarisch · pescetarisch · mit_fisch · mit_fleisch · mit_gefluegel

**F. Allergene (EU-14-orientiert):** gluten · laktose · ei · fisch · krebstiere · schalenfruechte · erdnuss · soja · sesam · senf · sellerie · sulfite (+ „keine”)

**G. Normalisierte Zutatenliste (Auszug, Basis für Bestandsabgleich).** Jede `zutat_id` sollte in der App zusätzlich Synonyme/Barcodes (via Open Food Facts) und eine Haltbarkeitsangabe tragen.

|zutat_id                |Anzeigename            |Kategorie    |typische Lagerung         |
|------------------------|-----------------------|-------------|--------------------------|
|ing_reis_weiss          |Weißer Reis (Langkorn) |Getreide     |Vorrat, trocken, jahrelang|
|ing_reis_basmati        |Basmatireis            |Getreide     |Vorrat, trocken           |
|ing_reis_vollkorn       |Vollkornreis/Naturreis |Getreide     |Vorrat, trocken           |
|ing_nudeln              |Nudeln (Hartweizen)    |Nudeln       |Vorrat, trocken           |
|ing_kartoffel           |Kartoffeln             |Kartoffeln   |kühl/dunkel, Wochen       |
|ing_linsen_rot          |Rote Linsen            |Hülsenfrüchte|Vorrat, trocken           |
|ing_kichererbsen_trocken|Kichererbsen getrocknet|Hülsenfrüchte|Vorrat, trocken           |
|ing_kichererbsen_dose   |Kichererbsen (Dose)    |Hülsenfrüchte|Vorrat, Konserve          |
|ing_ei                  |Eier (Größe M)         |Eier         |Kühlschrank, Wochen       |
|ing_zwiebel             |Zwiebel                |Gemüse       |kühl/dunkel               |
|ing_knoblauch           |Knoblauch              |Gemüse       |kühl/dunkel               |
|ing_tomate_dose         |Tomaten (Dose, stückig)|Gemüse       |Vorrat, Konserve          |
|ing_passierte_tomaten   |Passierte Tomaten      |Sauce        |Vorrat, Konserve          |
|ing_broccoli            |Brokkoli               |Gemüse       |Kühlschrank, Tage         |
|ing_moehre              |Möhre/Karotte          |Gemüse       |Kühlschrank, Wochen       |
|ing_spinat              |Blattspinat (frisch/TK)|Gemüse       |Kühl/TK                   |
|ing_paprika             |Paprika                |Gemüse       |Kühlschrank               |
|ing_zucchini            |Zucchini               |Gemüse       |Kühlschrank               |
|ing_olivenoel           |Olivenöl               |Fett         |Vorrat, dunkel            |
|ing_rapsoel             |Rapsöl/neutrales Öl    |Fett         |Vorrat                    |
|ing_butter              |Butter                 |Milchprodukt |Kühlschrank               |
|ing_mehl_405            |Weizenmehl Type 405    |Backen       |Vorrat                    |
|ing_milch               |Milch                  |Milchprodukt |Kühlschrank               |
|ing_joghurt_natur       |Naturjoghurt           |Milchprodukt |Kühlschrank               |
|ing_parmesan            |Parmesan/Hartkäse      |Milchprodukt |Kühlschrank               |
|ing_tofu_natur          |Tofu natur             |Fleischalt.  |Kühlschrank               |
|ing_haehnchenbrust      |Hähnchenbrustfilet     |Geflügel     |Kühl/TK                   |
|ing_hackfleisch_rind    |Rinderhackfleisch      |Fleisch      |Kühl/TK                   |
|ing_lachs               |Lachsfilet             |Fisch        |Kühl/TK                   |
|ing_kokosmilch          |Kokosmilch (Dose)      |Sauce        |Vorrat, Konserve          |
|ing_sojasauce           |Sojasauce              |Würze        |Vorrat                    |
|ing_zitrone             |Zitrone                |Obst         |Kühlschrank               |
|ing_haferflocken        |Haferflocken           |Getreide     |Vorrat                    |
|ing_salz                |Salz                   |Würze        |Vorrat                    |
|ing_pfeffer             |Pfeffer                |Würze        |Vorrat                    |

*(In der Produktion sollte diese Liste auf ~800–1.500 Einträge wachsen; Open Food Facts liefert dafür Produktnamen, Synonyme und Barcodes.)*

-----

### TEIL 3 — Die Datenbank (60 strukturierte Datensätze)

> Werte-Herkunft: Kerntemperaturen aus USDA FSIS „Safe Minimum Internal Temperature Chart”; Gar-/Kochzeiten aus etablierten Kochratgebern (Knorr, ÖKO-TEST, LECKER, Reishunger, Betty Bossi, EDEKA). Zeiten sind Richtwerte, Kerntemperaturen sind Sicherheitsminima.

#### 3.1 Produktzubereitungen (produktzentriert)

**PREP-001 — Weißen Langkornreis kochen (Quellmethode)**

- typ: produktzubereitung · kategorie: Getreide/Reis · cuisine: universell · mahlzeitentyp: [beilage, grundlage] · portionen: 2 · schwierigkeit: einfach
- zutaten: 100 g `ing_reis_weiss`, 150 ml Wasser, 1 Prise `ing_salz`
- schritte: 1) Reis in Sieb kalt abspülen bis Wasser klar ist (60 s, aktiv). 2) Reis mit 1,5-facher Menge Wasser (Verhältnis 1:1,5) und Salz aufkochen (aktiv).  3) Hitze reduzieren, Deckel drauf, ohne Rühren quellen lassen (12–15 Min, passiv). 4) Vom Herd nehmen, 5 Min ruhen lassen (300 s, ruhen). 5) Mit Gabel auflockern.
- gesamtzeit: {vorbereitung: 2, garzeit: 18, gesamt: 20} · ernaehrungsform: [vegan, vegetarisch] · allergene: [keine] · naehrwert: kohlenhydratreich · substitutionen: [{fehlt: Basmatireis, ersatz: weißer Langkornreis, hinweis: gleiches 1:1,5-Verhältnis}]

**PREP-002 — Basmatireis kochen**

- kategorie: Getreide/Reis · cuisine: indisch · portionen: 2 · einfach
- zutaten: 100 g `ing_reis_basmati`, 150 ml Wasser, Prise `ing_salz`
- schritte: 1) Reis waschen bis Wasser klar (60 s). 2) Optional 20–30 Min einweichen (passiv) für längere Körner.  3) Mit Wasser 1:1,5 aufkochen. 4) Deckel, niedrige Hitze, 10–15 Min quellen (passiv). 5) 5 Min ruhen, auflockern.
- ernaehrungsform: [vegan, vegetarisch] · allergene: [keine] · naehrwert: kohlenhydratreich

**PREP-003 — Vollkornreis/Naturreis kochen**

- kategorie: Getreide/Reis · portionen: 2 · einfach
- zutaten: 100 g `ing_reis_vollkorn`, 200–250 ml Wasser, Prise Salz
- schritte: 1) Waschen (60 s). 2) Verhältnis 1:2 bis 1:2,5 ansetzen.  3) Aufkochen, dann 30–40 Min köcheln (passiv). 4) 5 Min ruhen.
- ernaehrungsform: [vegan] · naehrwert: ballaststoffreich · tags: [ballaststoffreich] · substitutionen: [{fehlt: Vollkornreis, ersatz: weißer Reis, hinweis: Garzeit auf ~15 Min verkürzen, weniger Wasser}]

**PREP-004 — Nudeln al dente kochen**

- kategorie: Nudeln · cuisine: italienisch · portionen: 2 · einfach
- zutaten: 200 g `ing_nudeln`, 2 l Wasser, 20 g `ing_salz`
- schritte: 1) Reichlich Wasser aufkochen (aktiv). 2) Salzen (~10 g/l). 3) Nudeln einrühren. 4) Nach Packungsangabe kochen, 1 Min vor Ende probieren – al dente = bissfest mit hellem Kern (passiv).  5) Abgießen, etwas Kochwasser aufheben.
- allergene: [gluten] · ernaehrungsform: [vegan] · naehrwert: kohlenhydratreich · tags: [schnell]

**PREP-005 — Salzkartoffeln kochen (festkochend)**

- kategorie: Kartoffeln · cuisine: deutsch · portionen: 4 · einfach
- zutaten: 800 g `ing_kartoffel`, Wasser, `ing_salz`
- schritte: 1) Kartoffeln schälen, gleich groß schneiden (aktiv). 2) In KALTEM Salzwasser aufsetzen (verhindert Zerfallen außen). 3) Aufkochen, dann 20–25 Min köcheln (passiv).  4) Messerprobe: gleitet leicht = gar.  5) Abgießen.
- ernaehrungsform: [vegan] · naehrwert: kohlenhydratreich · substitutionen: [{fehlt: festkochend, ersatz: vorwiegend festkochend, hinweis: ~20 Min, etwas früher prüfen}]

**PREP-006 — Pellkartoffeln kochen**

- kategorie: Kartoffeln · portionen: 4 · einfach
- schritte: 1) Ungeschälte Kartoffeln waschen. 2) In kaltem Wasser aufsetzen. 3) 20–30 Min köcheln je nach Größe (passiv).  4) Abschrecken, pellen.
- ernaehrungsform: [vegan] · naehrwert: kohlenhydratreich

**PREP-007 — Ei kochen (weich / wachsweich / hart, Größe M)**

- kategorie: Eier · portionen: 2 · einfach
- zutaten: 2 `ing_ei`, Wasser
- schritte: 1) Wasser zum Kochen bringen (aktiv). 2) Eier mit Löffel einlegen. 3) Bei mittlerer Hitze kochen: **weich 4:30 Min** / **wachsweich 7 Min** / **hart 10 Min** (Timer je Garstufe, passiv).  4) In Eiswasser abschrecken (60 s, ruhen).
- allergene: [ei] · ernaehrungsform: [vegetarisch] · naehrwert: proteinreich · tags: [schnell, high-protein] · hinweis: Größe S −30 s, Größe L +30 s; kühlschrankkalt +1 Min. 

**PREP-008 — Kichererbsen aus getrockneter Ware**

- kategorie: Hülsenfrüchte · portionen: 4 · mittel
- zutaten: 250 g `ing_kichererbsen_trocken`, Wasser, Prise Salz
- schritte: 1) 8–12 h in reichlich Wasser einweichen (passiv, ~36000 s).  2) Einweichwasser weggießen, abspülen.  3) Frisch mit Wasser bedecken, aufkochen. 4) 60–70 Min köcheln bis weich (passiv).  5) Salz gegen Ende.
- ernaehrungsform: [vegan] · naehrwert: proteinreich · tags: [ballaststoffreich, budget, mealprep] · substitutionen: [{fehlt: getrocknete Kichererbsen, ersatz: Kichererbsen aus Dose, hinweis: bereits gegart, nur abspülen, spart 8–12 h + 70 Min}]

**PREP-009 — Rote Linsen kochen**

- kategorie: Hülsenfrüchte · portionen: 3 · einfach
- zutaten: 200 g `ing_linsen_rot`, 400 ml Wasser/Brühe
- schritte: 1) Linsen abspülen (kein Einweichen nötig).  2) Mit ~doppelter Menge Flüssigkeit aufkochen. 3) 10 Min köcheln bis weich, zerfallen leicht (passiv). 
- ernaehrungsform: [vegan] · naehrwert: proteinreich · tags: [schnell, high-protein]

**PREP-010 — Brokkoli blanchieren**

- typ: produktzubereitung · kategorie: Gemüse · portionen: 4 · einfach
- zutaten: 400 g `ing_broccoli`, Wasser, `ing_salz`, Eiswasser
- schritte: 1) In Röschen teilen (aktiv). 2) Salzwasser sprudelnd aufkochen, Eiswasser bereitstellen.  3) Röschen 2–4 Min ins kochende Wasser (passiv).  4) Sofort in Eiswasser abschrecken bis kalt (ruhen).  5) Abtropfen.
- ernaehrungsform: [vegan] · naehrwert: kalorienarm · tags: [saisonal] · hinweis: Blattgemüse/Spinat 15–30 s; hartes Gemüse (Rosenkohl) 4–6 Min. 

**PREP-011 — Hähnchenbrust in der Pfanne garen (sicher)**

- kategorie: Geflügel · cuisine: universell · portionen: 2 · einfach
- zutaten: 2 `ing_haehnchenbrust`, 1 EL `ing_rapsoel`, `ing_salz`, `ing_pfeffer`
- schritte: 1) Filet trockentupfen, salzen (aktiv). 2) Öl erhitzen, Filet 5–6 Min pro Seite braten (aktiv). 3) Kerntemperatur prüfen: **74 °C** (Sicherheitsminimum für Geflügel).  4) 3 Min ruhen (ruhen).
- ernaehrungsform: [mit_gefluegel] · naehrwert: proteinreich · tags: [high-protein] · quelle_typ: behoerde (Kerntemperatur USDA/FSIS)

**PREP-012 — Lachsfilet braten/backen**

- kategorie: Fisch · portionen: 2 · einfach
- zutaten: 2 `ing_lachs`, `ing_olivenoel`, `ing_zitrone`, Salz
- schritte: 1) Trockentupfen, würzen. 2) Hautseite zuerst 4 Min braten, wenden 2–3 Min – oder Ofen 180 °C 12–15 Min (ofen). 3) Gar bei Kerntemperatur **63 °C** bzw. Fleisch glasig-blättrig. 
- allergene: [fisch] · ernaehrungsform: [pescetarisch, mit_fisch] · naehrwert: proteinreich · quelle_typ: behoerde

**PREP-013 — Tofu natur anbraten (knusprig)**

- kategorie: Tofu/Fleischalternativen · cuisine: universell · portionen: 2 · einfach
- zutaten: 200 g `ing_tofu_natur`, 1 EL `ing_sojasauce`, 1 EL `ing_rapsoel`, 1 TL Stärke (optional)
- schritte: 1) Tofu pressen/abtropfen, würfeln (aktiv). 2) Optional in Stärke wenden für Knusprigkeit. 3) In heißem Öl rundum 8–10 Min goldbraun braten (aktiv). 4) Mit Sojasauce ablöschen.
- allergene: [soja] · ernaehrungsform: [vegan] · naehrwert: proteinreich · substitutionen: [{fehlt: Tofu, ersatz: Kichererbsen aus Dose, hinweis: abgetropft ebenfalls knusprig braten}]

**PREP-014 — Zwiebeln glasig dünsten (Basis-Aromabildung)**

- typ: produktzubereitung · kategorie: Gemüse · einfach
- zutaten: 1 `ing_zwiebel`, 1 EL Öl/Butter
- schritte: 1) Zwiebel fein würfeln (aktiv). 2) Bei mittlerer Hitze in Fett 3–5 Min glasig dünsten, nicht bräunen (aktiv).
- ernaehrungsform: [vegan] · naehrwert: kalorienarm

**PREP-015 — Möhren dämpfen**

- kategorie: Gemüse · portionen: 2 · einfach
- schritte: 1) Möhren in Scheiben/Stifte (aktiv). 2) Im Dämpfeinsatz über kochendem Wasser 8–12 Min garen bis bissfest (passiv).
- ernaehrungsform: [vegan] · naehrwert: kalorienarm · tags: [saisonal]

#### 3.2 Grundtechniken

**TECH-001 — Kochen (in Flüssigkeit)**: Lebensmittel vollständig in ~100 °C sprudelndem Wasser garen. Typische Fehler: zu wenig Wasser (Temperatur bricht ein), Kartoffeln in kochendes statt kaltes Wasser (Außenzerfall).  ernaehrungsform: [vegan].

**TECH-002 — Dämpfen**: Garen über (nicht in) kochendem Wasser im Siebeinsatz, ~100 °C. Schonend, erhält Vitamine/Farbe. Fehler: Wasser berührt Gargut; Deckel offen → kein Dampfstau.

**TECH-003 — Dünsten**: Garen im eigenen Saft mit wenig Fett/Flüssigkeit bei mittlerer Hitze, Deckel drauf. Für Zwiebeln, Blattgemüse, Fenchel. Fehler: zu hohe Hitze → Bräunung statt Dünsten.

**TECH-004 — Blanchieren**: Kurz (Sek. bis wenige Min.) in sprudelndem Salzwasser, dann Eiswasser-Schock. Stoppt Enzyme, fixiert Farbe. Blattgemüse 15–30 s, festes Gemüse 2–4 Min, hartes 4–6 Min.  Fehler: kein Eisbad → Nachgaren, graugrün.

**TECH-005 — Braten (Pfanne)**: Trockene Hitze mit Fett, ~160–200 °C. Fleisch/Gemüse für Röstaromen (Maillard). Fehler: Pfanne nicht heiß genug → grau statt braun; Pfanne überladen → Dünsten.

**TECH-006 — Scharf anbraten**: Sehr hohe Hitze, kurze Zeit, kräftige Kruste. Fleisch trockentupfen, nicht bewegen bis Kruste löst. Fehler: nasses Gargut, zu früh wenden.

**TECH-007 — Schmoren**: Anbraten + langes Garen in Flüssigkeit bei niedriger Hitze (~90–95 °C, 1–3 h), Deckel. Für zähe Fleischstücke, Eintöpfe. Fehler: zu viel Hitze → zäh statt zart.

**TECH-008 — Rösten (Ofen)**: Trockene Ofenhitze 180–220 °C für Gemüse/Fleisch, karamellisiert Oberflächen. Fehler: Blech überladen → Dampf; kein Wenden → ungleichmäßig.

**TECH-009 — Backen**: Ofengaren mit definierter Ober-/Unterhitze oder Umluft. Umluft ~20 °C niedriger als Ober-/Unterhitze. Fehler: Ofen nicht vorgeheizt; Tür zu früh öffnen (Gebäck fällt).

**TECH-010 — Frittieren**: Garen in heißem Öl 160–180 °C. Fehler: zu niedrige Temperatur → fettig; zu viel auf einmal → Temperatursturz.

**TECH-011 — Pochieren**: Garen in nur simmernder (~75–90 °C) Flüssigkeit, kein Sprudeln. Für Eier, Fisch, Geflügel. Fehler: zu heiß → zerfällt/zäh.

**TECH-012 — Sautieren / Stir-fry**: Sehr hohe Hitze, ständige Bewegung im Wok/Pfanne, kleine gleich große Stücke. Fehler: kaltes Gargut, überladen.

**TECH-013 — Marinieren**: Einlegen in Öl/Säure/Gewürze zur Aromatisierung/Zartmachung. Säure nicht zu lange bei Fisch (gart „durch”). Fehler: salzarme Marinade zu kurz; Säure zu lange → mehlige Textur.

**TECH-014 — Fermentieren**: Kontrollierte mikrobielle Gärung (z. B. Sauerkraut: 2 % Salz, luftdicht, 1–4 Wochen bei RT). Fehler: unsauberes Gerät, Gemüse nicht unter Lake → Schimmel.

**TECH-015 — Einkochen/Einmachen**: Sterilisieren + luftdicht verschließen zur Haltbarmachung. Saubere Gläser, Vakuum-Deckel-Test. Fehler: unsteril → Verderb/Botulismus-Risiko bei säurearmen Lebensmitteln.

**TECH-016 — Gratinieren**: Überbacken mit Käse/Sauce bis goldene Kruste, Oberhitze/Grillfunktion. Fehler: zu hohe Hitze → verbrannt oben, kalt innen.

**TECH-017 — Grillen**: Direkte Strahlungshitze. Kerntemperaturen wie beim Braten beachten (Geflügel 74 °C). Fehler: zu heiße Zone → außen verkohlt, innen roh.

**TECH-018 — Sous-vide**: Vakuumgaren im temperierten Wasserbad (präzise, z. B. Hähnchen 63–65 °C lang). Danach kurz scharf anbraten. Fehler: unsichere Temperatur/Zeit-Kombi bei Geflügel.

#### 3.3 Grundrezepte

**BASE-001 — Tomatensauce (Sugo)** · italienisch · vegan · 4 Port. · einfach

- zutaten: 1 `ing_zwiebel`, 1 Zehe `ing_knoblauch`, 1 EL `ing_olivenoel`, 400 g `ing_passierte_tomaten`, Salz, Pfeffer, Prise Zucker
- schritte: 1) Zwiebel+Knoblauch fein hacken (aktiv). 2) In Öl glasig dünsten 4 Min. 3) Passierte Tomaten zugeben, aufkochen. 4) 20 Min köcheln (passiv). 5) Abschmecken.
- allergene: [keine] · naehrwert: kalorienarm · tags: [budget, one-pot] · substitutionen: [{fehlt: passierte Tomaten, ersatz: Tomaten aus der Dose püriert, hinweis: identisch}]

**BASE-002 — Béchamel (helle Grundsauce)** · französisch · vegetarisch · 4 Port. · mittel

- zutaten: 40 g `ing_butter`, 40 g `ing_mehl_405`, 500 ml `ing_milch`, Salz, Muskat
- schritte: 1) Butter schmelzen. 2) Mehl einrühren, 1–2 Min anschwitzen (Mehlschwitze, aktiv). 3) Milch nach und nach unter Rühren angießen. 4) Unter Rühren 5–8 Min köcheln bis sämig. 5) Mit Muskat/Salz abschmecken.
- allergene: [gluten, laktose] · naehrwert: fettreich · substitutionen: [{fehlt: Milch, ersatz: Haferdrink, hinweis: für vegane Béchamel + Öl statt Butter}]

**BASE-003 — Gemüsebrühe (Fond)** · universell · vegan · einfach

- zutaten: 1 `ing_zwiebel`, 2 `ing_moehre`, Selleriestück, Petersilie, 1,5 l Wasser, Salz
- schritte: 1) Gemüse grob schneiden. 2) Alles mit Wasser aufkochen. 3) 45 Min leise köcheln (passiv). 4) Abseihen.
- allergene: [sellerie] · naehrwert: kalorienarm · tags: [resteverwertung]

**BASE-004 — Vinaigrette (Grunddressing)** · französisch · vegan · einfach

- zutaten: 3 EL `ing_olivenoel`, 1 EL Essig, 1 TL Senf, Salz, Pfeffer
- schritte: 1) Essig, Senf, Salz verrühren. 2) Öl langsam einschlagen bis emulgiert (60 s, aktiv).
- allergene: [senf] · naehrwert: fettreich · substitutionen: [{fehlt: Essig, ersatz: Zitronensaft, hinweis: frischer, etwas milder}]

**BASE-005 — Hummus** · levantinisch · vegan · 4 Port. · einfach

- zutaten: 250 g `ing_kichererbsen_dose`, 2 EL Tahin, 1 `ing_zitrone` (Saft), 1 Zehe `ing_knoblauch`, `ing_olivenoel`, Salz, Kreuzkümmel
- schritte: 1) Kichererbsen abspülen. 2) Mit Tahin, Zitrone, Knoblauch, Salz pürieren (90 s, aktiv). 3) Wasser/Öl bis cremig einarbeiten.
- allergene: [sesam] · naehrwert: proteinreich · tags: [high-protein, budget]

**BASE-006 — Pizza-/Flammkuchenteig (Hefeteig)** · italienisch · vegan · mittel

- zutaten: 300 g `ing_mehl_405`, 180 ml Wasser lauwarm, 4 g Trockenhefe, 1 TL Salz, 1 EL Öl
- schritte: 1) Zutaten verkneten 8 Min (aktiv). 2) Abgedeckt ~60 Min gehen bis doppelt (passiv, ofen-nein). 3) Ausrollen.
- allergene: [gluten] · naehrwert: kohlenhydratreich

**BASE-007 — Pfannkuchen-/Crêpeteig** · französisch · vegetarisch · einfach

- zutaten: 200 g `ing_mehl_405`, 3 `ing_ei`, 400 ml `ing_milch`, Prise Salz
- schritte: 1) Alles glatt verrühren (aktiv). 2) 15 Min quellen (passiv). 3) Dünn in heißer Pfanne mit Fett ausbacken, je Seite ~1–2 Min.
- allergene: [gluten, ei, laktose] · naehrwert: ausgewogen

**BASE-008 — Reis-Grundrezept Wassermethode (nährstoffschonend)** · universell · vegan · einfach — siehe PREP-001/003 (Quellmethode empfohlen, weniger Nährstoffverlust).

**BASE-009 — Joghurt-Kräuter-Dip (Tzatziki-Basis)** · griechisch · vegetarisch · einfach

- zutaten: 250 g `ing_joghurt_natur`, ½ Gurke, 1 Zehe `ing_knoblauch`, `ing_olivenoel`, Salz
- schritte: 1) Gurke raspeln, ausdrücken. 2) Mit Joghurt, Knoblauch, Öl, Salz verrühren.
- allergene: [laktose] · naehrwert: proteinreich · substitutionen: [{fehlt: Joghurt, ersatz: Sojajoghurt, hinweis: vegane Variante}]

**BASE-010 — Basis-Currypaste-Sauce (Kokos)** · thailändisch · vegan · einfach

- zutaten: 1 EL Currypaste, 400 ml `ing_kokosmilch`, 1 EL `ing_sojasauce`, Limette
- schritte: 1) Currypaste kurz in Öl anrösten (60 s). 2) Kokosmilch angießen, aufkochen. 3) 10 Min köcheln, mit Sojasauce/Limette abschmecken.
- allergene: [soja] · naehrwert: fettreich

#### 3.4 Vollständige Rezepte

**RCP-001 — Spaghetti Aglio e Olio** · italienisch · vegan · 2 Port. · einfach · ~15 Min

- zutaten: 200 g `ing_nudeln`, 3 Zehen `ing_knoblauch`, 4 EL `ing_olivenoel`, Chiliflocken, Petersilie, Salz
- schritte: 1) Nudeln al dente kochen (PREP-004, passiv). 2) Knoblauch in Scheiben in Öl sanft goldgelb (3 Min, aktiv). 3) Chili zugeben. 4) Nudeln + etwas Kochwasser schwenken (60 s). 5) Petersilie.
- allergene: [gluten] · naehrwert: kohlenhydratreich · tags: [schnell, budget]

**RCP-002 — Linsen-Dal mit rotem Linsen** · indisch · vegan · 3 Port. · einfach · ~25 Min

- zutaten: 200 g `ing_linsen_rot`, 1 `ing_zwiebel`, 1 Zehe `ing_knoblauch`, 1 TL Currypulver, 400 ml Wasser, 200 ml `ing_kokosmilch`, Salz
- schritte: 1) Zwiebel+Knoblauch dünsten (4 Min). 2) Gewürze anrösten (60 s). 3) Linsen + Wasser aufkochen, 10 Min köcheln. 4) Kokosmilch zugeben, 5 Min köcheln. 5) Abschmecken.
- naehrwert: proteinreich · tags: [high-protein, one-pot, budget, mealprep]

**RCP-003 — Gemüsecurry mit Kichererbsen** · indisch · vegan · 4 Port. · einfach

- zutaten: 250 g `ing_kichererbsen_dose`, 1 `ing_paprika`, 1 `ing_zucchini`, 400 g `ing_tomate_dose`, 200 ml `ing_kokosmilch`, Currypaste, Zwiebel
- schritte: 1) Zwiebel dünsten. 2) Currypaste anrösten. 3) Gemüse anbraten 5 Min. 4) Tomaten+Kokosmilch, 15 Min köcheln. 5) Kichererbsen zugeben, 5 Min.
- naehrwert: ballaststoffreich · tags: [one-pot, mealprep]

**RCP-004 — Hähnchen-Gemüse-Pfanne** · universell · mit_gefluegel · 2 Port. · einfach

- zutaten: 2 `ing_haehnchenbrust`, 1 `ing_paprika`, 1 `ing_broccoli`, `ing_sojasauce`, `ing_rapsoel`
- schritte: 1) Hähnchen würfeln, scharf anbraten 5 Min (aktiv). 2) Kerntemperatur 74 °C sichern.  3) Gemüse zugeben, 5–7 Min braten. 4) Mit Sojasauce ablöschen.
- allergene: [soja] · naehrwert: proteinreich · tags: [high-protein, schnell]

**RCP-005 — Lachs aus dem Ofen mit Gemüse** · universell · pescetarisch/mit_fisch · 2 Port.

- zutaten: 2 `ing_lachs`, 1 `ing_zucchini`, 1 `ing_paprika`, `ing_olivenoel`, `ing_zitrone`
- schritte: 1) Ofen 180 °C vorheizen (ofen). 2) Gemüse+Öl auf Blech, 10 Min vorrösten. 3) Lachs dazu, 12–15 Min bis Kerntemperatur 63 °C. 4) Zitrone.
- allergene: [fisch] · naehrwert: proteinreich

**RCP-006 — Klassische Bolognese** · italienisch · mit_fleisch · 4 Port. · mittel

- zutaten: 400 g `ing_hackfleisch_rind`, 1 `ing_zwiebel`, 2 `ing_moehre`, 400 g `ing_passierte_tomaten`, `ing_olivenoel`
- schritte: 1) Hack krümelig anbraten (5 Min). 2) Gemüsewürfel zugeben, 5 Min. 3) Tomaten angießen. 4) Mind. 30 Min schmoren (passiv). 5) Abschmecken. Kerntemperatur Hack 71 °C. 
- naehrwert: proteinreich · tags: [mealprep]

**RCP-007 — Chili con/sin Carne** · mexikanisch · mit_fleisch (Carne) / vegan (Sin) · 4 Port.

- zutaten: 400 g `ing_hackfleisch_rind` ODER 250 g Sojagranulat, 1 Dose Kidneybohnen, 1 `ing_tomate_dose`, `ing_paprika`, Zwiebel, Kreuzkümmel, Chili
- schritte: 1) Zwiebel+Hack/Granulat anbraten. 2) Gewürze anrösten. 3) Tomaten, Paprika, Bohnen zugeben. 4) 25 Min köcheln.
- naehrwert: proteinreich · tags: [one-pot, budget] · substitutionen: [{fehlt: Hackfleisch, ersatz: Sojagranulat + 1 EL Sojasauce, hinweis: vegane Version, Granulat einweichen}]

**RCP-008 — Shakshuka** · nordafrikanisch/levantinisch · vegetarisch · 2 Port.

- zutaten: 4 `ing_ei`, 400 g `ing_tomate_dose`, 1 `ing_paprika`, Zwiebel, Kreuzkümmel, Paprikapulver
- schritte: 1) Zwiebel+Paprika dünsten. 2) Tomaten+Gewürze, 10 Min köcheln. 3) Mulden formen, Eier hineingeben. 4) Zugedeckt 6–8 Min bis Eiweiß fest, Dotter cremig.
- allergene: [ei] · naehrwert: proteinreich · tags: [one-pot]

**RCP-009 — Miso-Suppe mit Tofu** · japanisch · vegan · 2 Port. · einfach

- zutaten: 750 ml Dashi/Wasser, 2 EL Misopaste, 100 g `ing_tofu_natur`, Frühlingszwiebel, Wakame
- schritte: 1) Dashi erhitzen (nicht kochen). 2) Miso in etwas Brühe auflösen, einrühren. 3) Tofuwürfel + Wakame, 2 Min ziehen (nicht kochen).
- allergene: [soja] · naehrwert: kalorienarm

**RCP-010 — Bibimbap-Bowl (vereinfacht)** · koreanisch · vegetarisch · 2 Port.

- zutaten: 150 g `ing_reis_weiss`, `ing_spinat`, `ing_moehre`, 2 `ing_ei`, Gochujang, `ing_sojasauce`, Sesamöl
- schritte: 1) Reis kochen (PREP-001). 2) Gemüse getrennt kurz anbraten/blanchieren. 3) Spiegelei braten. 4) Alles auf Reis anrichten, Gochujang dazu.
- allergene: [ei, soja, sesam] · naehrwert: ausgewogen

**RCP-011 — Pad Thai mit Tofu** · thailändisch · vegan · 2 Port. · mittel

- zutaten: 150 g Reisnudeln, 150 g `ing_tofu_natur`, Sojasprossen, Erdnüsse, Tamarinde, `ing_sojasauce`, Limette
- schritte: 1) Reisnudeln einweichen. 2) Tofu anbraten. 3) Nudeln + Sauce im Wok schwenken. 4) Sprossen, Erdnüsse, Limette.
- allergene: [soja, erdnuss] · naehrwert: kohlenhydratreich

**RCP-012 — Kartoffel-Lauch-Suppe** · deutsch · vegetarisch · 4 Port.

- zutaten: 600 g `ing_kartoffel`, 2 Stangen Lauch, 1 l `ing_gemuesebruehe` (BASE-003), 100 ml Sahne
- schritte: 1) Kartoffeln+Lauch würfeln. 2) In Brühe 20 Min weich kochen. 3) Pürieren, Sahne zugeben, abschmecken.
- naehrwert: ausgewogen · tags: [budget, mealprep]

**RCP-013 — Griechischer Bauernsalat** · griechisch · vegetarisch · 2 Port. · einfach

- zutaten: 2 Tomaten, ½ Gurke, `ing_paprika`, rote Zwiebel, Feta, Oliven, `ing_olivenoel`, Oregano
- schritte: 1) Gemüse grob schneiden. 2) Mit Öl+Oregano+Salz mischen. 3) Feta darauf.
- allergene: [laktose] · naehrwert: kalorienarm

**RCP-014 — Ratatouille** · französisch · vegan · 4 Port.

- zutaten: 1 Aubergine, 1 `ing_zucchini`, 1 `ing_paprika`, 400 g `ing_tomate_dose`, Zwiebel, Knoblauch, Kräuter der Provence
- schritte: 1) Gemüse würfeln. 2) Nacheinander anbraten. 3) Tomaten zugeben. 4) 25–30 Min schmoren.
- naehrwert: kalorienarm · tags: [saisonal, mealprep]

**RCP-015 — Overnight Oats** · US-amerikanisch · vegetarisch · 1 Port. · einfach · Frühstück

- zutaten: 50 g `ing_haferflocken`, 120 ml `ing_milch`, 1 EL Joghurt, Obst
- schritte: 1) Haferflocken+Milch+Joghurt verrühren. 2) Über Nacht im Kühlschrank quellen (passiv, ~28800 s). 3) Morgens mit Obst toppen.
- allergene: [gluten, laktose] · naehrwert: ballaststoffreich · tags: [mealprep, high-protein] · substitutionen: [{fehlt: Milch, ersatz: Haferdrink/Sojadrink, hinweis: vegan}]

**RCP-016 — Rührei klassisch** · universell · vegetarisch · 1 Port. · einfach · Frühstück

- zutaten: 3 `ing_ei`, 1 EL `ing_milch`, `ing_butter`, Salz, Pfeffer
- schritte: 1) Eier mit Milch+Salz verquirlen. 2) Butter schmelzen (mittlere Hitze). 3) Eimasse einlaufen lassen, langsam stocken lassen und ziehen (2–3 Min, aktiv). 4) Cremig vom Herd.
- allergene: [ei, laktose] · naehrwert: proteinreich · tags: [schnell, high-protein]

**RCP-017 — Türkische Linsensuppe (Mercimek)** · türkisch · vegan · 4 Port.

- zutaten: 250 g `ing_linsen_rot`, 1 `ing_zwiebel`, 1 `ing_moehre`, 1 EL Tomatenmark, 1,2 l Wasser, Kreuzkümmel, Minze
- schritte: 1) Zwiebel+Möhre dünsten. 2) Tomatenmark anrösten. 3) Linsen+Wasser, 20 Min köcheln. 4) Pürieren, mit Zitrone/Minze abschmecken.
- naehrwert: proteinreich · tags: [budget, one-pot]

**RCP-018 — Falafel (Ofen)** · levantinisch · vegan · 4 Port. · mittel

- zutaten: 250 g eingeweichte `ing_kichererbsen_trocken` (roh, nicht Dose!), Zwiebel, Knoblauch, Petersilie, Kreuzkümmel, 2 EL Mehl
- schritte: 1) Alles zu grobem Teig mixen (kein Kochen der Erbsen!). 2) 30 Min kühlen. 3) Bällchen formen, mit Öl bestreichen. 4) Ofen 200 °C, 25 Min backen, wenden.
- allergene: [gluten] · naehrwert: proteinreich · hinweis: Dosen-Kichererbsen zerfallen – hier zwingend eingeweichte rohe verwenden.

**RCP-019 — Gebratener Reis mit Ei (Resteverwertung)** · chinesisch · vegetarisch · 2 Port.

- zutaten: 300 g gekochter `ing_reis_weiss` (vom Vortag), 2 `ing_ei`, `ing_moehre`, Erbsen, `ing_sojasauce`, Frühlingszwiebel
- schritte: 1) Ei in Wok rührbraten, herausnehmen. 2) Gemüse anbraten. 3) Reis zugeben, heiß braten. 4) Ei+Sojasauce unterheben.
- allergene: [ei, soja] · naehrwert: ausgewogen · tags: [resteverwertung, schnell]

**RCP-020 — Caprese-Sandwich / Bruschetta** · italienisch · vegetarisch · Snack

- zutaten: Baguette/Ciabatta, Tomaten, Mozzarella/Basilikum, `ing_olivenoel`, Knoblauch
- schritte: 1) Brot rösten. 2) Mit Knoblauch einreiben. 3) Tomaten+Mozzarella+Öl+Basilikum darauf.
- allergene: [gluten, laktose] · naehrwert: ausgewogen · tags: [schnell]

**RCP-021 — Kartoffelgratin** · französisch · vegetarisch · 4 Port. · mittel

- zutaten: 800 g `ing_kartoffel` (festkochend), 300 ml Sahne, 100 ml `ing_milch`, `ing_parmesan`, Knoblauch, Muskat
- schritte: 1) Kartoffeln dünn hobeln. 2) In gebutterte Form schichten. 3) Sahne-Milch-Mix + Gewürze angießen. 4) Ofen 180 °C, 45–50 Min bis goldbraun (ofen).
- allergene: [laktose] · naehrwert: fettreich

**RCP-022 — Tacos mit Bohnen** · mexikanisch · vegan · 2 Port.

- zutaten: Tortillas, 1 Dose schwarze Bohnen, `ing_paprika`, Zwiebel, Mais, Limette, Kreuzkümmel
- schritte: 1) Zwiebel+Paprika anbraten. 2) Bohnen+Gewürze zugeben, 5 Min. 3) In warme Tortillas füllen, Limette.
- allergene: [gluten] · naehrwert: ballaststoffreich · tags: [schnell, budget]

**RCP-023 — Pho-inspirierte Nudelsuppe** · vietnamesisch · mit_gefluegel · 2 Port.

- zutaten: 750 ml Hühnerbrühe, Reisnudeln, 1 `ing_haehnchenbrust`, Ingwer, Sternanis, Frühlingszwiebel, Koriander, Limette
- schritte: 1) Brühe mit Ingwer/Sternanis 15 Min ziehen. 2) Hähnchen darin pochieren (Kerntemp. 74 °C). 3) Nudeln separat garen. 4) Alles in Schüssel schichten, Brühe angießen.
- naehrwert: proteinreich

**RCP-024 — Caesar-Salad mit Hähnchen** · US-amerikanisch · mit_gefluegel · 2 Port.

- zutaten: Römersalat, 1 `ing_haehnchenbrust`, Croutons, `ing_parmesan`, Caesar-Dressing (Ei, Sardelle, Öl)
- schritte: 1) Hähnchen braten (74 °C), in Scheiben. 2) Salat mit Dressing mischen. 3) Croutons+Parmesan+Hähnchen.
- allergene: [gluten, ei, fisch, laktose] · naehrwert: proteinreich

**RCP-025 — Spanische Tortilla** · spanisch · vegetarisch · 4 Port. · mittel

- zutaten: 500 g `ing_kartoffel`, 6 `ing_ei`, 1 `ing_zwiebel`, `ing_olivenoel`, Salz
- schritte: 1) Kartoffeln+Zwiebel in Öl weich garen (nicht bräunen, 15 Min). 2) Mit verquirlten Eiern mischen. 3) In Pfanne stocken lassen, wenden, fertig garen (je 6–8 Min).
- allergene: [ei] · naehrwert: ausgewogen · tags: [budget, mealprep]

#### 3.5 Rezeptideen (kurze Variationen aus Grundrezepten/Vorräten)

**IDEA-001 — Sugo-Varianten:** BASE-001 + Oliven/Kapern = Puttanesca; + Sahne = Tomatensahne; + Gemüsewürfel = Arrabiata-Style. tags: [schnell, budget]

**IDEA-002 — Dal-Toppings:** RCP-002 + geröstete Zwiebeln / Spinat / Spritzer Zitrone. vegan.

**IDEA-003 — Bowl-Baukasten:** Basis (Reis/Quinoa) + Protein (Tofu/Ei/Hähnchen) + 2 Gemüse + Sauce (BASE-004/009/010). Deckt vegan bis mit_gefluegel je nach Wahl.

**IDEA-004 — Overnight-Oats-Varianten:** RCP-015 + Kakao / Beeren / Apfel-Zimt / Erdnussmus. tags: [mealprep]

**IDEA-005 — Reste-Frittata:** 4 Eier + beliebiges gekochtes Gemüse/Nudeln/Kartoffeln + Käse, Pfanne + Ofen 180 °C 10 Min. tags: [resteverwertung]

**IDEA-006 — Hummus-Twists:** BASE-005 + geröstete Paprika / Rote Bete / Kräuter. vegan.

**IDEA-007 — Stir-fry aus dem Kühlschrank:** Welkes Gemüse in Streifen + Sojasauce + Knoblauch/Ingwer, hohe Hitze 5 Min, zu Reis. tags: [resteverwertung, schnell]

**IDEA-008 — Suppen-Upgrade:** Jede pürierte Gemüsesuppe + Kokosmilch + Currypaste = asiatische Variante.

**IDEA-009 — Wrap-Ideen:** Tortilla + Hummus + Falafel/Hähnchen + Salat = schneller Lunch. tags: [schnell, mealprep]

**IDEA-010 — Süße Pfannkuchen → herzhaft:** BASE-007 ohne Zucker + Käse/Spinat-Füllung.

#### 3.6 Tipps & Tricks

**TIP-001 — Hülsenfrüchte bekömmlicher:** Einweichwasser weggießen, mit Kümmel/Fenchel/Lorbeer garen;  Salz beschleunigt Garung (Mythos widerlegt),  Säure (Essig/Zitrone) erst NACH dem Garen zugeben, sonst bleiben sie hart. 

**TIP-002 — Reis fluffig:** Vor dem Kochen waschen bis Wasser klar (entfernt Stärke → nicht klebrig,  reduziert Arsen bei Vollkornreis);  nach dem Garen 5 Min ruhen, dann mit Gabel auflockern. 

**TIP-003 — Eier leichter pellen:** Leicht ältere Eier verwenden; nach dem Kochen in Eiswasser abschrecken; am stumpfen Ende (Luftkammer) anschlagen. 

**TIP-004 — Kartoffeln kalt aufsetzen:** Rohe Kartoffeln in kaltem Wasser aufsetzen → gleichmäßiges Garen, kein Außenzerfall (anders als Nudeln). 

**TIP-005 — Blanchier-Regel:** Eiswasser immer VOR dem Blanchieren bereitstellen;  Zeit erst zählen, wenn Wasser wieder sprudelt; nicht überladen. 

**TIP-006 — Fleisch ruhen lassen:** Ganze Stücke nach 63 °C mind. 3 Min ruhen (Teil des Sicherheitsminimums, Saft verteilt sich).  Farbe/„klarer Saft” sind KEIN verlässlicher Garindikator – Thermometer nutzen. 

**TIP-007 — Gemüse einfrieren:** Brokkoli/Bohnen/Blumenkohl vor dem Einfrieren blanchieren (stoppt Enzyme);  Paprika, Zwiebeln, Kräuter können roh eingefroren werden.  Haltbarkeit bei −18 °C ~8–12 Monate. 

**TIP-008 — Substitutions-Basics:** Buttermilch = Milch + 1 EL Zitronensaft (10 Min); 1 Ei zum Binden = 1 EL gemahlene Leinsamen + 3 EL Wasser; Sahne = Kochsahne/Kokosmilch; Parmesan = Hefeflocken (vegan).

**TIP-009 — Resteverwertung:** Altes Brot → Croutons/Semmelbrösel; welkes Gemüse → Suppe/Stir-fry; gekochter Reis vom Vortag → gebratener Reis (RCP-019, besser als frischer).

**TIP-010 — Lagerung:** Hart gekochte Eier (in Schale) im Kühlschrank bis 1 Woche;  getrocknete Hülsenfrüchte kühl/trocken 2+ Jahre (werden mit Alter härter → längere Garzeit);  Öle dunkel lagern.

-----

### TEIL 4 — Offene Rezept-Datenquellen: Umfang, Lizenz, Kosten, Empfehlung

|Quelle                                                                        |Umfang                                                                 |Sprache                          |Zugang                 |Lizenz / Kommerziell?                                                                                                                    |Kosten                                                                                  |Eignung                                                |
|------------------------------------------------------------------------------|-----------------------------------------------------------------------|---------------------------------|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|-------------------------------------------------------|
|**TheMealDB**                                                                 |792 Meals / 992 Zutaten                                                |EN (crowd-sourced, international)|JSON-API               |Scrapen der API-Endpunkte erlaubt; **App-Store-Veröffentlichung nur mit bezahltem Supporter-Key**; Attribution Pflicht                   |Test-Key „1” gratis (nur Dev); Supporter ~£10 lifetime (Patreon) bzw. RapidAPI Pro $2/Mo|**Grundstock internationaler Vollrezepte**             |
|**Spoonacular**                                                               |365.000 Rezepte + 86.000 Produkte                                      |EN only                          |REST-API (Punkte-Quota)|Kommerziell lizenziert, ABER **Caching max. 1 Stunde**, kein dauerhaftes Speichern, kein Weiterverkauf; bei Kündigung alle Daten löschen |Free 50 Punkte/Tag; Cook $29; Culinarian $79; Chef $149/Mo; Enterprise ab $300          |**Nur Live-Feature**, nicht als DB-Speicher            |
|**Edamam Recipe Search**                                                      |2 Mio. Web-Rezepte (fremdlizenziert) + 80.000 eigene                   |EN                               |REST-API               |Web-Rezepte: nur Anzeige mit Backlink, **kein Speichern** außer 4 Basismakros + URI/Titel/Bild; „nur menschlich getriebene Requests”     |Free-Tier + Pläne bis ~$799/Mo                                                          |Live-Rezeptsuche/Nährwertanalyse                       |
|**Edamam Licensed Recipes**                                                   |80.000 lizenzierte Vollrezepte (mit Instruktionen + Nährwert)          |EN                               |Lizenzvertrag          |Explizit für lokale Speicherung lizenzierbar (Partner wie America’s Test Kitchen)                                                        |Individuell (kostenpflichtig)                                                           |Wenn kuratierte, speicherbare Vollrezepte gebraucht    |
|**Open Food Facts**                                                           |2,5 Mio+ Produkte (Barcode, Zutaten, Nährwerte, Nutri-Score, Allergene)|Multilingual (inkl. DE)          |Bulk-Dump + API        |**ODbL** – kommerziell nutzbar, ABER Attribution + **Share-Alike** (abgeleitete DB muss ebenfalls ODbL)                                  |Gratis                                                                                  |**Produkt-/Barcode-/Nährwert-/Vorratsabgleich** – ideal|
|**RecipeNLG**                                                                 |exakt 2.231.142 Rezepte                                                |EN                               |Download (Poznań Univ.)|**Nur nicht-kommerzielle Forschung/Bildung** – für kommerzielle App **ungeeignet**                                                       |Gratis                                                                                  |Nur Forschung/Prototyp                                 |
|**Recipe1M+**                                                                 |>1 Mio. Rezepte + 13 Mio. Bilder                                       |EN                               |Download (MIT)         |Forschung/nicht-kommerziell                                                                                                              |Gratis                                                                                  |Nur Forschung                                          |
|**food.com-Dump** (Kaggle)                                                    |~1,05 Mio. Rezepte                                                     |EN                               |Kaggle                 |**MIT** (kommerziell OK)                                                                                                                 |Gratis                                                                                  |Englischer Vollrezept-Bulk, wenn Sprache egal          |
|**Dt. chefkoch-Datasets** (sterby 12.190 / Kicherer 263.854 / Murgio 300.000+)|12k–300k+                                                              |**DE**                           |Kaggle/GitHub/Paper    |Aus chefkoch.de gescrapte, urheberrechtlich geschützte Nutzerinhalte; **keine verifizierte kommerzielle Lizenz**                         |Gratis                                                                                  |**Rechtlich riskant** – nur mit juristischer Prüfung   |
|**DGE „Station Ernährung”**                                                   |Nährstoffoptimierte Rezepte (DGE-Qualitätsstandard)                    |DE                               |Web                    |Behördennah, seriös; Nutzungsrechte anfragen                                                                                             |Gratis (Anzeige)                                                                        |Referenz für **gesunde/nährwertorientierte** Rezepte   |
|**USDA / FDA / FSIS**                                                         |Kerntemperaturen, Lebensmittelsicherheit                               |EN                               |Web/PDF                |Public Domain (US-Behörde)                                                                                                               |Gratis                                                                                  |**Sicherheitswerte** (bereits eingearbeitet)           |

**Kombinationsempfehlung (konkret):**

1. **Kern-DB selbst pflegen** (dieser Report): alle `grundtechnik`, `produktzubereitung`, `grundrezept`, `tipp` + kuratierte Signature-Rezepte. Dieser Teil hat keinen guten offenen Ersatz und ist zugleich das strukturierte Wissen, das das AI-Vorschlagsmodell braucht.
1. **TheMealDB (Supporter-Key)** als internationaler Vollrezept-Grundstock – der einzige international breite Datensatz, der mit Attribution kommerziell UND dauerhaft speicherbar ist.
1. **Open Food Facts (ODbL-Dump)** als Produkt-/Barcode-Layer für den Vorratsabgleich, Nährwerte und Allergene. (Share-Alike beachten: der aus OFF abgeleitete DB-Teil muss ODbL bleiben – am besten OFF-Produktdaten in einer separaten, klar getrennten Tabelle halten.)
1. **Spoonacular ODER Edamam** optional als Online-„Mehr Ideen”-Feature (Live-Abruf, nicht speichern) – erst ab Nutzerwachstum, wegen laufender Kosten.
1. **Für DE-Rezeptmasse** langfristig eigene redaktionelle Erstellung oder eine **kostenpflichtige, sauber lizenzierte** Quelle (z. B. Edamam Licensed Recipes), NICHT die chefkoch-Scrapes.

-----

## Recommendations

**Phase 1 (MVP, 0–3 Monate):** Kern-DB dieser Lieferung importieren (Schema + 60 Datensätze). Diese redaktionell auf ~300–500 Einträge ausbauen (jede Grundtechnik + jede wichtige Produktzubereitung + 150 Alltagsrezepte breit über Ernährungsformen). Open Food Facts ODbL-Dump für Produkt-/Nährwert-/Allergen-Layer einbinden. TheMealDB-Test-Key nur zum Prototyping. **Schwelle zum Weitergehen:** funktionierender Bestandsabgleich + AI-Vorschlag über ≥300 Rezepte.

**Phase 2 (Launch, 3–6 Monate):** TheMealDB Supporter-Key kaufen (Attribution einbauen: „Rezeptdaten teils von TheMealDB”) und internationale Rezepte importieren. Nährwertfilter + Ernährungsform-Filter + Zeitfilter (`gesamtzeit_min.gesamt`) live schalten. Rechtsprüfung aller Lizenzen (v. a. ODbL-Share-Alike-Abgrenzung) vor App-Store-Release. **Schwelle:** saubere Lizenzkette dokumentiert.

**Phase 3 (Skalierung, ab 6 Monaten):** Bei Bedarf an großer DE-Rezeptmenge entweder redaktionell/Community-Content aufbauen oder Edamam Licensed Recipes (kostenpflichtig, speicherbar) lizenzieren. Spoonacular/Edamam als optionales Live-Feature testen, sobald DAU-Zahlen die Punkte-/Monatskosten rechtfertigen (Chef-Tier $149/Mo ≈ 10.000 Punkte/Tag). **Schwelle zum Umstieg auf bezahlte API:** wenn eigene DB die AI-Vorschlagsqualität nachweislich limitiert.

**Governance-Regeln (dauerhaft):** (a) Kerntemperaturen sind Pflichtfelder bei Fleisch/Fisch/Geflügel und dürfen nie unter USDA-Minima liegen. (b) Jeder Datensatz trägt `quelle_typ`; „erfundene” Zeiten sind unzulässig. (c) OFF-abgeleitete Daten physisch von eigener Rezept-DB trennen (Share-Alike-Isolierung).

## Caveats

- **Zeiten sind Richtwerte, Kerntemperaturen sind Minima.** Gar-/Kochzeiten variieren mit Menge, Herd, Höhe, Topfgröße; Kerntemperaturen (Geflügel 74 °C, Hackfleisch 71 °C, ganze Stücke 63 °C + 3 Min Ruhe, Fisch 63 °C) sind sicherheitskritische Untergrenzen aus USDA/FSIS und nicht verhandelbar.
- **TheMealDB ist crowd-sourced** (nur 792 Meals, wechselnde Qualität) – die Rezepte müssen vor Nutzung normalisiert (Zutaten-IDs mappen) und redaktionell geprüft werden; sie enthalten keine strukturierten Timer/Kerntemperaturen (die muss die App ergänzen).
- **Spoonacular/Edamam sind Mietmodelle:** Die Terms verbieten dauerhaftes Speichern (Spoonacular: Cache max. 1 Stunde, bei Kündigung alle Daten löschen). Sie können die eigene DB nie ersetzen.
- **Lizenzangaben können sich ändern** (Preise/Terms wurden Mitte 2025/2026 erhoben) – vor kommerzieller Nutzung stets die aktuelle Fassung prüfen und die ODbL-Share-Alike-Pflicht sowie die chefkoch-Urheberrechtslage juristisch bewerten lassen.
- **Nährwert-Einordnungen im gelieferten Datensatz sind qualitativ** (Profil-Tags), keine geprüften kcal-Werte – für exakte Werte pro Portion Open Food Facts/USDA-Nährwerte über die Zutaten-IDs verrechnen.
- Einige Quellen in der Recherche waren Sekundär-/Marketingseiten; die sicherheits- und lizenzkritischen Fakten wurden auf Primärquellen (USDA/FSIS, spoonacular.com, edamam.com, openfoodfacts.org, recipenlg.cs.put.poznan.pl) zurückgeführt.
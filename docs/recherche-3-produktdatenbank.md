# Deep-Research-Bericht: Aufbau einer Produktdatenbank für Max Kruggels Vorrats- & Rezept-App (2. Lauf)

## TL;DR

- **Der schnellste, rechtssicherste Weg zum Produktkatalog ist der Open-Food-Facts-Dump (ODbL, kostenlos) als Basis, gefiltert auf „sold in Germany” (407.907 Produkte laut Live-Zähler von de.openfoodfacts.org), ergänzt um den seit Ende 2025 kostenlosen Bundeslebensmittelschlüssel (BLS 4.0) für generische Nährwerte von loser Ware — und Barcode-Scan als Primär-Identifikation in der App.**
- **Discounter-Eigenmarken (Aldi/Penny/Netto) sind der kritische Schwachpunkt jeder offenen Datenquelle; sie lassen sich am besten über einen eigenen In-App-Scan-Flow („fehlt → Nutzer fotografiert → speichern + optional an OFF zurückspielen”) sowie über die inoffiziellen Händler-APIs (REWE, Picnic) nach und nach schließen.**
- **Foto-Identifikation: Barcode zuerst (ZXing/ML Kit nativ, html5-qrcode/zxing-wasm im Web, VisionKit auf iOS); Bilderkennung von loser Ware (Obst/Gemüse) nur als Fallback über ein eigenes Vision-Modell/Cloud-Vision, gestützt auf den offenen OFF-Bilddatensatz auf AWS.**

## Key Findings

1. **Open Food Facts (OFF) ist die einzige realistische offene Basis.** Weltweit ~4,65 Mio. Produkte (Live-Homepage), davon **407.907** als „in Deutschland verkauft” markiert. Lizenz: ODbL (Datenbank) + DbCL (Inhalte) + CC-BY-SA (Bilder). Vollständige Dumps (MongoDB, JSONL, CSV, Parquet) kostenlos, nächtlich aktualisiert. Der API-Weg ist ausdrücklich nur für Einzel-Scans gedacht — für den Katalog-Aufbau ist der Dump zu nutzen.
1. **Datenqualität in Deutschland ist mittelmäßig-lückenhaft:** Stand Nov 2024 hatten nur 36 % der DE-Produkte einen Nutri-Score, 28 % eine NOVA-Bewertung; die Rohdatenqualität lag bei 97,9 %. Nährwerte fehlen bei vielen Einträgen teilweise.
1. **Markenartikel sind gut, Discounter-Eigenmarken mittelmäßig abgedeckt.** Weltweite Marken-Tag-Zahlen in OFF: Milbona (Lidl) ~3.549,  Ja! (Rewe) ~3.562, Gut & Günstig (Edeka) ~3.167, Aldi (Sammel-Tag) ~12.828, Penny ~5.261, Netto ~2.760, Milsani (Aldi) ~1.258. **Wichtig:** Die auf Deutschland gefilterten Marken-Tags sind deutlich kleiner und stark fragmentiert (z. B. „edeka” 359, „gut-gunstig” 110, „lidl” 109, „Milbona” 72, „milsani” 78) — d. h. die Marken-Zuordnung in OFF ist uneinheitlich und muss bei der Aufbereitung normalisiert werden. Für Gut Bio und Rio D’Oro (Aldi) ließ sich keine belastbare Gesamtzahl finden.
1. **Sortimentsgrößen:** Discounter (Aldi Süd ~1.800 Stammartikel; Discounter-Schnitt ~2.500) sind klein und eigenmarkenlastig (rund 90 % Eigenmarke bei Aldi); Vollsortimenter (Edeka/Rewe) führen 12.000–60.000 Artikel. Picnic (online, Edeka-nah) führt >10.000 Artikel.
1. **Inoffizielle Händler-APIs existieren** für REWE (mobile-api, mTLS-Zertifikat nötig) und Picnic (mehrere Community-Clients, DE unterstützt) — nützlich zur gezielten Anreicherung, aber rechtlich Grauzone und technisch fragil.
1. **Barcode-Scanning ist ein gelöstes Problem**; Bilderkennung loser Ware ist der einzige echte technische Zusatzaufwand.

## Details

### 1. Datenquellen-Landschaft

#### Open Food Facts (OFF) — **klare Nr. 1**

- **Umfang:** weltweit ~4,65 Mio. Produkte (Live-Homepage). Deutschland: **407.907 Produkte** laut Live-Zähler der deutschen Startseite (de.openfoodfacts.org: „search 407.907 Produkte”). Zum Vergleich lag der Wert im Nov 2024 laut OFF-Wiki bei ~250.000 — also starkes Wachstum.
- **Felder:** GTIN/EAN (`code`), `product_name`, `generic_name`, `brands`, `quantity` (Packungsgröße), `categories`, Nährwerte je 100 g/ml und je Portion (`nutriments`, Felder mit `_100g`/`_serving`), `ingredients_text`, `allergens`, `nutriscore_grade`/`nutriscore_data`, NOVA, `labels` (bio/vegan), `stores` (Händler!), `countries`, Bild-URLs. Nährwerte-Handling ist komplex (kJ/kcal, salt vs. sodium, per 100g/serving/prepared) — dokumentiert im OFF-Wiki („Nutrients handling in Open Food Facts”).
- **Zugang:** komplett offen, kein API-Key. Dumps:
  - MongoDB-Dump: `https://static.openfoodfacts.org/data/openfoodfacts-mongodbdump.gz`
  - JSONL: `https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz`
  - CSV: `https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz` (komprimiert ~0,9 GB / entpackt ~9 GB)
  - Parquet auf Hugging Face: `https://huggingface.co/datasets/openfoodfacts/product-database`
  - Tägliche Delta-Exporte für 14 Tage; Feld-Doku: `https://static.openfoodfacts.org/data/data-fields.txt`; API-Doku: `https://openfoodfacts.github.io/openfoodfacts-server/api/`
- **Lizenz:** ODbL 1.0 (Datenbank), DbCL 1.0 (Einzelinhalte), Bilder CC-BY-SA 3.0. Attribution und Share-Alike Pflicht.
- **Pflegezustand:** aktiv, nächtliche Dumps; Crowdsourcing, daher Lücken v. a. bei Discounter-Eigenmarken und Nährwertvollständigkeit.
- **Wichtig:** OFF blockt Scraping über die Live-API; „1 API call = 1 real scan by a user”. Für Bulk immer Dump nutzen.

#### Bundeslebensmittelschlüssel (BLS 4.0) — **beste amtliche Nährwertquelle, jetzt kostenlos**

- Nationale Nährstoffdatenbank des Max Rubner-Instituts (MRI). Version 4.0: **genau 7.140 Lebensmittel mit 138 Nährstoffen **, reduziert von zuvor 14.814 Einträgen (laut blsdb.de: „Die Reduktion von 14.814 auf 7.140 Einträge ist das Ergebnis einer systematischen, wissenschaftlich fundierten Bereinigung.”). **Ende 2025 als Version 4.0 erstmals lizenzfrei/kostenlos veröffentlicht** (zuvor Server-Lizenz ~2.000 €/Jahr); frei verfügbar über MRI/BMLEH.
- **Stärke:** laborbasierte Durchschnittswerte, ideal für generische/lose Ware (Obst, Gemüse, Fleisch) ohne Barcode und ohne Herstellerangaben. Enthält komplexe Rezept-/Berechnungsalgorithmen zur Nährstoffschätzung. Zugang: `https://blsdb.de/bls`.
- **Schwäche:** keine GTINs, keine konkreten Handelsprodukte/Marken, keine Bilder.

#### GS1 Germany / Verified by GS1 / GTIN-Registry

- Verified by GS1 verifiziert GTINs und liefert Kern-Attribute (Markenname, Produktbeschreibung, Bild, GPC-Klassifikation, Nettoinhalt, Verkaufsland). Zugang für Massenabfragen nur mit Key/Mitgliedschaft; Web-Suche max. ~30 Abfragen/Tag gratis (GS1 US).  Nicht als Massen-Nährwertquelle geeignet, aber gut zur GTIN-Validierung/Marken-Zuordnung. (`https://www.gs1.org/services/verified-by-gs1`)

#### Barcode-Lookup-APIs (kommerzielle Anreicherung)

- **EAN-Search.org:** >1,2 Mrd. Barcodes, REST-API  (JSON/XML), Key nötig, kostenpflichtig, Bulk-/Teil-Dumps möglich.  Doku: `https://www.ean-search.org/ean-api-intro.html`. Fokus Name/Marke, kaum Nährwerte.
- **Barcode Lookup (barcodelookup.com):** >1,2 Mrd. Produkte, API + Bulk-CSV, Name/Kategorie/Bilder/Preise.  Doku: `https://www.barcodelookup.com/api`.
- **EAN-DB:** Bulk/Teil-Dumps zu Pauschale ~0,005 €/Barcode (`https://ean-db.com/`). 
- **Digit-Eyes:** UPC/EAN-DB (Eigenangabe >35 Mio.; Drittquelle nennt bis 331 Mio. Records),  XML/CSV-API, Key/kostenpflichtig (`http://www.digit-eyes.com/`).
- **OpenGTINDB (opengtindb.org):** offen, aber unvollständig/veraltet — nur als Notnagel.
- **CodeCheck:** laut eigener Angabe >40 Mio. Produkte, deutschsprachig, Nährwerte/Inhaltsstoffe;  Produktdaten-API kommerziell (`https://corporate.codecheck.info/produkte/produktdaten-api/`). Firma war zwischenzeitlich insolvent (Käufer gefunden) — Kontinuitätsrisiko.
- **fddb.info:** >230.000 Lebensmittel inkl. Mikronährstoffe; primär Kalorientabelle/Ernährungstagebuch, keine offene Bulk-Lizenz — für Nachschlagen brauchbar, nicht als lizenzfreie DB-Basis.

#### Händler-Onlineshops & inoffizielle APIs

- **REWE:** inoffizielle Community-Clients (`ByteSizedMarius/rewerse-engineering` in Go, `torbenpfohl`-Fork in Python, `yannick-cw/korb`). Seit März 2024 Cloudflare-mTLS → Zertifikat + Key aus der APK nötig.  Endpunkte für Produkte/Preise/Angebote je Markt-ID; Suche auch per EAN.  Zudem tägliche Preis-CSV-Repos (inkl. EAN, Grammatur, Bild) auf GitHub.
- **Picnic:** mehrere inoffizielle Wrapper (`MikeBrink/python-picnic-api`, `MRVDH/picnic-api` in Node — `countryCode: "DE"` unterstützt, Basis-URL `storefront-prod.de.picnicinternational.com/api/<version>`). Liefert Suche, Artikel (Name, Preis, Menge, image_id), benötigt Login/2FA. Sortiment >10.000 Artikel,  Edeka-nah (Gut & Günstig); Edeka Rhein-Ruhr hält 35 % an der Picnic-Deutschland-Gesellschaft.
- **Aldi/Penny/Edeka/Bringmeister:** keine stabilen offenen APIs gefunden; Prospekt-/Onlineshop-Scraping wäre nötig (rechtlich Grauzone, s. u.).
- Alle inoffiziellen APIs: **rechtliche/ToS-Grauzone, technisch fragil (brechen bei App-Updates)** — nur zur ergänzenden Anreicherung, nie als alleinige Basis.

### 2. Sortimente & Eigenmarken

|Händler           |Sortimentsgröße                       |Zentrale Eigenmarken                                                         |OFF-Abdeckung (weltweiter Marken-Tag)                                           |
|------------------|--------------------------------------|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------|
|Aldi Süd          |~1.800 Stammartikel (~90 % Eigenmarke)|Milsani, Gut Bio, Rio D’Oro, Tandil (Non-Food)                               |Aldi-Tag ~12.828; Milsani ~1.258; Gut Bio/Rio D’Oro nicht sicher quantifizierbar|
|Aldi Nord         |ähnlich klein, eigenmarkenlastig      |Milsani, Gut Bio                                                             |s. o.                                                                           |
|Discounter-Schnitt|~2.500 (Statista: 2.000–3.500)        |—                                                                            |—                                                                               |
|Rewe              |~12.000 (bis 60.000 im Center)        |ja!, REWE Beste Wahl, REWE Bio, REWE Feine Welt, REWE frei von, REWE Regional|rewe ~4.756; ja ~3.562; rewe-beste-wahl ~2.591; rewe-bio ~654                   |
|Edeka             |12.000–60.000                         |Gut & Günstig, EDEKA Bio, Naturgut                                           |edeka ~4.789; gut-gunstig ~3.167                                                |
|Penny             |Discounter-Größe                      |Penny-Eigenmarken (Rewe-Group)                                               |penny ~5.261                                                                    |
|Picnic            |>10.000 online                        |Edeka-Eigenmarken (Gut & Günstig)                                            |keine eigene Picnic-Marke                                                       |

Angaben laut Dr. Web unter Berufung auf Smhaggle-Gründer Sven Reuter (Aldi Süd „rund 1.800 Stammartikel”, Discounter-Schnitt „rund 2.500 Produkte”, Edeka-Center „12.000 bis 60.000 Artikel”) und „Analysen der Harvard Business School und mehrerer Branchenstudien” (~90 % Privatlabel bei Aldi; Aldi Süd nennt selbst ~85 %, Aldi Nord ~87 %).

- **Kernaussage:** Marken-Artikel und die großen Vollsortimenter-Eigenmarken (G&G, ja!, REWE Beste Wahl) sind in OFF ordentlich vertreten. Discounter-Eigenmarken sind lückenhaft und die Nährwert-/Kategorievollständigkeit ist schwächer. Das Basis-Sortiment ist über alle Händler weitgehend identisch  (gleiche Hersteller) — d. h. viele physische Discounter-Produkte entsprechen einem GTIN, der ggf. schon als Markenprodukt in OFF existiert. Die OFF-Marken-Tags sind zudem fragmentiert (mehrere Schreibweisen desselben Labels) und müssen beim Import normalisiert werden.

### 3. Schema-Empfehlung Produktdatenbank

Empfohlene Kern-Tabelle `products` (ein Datensatz je GTIN):

- `gtin` (EAN-13, PK, normalisiert — führende Nullen beachten)
- `product_name`, `generic_name`
- `brand`, `brand_owner`
- `quantity_value` + `quantity_unit` (z. B. 500 / g) und `net_content`
- `category` (Warengruppe; OFF-Taxonomie oder GPC)
- Nährwerte je 100 g/ml: `energy_kj`, `energy_kcal`, `fat`, `saturated_fat`, `carbohydrates`, `sugars`, `fiber`, `proteins`, `salt` (+ optional `_serving` und `serving_size`)
- `ingredients_text`, `allergens` (strukturiert), `traces`
- `nutriscore_grade`, `nova_group`, `labels` (bio/vegan/…)
- `image_front_url`, `image_nutrition_url`, `image_ingredients_url`
- `data_source` (off/bls/rewe/picnic/user), `last_modified`, `data_quality_flag`

Umgang mit Varianten & Duplikaten:

- **Mehrere Größen = mehrere GTINs** → separate `products`-Zeilen, verknüpft über eine `product_group_id` (gleiches Produkt, verschiedene Gebinde). Packungsgröße bleibt eigenes Feld.
- **Händlerübergreifende Verfügbarkeit:** n:m-Tabelle `product_availability` (`gtin`, `retailer`, `price optional`, `store_brand_flag`) statt Duplikaten je Händler.
- **Lose Ware ohne GTIN:** eigener Namensraum (interne IDs, wie OFF sie mit Präfix „200” vergibt), Nährwerte aus BLS.
- **Restricted-Circulation-Codes (20…‑Barcodes):** als „mehrdeutig” markieren — dieselbe Nummer kann bei verschiedenen Händlern verschiedene Produkte sein  (OFF weist explizit darauf hin, z. B. bei „Bio Sauerkraut – Natur Gut”, Barcode 20513146).

### 4. Foto-/Barcode-Identifikation

**Primärweg Barcode-Scan (deckt praktisch alle verpackten Produkte ab):**

- **Web/HTML:** `html5-qrcode` (auf ZXing-js basierend,  fertige UI, aber ZXing-js/html5-qrcode gelten inzwischen als unmaintained) oder moderner `zxing-wasm` bzw. die native `BarcodeDetector`-API (Chrome/Edge/Safari 17+, nicht Firefox). 
- **iOS:** Apple **VisionKit**/AVFoundation (nativ, schnell; liest UPC-A als EAN-13). 
- **Cross-Platform/Flutter:** `mobile_scanner` (ML Kit auf Android, Apple Vision auf iOS, ZXing/zxing-wasm im Web)  — beste Wahl bei einer plattformübergreifenden App.
- **Android nativ:** ZXing (Apache-2.0, Maintenance-Mode)  oder Google ML Kit (kostenlos, on-device, nicht open source). 
- Unterstützte Symbologien decken EAN-13/EAN-8/UPC problemlos ab.

**Fallback Bilderkennung (lose Ware ohne Barcode: Obst, Gemüse, Backwaren):**

- Eigenes Klassifikationsmodell für eine begrenzte Zahl von Kategorien (praktikabler als generische Produkterkennung). Trainingsdaten: **OFF-Bilddatensatz auf AWS** (>6,7 Mio. Verpackungsbilder + OCR,  CC-BY-SA, S3-Bucket `openfoodfacts-images`, Region eu-west-3; Doku `https://openfoodfacts.github.io/openfoodfacts-server/api/aws-images-dataset/`).
- OFFs eigenes KI-System **Robotoff** nutzt Objekt-/Logo-Erkennung (CLIP-Embeddings + KNN via Elasticsearch, Triton-Objektdetektion) und Google-Cloud-Vision-OCR  — als Referenzarchitektur brauchbar; die Logo-Erkennung könnte perspektivisch Marken auf Verpackungen erkennen.
- Für Verpacktes ohne Treffer: OCR der Nährwerttabelle (wie Robotoff) + Nutzerbestätigung.

### 5. Praktischer Aufbauweg (empfohlene Pipeline)

1. **OFF-Dump laden** (JSONL oder Parquet). Parquet + DuckDB ist der effizienteste Weg — man selektiert nur benötigte Spalten. Größenordnung: CSV entpackt ~9 GB weltweit; nach DE-Filter deutlich kleiner.
1. **Filtern** auf `countries_tags` enthält `en:germany` → ~407.907 Produkte. Optional zusätzlich auf `stores` (rewe/edeka/aldi/penny/picnic) für einen fokussierten Erstkatalog.
1. **In SQLite/JSON überführen** nach obigem Schema; nur relevante Felder. SQLite eignet sich für lokale In-App-DB (offline-fähig), größere Backends eher Postgres. Marken-Tags dabei normalisieren (Fragmentierung).
1. **Nährwert-Lücken schließen:** für lose/generische Ware BLS 4.0 einspielen (kostenlos); für verpackte Ware ohne Nährwerte optional gezielte Barcode-API-Abfragen.
1. **Discounter-Eigenmarken anreichern** über (a) eigenen In-App-Scan-Flow (Nutzer scannt/fotografiert fehlendes Produkt → lokal speichern, optional an OFF zurückspielen) und (b) punktuell inoffizielle REWE-/Picnic-Clients.
1. **Update-Strategie:** OFF-Delta-Exporte (14 Tage) regelmäßig einspielen; Voll-Dump periodisch (z. B. monatlich) für gelöschte Produkte. Nutzer-Beiträge crowdsourcen.

### 6. Rechtliches in Kürze

- **OFF (ODbL/DbCL/CC-BY-SA):** unproblematisch nutzbar. Pflichten: Namensnennung (Attribution) und Share-Alike — eine abgeleitete/angereicherte Datenbank muss unter ODbL weitergegeben werden, wenn sie öffentlich verteilt wird. Für interne App-Nutzung mit Attribution i. d. R. unkritisch; bei Weitergabe der DB Share-Alike beachten.
- **BLS:** seit Ende 2025 lizenzfrei/kostenlos (MRI/BMLEH).
- **Kommerzielle APIs (EAN-Search, Barcode Lookup, CodeCheck, Digit-Eyes):** Nutzung nur nach deren AGB, i. d. R. kein Weiterverkauf/keine Bulk-Redistribution.
- **Scraping von Händler-Shops:** in Deutschland nicht generell verboten. Der BGH (Urteil v. 30.04.2014, I ZR 224/12 – „Flugvermittlung im Internet”) hält automatisiertes Auslesen frei zugänglicher, technisch ungeschützter Seiten grundsätzlich für zulässig (keine gezielte Behinderung nach UWG). Grenzen: (a) **Datenbank-Schutzrecht §§ 87a ff. UrhG** — Übernahme wesentlicher Teile ist unzulässig; systematisches, wiederholtes Auslesen kann § 87b UrhG verletzen; (b) keine Überwindung technischer Schutzmaßnahmen (die mTLS-Zertifikate der REWE-API sind eine solche → Umgehung rechtlich riskant); (c) keine Serverüberlastung; (d) ggf. UWG/virtuelles Hausrecht bei AGB-Verstoß; (e) DSGVO/Urheberrecht bei Bildern. **Fazit:** Offene Dumps (OFF/BLS) sind sicher; Händler-Scraping/inoffizielle APIs bergen Rest-Risiko und sollten sparsam, technisch schonend und ohne Umgehung von Zugangsschutz erfolgen.

## Recommendations

**Stufe 1 (MVP, sofort):**

- OFF-Parquet/JSONL-Dump laden, mit DuckDB auf `en:germany` filtern, in SQLite nach o. g. Schema überführen. → sofort ~407.907 deutsche Produkte mit Nährwerten/Bildern/Kategorien.
- Barcode-Scan mit `mobile_scanner` (Flutter) bzw. VisionKit (iOS nativ) / html5-qrcode (Web) als Primär-Identifikation. Bei Treffer im lokalen Katalog → Bestandsbuchung; bei Miss → OFF-Live-API einmalig abfragen, sonst Nutzer-Anlage.
- BLS 4.0 für lose Ware/Grundzutaten (Rezept-Engine, „Bestand reduziert sich beim Kochen”).

**Stufe 2 (Abdeckung erhöhen):**

- Eigener „Produkt fehlt”-Flow: Foto von Front/Nährwerttabelle → OCR → Nutzerbestätigung → lokal speichern + optional an OFF zurückspielen (verbessert Gemeingut und eigene DB).
- Discounter-Eigenmarken gezielt nachtragen; punktuell Picnic-/REWE-Client zur Anreicherung (schonend, ToS beachten).

**Stufe 3 (Komfort):**

- Bilderkennungs-Fallback für Obst/Gemüse (eigenes Modell, Trainingsbasis OFF-AWS-Bilddatensatz).
- Optional kommerzielle Barcode-API (EAN-Search/Barcode Lookup) für verbleibende GTIN-Lücken, wenn Budget vorhanden.

**Benchmarks / Umschaltpunkte:**

- Wenn Trefferquote beim Scannen im DE-Katalog < ~85 % (v. a. Discounter) → Stufe 2 priorisieren.
- Wenn Nutzerbasis wächst und Redistribution der DB geplant → ODbL-Share-Alike-Konformität rechtlich prüfen.
- Wenn inoffizielle Händler-APIs wiederholt brechen (App-Updates/mTLS) → auf reinen Crowdsourcing-/OFF-Weg zurückfallen.

## Caveats

- OFF-Daten sind Crowdsourcing: DE-Nährwertvollständigkeit ist begrenzt (Nov 2024: nur 36 % mit Nutri-Score, 28 % NOVA).  Für exakte Nährwerte je Produkt sind Lücken einzuplanen.
- Die Zahl „407.907 DE-Produkte” stammt von der Live-Anzeige der deutschen OFF-Seite und konnte nicht per API gegenbestätigt werden; das aktuelle OFF-DE-Wiki-Dashboard war zum Recherchezeitpunkt bot-gesperrt, daher sind die Vollständigkeits-Prozente Stand Nov 2024.
- OFF-Marken-Tags sind fragmentiert; die weltweiten Marken-Zahlen (Milbona ~3.549 etc.) und die DE-gefilterten Zahlen (Milbona 72 etc.) messen nicht dasselbe — Marken-Zuordnung muss beim Import normalisiert werden.
- Gesamtzahl vorhandener Discounter-Eigenmarken-SKUs am Markt ist nicht öffentlich bezifferbar → eine exakte „OFF-Abdeckungsquote” für Discounter lässt sich nicht seriös berechnen.
- Inoffizielle Händler-APIs sind rechtlich Grauzone und technisch instabil; kein Produktivverlass.
- Sortimentszahlen (Aldi ~1.800 etc.) sind Branchen-/Presseangaben, keine amtlichen Zahlen, und schwanken mit Aktionsware.
- CodeCheck hatte eine Insolvenz (Käufer gefunden) → Kontinuitätsrisiko bei kommerzieller Nutzung.
- Der BLS-4.0-Freigabezeitpunkt wird in Quellen leicht unterschiedlich datiert (Pressemeldungen 2025; heise/Wikipedia nennen konkret Dezember 2025) — für die Praxis relevant ist: aktuell kostenlos verfügbar.
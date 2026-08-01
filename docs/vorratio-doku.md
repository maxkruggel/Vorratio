# VORRATIO – Projektdokumentation

**Version 1.1 · Stand: 01.08.2026 · Max Kruggel**
Führende Quelle: Diktat vom 01.08.2026 (= Übergabe zur App-Erstellung). Integriert: Recherche 1 (Ernährungsformen), Recherche 2 (Zubereitungs- & Rezeptdatenbank), Recherche 3 (Produktdatenbank). Die Datenarchitektur ist damit vollständig; die Rechtsrecherche zur Picnic-API läuft separat.

---

## 1. Projekt

**Vorratio** ist eine Vorrats- und Rezept-App für iOS, umgesetzt als HTML-App auf dem Homebildschirm. Sie kennt den Haushaltsbestand, schlägt daraus dreimal täglich AI-generierte Rezepte vor, führt durchs Kochen mit Timern, bucht den Verbrauch automatisch ab und hält den Bestand über Kassenbon-Scans und Picnic-Quittungen aktuell – ein geschlossener Kreislauf.

- **Name:** Vorratio (fix). Branding zunächst bewusst neutral; die visuelle Identität wird später entwickelt und übergelegt.
- **Plattform & Architektur:** iOS, HTML-App auf dem Homebildschirm (PWA), **zunächst rein lokal** (bewährter Stack wie Frida und Flora AI) – kein Backend im ersten Schritt. Serverseitige Erweiterung langfristig sinnvoll und offen. Design/Bau über **Claude Design**, Weiterentwicklung über Claude Code.
- **Nutzungsmodell:** Single-User – Max entwickelt und nutzt die App zunächst allein; ein späterer Marktgang bleibt offen und wird bei den Lizenzen (Kap. 6) bereits mitgedacht.
- **Status:** Konzept vollständig diktiert, alle drei Daten-Recherchen abgeschlossen und eingearbeitet. Nächster Schritt: Aufbau.

## 2. Zielgruppe & Produktversprechen

Nutzerinnen und Nutzer, die gern kochen, aber wenig Zeit und wenig Entscheidungsfreude haben, oft nicht wissen, was im Vorrat ist – und deswegen doppelt kaufen und am Ende 5 kg Mehl im Schrank haben.

Vorratio verspricht: Überblick ohne Buchhaltung, täglich passende Rezeptideen aus dem, was da ist, kurze fokussierte Einkäufe und effizienter Verbrauch. Die App deckt alle Ernährungsformen ab (inkl. Fisch und Fleisch); die Ernährungsform wird im Profil gewählt.

## 3. Leitprinzipien

1. **Minimale Erfassungshürde.** Dokumentieren, Wiegen und Nachhalten ist der größte Motivationskiller. Jede Erfassung ist automatisch, ein Nebenprodukt einer ohnehin stattfindenden Handlung oder ein einzelner Tap. Es wird nie abgewogen für die App.
2. **Toleranz statt Scheinpräzision.** Beim Verbrauch gilt eine Toleranz von ±10–15 % pro Produkt, weil aus der Hüfte gekocht wird. Darauf wird beim Onboarding einmal kurz hingewiesen.
3. **Geschlossener Kreislauf.** Bestand → Rezeptvorschlag → Einkauf (nur was fehlt) → Kochen → automatische Abbuchung → Bon-Scan füllt auf. Jede Station füttert die nächste.
4. **Einfach & anfängertauglich.** Rezepte funktionieren auch für Menschen, die selten kochen (inkl. Basics wie „Reis vor dem Kochen abspülen"). Zwischendurch kurze Tipps, wie in der Flora-App.

## 4. User Journey (diktierter Stand)

### 4.1 Onboarding
1. App öffnen → Start-Animation.
2. Geführte Einrichtung: **Name** anlegen, **Nutzerprofil**, **Ernährungsprofil** – Ernährungsform, Vorlieben und Spezifikationen, Allergien und Unverträglichkeiten (Datenmodell siehe 6.1).
3. Kurzer Hinweis auf das Toleranzprinzip (±10–15 % beim Verbrauch).

### 4.2 Ersteinrichtung Bestand (~15 Minuten)
Einmalige vollständige Aufnahme des Haushalts: **Trockenware, Frischware, Konserven, Gewürze.** Der Stand liegt danach klar in der Datenbank und aktualisiert sich fortlaufend.

Vier gleichwertige Erfassungswege, frei kombinierbar:
- **Diktat / Chatbot-Interaktion** (Chatbot-Name noch offen) – Nutzer spricht, die App parst in Buchungen.
- **Fotos in der App** – insbesondere Schrank-/Schubladen-Analyse: Foto vom geöffneten Vorratsschrank, die App erkennt sichtbare Produkte (Glas Gurken = eindeutig); wo der Füllstand nicht sichtbar ist (Mehltüte), wählt der Nutzer per Tap nach, wie voll es ist. So sind die meisten Informationen erfasst, ohne sie eintippen zu müssen.
- **Schriftlich** – klassische Eingabe.
- **Auswahlfenster** – vorstrukturierte Optionen, z. B. Mehl Type 405 / Type 1050.

### 4.3 Täglicher Rhythmus: Rezeptvorschläge
- Proaktive Vorschläge zu festen Zeiten: **8:00 Frühstück · 11:30 Mittagessen · 17:30 Abendessen.**
- Immer **drei Vorschläge**, orientiert am Bestand, jeweils mit dem Hinweis: „Das und das fehlt dir für dieses Rezept."
- **Neu würfeln** möglich, wenn nichts zusagt. Pro Tag neue Rezeptideen.
- Technischer Hinweis: Web Push ist auf iOS ab 16.4 für Homescreen-Web-Apps verfügbar und in Max' Setup bereits erprobt (Beta-Tests, Flora AI) – die festen Zeiten sind damit als lösbar bestätigt.

### 4.4 Rezept gewählt → fokussierter Einkauf
- Die App erstellt die **rezeptbezogene Einkaufsliste**: nur die fehlenden Zutaten.
- Ein einziges zusätzliches Element: „**Weitere Sachen benötigt?**" – ja/nein bzw. Swipe, bewusst schlank gehalten. Fokus bleibt das Rezept.
- Einkaufsweg wählbar: **lokal** oder **Picnic-Bestellung** (siehe 7.2).

### 4.5 Kochmodus
- Schön gestaltete **Schritt-für-Schritt-Anleitung** mit Icons und Bebilderung, zum Durchklicken – im Stil der Rezeptdarstellung aus dem Claude-Chat.
- **Timer** laufen in der App, sind korrekt benannt („Nudeln kochen", „Teig gehen lassen") und haben Zugriff auf das Gerät.
- Anfängertauglich formuliert; eingestreute Tipps (Flora-Prinzip), z. B. ob man Reis oder Linsen abwäscht.

### 4.6 Abschluss: Abhaken & Abbuchung
- Rezept abhaken → kurze **Validierung** → der Vorrat reduziert sich automatisch um die Rezeptmengen (mit Toleranzband). Das passiert bei jedem Rezept.

### 4.7 Wocheneinkauf & Angebots-Crawl
- **Leere oder fast leere Vorräte** (z. B. noch ein Fünftel) landen automatisch auf der **Wocheneinkaufsliste**.
- **Einmal wöchentlich** (z. B. freitags) läuft ein **Angebots-Crawl** über die bestmöglichen Angebote am gewählten **Standort**: Die App gibt eine Einschätzung, bei welchem Markt (Edeka, Lidl, Rewe, Penny …) die Liste am besten abgedeckt ist – meiste Angebote, meiste Produkte, beste Konditionen.
- Bewusst kein Markt-Hopping: **kein deutlicher Wechsel über zwei, drei Einkaufsmärkte hinaus.**

### 4.8 Bestandsauffüllung: Bon-Scan
- Mit Bestätigung des Einkaufs füllen sich die Vorräte auf – Grundlage ist der **gescannte Kassenbon** bzw. die **Picnic-Quittung**, nicht die Einkaufsliste. So werden auch Zusatzkäufe erfasst, die nicht auf dem Zettel standen.
- Technische Umsetzung: Vision-Modell liest den Bon und mappt Bon-Bezeichnungen auf Produkte/Zutaten; kurzer Bestätigungsschritt vor dem Verbuchen (siehe 7.3).

### 4.9 Snack-Ecke: Snacks, Süßes & Frozen (Recherche 4)
- Eigene Kategorie **außerhalb der drei Essens-Slots**: Dinge, die man zwischendurch aus Vorräten herstellt – Nicecream, Sorbet, Eis am Stiel, Frozen-Joghurt-Bark, schokolierte Früchte, Fruchtleder, Apfelchips, Energiebällchen, geröstete Kichererbsen, Popcorn, Blitzkekse (Datenbasis: `docs/recherche-4-snacks.md`).
- **Kein vierter Slot**, sondern eine slot-unabhängige „Snack-Ecke" auf dem Heute-Screen: zwei tagesstabile Vorschläge, Neu-würfeln, eigener Claude-Einstieg („Snack-Ideen von Claude", `mahlzeitentyp: ["snack"]`).
- Snack-Rezepte laufen als Vollrezepte (`SNK-…`) durch dieselbe Maschinerie wie Hauptgerichte: Profilfilter (alle drei Achsen), Bestandsabgleich, Kochmodus mit Timern, Abbuchung, Einkaufsliste. Reine Snack-Rezepte erscheinen **nie** in den Mahlzeiten-Slots – auch nicht beim Auffüllen dünner Pools.
- Typisches Timer-Profil: lange **passive** Wartezeiten (`ruhen` fürs Gefrieren, `ofen` fürs Dörren bei behördlich empfohlenen 60–65 °C) statt aktiver Kochschritte.

## 5. Bestandsmodell

- **Kategorien:** Trockenware/Vorrat · Frischware · Konserven · Gewürze (dazu Kühl-/TK-Ware).
- **Zugänge** sind exakt: Bon und Packungsgröße liefern die Menge – kein Wiegen.
- **Verbrauch** wird über Rezeptmengen abgebucht, mit **±10–15 % Toleranz** pro Produkt (Freestyle-Faktor).
- **Zählbares** (Eier, Bananen, Äpfel, Karotten): Anzahl per Push/Slider auswählen – vorhanden bzw. verbraucht.
- **Schüttgut** (Mehl, Zucker, Milch): **vorschlagsbasierte Schätzlogik (beschlossen)** – ausdrücklich ohne Abwiegen. Die App schlägt vor, der Nutzer bestätigt oder korrigiert:
  - Visuelle Schätzer: Slider mit Packungs-Silhouette („Wie voll ist die Tüte?"), intern über die bekannte Packungsgröße in Gramm übersetzt.
  - Wachsendes Unsicherheitsband (Toleranz ±10–15 % je Kochung), das gezielte Ein-Tap-Rückfragen nur dann auslöst, wenn ein Rezept es entscheidungsrelevant macht („Reicht dein Mehl noch für 500 g?").
  - Optionaler 30-Sekunden-Schnellcheck (max. 5 Karten, Swipe) für Artikel mit breitem Band – ohne Pflicht, ohne Strafe.
- **Anzeige** immer als Näherung („~500 g"), nie mit Scheinpräzision.

## 6. Datenarchitektur

Vorratio steht auf drei Datenbanken plus dem Nutzerprofil. Der Klebstoff zwischen Produkt- und Rezeptwelt ist das Mapping **GTIN → `zutat_id`**: Gekaufte Produkte (Barcode/Bon) werden auf normalisierte Zutaten gemappt, gegen die Rezepte und Bestand abgeglichen werden.

**Datenfluss:**
Bon/Barcode → Produkt-DB (GTIN, Packungsgröße, Nährwerte) → Mapping auf `zutat_id` → **Bestand** → AI-Rezeptgenerierung (Rezept-DB als strukturiertes Domänenwissen + Profilregeln aus der Ernährungs-DB) → „Gekocht" → Abbuchung über `zutaten[].zutat_id × menge × (Portionen-Faktor)`.

### 6.1 DB Ernährungsprofil (Recherche 1 – DGE/BfR-basiert)

**Datenmodell: drei unabhängige Achsen** (verhindert widersprüchliche Kombinationen):
1. **Ernährungsform** (Radio, genau eine): Mischkost/omnivor · Flexitarier · Pescetarier · Ovo-Lacto-Vegetarier · Lacto-Vegetarier · Ovo-Vegetarier · Veganer · optional „überwiegend pflanzenbasiert".
2. **Ausschlüsse** (Mehrfachauswahl): Allergien/Intoleranzen (EU-14-orientiert: Gluten, Laktose, Nüsse, Soja …) sowie religiös-kulturelle Regeln (halal, koscher) – harte Filter, quer zu allen Formen.
3. **Stil-Präferenz** (optional, Mehrfachauswahl): priorisiert **mediterran, High-Protein, Low-Carb**; Keto/Paleo nur mit Evidenz-Hinweis; Intervallfasten als Timing-Thema, nicht als Rezeptfilter.

**AI-Rezeptregeln je Form (Auszug, quellenbelegt):**
- **Vegan:** keine Tierprodukte inkl. Honig; Proteinziel je Hauptmahlzeit (Hülsenfrüchte/Tofu/Tempeh/Seitan), Getreide + Hülsenfrüchte kombinieren; eisenreiche Gerichte immer mit Vitamin-C-Komponente, Kaffee/Schwarztee nicht als Mahlzeitgetränk; Jodsalz als Default, Algen nicht als Jod-/B12-Quelle; Leinöl/Walnüsse (ALA), Mikroalgenöl als Einkaufshinweis. **B12 ist App-Hinweis, keine Rezeptregel** – nur per Präparat lösbar (DGE-Position 13.06.2024).
- **Vegetarisch (ovo-lacto/lacto/ovo):** Eisen-Vitamin-C-Kopplung wie vegan; Milch/Ei als Protein-, B12- und Calciumquelle; bei ovo-vegetarisch Calcium über pflanzliche Quellen/Mineralwasser absichern.
- **Pescetarier:** 1–2 Portionen Fisch/Woche, davon 1× fettreicher Seefisch; Positivliste (Lachs, Makrele, Hering, Kabeljau, Seelachs), Negativliste großer Raubfische (Thunfisch, Hai, Schwertfisch, Heilbutt, Rotbarsch, Aal – BfR 17/2024); Nachhaltigkeitssiegel-Hinweis.
- **Mischkost/Flexitarier:** DGE-FBDG 2024 – Fleisch/Wurst max. 300 g/Woche, > 75 % pflanzlich; Jodsalz-Default; Ballaststoffe über Vollkorn/Hülsenfrüchte.

**Haftungszonen (nur Hinweis, keine Empfehlung):** Supplemente (B12, Jod, Vitamin D, Algenöl) mit Verweis auf ärztliche Beratung; Schwangerschaft/Stillzeit, Kinder/Jugendliche, Senioren als Sonderfälle; Quecksilber-Hinweis für Schwangere bei Fisch. Die App ersetzt keine Ernährungs-/ärztliche Beratung.

### 6.2 DB Zubereitung & Rezepte (Recherche 2)

**Strategie: hybrid.**
- **Eigene Kern-DB** (geliefert: Schema + 60 Datensätze; Ausbauziel 300–500): Grundtechniken (18er-Kanon), Produktzubereitungen (Reis, Eier, Hülsenfrüchte …), Grundrezepte (Sugo, Béchamel, Hummus …), Vollrezepte, Rezeptideen, Tipps. Für diesen produktzentrierten Teil gibt es keine brauchbare offene Quelle – er ist zugleich das strukturierte Domänenwissen für die AI-Vorschläge.
- **TheMealDB** (Supporter-Key, Attribution) als international breiter Vollrezept-Grundstock – einzige kommerziell dauerhaft speicherbare Quelle dieser Art.
- **Open Food Facts** (ODbL) für Produkt-/Nährwert-/Allergen-Abgleich (siehe 6.3).
- **Spoonacular/Edamam** höchstens als Live-Feature („mehr Ideen"), niemals zur DB-Befüllung (Caching-Verbote).
- **No-Gos:** RecipeNLG und die Chefkoch-Scrape-Datasets – nicht kommerziell lizenziert.

**Schema-Kern (`kruggel-recipe-db/v1`, JSON):** `id` (Präfixe TECH-/PREP-/BASE-/RCP-/IDEA-/TIP-), `typ`, `kategorie`, `cuisine`, `mahlzeitentyp`, `portionen`, `zutaten[]` mit **`zutat_id`** (FK auf normalisierte Zutatenliste → Bestandsabgleich), `schritte[]` mit `dauer_sekunden` + `timer_typ` (aktiv/passiv/ofen/ruhen → treibt die In-App-Timer), `gesamtzeit_min`, `schwierigkeit`, `ernaehrungsform[]`, `allergene[]`, `naehrwert_einordnung`, `substitutionen[]`, `tags[]`, `quelle_typ`.

**Entscheidungen:** Output direkt für die App weiterverarbeitbar (strukturierte Datensätze); Fisch und Fleisch von Anfang an abgedeckt (Ernährungsform filtert); Küche international breit (17 Cuisines).

**Governance:** Kerntemperaturen sind Pflichtfelder bei Fleisch/Fisch/Geflügel und dürfen USDA/FSIS-Minima nie unterschreiten (Geflügel 74 °C, Hack 71 °C, ganze Stücke 63 °C + 3 Min Ruhe, Fisch 63 °C); jeder Datensatz trägt `quelle_typ`, erfundene Zeiten sind unzulässig; OFF-abgeleitete Daten physisch getrennt halten (Share-Alike-Isolierung).

### 6.3 DB Produkte (Recherche 3)

**Basis:** Open-Food-Facts-Dump, gefiltert auf „sold in Germany" (~407.907 Produkte; Lizenz ODbL/DbCL/CC-BY-SA, Dumps nächtlich, Delta-Exporte 14 Tage). Ergänzt um den **Bundeslebensmittelschlüssel BLS 4.0** (seit Ende 2025 kostenlos; 7.140 Lebensmittel × 138 Nährstoffe) für generische/lose Ware ohne Barcode.

**Schema-Kern (`products`, je GTIN):** `gtin` (PK), Name, Marke, `quantity_value`/`quantity_unit`, Kategorie, Nährwerte je 100 g/ml, Zutatentext, Allergene, Nutri-Score/NOVA/Labels, Bild-URLs, `data_source`, `last_modified`. Varianten über `product_group_id` (gleiches Produkt, mehrere Gebinde); Händler über n:m-Tabelle `product_availability`; lose Ware in eigenem ID-Namensraum mit BLS-Nährwerten; 20er-Barcodes (Restricted Circulation) als mehrdeutig markieren.

**Identifikation in der App:** **Barcode-Scan primär** (iOS: VisionKit; Web: zxing-wasm bzw. `BarcodeDetector`-API) → Treffer im lokalen Katalog → Buchung; bei Miss einmaliger OFF-Live-Abruf, sonst Nutzer-Anlage. **Bilderkennung nur als Fallback** für lose Ware (Obst/Gemüse; eigenes Modell, Trainingsbasis OFF-AWS-Bilddatensatz).

**Bekannte Lücke:** Discounter-Eigenmarken (Aldi/Penny/Netto) sind in OFF schwach abgedeckt → „Produkt fehlt"-Flow (Foto Front + Nährwerttabelle → OCR → bestätigen → lokal speichern, optional an OFF zurückspielen); punktuell inoffizielle REWE-/Picnic-Clients zur Anreicherung (schonend, ohne Umgehung technischer Schutzmaßnahmen wie REWE-mTLS).

**Aufbau-Pipeline:** OFF-Parquet + DuckDB → DE-Filter → SQLite nach Schema (offlinefähige In-App-DB) → BLS für Lücken → Delta-Updates.

### 6.4 Persistenz & Datenhaltung (lokal)

- **Auto-Save als Grundprinzip: eine Aktion = ein Save.** Jede Buchung, Profil- oder Bestandsänderung wird sofort persistiert – nie ein expliziter Speichern-Button, nie Datenverlust beim Schließen.
- **Strukturierte lokale Speicherung**, sodass alle eingegebenen und sich aktualisierenden Informationen dauerhaft aktuell und erhalten bleiben (Bestand, Profil, Rezepthistorie, Listen).
- **JSON-Export und JSON-Import**: vollständiger Datenbestand als Datei sicherbar und wieder einspielbar – zugleich Backup gegen iOS-Storage-Eviction und späterer Migrationspfad Richtung Server-Variante.

### 6.5 DB Substitutionen (Recherche Substitutionen, 08/2026 – umgesetzt)

**Pflanzliche Alternativen zu tierischen Zutaten** als eigene In-App-Datenbank (`js/data/substitutionen.js`, Schema `vorratio-substitutions-db/v1`, 47 Datensätze in 6 Kategorien: Milchprodukte · Käse · Ei · Fleisch & Wurst · Fisch & Meer · Sonstiges).

**Kernentscheidungen (quellenbelegt):**
- **Ei ist funktionsbasiert modelliert** (5 Datensätze: Binden · Lockern/Backen · Hauptzutat Rührei/Omelett · Aufschlagen/Eischnee · Ei-Geschmack) – es gibt keinen 1:1-Allrounder. Alle anderen Zutaten zutatenbasiert.
- **`prioritaet: 1` = neutralste/verlässlichste Alternative**, bei Milchprodukten meist Sojabasis (einzige proteinstarke Wahl, ~3,5 g Protein/100 ml – Kuhmilch ebenbürtig; Hafer/Kokos liefern kaum Protein).
- **Anwendungsfall-Filter** über `geeignet_fuer` (backen/kochen/kalt/aufschlagen/binden/überbacken/…): Aufschlagbarkeit ist der kritische Sonderfall (nur Spezial-Schlagcremes werden fest, Koch-/Hafersahne nicht); Schmelzen zum Überbacken gelingt nur mit Kaufprodukten, DIY-Cashew-Parmesan streut nur.
- **Kopplung an die Kern-DB** über `zutat_ids` (FK auf normalisierte Zutatenliste) → im Rezept-Detail werden für fehlende Zutaten Ersatz-Ideen angezeigt.
- **Allergie-Filterung hart** über die Basis (Soja → soja/tofu/tempeh, Nüsse → cashew/mandel, Gluten → weizen_seitan, Lupinen → lupine), konsistent mit den Profil-Ausschlüssen (6.1).
- **Handelsprodukte**: Eigenmarken (Vemondo, K-take it veggie, Vehappy, MyVay/GutBio …) werden zuerst gelistet (Preis/Verfügbarkeit), Markenprodukte als Fallback; Ladenzuordnung über `laeden`.
- **B12-Dauerhinweis** beim veganen Profil im Ersatz-Tab (DGE-Position 2024: nur per Präparat lösbar) – Anzeige, keine Rezeptregel.

**Bekannte Vorbehalte:** Sortimente/Produktnamen ändern sich schnell (Stand 08/2026, quartalsweise gegen Open Food Facts abgleichen); Worcestersauce-Veganität variiert je Marke/Charge („Zutatenliste/V-Label prüfen" ist fester Hinweis); Namensfallen beachten („Alnatura Hühner Brühe" enthält echtes Hühnerpulver; EU-Milchbezeichnungsschutz → „Drink"/„Reibegenuss" statt Milch/Käse); manche Kokosmilchpulver enthalten Natriumkaseinat (nicht vegan).

*Die Datenarchitektur ist mit 6.1–6.3 und 6.5 vollständig; sollten weitere Datenquellen dazukommen, werden sie hier ergänzt.*

## 7. Technik-Notizen

### 7.1 iOS-HTML-App (PWA)
- Installation über Safari-Share „Zum Home-Bildschirm".
- **Web Push** für die festen Vorschlagszeiten (8:00/11:30/17:30) ist ab iOS 16.4 für Homescreen-Web-Apps verfügbar – braucht aber einen Push-Server und muss aktiv eingerichtet werden; Fallback (in v1 umgesetzt): Vorschläge liegen beim Öffnen bereit – sie werden beim App-Start bzw. beim Zurückkehren in den Vordergrund für den aktuellen Slot erzeugt, lokal gespeichert und bleiben innerhalb des Slots stabil.
- Kein direkter Schreibzugriff auf Apple Notizen/Erinnerungen und kein HealthKit aus der PWA. Export-Wege für Listen: Web Share API (Share-Sheet), Zwischenablage, optional Apple-Shortcut als Brücke.
- Lokale Datenhaltung nach Kap. 6.4: Auto-Save je Aktion, JSON-Export/-Import als Backup gegen Storage-Eviction.

### 7.2 Picnic-Anbindung (inoffiziell – Grauzone, vor Nutzung validieren)
- Community-APIs mit DE-Support: `python-picnic-api2` (Python, gepflegt; 2FA; `get_deliveries`/`get_delivery(id)` liefert Bestellhistorie inkl. Artikelzeilen; `search`, `add_product`, `get_cart`) und `picnic-api` (Node, MRVDH).
- Damit möglich: (a) Picnic-Quittungen/Bestellhistorie automatisch in den Bestand; (b) Einkaufsliste als Picnic-Warenkorb übergeben.
- Status: inoffiziell, „use at your own risk", kann bei API-Umbauten brechen → als gekapseltes Modul mit manuellem Fallback (Quittungs-Scan) bauen. **Picnic-Zugang ist vorhanden.**
- **Rechtslage in Klärung:** Separate Recherche zu Legalität und möglichen Konsequenzen der inoffiziellen API-Nutzung (privat vs. späterer Marktgang) läuft; Ergebnis wird als eigenes Dokument beigelegt. Bis dahin: keine Produktivnutzung über gelegentliche eigene Abrufe hinaus.

### 7.3 Bon-Scan
- Pipeline: Foto → Vision-LLM → strukturiertes JSON (Artikel, Menge, Preis) → Validierung → Buchung; Größenordnung ~0,002 $ pro Bon.
- Mapping kryptischer Bon-Bezeichnungen („G&G WEIZENM. 405") auf Produkte/`zutat_id` per Modell-Prompt; kurzer Bestätigungsschritt vor dem Verbuchen.
- Picnic-Quittungen kommen strukturiert über die API und brauchen keinen Scan.

### 7.4 Angebots-Crawl (Kapitel 4.7)
- **Quelle festgelegt: Marktguru** (inoffizielle, zugängliche API; PLZ-basiert, viele Ketten). REWE verworfen (seit 2024 mTLS – wird nicht umgangen); Bonial/kaufDA ohne offene API. Die öffentlichen Web-App-Keys werden nicht eingebrannt, sondern einmalig aus marktguru.de kopiert und in der App hinterlegt; ohne Keys läuft ein Demo-Modus mit Beispieldatensatz (gleicher Codepfad).
- Logik: Wocheneinkaufsliste × Standort-Angebote → Markt-Empfehlung mit Abdeckung und Konditionen. **Prototypisch umgesetzt** (`js/angebote.js`, UI im Einkauf-Tab): Suchprofile + Textabgleich je Zutat, Ranking Abdeckung → Ø-Rabatt → Angebotszahl, 1 Empfehlung + max. 2 Alternativen (kein Markt-Hopping), Ergebnis gilt eine Kalenderwoche. Details, Grenzen und Key-Beschaffung: `docs/angebots-crawl.md`.
- Automatischer Freitags-Lauf hängt an Web Push/Background Sync (offener Punkt 6); bis dahin manueller Ein-Tap-Start.

## 8. Design & UI

- **Branding:** zunächst **neutral** bauen; das finale Branding wird später entwickelt und übergelegt (Name Vorratio steht).
- **Umsetzung:** Design und Bau über **Claude Design**; diese Doku ist die Übergabe dafür.
- **Chatbot:** startet mit **Platzhalter-Namen**; Benennung später.
- **Icon-Palette:** eigene, stilistisch coole Produkt-Icons für die Übersichten (Mehl, Zucker, …) statt Produktfotos.
- **Kochmodus-UX:** durchklickbare Schrittkarten mit Icons/Bildern, benannte Timer, Tipps eingestreut.
- **Erfassungs-UX:** Slider/Push für Zählbares, Silhouetten-Slider für Schüttgut, Auswahlfenster für Varianten (Mehl-Typen), Chat-/Diktatfläche für alles Übrige.

## 9. Offene Punkte & nächste Schritte

| # | Punkt | Status |
|---|---|---|
| 1 | App-Aufbau über Claude Design (neutral), Basis: diese Doku | nächster Schritt |
| 2 | Auto-Save + JSON-Export/-Import implementieren (Kap. 6.4) | mit dem Aufbau |
| 3 | Bon-Scan-Prototyp – Testdaten: allgemeine Grundzutaten (kein echtes Bon-Material nötig) | mit dem Aufbau |
| 4 | Picnic: Rechtsrecherche abwarten, dann Funktionsvalidierung mit vorhandenem Zugang | läuft |
| 5 | Angebots-Crawl: Quelle + Matching prototypen (7.4, `docs/angebots-crawl.md`) | erledigt |
| 6 | Web-Push für feste Vorschlagszeiten einrichten (Muster aus Flora AI übernehmen; braucht Push-Server) | To-do – Fallback aktiv: Vorschläge liegen beim Öffnen bereit |
| 7 | Icon-Palette erstellen | To-do |
| 8 | Kern-Rezept-DB von 60 auf 300–500 Datensätze ausbauen | geplant |
| 9 | Finales Branding + Chatbot-Name | später |
| 10 | Lizenz-Check vor einem etwaigen Marktgang (ODbL Share-Alike, TheMealDB-Attribution) | vor Release |

## Anhang: Quelldokumente

1. **Diktat Max Kruggel, 01.08.2026** – führender Konzeptstand (Kapitel 3–5, 4.x).
2. **Recherche 1: Ernährungsformen als Zielgruppen-Presets** (DGE/BfR/MRI, Stand 08/2026) – Basis für Kapitel 6.1.
3. **Recherche 2: Zubereitungs- & Rezeptdatenbank** (Schema, 60 Datensätze, Quellen-/Lizenzbewertung) – Basis für Kapitel 6.2.
4. **Recherche 3: Produktdatenbank** (Open Food Facts, BLS 4.0, Barcode/Foto-Identifikation, Recht) – Basis für Kapitel 6.3.
5. **Recherche 4: Rechtslage inoffizielle Picnic-API** – läuft, wird nach Fertigstellung hier beigelegt (Kapitel 7.2).
6. **Recherche Substitutionen: Pflanzliche Alternativen zu tierischen Zutaten** (DGE 2024, Stiftung Warentest 3/2025, ProVeg, Hersteller-/Händlerangaben, Stand 08/2026) – Basis für Kapitel 6.5, umgesetzt in `js/data/substitutionen.js`.

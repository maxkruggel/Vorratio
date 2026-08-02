# Vorratio

Vorrats- und Rezept-App für iOS als Homescreen-Web-App (PWA) – rein lokal, ohne Backend.

Vorratio kennt den Haushaltsbestand, schlägt daraus dreimal täglich Rezepte vor, führt mit
benannten Timern durchs Kochen, bucht den Verbrauch automatisch ab (Toleranzprinzip ±10–15 %)
und hält den Bestand über den Einkauf aktuell – ein geschlossener Kreislauf.

## Ausprobieren

Statisch servieren, mehr braucht es nicht:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Auf dem iPhone: in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

Rezeptdatenbank prüfen (vor jedem Commit an den Daten):

```bash
node tools/validate-db.mjs
```

## Stand (v3)

Neu gegenüber v2.1:

- **Rezeptdatenbank von 39 auf 235 Rezepte ausgebaut.** Der bisherige Kernblock war ein
  Startdatensatz zum Testen der Engine – Ø 3,9 Schritte, kein Rezept über 5 Schritte,
  Schwierigkeitsstufe „fortgeschritten" komplett unbelegt. Dazu kommen jetzt vier Blöcke:
  - `js/data/rezepte-komplex.js` – **42 komplexe Rezepte** mit 8–14 Schritten und echten
    Ruhe-, Schmor- und Gehzeiten: Lasagne al forno, Risotto milanese, Rindergulasch,
    Coq au Vin, Bœuf Bourguignon, Moussaka, handgemachte Gnocchi und Pasta, Paella,
    Rouladen, Sauerteigbrot, Shoyu-Ramen mit Ajitama, Butter Chicken, Pho Bo, Maki-Sushi,
    Pizza Napoletana mit 24-h-Gare, Baklava, Cassoulet, Osso buco, Ravioli, Hefezopf.
    Nutzt endlich die Techniken, die in `TECHNIKEN` schon standen (Schmoren, Pochieren,
    Frittieren, Fermentiertes).
  - `js/data/rezepte-tofu.js` – **55 Rezepte rund um Tofu, Tempeh, Seitan und Sojaprodukte.**
    Alle tragen `vegan`/`vegetarisch` und werden damit nach `FORM_ERLAUBT` *jeder*
    Ernährungsform vorgeschlagen, auch Mischkost. Zusätzlich trägt jedes Fleischrezept der
    Datenbank eine konkrete pflanzliche Substitution – der Umstieg ist damit nie eine
    Verzichtsentscheidung, sondern eine Zeile im selben Rezept.
  - `js/data/rezepte-welt.js` – **55 Weltküchen-Rezepte** über 25 Küchen, inkl. der bislang
    fast leeren Fisch-Ecke (BfR 17/2024: kleine Fische statt großer Raubfische).
  - `js/data/rezepte-alltag.js` – **44 Alltagsrezepte**: Frühstück (von 14 auf 30 Rezepte),
    schnelle Feierabendgerichte, Resteverwertung und Snacks.
  - **91 neue Zutaten** (Tofu-Varianten, Tempeh, Seitan, Schmorfleisch, Fisch, Risottoreis,
    Filoteig, Weinessig, Gewürze) – die Datenbank umfasst jetzt 249 Zutaten.
- **Vorrats-Generator (offline)** – `js/generator.js`, Button „Aus Vorrat bauen" auf dem
  Heute-Screen: kombiniert den *tatsächlichen* Bestand nach sieben festen Küchenmustern
  (Pfanne, Eintopf, Ofenblech, Suppe, Pasta, Bowl, Salat) zu neuen, vollständigen Rezepten
  im Schema `kruggel-recipe-db/v1` – mit Timern, Kerntemperaturen, Allergendeklaration und
  Profilfilter, aber **ohne API-Key und ohne Netz**. Jeder Klick würfelt neu (Seed-basiert,
  deterministisch). Ohne hinterlegten Key fällt „Claude fragen" automatisch hierauf zurück,
  statt eine Fehlermeldung zu zeigen.
- **Datenbank-Validator** – `node tools/validate-db.mjs` prüft die gesamte Rezeptdatenbank
  gegen das Schema: doppelte IDs, unbekannte `zutat_id`, Timer-Konsistenz, Schrittnummern
  und Plausibilität der Ernährungsform (z. B. „vegan" trotz Sahne) sowie fehlende
  Allergendeklarationen. Exit-Code 1 bei Fehlern.

## Stand (v2.1)

Neu gegenüber v2:

- **Snack-Ecke: Snacks, Süßes & Frozen** (Kap. 4.9, [Recherche 4](docs/recherche-4-snacks.md)):
  eigene Rezeptkategorie **außerhalb der drei Essens-Slots** – für alles, was man
  zwischendurch aus Vorräten herstellt: Bananen-Nicecream, Beeren-Sorbet (4:1-Ratio),
  Joghurt-Eis am Stiel, Frozen-Joghurt-Bark, Schoko-Bananen, Fruchtleder (NCHFP-Dörrwerte),
  Apfelchips, Dattel-Energiebällchen, geröstete Kichererbsen, Popcorn, 2-Zutaten-Kekse.
  11 neue `SNK-`Rezepte + 9 neue Vorratszutaten (Datteln, Zartbitterschokolade,
  Popcornmais …). Eigene Vorschlagsschiene auf dem Heute-Screen (2 tagesstabile
  Vorschläge, Neu-würfeln, „✨ Snack-Ideen von Claude") – Snack-Rezepte tauchen nie
  in den Mahlzeiten-Slots auf, respektieren aber alle Profilregeln und laufen voll
  durch Kochmodus, Timer (Gefrieren/Dörren als `ruhen`/`ofen`) und Abbuchung.

## Stand (v2 / Ausbaustufe 2)

Neu gegenüber v1:

- **AI-Rezeptgenerierung** (Kap. 4.3): „✨ Neue Ideen von Claude" auf dem Heute-Screen –
  Claude (`claude-opus-5`) generiert 3 schema-konforme Rezepte (`kruggel-recipe-db/v1`)
  aus dem aktuellen Bestand, unter strikter Beachtung der Profilregeln (Ernährungsform,
  Ausschlüsse, DGE-Regeln, USDA/FSIS-Kerntemperaturen). Generierte Rezepte sind vollwertig:
  Timer, Bestandsabgleich, Abbuchung, Profilfilter.
- **Bon-Scan** (Kap. 7.3): Kassenbon fotografieren → Claude Vision liest ihn, mappt
  kryptische Bon-Bezeichnungen („G&G WEIZENM. 405") auf `zutat_id`s → Bestätigungsschritt →
  Bestand füllt sich auf (auch Zusatzkäufe).
- **Barcode-Scan** (Kap. 6.3): EAN → Open-Food-Facts-Live-Lookup („1 API call = 1 real
  scan") → Zutat-Zuordnungsvorschlag → Buchung mit Packungsgröße vom Produkt.
  Kamera-Scan über die native BarcodeDetector-API, wo verfügbar; sonst manuelle
  EAN-Eingabe (iOS Safari).
- **Claude-API-Key** im Profil: liegt ausschließlich lokal auf dem Gerät (localStorage),
  geht nur an api.anthropic.com – gleiches Muster wie Frida/Flora AI.

## Stand (v1 / MVP)

Umgesetzt aus der Projektdoku ([docs/vorratio-doku.md](docs/vorratio-doku.md)):

- **Onboarding** mit Ernährungsprofil auf vier unabhängigen Achsen (Kap. 6.1):
  Ernährungsform (8 Presets, DGE-basiert) · Ausschlüsse (EU-14-Allergene, halal/koscher) ·
  Stil-Präferenzen (mediterran, High-Protein, Low-Carb; Keto/Paleo mit Evidenz-Hinweis) ·
  **Ziele** (mehr Energie, Abnehmen, fitter werden/Muskelaufbau, flacherer Bauch, mehr
  Konzentration, gesunde Verdauung) – nur Ziele, die wissenschaftlich belegt über
  Ernährung beeinflussbar sind (DGE, EFSA, ISSN 2017, DIETFITS 2018, PREDIMED/MIND);
  jede Auswahl zeigt ehrlich die Evidenzlage inkl. dem, was NICHT belegt ist
  („Spot Reduction“). Rückkopplung: Ziele fließen als weiche Präferenz in den
  Vorschlags-Score, in den Systemprompt der AI-Rezeptgenerierung und als
  „🎯 Zahlt auf deine Ziele ein“-Hinweis im Rezept-Detail – nichts wird verboten.
  Plus Toleranz-Hinweis.
- **Bestand** (Kap. 5): Kategorien Trockenware/Frischware/Konserven/Gewürze/Kühl/TK,
  Stepper für Zählbares, Silhouetten-Slider („Wie voll ist die Packung?“) für Schüttgut,
  vorrätig/leer für Pauschales. Anzeige immer als Näherung („~500 g“), nie Scheinpräzision.
- **Rezeptvorschläge** (Kap. 4.3): 3 Vorschläge je Slot (8:00/11:30/17:30), gefiltert nach
  Profil, gescort nach Bestandsdeckung, mit „Das fehlt dir“-Hinweis und Neu-würfeln.
  Web-Push braucht einen Push-Server – bis dahin greift der dokumentierte Fallback
  (Kap. 7.1): Die Vorschläge werden beim Öffnen (App-Start und Rückkehr in den
  Vordergrund) für den aktuellen Slot erzeugt, lokal gespeichert und bleiben innerhalb
  des Slots stabil – pro Tag neue Ideen, Neu-würfeln überlebt den App-Neustart.
- **Fokussierter Einkauf** (Kap. 4.4): rezeptbezogene Liste nur mit fehlenden Zutaten;
  Bestätigung füllt den Bestand über Packungsgrößen auf (Vorstufe zum Bon-Scan).
- **Kochmodus** (Kap. 4.5): durchklickbare Schrittkarten, benannte Timer
  (aktiv/passiv/ofen/ruhen), eingestreute Tipps (Flora-Prinzip), Kerntemperatur-Minima
  (USDA/FSIS) in den Schritten.
- **Abhaken & Abbuchung** (Kap. 4.6): Verbrauch = Rezeptmengen × Portionsfaktor mit
  Toleranzband; Kleinmengen (EL/TL/Prise) laufen unter Toleranz.
- **Wocheneinkauf** (Kap. 4.7): leere/fast leere Vorräte (≤ 1/5 Packung) landen automatisch
  auf der Liste.
- **Angebots-Crawl** (Kap. 4.7/7.4): einmal wöchentlich Liste × Standort-Angebote →
  Markt-Empfehlung mit Abdeckung und Konditionen, bewusst kein Markt-Hopping (max.
  1 Empfehlung + 2 Alternativen). Quelle Marktguru (PLZ + Keys in den Einstellungen),
  ohne Keys Demo-Modus; Details in [docs/angebots-crawl.md](docs/angebots-crawl.md).
- **Wissen**: 18 Grundtechniken, 15 Produktzubereitungen, 9 Grundrezepte, Tipps & Ideen aus
  der Kern-Rezept-DB (Schema `kruggel-recipe-db/v1`, 235 Rezepte strukturiert).
- **Persistenz** (Kap. 6.4): Auto-Save je Aktion (localStorage), JSON-Export/-Import als
  Backup; offlinefähig per Service Worker.

## Struktur

```
index.html            App-Shell (PWA)
manifest.webmanifest  Web-App-Manifest
sw.js                 Service Worker (Offline-Shell)
css/style.css         Design-Tokens (:root) + alle Komponenten – Claude-Design-Variante 2A
fonts/                Bricolage Grotesque + Figtree als lokale WOFF2 (kein CDN, OFL)
js/app.js             Views & Steuerung
js/icons.js           Duotone-Icon-Set (24er-Raster, Strich 1,6 px)
js/engine.js          Rezept-Engine: Profilfilter, Bestandsabgleich, Abbuchung
js/angebote.js        Angebots-Crawl: Marktguru-Client, Suchprofile, Matching, Markt-Ranking
js/ai.js              Claude API: Rezeptgenerierung + Bon-Scan (strukturierte Ausgaben)
js/generator.js       Vorrats-Generator: baut offline Rezepte aus dem Bestand
js/scan.js            Barcode: Open-Food-Facts-Lookup, Zutat-Matching, Kamera-Scan
js/storage.js         Auto-Save, JSON-Export/-Import
js/data/kerndb.js     Zutaten, Kernrezepte, Preps, Grundrezepte, Techniken, Tipps
js/data/rezepte-komplex.js  Aufbaublock 1: komplexe Küche (8–14 Schritte)
js/data/rezepte-tofu.js     Aufbaublock 2: Tofu, Tempeh, Seitan & Sojaprodukte
js/data/rezepte-welt.js     Aufbaublock 3: Weltküche über 25 Küchen
js/data/rezepte-alltag.js   Aufbaublock 4: Frühstück, Alltag, Snacks
js/data/profil.js     Ernährungsprofil-Achsen + DGE/BfR-Hinweise
js/data/angebote-demo.js  Demo-Angebote für den Crawl (offline testbar)
tools/validate-db.mjs Schema-Validator für die Rezeptdatenbank
docs/                 Projektdoku, fünf Recherchen (Daten, Snacks, Picnic-Recht) + Angebots-Crawl-Doku
```

Die vier Rezeptblöcke werden in `kerndb.js` zu einer flachen `REZEPTE`-Liste
zusammengeführt; die Herkunft steckt im ID-Präfix (`RCP-`/`SNK-` Kern, `KMX-` komplex,
`TOF-` Tofu & Co., `WLT-` Weltküche, `ALL-` Alltag, `GEN-` aus dem Vorrat gebaut).

## Design

Seit 08/2026 liegt die visuelle Identität aus der Claude-Design-Übergabe über der
App (Variante 2A „Papier & Tanne"; Auftrag und Ist-Zustand davor:
[docs/design-handoff/UEBERGABE-CLAUDE-DESIGN.md](docs/design-handoff/UEBERGABE-CLAUDE-DESIGN.md)).

- **Farbwelt:** Papier `#f3efe5`, Fläche `#fffdf8`, Tanne `#2c5b43`,
  Tanne soft `#dfe9e0`, Terrakotta `#b4552d`, Tinte `#1c231e` – alle als
  Custom Properties in `css/style.css` → `:root`. Diese sechs Werte sind die
  ganze Farbwelt: **kein Dark Mode**, die App bleibt in jeder Systemeinstellung
  auf dem Sheet (`color-scheme: light`).
- **Typografie:** Bricolage Grotesque 600/700 für Display (Tracking −0,03 em,
  Überschriften klein gesetzt), Figtree 400–600 für Text. Beide als variable
  WOFF2 in `fonts/` – kein CDN, damit die PWA offlinefähig bleibt (SIL OFL 1.1,
  siehe `fonts/README.md`).
- **Icons:** eigenes Duotone-Set auf 24er-Raster mit 1,6 px Strich
  (`js/icons.js`, Tabbar inline in `index.html`). Die Duotone-Fläche hängt an
  `--duo` und schaltet je Kontext um (Tabbar aktiv, Akzentkarte, Hinweiskarte).
- **App-Icon:** „Keimling-V" auf Tanne – `icons/icon.svg` plus PNG 180
  (apple-touch-icon), 512 (any) und 512 maskable.
- **Dialoge:** statt nativer `confirm`/`alert` ein bodenbündiges Sheet
  (`<dialog>`, Scrim-Tap und ESC brechen ab) für Rückfragen und ein Toast für
  kurze Rückmeldungen – beide in der Design-Sprache, beide in `js/app.js`.

## Nächste Ausbaustufen (siehe Doku Kap. 9)

Lokale OFF/BLS-Produkt-DB (statt Live-Lookup) · Picnic-Anbindung (Rechtsrecherche liegt
vor: [docs/recherche-5-picnic-recht.md](docs/recherche-5-picnic-recht.md)) ·
Web-Push für feste Vorschlagszeiten (braucht Push-Server; bis dahin gilt der Fallback:
Vorschläge liegen beim Öffnen bereit – schaltet auch den automatischen Freitags-Crawl
frei) · Diktat/Chatbot- und Schrankfoto-Erfassung · Produkt-Icons je Zutat.

---

Vorratio ersetzt keine Ernährungs- oder ärztliche Beratung. Nährwert- und
Sicherheitsangaben basieren auf DGE, BfR und USDA/FSIS (Quellen in `docs/`).

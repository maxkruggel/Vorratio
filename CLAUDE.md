# Vorratio – Code-Map für Claude

Diese Datei ist die Einstiegskarte ins Projekt. Sie wird bei jedem Session-Start
automatisch geladen und ersetzt das Neu-Einlesen des Codes: Erst hier orientieren,
dann gezielt nur die Datei/Funktion öffnen, die für die Aufgabe gebraucht wird.
**Pflegeregel:** Wer Struktur, Module, Exporte, State-Schema oder zentrale Konzepte
ändert, aktualisiert diese Datei im selben Commit.

## Was Vorratio ist

Vorrats- und Rezept-App für iOS als Homescreen-PWA. Rein lokal: kein Backend, kein
Build-Schritt, kein Framework, keine Dependencies – Vanilla JS (ES-Module),
localStorage, Service Worker. Geschlossener Kreislauf: Bestand erfassen →
Rezeptvorschläge (3 je Essens-Slot + Snack-Ecke) → Kochmodus mit Timern →
automatische Abbuchung mit Toleranz → Einkauf füllt den Bestand wieder auf.

- Starten: `python3 -m http.server 8080` (statisch servieren reicht)
- Keine Tests, kein Linter, keine CI im Repo
- Sprache durchgehend Deutsch (Code-Bezeichner, Kommentare, UI)

## Dateibaum

```
index.html                 App-Shell: nur #app-Container + Tabbar (5 Tabs, Inline-SVGs), lädt js/app.js
manifest.webmanifest       PWA-Manifest
sw.js                      Service Worker: Network-first, Cache-Fallback. SHELL-Liste + CACHE-Version ("vorratio-vN")
css/style.css              Gesamtes Styling: Design-Tokens in :root + alle Komponenten (~950 Z., Sektionen per Kommentar)
fonts/                     Bricolage Grotesque (Display) + Figtree (Text) als lokale WOFF2 – kein CDN
icons/                     App-Icon „Keimling-V" (SVG + PNG 180/512/maskable)
js/app.js                  ~2200 Z. – Views, Steuerung, gesamtes UI (Details unten)
js/engine.js               Rezept-Engine: Profilfilter, Bestandsabgleich, Scoring, Abbuchung (pure Funktionen)
js/storage.js              State + Persistenz: DEFAULT_STATE, load/save, Export/Import, Migration
js/ai.js                   Claude API (clientseitig): Rezeptgenerierung, Bon-Scan, Barcode-Foto-Lesen
js/scan.js                 Barcode: Open-Food-Facts-Lookup, Fuzzy-Zutat-Matching, Kamera-Scan (BarcodeDetector)
js/angebote.js             Angebots-Crawl: Marktguru-Client, Suchprofile, Matching, Markt-Ranking
js/substitution.js         Ersatz-Logik: Alternativen filtern/priorisieren nach Profil + Anwendungsfall
js/icons.js                Duotone-Icon-Set (24er-Raster, 1,6 px Strich): icon(name, size, klasse), logoMark(size)
js/data/kerndb.js          Kern-DB (Schema kruggel-recipe-db/v1): ZUTATEN, REZEPTE, PREPS, BASES, TIPPS, IDEEN, TECHNIKEN
js/data/profil.js          Profil-Achsen: ERNAEHRUNGSFORMEN, FORM_ERLAUBT, AUSSCHLUESSE, STILE, ZIELE, FORM_HINWEISE
js/data/substitutionen.js  Substitutions-DB (vorratio-substitutions-db/v1): SUBSTITUTIONEN, BASIS_ALLERGENE, SUB_*
js/data/angebote-demo.js   DEMO_ANGEBOTE für den Crawl ohne API-Keys
docs/                      Projektdoku (vorratio-doku.md), 5 Recherchen, angebots-crawl.md, design-handoff/
```

## Architektur & Datenfluss

- **Ein globaler State** in `storage.js` (`getState()`), persistiert als ein
  JSON-Blob unter localStorage-Key `vorratio_v1`. Grundprinzip: **eine Aktion =
  ein `save()`**. Neue State-Felder in `DEFAULT_STATE` ergänzen UND in
  `migriere()` für Alt-Sicherungen nachrüsten.
- **Rendering:** Kein Framework. `app.js` hält den View-Zustand in
  Modul-Variablen (`view`, `cook`, `detailRezept`, `scanPanel`, `bon`, …).
  `render()` dispatcht auf `renderHeute/Vorrat/Einkauf/Wissen/Profil`; Kochmodus
  und Rezept-Detail haben Vorrang. Jede View baut ihren Screen als
  Template-String, `zeigeApp(html, key)` tauscht den Inhalt (gleicher key =
  kein Fade, Scrollposition bleibt), danach werden Listener neu gebunden.
  **Jede Interpolation von Nutzdaten läuft durch `esc()`.**
- **Engine ist pur:** `engine.js` kennt kein DOM und keinen State – bekommt
  Profil/Bestand als Argumente. Gute Stelle für Logik-Änderungen ohne UI-Risiko.
- **Daten sind Code:** Rezepte/Zutaten/Substitutionen liegen als JS-Konstanten
  in `js/data/`. Neue Rezepte = Eintrag in `REZEPTE` nach v1-Schema (s. u.).

## State-Schema (storage.js → DEFAULT_STATE)

```
profil        { name, ernaehrungsform, ausschluesse[], eigeneAusschluesse[], stile[], ziele[], onboarded }
bestand       [{ id, zutat_id, name, kategorie, art, einheit, menge, packung?, eigen?, updated }]
vorschlaege   { datum, slot, rezeptIds[], gewuerfelt, bestandLeer }   (Push-Fallback, tagesstabil)
snackVorschlaege { datum, rezeptIds[], gewuerfelt }
historie      [{ rezeptId, name, portionen, datum }]
einkauf       { rezept: [{zutat_id, name, menge, einheit, erledigt}], woche: [{zutat_id, name, erledigt, auto}], rezeptId }
angebote      { plz, apikey, clientkey, proxy, demo, letzter }        (Marktguru; letzter gilt 1 ISO-KW)
aiRezepte     [max. 24 AI-Rezepte, v1-kompatibel, id "AI-<ts>-<i>"]
tipps         { klicks, gesehen[], reihenfolge[] }                    (Tipp-Dosierung: Pop-up alle 9 Taps)
settings      { erstellt, apiKey }                                    (Claude-Key, nur lokal)
```

## Zentrale Konzepte (Begriffe, die überall auftauchen)

- **Toleranzprinzip (±10–15 %):** Nie Scheinpräzision. Anzeige als Näherung
  („~500 g"), `istVorhanden()` rechnet mit −15 %-Band, EL/TL/Prise/`nach_Bedarf`
  werden nie gerechnet (`mengeInBestandsEinheit()` → null), `abbuchen()` rundet
  g/ml auf 10er (`rund()`).
- **Führungsarten (`art`):** `schuettgut` (g/ml, Füllstands-Slider gegen
  `packung`), `zaehlbar` (Stk/Dose/Pck, Stepper), `pauschal` (nur da/leer;
  `menge: null` = vorrätig, `0` = leer). Bestimmt UI in `renderVorratEdit()`
  und die gesamte Mengenlogik.
- **Slots:** Frühstück/Mittag/Abend (8:00/11:30/17:30, `aktuellerSlot()`:
  Grenzen 11:00/16:00). **Push-Fallback:** kein Push-Server – Vorschläge werden
  beim Öffnen/`visibilitychange` erzeugt und persistiert
  (`stelleVorschlaegeBereit()`), tagesstabil via `tagesSeed()` + `pseudoZufall()`.
- **Snack-Ecke:** eigene Schiene außerhalb der Slots (`mahlzeitentyp: ["snack"]`,
  `SNK-`Rezepte). `nurSnack`-Rezepte tauchen nie in Essens-Slots auf, auch nicht
  beim Pool-Auffüllen.
- **Profil-Achsen (unabhängig):** 1 Ernährungsform (genau eine, `FORM_ERLAUBT`
  mappt auf Rezept-Tags) · 2 Ausschlüsse (EU-14 + halal/koscher + Freitext
  `eigeneAusschluesse` – filtern hart in `rezeptErlaubt()`) · 3 Stile (+15
  Score) · 4 Ziele (weich, ±18 Score via `zielBonus()`, UI-Badge via
  `zielTreffer()`, fließen in den AI-Systemprompt).
- **Scoring** (`vorschlaege()`): Bestandsdeckung ×100 + Stil 15 + Zielbonus ±18
  + Wurf-Varianz ×20. `basis: true`-Zutaten (Öl, Brühe, Essig) und `optional`
  zählen nie als fehlend.
- **Rezept-Schema kruggel-recipe-db/v1** (kerndb.js REZEPTE + ai.js
  REZEPT_SCHEMA): id, name, typ, kategorie, cuisine, mahlzeitentyp[],
  portionen, schwierigkeit, zutaten[{menge, einheit, zutat_id|null,
  zutat_name, optional?}], schritte[{nr, text, dauer_sekunden, temperatur_c,
  timer_typ: aktiv|passiv|ofen|ruhen, timer_name}], gesamtzeit_min,
  ernaehrungsform[], allergene[], naehrwert_einordnung{profil, makro_hinweis},
  tags[], quelle_typ. Kerntemperaturen = USDA/FSIS-Minima, stehen im Schritt.

## Modul-Index (Exporte → Zweck; Funktionen per Grep auffindbar)

**engine.js** – `aktuellerSlot`, `SLOT_NAMEN`, `rezeptErlaubt` (Achse 1+2 hart),
`bestandsAbgleich` (→ {vorhanden, fehlt, quote}), `vorschlaege`,
`snackVorschlaege`, `zielTreffer`, `tagesSeed`, `abbuchen`, `mengeAnzeige`,
`wochenKandidaten` (leer/≤20 % Packung → Wochenliste), `mengeInBestandsEinheit`,
`ZUTAT_INDEX`.

**app.js** – Sektionen in Dateireihenfolge (Kommentar-Trennlinien im Code):
Helpers (`esc`, `h`, `zeigeApp`) · Dialoge (`dialog`, `bestaetige`, `toast` –
ersetzen confirm/alert, hängen an body) · Tipp-Pop-up (alle 9 Taps) ·
`render()` + Tabbar · Onboarding (7 Schritte `OB_STEPS`, Zustand `ob`) ·
Heute (`stelleVorschlaegeBereit`, `stelleSnacksBereit`, `rezeptKarte`,
`starteAiGenerierung`) · Rezept-Detail (`ersatzIdeenHtml` = Substitutions-Teaser)
· Kochmodus (`cook`-Objekt, Schrittkarten, Timer mit `ende`-Timestamp +
250ms-Tick, Notification/Vibration) · Validierung/Abbuchung · Vorrat
(`zutatTreffer`-Suche inkl. Freitext-Anlage `addBestandFrei` mit `FREI_REGELN`,
`renderVorratEdit` je `art`) · Barcode-UI (`scanPanel`-Statusmaschine:
start→kamera/foto→laden→treffer/kein_treffer/fehler) · Einkauf
(`syncWochenliste`, `buchZugang` = zentrale Zugangsbuchung über Packungsgrößen)
· Bon-Scan (`bon`-Statusmaschine) · Angebots-Sektion (`starteCrawl`,
`crawlListe`) · Wissen (Tabs: tipps/ersatz/preps/bases/techniken) · Profil
(Achsen editieren, API-Key, Export/Import/Reset) · Start + `visibilitychange`.

**storage.js** – `load`, `save`, `getState`, `onChange`, `exportJson`,
`importJson`, `resetAll`. Migration in `migriere()`.

**ai.js** – `MODEL = "claude-opus-5"`, direkte Browser-Calls an
api.anthropic.com (Header `anthropic-dangerous-direct-browser-access`).
Strukturierte Ausgaben via `output_config.format json_schema`:
`generiereRezepte` (Systemprompt = Profilregeln DGE/BfR/USDA + Zutatenkatalog;
Bestand im User-Prompt), `scanBon` (Vision → Artikel mit zutat_id-Mapping),
`leseBarcodeVomFoto` (iOS-Fallback: Foto → EAN-Ziffern).

**scan.js** – `lookupBarcode` (OFF v2, „1 API call = 1 real scan"),
`vorschlagZutat` (Wortüberlappungs-Fuzzy → Nutzer bestätigt immer),
`kameraVerfuegbar`/`starteKameraScan` (BarcodeDetector; iOS Safari hat keinen →
Foto-Weg über ai.js).

**angebote.js** – `angebotsCrawl(liste, cfg, opts)` → Ergebnisobjekt
{kw, items, maerkte, empfehlung (max. 3), ohneAngebot, fehler}. `SUCHPROFILE`
(je zutat_id: q/muster/nicht), `passtAngebot` (Token-Matching mit
Komposita-Regeln), `marktAuswertung` (Deckung > Ø-Rabatt > Angebotszahl),
`liveKonfiguriert`, `isoWoche`. Ohne Keys: Demo-Pfad über angebote-demo.js.

**substitution.js** – `ersatzVorschlaege(zutatId, profil)` (beste Alternative je
Datensatz, fürs Rezept-Detail), `subsFiltern` (Wissen-Tab), `produkteSortiert`
(Eigenmarken zuerst). Ei ist funktionsbasiert modelliert (mehrere Datensätze).
Allergie-Filter über `BASIS_ALLERGENE[alt.basis]`, hart wie überall.

## Externe Dienste (alle direkt vom Client)

| Dienst | Wofür | Zugang |
|---|---|---|
| api.anthropic.com | AI-Rezepte, Bon-Scan, Barcode-Foto | Nutzer-Key in `settings.apiKey` (nur lokal) |
| world.openfoodfacts.org | Barcode → Produktdaten | frei (ODbL), sparsam nutzen |
| api.marktguru.de | Angebots-Crawl | inoffiziell; `angebote.apikey/clientkey` + PLZ, sonst Demo |

## Design-Regeln (verbindlich)

- Farbwelt „Papier & Tanne" (Variante 2A): Papier `#f3efe5`, Fläche `#fffdf8`,
  Tanne `#2c5b43`, Tanne soft `#dfe9e0`, Terrakotta `#b4552d`, Tinte `#1c231e`
  – als Custom Properties in `css/style.css :root`. **Kein Dark Mode**
  (`color-scheme: light`), keine neuen Farben erfinden.
- Typo: Bricolage Grotesque 600/700 (Display, Überschriften klein gesetzt),
  Figtree 400–600 (Text). Nur die lokalen WOFF2, kein CDN (Offline-Fähigkeit).
- Icons: nur `js/icons.js`-Set (Duotone, 24er-Raster, 1,6 px; Fläche über
  `--duo`). Keine Emoji/Unicode-Symbole als UI-Icons.
- Keine nativen `confirm()`/`alert()` – immer `dialog()`/`bestaetige()`/`toast()`.
- Texte: Deutsch, direkt, ehrlich (Evidenz-Hinweise inkl. dem, was NICHT belegt
  ist); Überschriften klein („vorrat", „moin, Max").

## Stolperfallen & Konventionen

- **sw.js:** Neue Datei → in `SHELL` eintragen UND `CACHE`-Version hochzählen
  („vorratio-vN"), sonst laden Alt-Clients sie offline nie.
- Nach jeder State-Mutation `save()` aufrufen; UI danach über die passende
  `renderX()` neu zeichnen (Listener werden bei jedem Render neu gebunden).
- `zeigeApp(html, key)`: gleicher key = kein Fade/kein Scroll-Reset. Für neue
  Screens eindeutigen key vergeben.
- AI-Rezepte leben nur in `state.aiRezepte` – Rezeptzugriff daher immer über
  `alleRezepte()`/`findRezept()` (app.js), nie direkt über `REZEPTE`.
- Freitext-Zutaten bekommen `zutat_id` mit Präfix `frei_` und fehlen in
  `ZUTAT_INDEX` – Code, der `ZUTAT_INDEX[zutat_id]` liest, muss null-tolerant sein.
- `mengeInBestandsEinheit()` gibt bewusst oft `null` zurück (= nicht rechnen,
  Toleranzprinzip) – nicht „reparieren".
- Kommentare im Code verweisen auf Doku-Kapitel („Kap. 4.7") =
  `docs/vorratio-doku.md` und auf Design-Nummern („Design 19") =
  Screenshots in `docs/design-handoff/screenshots/`.

## Roadmap (nächste Ausbaustufen, Doku Kap. 9)

1. Lokale OFF/BLS-Produkt-DB statt Live-Lookup (GTIN-Mapping in kerndb vorbereitet)
2. Picnic-Anbindung (Rechtsrecherche liegt vor: docs/recherche-5-picnic-recht.md)
3. Web-Push für feste Vorschlagszeiten (braucht Push-Server; bis dahin gilt der
   dokumentierte Öffnen-Fallback) + automatischer Freitags-Crawl
4. Diktat-/Chatbot- und Schrankfoto-Erfassung
5. Produkt-Icons je Zutat (Brief: docs/design-handoff/ICON-BRIEF-PRODUKT-ICONS.md)

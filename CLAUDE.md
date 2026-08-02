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

- Läuft öffentlich auf GitHub Pages: **https://maxkruggel.github.io/Vorratio/** – jeder Push
  auf `main` deployt automatisch. Das ist die Adresse für den Homebildschirm; nur dort
  bleiben die Daten (localStorage hängt an der Adresse).
- Lokal starten: `python3 -m http.server 8080` (statisch servieren reicht) – zum Entwickeln,
  nicht zum Installieren
- Prüfen: `node tools/validate-db.mjs` (Rezeptdaten) + `node tools/test-engine.mjs`
  (Engine). Beides läuft in der CI (`.github/workflows/ci.yml`), ohne
  Abhängigkeiten. Dazu `node tools/pr-aktuell.mjs` (Branch-Stand vor einer PR,
  s. u.). Kein Linter, kein Build-Schritt.
- Sprache durchgehend Deutsch (Code-Bezeichner, Kommentare, UI)

## Dateibaum

```
index.html                 App-Shell: nur #app-Container + Tabbar (6 Tabs, Inline-SVGs), lädt js/app.js
manifest.webmanifest       PWA-Manifest
sw.js                      Service Worker: Network-first mit 3s-Timeout + Revalidierung, Cache-Fallback;
                           cached nur res.ok. SHELL-Liste + CACHE-Version ("vorratio-vN"), Versionsauskunft per postMessage
css/style.css              Gesamtes Styling: Design-Tokens in :root + alle Komponenten (~960 Z., Sektionen per Kommentar)
fonts/                     Bricolage Grotesque (Display) + Figtree (Text) als lokale WOFF2 – kein CDN
icons/                     App-Icon „Keimling-V" (SVG + PNG 180/512/maskable)
js/app.js                  ~2200 Z. – Views, Steuerung, übriges UI (Details unten)
js/ui.js                   UI-Grundbausteine ohne State-Kenntnis: esc, h, zeigeApp, dialog,
                           bestaetige, toast, progressBar, fmtZeit
js/kochmodus.js            Kochmodus: Portionswahl, Schrittkarten, Timer, Abbuchung.
                           Zustand liegt im State (state.kochen), Timer rechnet gegen Zeitstempel
js/engine.js               Rezept-Engine: Profilfilter, Bestandsabgleich, Scoring, Abbuchung (pure Funktionen)
js/kochbuch.js             Kochbuch: merken/vergessen/Notiz, Suche+Filter, eigene Rezepte, Tag-Ableitung aus Zutaten
js/storage.js              State + Persistenz: DEFAULT_STATE, load/save, Export/Import, Migration, lokalesDatum
js/ai.js                   Claude API (clientseitig): Rezeptgenerierung, Bon-Scan, Diktat-Auswertung, Barcode-Foto-Lesen
js/generator.js            Offline-Generator: baut aus dem Bestand Rezepte nach Küchenmustern (ohne API-Key)
js/scan.js                 Barcode: Open-Food-Facts-Lookup, Fuzzy-Zutat-Matching, Kamera-Scan (BarcodeDetector)
js/diktat.js               Diktat: Web-Speech-Aufnahme + lokaler Parser (Zahlwörter, Einheiten, Anteile, Katalog-Matching)
js/angebote.js             Angebots-Crawl: Marktguru-Client, Suchprofile, Matching, Markt-Ranking
js/substitution.js         Ersatz-Logik: Alternativen filtern/priorisieren nach Profil + Anwendungsfall
js/icons.js                Duotone-Icon-Set (24er-Raster, 1,6 px Strich): icon(name, size, klasse), logoMark(size)
js/data/kerndb.js          Kern-DB: ZUTATEN + REZEPTE_KERN, PREPS, BASES, TIPPS, IDEEN, TECHNIKEN.
                           REZEPTE = Zusammenbau aller fünf Rezeptblöcke (Schema kruggel-recipe-db/v1)
js/data/rezepte-kern|komplex|tofu|welt|alltag|fruehstueck.js
                           Rezeptblöcke (RCP-/SNK- · KMX- · TOF- · WLT- · ALL- · FRU-)
js/data/allergene.js       EINE Quelle für Allergene + Schwein/Alkohol: ZUTAT_ALLERGENE, NAME_MUSTER,
                           FALSCHE_FREUNDE, allergeneFuerRezept, enthaeltSchwein, enthaeltAlkohol
js/data/profil.js          Profil-Achsen: ERNAEHRUNGSFORMEN, FORM_ERLAUBT, AUSSCHLUESSE, VORLIEBEN, STILE, ZIELE
js/data/substitutionen.js  Substitutions-DB (vorratio-substitutions-db/v1): SUBSTITUTIONEN, BASIS_ALLERGENE, SUB_*
js/data/angebote-demo.js   DEMO_ANGEBOTE für den Crawl ohne API-Keys
tools/validate-db.mjs      Datenbank-Validator (Schema, IDs, Allergen-Deklaration) – Exit 1 bei Fehlern
tools/test-engine.mjs      Engine-Tests ohne Framework – Filter, Toleranzband, Abbuchung, Abdeckung
tools/browsertest.mjs      Browser-Rauchtest (Onboarding→Tabs→Kochmodus→Neuladen). Nicht in der CI,
                           braucht einmalig `npm install --no-save playwright-core`
tools/pr-aktuell.mjs       PR-Aktualitätsprüfung gegen main (node tools/pr-aktuell.mjs)
docs/                      Projektdoku (vorratio-doku.md), 5 Recherchen, angebots-crawl.md, design-handoff/
```

## Architektur & Datenfluss

- **Selbstaktualisierung:** iOS setzt Homescreen-Web-Apps fort statt sie neu zu laden.
  `starteServiceWorker()` registriert mit `updateViaCache: "none"`, jede Rückkehr in den
  Vordergrund ruft `sucheUpdate()`; übernimmt ein neuer Worker (`controllerchange`), lädt
  `spieleUpdateEin()` einmal neu – aber nur wenn `darfNeuLaden()` (nichts Angefangenes,
  kein offener Dialog). Ansicht und Rückmeldung laufen über `sessionStorage`
  (`meldeUpdateNach()`). **Reihenfolge beachten:** Der Block steht bewusst VOR der
  Start-Sektion – `meldeUpdateNach()` greift auf eine `const` zu, die sonst in der
  temporalen Todeszone läge und deren Fehler im `try/catch` verschwände.
- **Ein globaler State** in `storage.js` (`getState()`), persistiert als ein
  JSON-Blob unter localStorage-Key `vorratio_v1`. Grundprinzip: **eine Aktion =
  ein `save()`**. Neue State-Felder in `DEFAULT_STATE` ergänzen UND in
  `migriere()` für Alt-Sicherungen nachrüsten.
- **Rendering:** Kein Framework. `app.js` hält den View-Zustand in
  Modul-Variablen (`view`, `detailRezept`, `editor`, `scanPanel`, `bon`, …).
  `render(zielView?)` dispatcht auf
  `renderHeute/Kochbuch/Vorrat/Einkauf/Wissen/Profil`; Kochmodus, Rezept-Editor
  und Rezept-Detail haben Vorrang (in dieser Reihenfolge). Jede View baut ihren Screen als
  Template-String, `zeigeApp(html, key)` tauscht den Inhalt (gleicher key =
  kein Fade, Scrollposition bleibt), danach werden Listener neu gebunden.
  **Jede Interpolation von Nutzdaten läuft durch `esc()`.**
- **Kochmodus getrennt:** `kochmodus.js` bekommt per `initKochmodus()` nur
  `{ render, findRezept, syncWochenliste }` gereicht – kein zirkulärer Import.
  Sein Zustand liegt in `state.kochen` und wird bei jedem Schritt gespeichert.
- **Engine ist pur:** `engine.js` kennt kein DOM und keinen State – bekommt
  Profil/Bestand als Argumente. Gute Stelle für Logik-Änderungen ohne UI-Risiko.
  Getestet in `tools/test-engine.mjs`; Änderungen dort mit Test belegen.
- **Daten sind Code:** Rezepte/Zutaten/Substitutionen liegen als JS-Konstanten
  in `js/data/`. Neue Rezepte = Eintrag in einem `rezepte-*.js`-Block nach
  v1-Schema (s. u.); der Block muss in `kerndb.js` in `REZEPTE` einfließen.

## State-Schema (storage.js → DEFAULT_STATE)

```
profil        { name, ernaehrungsform, ausschluesse[], eigeneAusschluesse[], vorlieben[], stile[], ziele[], onboarded }
bestand       [{ id, zutat_id, name, kategorie, art, einheit, menge, packung?, eigen?, updated }]
vorschlaege   { datum, slot, rezeptIds[], gewuerfelt, bestandLeer }   (Push-Fallback, tagesstabil)
snackVorschlaege { datum, rezeptIds[], gewuerfelt }
historie      [{ rezeptId, name, portionen, datum }]
einkauf       { rezept: [{zutat_id, name, menge, einheit, erledigt}], woche: [{zutat_id, name, erledigt, auto}], rezeptId }
angebote      { plz, apikey, clientkey, proxy, demo, letzter }        (Marktguru; letzter gilt 1 ISO-KW)
aiRezepte     [max. 24 AI-Rezepte, v1-kompatibel, id "AI-<ts>-<i>"]
vorratRezepte [max. 24 offline generierte Rezepte, id "GEN-<hash>"]
kochbuch      [gemerkte + eigene Rezepte als vollständige v1-Kopien, je + gespeichert, notiz]
kochen        { rezeptId, portionen, step, timer } | null             (laufender Kochdurchgang)
tipps         { klicks, gesehen[] }                                   (Tipp-Dosierung: Pop-up alle 9 Taps)
settings      { erstellt, apiKey }                                    (Claude-Key, nur lokal; NICHT im Export)
```

`migriere()` füllt verschachtelte Teilbäume einzeln auf – der Spread beim Laden
ersetzt sonst ein ganzes Objekt und hinterlässt fehlende Unterfelder.
`save()` liefert `false`, wenn das Schreiben scheitert, und meldet es über
`onSpeicherFehler()`; app.js zeigt dann einmalig den Hinweis auf den Export.
Datumsstempel für Tagesvorschläge kommen aus `lokalesDatum()` (Ortszeit, nicht UTC).

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
- **Kochbuch (`state.kochbuch`):** speichert **Kopien**, keine Verweise – ein
  gemerktes AI- oder Vorrats-Rezept überlebt so die Rotation seines Pools und
  das Löschen im Profil. Herkunft steckt in `quelle_typ` (`ai_generiert`,
  `vorrat_generiert`, `eigen`, sonst Kern-DB) und steuert nur Pill und Filter.
  Eigene Rezepte (`EIG-…`) entstehen im Editor; Ernährungsform und Allergene
  werden dort aus den Zutaten abgeleitet (`tagsAusZutaten`) und sind
  korrigierbar – beide filtern hart.
- **Snack-Ecke:** eigene Schiene außerhalb der Slots (`mahlzeitentyp: ["snack"]`,
  `SNK-`Rezepte). `nurSnack`-Rezepte tauchen nie in Essens-Slots auf, auch nicht
  beim Pool-Auffüllen.
- **Diktat (`js/diktat.js`, UI im Vorrat):** Aufzählen statt antippen. Die
  Auswertung läuft ohne Key lokal, mit Key über `leseDiktat()` – beide liefern
  dieselbe Eintragsform und enden in derselben Bestätigungsliste. „halb
  voll"/„fast leer" werden als Anteil der Packung gebucht (`aktion: "anteil"`),
  nie als Scheingramm. **Nur Bestandsaufnahme:** ein Diktat **setzt** den Stand,
  Bon-Scan und Barcode **addieren** über `buchZugang()`. Eine additive
  Diktat-Variante fehlt absichtlich – nicht vergessen, sondern entschieden
  (Doku 7.5); wer sie nachrüstet, ändert damit ein zugesagtes Verhalten.
- **Profil-Achsen (5, unabhängig):** 1 Ernährungsform (genau eine, `FORM_ERLAUBT`
  mappt auf Rezept-Tags) · 2 Ausschlüsse (EU-14 + halal/koscher + Freitext
  `eigeneAusschluesse` – filtern **hart** in `rezeptErlaubt()`) · 3 Vorlieben
  (weich, bis +14 via `vorliebenBonus()`) · 4 Stile (+15 Score) · 5 Ziele
  (weich, ±18 Score via `zielBonus()`, UI-Badge via `zielTreffer()`).
  Achsen 1–3 und 5 fließen in den AI-Systemprompt, inklusive der Freitext-Ausschlüsse.
- **Allergene werden nie geglaubt, sondern abgeleitet:** Der harte Filter nutzt
  `allergeneFuerRezept()` = Deklaration ∪ aus `zutat_id` abgeleitet ∪ aus
  Zutatennamen erkannt (`js/data/allergene.js`). Damit rutscht auch ein
  AI-Rezept mit falsch ausgefülltem `allergene`-Feld nicht durch. Wer die
  Muster erweitert, prüft die `FALSCHE_FREUNDE`-Liste mit: „Kokosmilch" ist
  keine Laktose, „Erdnuss" keine Schalenfrucht, „Reisnudeln" kein Gluten.
- **halal/koscher** (`RELIGIOES` in engine.js): halal = kein Schwein, kein
  Alkohol (auch verkocht), keine Krebs-/Weichtiere; koscher = kein Schwein,
  keine Krebs-/Weichtiere, keine Fleisch-Milch-Kombination. Erkennung über
  `enthaeltSchwein()`/`enthaeltAlkohol()` – zutat_id **und** Name.
- **Scoring** (`bewerte()` – eine Stelle für Slots und Snacks): Bestandsdeckung
  ×100 + Stil 15 + Vorlieben bis 14 + Zielbonus ±18 + Wurf-Varianz ×20.
  `basis: true`-Zutaten (Öl, Brühe, Essig) und `optional` zählen nie als fehlend.
  Ist ein Slot-Pool zu dünn, füllt `vorschlaege()` mit slot-fremden Rezepten auf –
  bewertet und sortiert wie die anderen, in der UI als „eigentlich fürs …" markiert.
- **Rezept-Schema kruggel-recipe-db/v1** (kerndb.js REZEPTE + ai.js
  REZEPT_SCHEMA): id, name, typ, kategorie, cuisine, mahlzeitentyp[],
  portionen, schwierigkeit, zutaten[{menge, einheit, zutat_id|null,
  zutat_name, optional?}], schritte[{nr, text, dauer_sekunden, temperatur_c,
  timer_typ: aktiv|passiv|ofen|ruhen, timer_name}], gesamtzeit_min,
  ernaehrungsform[], allergene[], naehrwert_einordnung{profil, makro_hinweis},
  tags[], quelle_typ. Kerntemperaturen = USDA/FSIS-Minima, stehen im Schritt.

## Modul-Index (Exporte → Zweck; Funktionen per Grep auffindbar)

**engine.js** – `aktuellerSlot`, `SLOT_NAMEN`, `rezeptErlaubt` (Achse 1+2 hart),
`bestandsAbgleich` (→ {vorhanden, fehlt, quote}), `bestandsPosten`,
`istVorhanden` (summiert über mehrere Posten derselben Zutat), `bewerte`,
`vorschlaege`, `snackVorschlaege`, `zielTreffer`, `vorliebenTreffer`,
`tagesSeed`, `pseudoZufall`, `abbuchen` (räumt mehrere Posten der Reihe nach ab),
`mengeAnzeige`, `wochenKandidaten` (leer/≤20 % Packung → Wochenliste),
`mengeInBestandsEinheit`, `ZUTAT_INDEX`.

**ui.js** – `app`, `esc`, `h`, `zeigeApp`, `aktuellerScreen`, `dialog`,
`bestaetige`, `toast` (ersetzen confirm/alert, hängen an body), `progressBar`,
`fmtZeit`. Kennt weder State noch Views.

**kochmodus.js** – `initKochmodus({render, findRezept, syncWochenliste})`,
`startKochen`, `beendeKochen`, `darfVerlassen`, `istAktiv`, `stelleKochenWieder`
(Start), `renderKochmodus`, `pruefeTimerNachPause` (`visibilitychange`).
Timer rechnet gegen `ende`-Zeitstempel + 250-ms-Tick; nach Neuladen/Rückkehr
wird gegen die Wanduhr nachgezogen und der Tick neu gestartet.

**app.js** – Sektionen in Dateireihenfolge (Kommentar-Trennlinien im Code):
Tipp-Pop-up (alle 9 Taps) · `render(zielView?)` + Tabbar · Onboarding
(7 Schritte `OB_STEPS`, Zustand `ob`) · Heute (`stelleVorschlaegeBereit`,
`stelleSnacksBereit`, `rezeptKarte`, `quellenBadge`, `slotHinweis`,
`baueAusVorrat`, `starteAiGenerierung` inkl. Gegenprüfung der gelieferten
Rezepte) · Rezept-Detail (`ersatzIdeenHtml` = Substitutions-Teaser,
Merken-Schalter, Notiz) · Kochbuch (`renderKochbuch`, `kochbuchTrefferHtml`)
+ Rezept-Editor (`editor`-Entwurf, `uebernehmeEditorFelder` liest sichtbare
Felder vor jedem Neuzeichnen zurück) · Vorrat
(`zutatTreffer`-Suche inkl. Freitext-Anlage `addBestandFrei` mit `FREI_REGELN`,
`renderVorratEdit` je `art`) · Barcode-UI (`scanPanel`-Statusmaschine:
start→kamera/foto→laden→treffer/kein_treffer/fehler) · Diktat-UI
(`diktat`-Statusmaschine: start→hoeren→lesen→ergebnis/fehler; `werteDiktatAus`
= Claude oder lokaler Parser, `uebernehmeDiktat`, `diktatMenge` = diktierte
Angabe → Bestandsmenge) · Einkauf
(`syncWochenliste`, `bestandFuer`/`freierBestand` = Bestandszeile holen/anlegen,
`buchZugang` = zentrale Zugangsbuchung über Packungsgrößen)
· Bon-Scan (`bon`-Statusmaschine) · Angebots-Sektion (`starteCrawl`,
`crawlListe`) · Wissen (Tabs: tipps/ersatz/preps/bases/techniken) · Profil
(Achsen editieren, API-Key, App-Stand + „Prüfen", Export/Import/Reset) ·
App-Aktualisierung (`starteServiceWorker`, `sucheUpdate`, `spieleUpdateEin`,
`darfNeuLaden`, `meldeUpdateNach`) · Start (`initKochmodus`,
`onSpeicherFehler`, `stelleKochenWieder`) + `visibilitychange`.

**storage.js** – `load`, `save` (→ bool), `getState`, `onChange`,
`onSpeicherFehler`, `exportJson` (ohne API-Key), `importJson` (behält den Key
des Geräts), `resetAll`, `lokalesDatum`. Migration in `migriere()`.

**kochbuch.js** – `merken`/`vergessen`/`setzeNotiz`/`ersetze` (State-Mutationen,
`save()` bleibt Sache des Aufrufers), `istGemerkt`/`findeGemerkt`,
`kochbuchListe` (Suche + Herkunftsfilter), `gekochtAnzahl` (aus `historie`),
`katalogZutaten` (Kern-Zutaten + eigene Vorratsartikel für die Editor-Auswahl),
`tagsAusZutaten` (Muster → Ernährungsform/Allergene), `leererEntwurf`/
`entwurfAus`/`entwurfFehler`/`eigenesRezept` (Editor-Entwurf ↔ v1-Rezept),
`KOCHBUCH_FILTER`, `QUELLE_LABEL`, `quelleVon`.

**data/allergene.js** – `allergeneFuerRezept` (Deklaration ∪ Ableitung),
`allergeneAusZutaten` (nur zutat_id, für den Validator), `enthaeltSchwein`,
`enthaeltAlkohol`, `ZUTAT_ALLERGENE`, `NAME_MUSTER`, `SCHWEIN_IDS`, `ALKOHOL_IDS`.
Wird von engine.js, ai.js, generator.js und tools/validate-db.mjs gemeinsam genutzt.

**generator.js** – `generiereAusVorrat(profil, bestand, slot, anzahl, seed)`
(Templates: Pfanne/Eintopf/Blech/Suppe/Pasta/Bowl/Salat, deterministisch pro
Seed, Allergene über data/allergene.js), `vorratsTiefe` (belegte Rollen → UI-Hinweis).

**ai.js** – `MODEL = "claude-opus-5"`, direkte Browser-Calls an
api.anthropic.com (Header `anthropic-dangerous-direct-browser-access`).
Strukturierte Ausgaben via `output_config.format json_schema`:
`generiereRezepte` (Systemprompt = Profilregeln DGE/BfR/USDA + Zutatenkatalog;
Bestand im User-Prompt), `scanBon` (Vision → Artikel mit zutat_id-Mapping),
`leseDiktat` (Diktattext → Artikel mit zustand menge/anteil/vorraetig/leer),
`leseBarcodeVomFoto` (iOS-Fallback: Foto → EAN-Ziffern).

**scan.js** – `lookupBarcode` (OFF v2, „1 API call = 1 real scan"),
`vorschlagZutat` (Wortüberlappungs-Fuzzy → Nutzer bestätigt immer),
`kameraVerfuegbar`/`starteKameraScan` (BarcodeDetector; iOS Safari hat keinen →
Foto-Weg über ai.js).

**diktat.js** – `diktatVerfuegbar`/`starteDiktat` (Web Speech, de-DE, hört nach
jeder Sprechpause von allein weiter), `parseDiktat(text, bestand)` → Einträge
{rohtext, name, zutat_id, menge, einheit, anteil, aktion, sicher} – dieselbe
Form liefert `leseDiktat` aus ai.js. Rein lokal: `ZAHLWORT`, `EINHEIT_WORT`,
`ANTEIL_MUSTER`, `LEER_MUSTER`, `ALIAS` (Kurzform → zutat_id), `findeZutat`
(Wortstamm-Matching, von der genannten Einheit geschärft), `diktatAnzeige`.

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
| api.anthropic.com | AI-Rezepte, Bon-Scan, Diktat-Auswertung, Barcode-Foto | Nutzer-Key in `settings.apiKey` (nur lokal) |
| Spracherkennung des Browsers | Diktat aufnehmen (Web Speech API) | ohne Key; die Erkennung läuft beim Plattformbetreiber (iOS: Apple), nicht bei Vorratio |
| world.openfoodfacts.org | Barcode → Produktdaten | frei (ODbL), sparsam nutzen |
| api.marktguru.de | Angebots-Crawl | inoffiziell; `angebote.apikey/clientkey` + PLZ, sonst Demo |

Der optionale `angebote.proxy` schickt PLZ, Einkaufsliste und beide Schlüssel
über einen fremden Server – die UI warnt, sobald das Feld gefüllt ist. Die
Marktguru-Schnittstelle ist nicht offiziell und kann jederzeit wegbrechen;
Fallback sind dann die Demo-Angebote.

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
- **Neuer Rezeptblock:** Datei in `js/data/`, Import + Spread in `kerndb.js`
  (`REZEPTE`), Eintrag in `sw.js` SHELL, danach `node tools/validate-db.mjs`.
- Nach jeder State-Mutation `save()` aufrufen; UI danach über die passende
  `renderX()` neu zeichnen (Listener werden bei jedem Render neu gebunden).
- `zeigeApp(html, key)`: gleicher key = kein Fade/kein Scroll-Reset. Für neue
  Screens eindeutigen key vergeben.
- Rezepte liegen in vier Töpfen (`REZEPTE`, `state.aiRezepte`,
  `state.vorratRezepte`, `state.kochbuch`) – Zugriff daher immer über
  `alleRezepte()`/`findRezept()` (app.js), nie direkt über `REZEPTE`.
  `alleRezepte()` dedupliziert über die `id`, weil das Kochbuch Kopien hält.
- Im Rezept-Editor lösen nur Struktur-Änderungen (Zeile zu/weg, Chip, Stepper)
  ein Neuzeichnen aus, und immer erst nach `uebernehmeEditorFelder()` – sonst
  ist das Getippte weg.
- Freitext-Zutaten bekommen `zutat_id` mit Präfix `frei_` und fehlen in
  `ZUTAT_INDEX` – Code, der `ZUTAT_INDEX[zutat_id]` liest, muss null-tolerant sein.
- `mengeInBestandsEinheit()` gibt bewusst oft `null` zurück (= nicht rechnen,
  Toleranzprinzip) – nicht „reparieren".
- **Kein `new Date().toISOString().slice(0,10)` für Tagesdaten** – das ist UTC
  und wechselt in der Sommerzeit erst um 2 Uhr. `lokalesDatum()` nutzen.
- Eine Zutat darf mehrfach im Bestand liegen. Wer über den Bestand rechnet,
  nimmt `bestandsPosten()` und summiert – nicht `bestand.find()`.
- Kommentare im Code verweisen auf Doku-Kapitel („Kap. 4.7") =
  `docs/vorratio-doku.md` und auf Design-Nummern („Design 19") =
  Screenshots in `docs/design-handoff/screenshots/`.

## Pull Requests: an diesem Repo arbeiten mehrere Prozesse parallel

Während ein Branch reift, wandern andere PRs nach `main`. Ein Branch, der beim
Anlegen noch sauber war, ist beim Mergen womöglich veraltet – und `main` fasst
regelmäßig dieselben Stellen an (`js/storage.js` bekommt mit jeder neuen
Funktion ein State-Feld, `sw.js` eine SHELL-Zeile, `js/data/profil.js` eine
Achse). Erfahrungswert aus der Praxis: drei Nachzüge innerhalb einer Sitzung.

**Pflicht vor jedem `git push`, vor dem Anlegen einer PR und bevor eine PR als
fertig oder mergebar gemeldet wird:**

```bash
node tools/validate-db.mjs && node tools/pr-aktuell.mjs
```

`tools/pr-aktuell.mjs` prüft in einem Lauf: Arbeitsbaum committet · alles
gepusht (sonst zeigt die PR einen älteren Head) · `origin/main` vollständig
enthalten · Merge liefe konfliktfrei. Exit 1 = erst nachziehen, die Ausgabe
nennt den Befehl. Exit 2 = Prüfung selbst nicht möglich (kein Netz, kein
Repo) – das ist **kein** Freifahrtschein.

Die Statusanzeige von GitHub ist dafür kein Ersatz: `mergeable_state` wird
asynchron berechnet und liefert direkt nach einem Push `unknown` oder einen
veralteten Wert. Im Zweifel gilt der lokale Lauf.

Nach jedem Nachziehen die inhaltlichen Prüfungen wiederholen – ein Merge kann
Rezeptdaten, Icon-Verwendung oder State-Felder verändern, ohne dass es
Konflikte gibt.

## Roadmap (nächste Ausbaustufen, Doku Kap. 9)

1. Lokale OFF/BLS-Produkt-DB statt Live-Lookup (GTIN-Mapping in kerndb vorbereitet)
2. Picnic-Anbindung (Rechtsrecherche liegt vor: docs/recherche-5-picnic-recht.md)
3. Web-Push für feste Vorschlagszeiten (braucht Push-Server; bis dahin gilt der
   dokumentierte Öffnen-Fallback) + automatischer Freitags-Crawl
4. Chatbot- und Schrankfoto-Erfassung (Diktat ist umgesetzt, s. `js/diktat.js`)
5. Produkt-Icons je Zutat (Brief: docs/design-handoff/ICON-BRIEF-PRODUKT-ICONS.md)

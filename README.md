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

- **Onboarding** mit Ernährungsprofil auf drei unabhängigen Achsen (Kap. 6.1):
  Ernährungsform (8 Presets, DGE-basiert) · Ausschlüsse (EU-14-Allergene, halal/koscher) ·
  Stil-Präferenzen (mediterran, High-Protein, Low-Carb; Keto/Paleo mit Evidenz-Hinweis) –
  plus Toleranz-Hinweis.
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
- **Wissen**: 18 Grundtechniken, 15 Produktzubereitungen, 9 Grundrezepte, Tipps & Ideen aus
  der Kern-Rezept-DB (Schema `kruggel-recipe-db/v1`, 25 Vollrezepte strukturiert).
- **Persistenz** (Kap. 6.4): Auto-Save je Aktion (localStorage), JSON-Export/-Import als
  Backup; offlinefähig per Service Worker.

## Struktur

```
index.html            App-Shell (PWA)
manifest.webmanifest  Web-App-Manifest
sw.js                 Service Worker (Offline-Shell)
css/style.css         Neutrales Design (Branding wird später übergelegt)
js/app.js             Views & Steuerung
js/engine.js          Rezept-Engine: Profilfilter, Bestandsabgleich, Abbuchung
js/ai.js              Claude API: Rezeptgenerierung + Bon-Scan (strukturierte Ausgaben)
js/scan.js            Barcode: Open-Food-Facts-Lookup, Zutat-Matching, Kamera-Scan
js/storage.js         Auto-Save, JSON-Export/-Import
js/data/kerndb.js     Kern-DB nach kruggel-recipe-db/v1 (Rezepte, Preps, Techniken …)
js/data/profil.js     Ernährungsprofil-Achsen + DGE/BfR-Hinweise
docs/                 Projektdoku + die drei Daten-Recherchen
```

## Nächste Ausbaustufen (siehe Doku Kap. 9)

Lokale OFF/BLS-Produkt-DB (statt Live-Lookup) · Picnic-Anbindung (nach Rechtsrecherche) ·
Angebots-Crawl · Web-Push für feste Vorschlagszeiten (braucht Push-Server; bis dahin gilt
der Fallback: Vorschläge liegen beim Öffnen bereit) · Diktat/Chatbot- und
Schrankfoto-Erfassung · Icon-Palette & finales Branding.

---

Vorratio ersetzt keine Ernährungs- oder ärztliche Beratung. Nährwert- und
Sicherheitsangaben basieren auf DGE, BfR und USDA/FSIS (Quellen in `docs/`).

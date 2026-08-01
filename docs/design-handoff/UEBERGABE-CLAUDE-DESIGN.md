# Vorratio – Design-Übergabe an Claude Design

Stand: 01.08.2026 · Codestand: v2 (Ausbaustufe 2) · Ansprechpartner: Max Kruggel

Diese Übergabe enthält alles, was Claude Design braucht, um die finale visuelle
Identität für Vorratio zu entwickeln: Produktkontext, technische Leitplanken,
Informationsarchitektur, sämtliche Screens als Screenshots (Ordner
`screenshots/`, iPhone-Format 390×844 @2x), das komplette Komponenten- und
Symbol-Inventar sowie die Ist-Design-Tokens als Andockpunkt.

---

## 1. Was ist Vorratio?

Vorrats- und Rezept-App fürs iPhone als Homescreen-Web-App (PWA), rein lokal,
ohne Backend. Der Kreislauf: Die App kennt den Haushaltsbestand → schlägt
dreimal täglich Rezepte daraus vor (8:00 / 11:30 / 17:30) → führt mit benannten
Timern durchs Kochen → bucht den Verbrauch automatisch ab (Toleranzprinzip
±10–15 %, nie Scheinpräzision – Mengen immer als „~500 g") → hält den Bestand
über Einkauf, Barcode-Scan und Bon-Scan aktuell. AI-Features (Rezeptgenerierung,
Bon-Scan) laufen über die Claude API mit lokalem Key.

## 2. Der Auftrag

Laut Projektdoku (Kap. 8) wurde Vorratio **bewusst neutral** gebaut: ruhige
Fläche, klare Karten, System-Typografie. Die visuelle Identität soll jetzt
entwickelt und **übergelegt** werden. Fix ist nur der Name **Vorratio**.

Gewünschte Deliverables:

1. **Farbwelt** – Ersatz/Weiterentwicklung der neutralen Grün-Palette (Ist-Werte in Abschnitt 7).
2. **Typografie** – aktuell System-Font; Webfonts sind möglich (müssen lokal gebundelt werden, kein CDN – PWA ist offlinefähig).
3. **Icon-Set** – alle aktuellen Symbole sind Unicode-Glyphen/Emoji-Platzhalter. Benötigt wird ein konsistentes Set (SVG), Liste in Abschnitt 8.
4. **App-Icon + Logo/Wortmarke** – aktuelles Icon (Vorratsglas) und Logo-Mark „V" sind Platzhalter. Benötigt: SVG + PNG 180 px (apple-touch-icon) + PNG 512 px (Manifest), maskable-tauglich.
5. **Komponenten-Styling** – alle UI-Bausteine aus Abschnitt 6.
6. Optional: **Dark Mode** (bisher nicht vorhanden, `theme-color` ist `#f7f6f2`).

Offene Grundsatzentscheidung (bitte als Vorschlag mitliefern): eigene,
eigenständige Vorratio-Identität **oder** Anbindung an Max' bestehendes
Markensystem (brand-core: Space Grotesk / Space Mono, 8-px-Raster). Die Doku
tendiert zu einer eigenen Identität; die Ergebnisse wandern danach ohnehin als
Token in den Code zurück.

## 3. Technische Leitplanken (hart)

- **Statische PWA ohne Build-Step**: `index.html` + `css/style.css` + ES-Module. Das gesamte Styling lebt in **einer** CSS-Datei; alle Farben/Radien/Schatten sind CSS-Custom-Properties in `:root` – das ist der Übergabepunkt für neue Tokens.
- **DOM entsteht aus JS-Template-Strings** (`js/app.js`) – Klassennamen (Abschnitt 6) sind der Design-Kontrakt. Neue Optik = neue CSS, idealerweise ohne Markup-Umbau.
- **Zielgerät iPhone / iOS Safari** als Home-Screen-App: `viewport-fit=cover`, `env(safe-area-inset-bottom)` an der Tabbar, kein Hover, Tap-Ziele ≥ 44 px, `-apple-system`-Fallback.
- **Layout**: eine Spalte, `max-width: 640px`, zentriert; fixe Tabbar unten mit Blur (`backdrop-filter`).
- **Offline-fähig** (Service Worker cached alles) → keine externen Ressourcen (Fonts/Icons müssen ins Repo).
- Native Browser-Dialoge (`confirm`/`alert`) an einigen Stellen – dürfen gern durch gestaltete Dialoge ersetzt werden, ist aber Codeänderung.

## 4. Informationsarchitektur

```
Onboarding (einmalig, 6 Schritte, keine Tabbar)
  Welcome → Name → Ernährungsform (8 Presets) → Ausschlüsse (Chips) → Stile (Chips + Hinweiskarten) → Toleranz-Prinzip

Tabbar (5 Tabs, fix unten)
├── Heute        Begrüßung „Moin, {Name}" · 3 Rezeptvorschläge je Slot · Neu würfeln · ✨ AI-Generierung
│     └── Rezept-Detail   Zutaten-Checkliste (da/fehlt) · Hinweiskarte · CTA kochen/Einkaufsliste · Tipp-Karte
│           └── Kochmodus  Portionswahl → Schritt-Screens (Timer, Progress-Dots) → Abschluss/Abbuchung
├── Vorrat       6 Kategorien-Gruppen · + Erfassen (Suche + Chips) · ▮▮ Barcode-Scan (5 Panel-Zustände)
│     └── Artikel-Edit    3 Mengen-UIs: Stepper (zählbar) / Silhouetten-Slider (Schüttgut) / Vorrätig-Leer (pauschal)
├── Einkauf      Rezeptbezogene Liste · Bon-Scan (Foto → Claude → Bestätigen) · Wochenliste (auto-Badge)
├── Wissen       4 Sub-Tabs als Chips: Tipps / Zubereitung / Grundrezepte / Techniken
└── Profil       Ernährungsform/Ausschlüsse/Stile ändern · Hinweise · Historie · Claude-API-Key · Export/Import/Reset
```

## 5. Screens (alle Screenshots in `screenshots/`)

| # | Datei | Screen / Zustand |
|---|-------|------------------|
| 01 | `01-onboarding-1-welcome.png` | Onboarding Welcome: Logo-Mark „V", Claim, Primär-CTA |
| 02 | `02-onboarding-2-name.png` | Namenseingabe (Textfeld) |
| 03 | `03-onboarding-3-ernaehrungsform.png` | Choice-Liste, 8 Presets, Auswahlzustand |
| 04 | `04-onboarding-4-ausschluesse.png` | Chip-Gruppen (Allergien / religiös), Mehrfachauswahl |
| 05 | `05-onboarding-5-stile.png` | Stil-Chips + kontextuelle Hinweiskarte (Keto-Evidenz) |
| 06 | `06-onboarding-6-toleranz.png` | Toleranz-Erklärkarte, Abschluss-CTA |
| 07 | `07-heute-vorschlaege.png` | Heute: Gruß, 3 Rezeptkarten („Alles da ✓" vs. „Das fehlt dir: …"), Neu würfeln, ✨-AI-Button, Slot-Fußnote |
| 08 | `08-heute-leerer-vorrat.png` | Heute bei leerem Bestand: Hint-Card mit CTA „Zum Vorrat" |
| 09 | `09-rezept-detail-alles-da.png` | Rezept-Detail, alle Zutaten vorhanden → „Jetzt kochen" |
| 10 | `10-rezept-detail-fehlt.png` | Rezept-Detail mit fehlenden Zutaten → „fehlt"-Badges, „Einkaufsliste erstellen" + „Trotzdem kochen" |
| 11 | `11-kochmodus-portionen.png` | Kochmodus-Start: Portions-Stepper |
| 12 | `12-kochmodus-schritt-timer.png` | Koch-Schritt mit laufendem Timer (Timer-Box, Progress-Dots, Weiter/Zurück) |
| 13 | `13-kochmodus-abschluss.png` | Abschluss „Fertig gekocht 🎉": Abbuchen vs. ohne Abbuchung |
| 14 | `14-vorrat-liste.png` | Vorrat gefüllt: Kategorie-Gruppen, Mengen-Näherungen, Ändern-Links, Kopf mit Barcode/+ Erfassen |
| 15 | `15-vorrat-leer.png` | Vorrat Empty-State (▤-Glyphe) |
| 16 | `16-vorrat-erfassen.png` | Erfassen-Panel: Suchfeld + Zutaten-Chips |
| 17 | `17-vorrat-barcode-eingabe.png` | Barcode-Panel: EAN-Eingabe (+ Kamera-Button, wo verfügbar), OFF-Quellenhinweis |
| 18 | `18-vorrat-barcode-treffer.png` | Barcode-Treffer: Produktkarte + Zutat-Zuordnung (Select) + Buchen |
| 19 | `19-vorrat-edit-schuettgut.png` | Artikel-Edit Schüttgut: Silhouetten-Slider „Wie voll ist die Packung?" + Fill-Meter |
| 20 | `20-vorrat-edit-zaehlbar.png` | Artikel-Edit Zählbar: runder −/+-Stepper |
| 21 | `21-vorrat-edit-pauschal.png` | Artikel-Edit Pauschal: Vorrätig/Leer-Toggle |
| 22 | `22-einkauf-uebersicht.png` | Einkauf komplett: Rezeptliste (abgehakt/offen), Bon-Scan-Einstieg, Wochenliste mit „auto"-Badge und ✕ |
| 23 | `23-einkauf-bon-ergebnis.png` | Bon-Scan-Ergebnis: erkannter Händler, Artikel mit Bon-Rohtext, ohne Zuordnung, Verwerfen/Buchen |
| 24 | `24-einkauf-leer-ohne-key.png` | Einkauf leer + ohne API-Key: Key-Hinweiskarte, Empty-State Wochenliste |
| 25 | `25-wissen-tipps.png` | Wissen: Chip-Subnavigation, Tipp- (💡) und Ideen-Karten (✦) |
| 26 | `26-wissen-zubereitung.png` | Wissen: Zubereitungen mit Dauer-Badges |
| 27 | `27-wissen-grundrezepte.png` | Wissen: Grundrezepte mit Varianten-Zeile (Akzentfarbe) |
| 28 | `28-wissen-techniken.png` | Wissen: Technik-Karten |
| 29 | `29-profil.png` | Profil komplett: Choice-Liste, Chips, Hinweiskarten, Historie, API-Key-Karte, Export/Import, Danger-Button, Fußzeile |
| 30 | `30-symbole-uebersicht.png` | **Symbol-Inventar** (alle Glyphen mit Codepoints und Verwendungsort) |
| 31 | `31-symbol-tabbar.png` | Tabbar-Ausschnitt (aktiver vs. inaktiver Tab) |

Nicht als Screenshot, aber zu gestalten (Zustände aus dem Code):

- AI-Button aktiv: Label wechselt zu „✨ Claude kocht Ideen …" (disabled, Opacity 0.4); Fehlerzeile darunter in `--warn`.
- AI-Badge „✨ AI" an generierten Rezeptkarten (gleiche Badge-Komponente wie „Alles da ✓").
- Timer abgelaufen: Anzeige „Fertig!", Timer-Box wechselt auf `--warn-soft`; Vibration + System-Notification.
- Barcode-Panel-Zustände „laden", „kein Treffer", „fehler" (Textkarten) und Kamera-Live-View (Video schwarz, abgerundet, Abbrechen darunter).
- Bon-Scan „Claude liest den Bon …" (Ladekarte) und Fehlerkarte mit „Nochmal versuchen".
- Native confirm/alert-Dialoge (Kochen verlassen, Reset, AI-Rezepte löschen, Buchungsbestätigung).

## 6. Komponenten-Inventar (CSS-Klassen = Kontrakt)

| Komponente | Klasse(n) | Ist-Zustand |
|---|---|---|
| Karte | `.card`, `.tappable` | Weiß, 1px `--line`, Radius 14, weicher Schatten; tappable: scale(0.985) bei :active |
| Hinweiskarte | `.hint-card` | `--accent-soft`-Fläche, ohne Rand, fette Titelzeile |
| Badge | `.badge`, `.warn`, `.neutral` | Pill 999px; grün/rot/grau-soft |
| Primär-Button | `.btn` | Vollbreite, `--accent`, weiß, 600, Radius 14 |
| Sekundär / Ghost / Danger / Small | `.btn.secondary/.ghost/.danger/.small-btn` | Outline / textgrün / warn-Outline / inline klein |
| Button-Zeile | `.btn-row` | Flex, gleichbreite Buttons |
| Auswahl-Karte (Radio) | `.choice`, `.selected` | 1.5px-Rahmen; selected: Akzentrahmen + Soft-Fläche |
| Chip (Mehrfach) | `.chip`, `.selected` | Pill; selected: Akzentrahmen + Soft + 600 |
| Eingaben | `input[text/number/password]`, `select` | 1.5px-Rahmen, Radius 10, Fokus = Akzentrahmen |
| Feld-Label | `label.field` | kleines, gedämpftes Label über dem Feld |
| Füllstands-Slider | `input[range]` + `.fill-meter` | accent-color + eigene 10px-Fortschrittspille |
| Stepper | `.stepper` | 40px-Kreisbuttons − / +, große Zahl |
| Check-Kreis | `.check`, `.done` | 26px-Kreis, done: Akzent gefüllt + weißes ✓; Text dazu `.done-text` (durchgestrichen) |
| Listenzeile | `.list-item`, `.grow`, `.name` | Trennlinien, letzte ohne |
| Timer-Box | `.timer-box`, `.done` | Soft-grüne Kachel, 2.4rem Tabular-Ziffern; done → warn-soft |
| Progress-Dots | `.progress-dots` | 8px-Punkte, erledigte in Akzent |
| Koch-Schritt | `.cook-step`, `.step-nr`, `.step-text` | zentriert, min-height 40vh, Uppercase-Schrittzähler |
| Tabbar | `.tabbar`, `.tab`, `.active`, `.tab-icon` | fix, Blur 94 %-Weiß, 0.68rem Labels, aktive in Akzent + 700 |
| Empty-State | `.empty-state`, `.big` | zentrierte Glyphe + Text |
| Onboarding-Hero | `.onboard-hero`, `.logo-mark` | 72px-„V"-Kachel, Radius 22 |
| Animation | `.fade-in` | 0.35s Fade+6px-Slide bei jedem Screenwechsel |

## 7. Ist-Design-Tokens (`css/style.css` → `:root`)

| Token | Wert | Verwendung |
|---|---|---|
| `--bg` | `#f7f6f2` | App-Hintergrund, theme-color, App-Icon-Glas |
| `--surface` | `#ffffff` | Karten, Inputs, Tabbar |
| `--ink` | `#1f2421` | Text |
| `--ink-soft` | `#5c6660` | Sekundärtext, inaktive Tabs |
| `--line` | `#e4e2da` | Ränder, Trenner, Meter-Grund |
| `--accent` | `#2f6b4f` | Primärfarbe (Buttons, aktive Zustände, App-Icon-Grund) |
| `--accent-soft` | `#e3efe8` | Soft-Flächen (Badges, Hinweiskarten, Timer, Auswahl) |
| `--warn` | `#b4552d` | Fehlend/Fehler/Danger |
| `--warn-soft` | `#f7e8df` | Warn-Flächen (Badge, Timer fertig) |
| `--radius` | `14px` | Karten & Buttons (Inputs 10px, Pills 999px, Logo 22px) |
| `--shadow` | `0 1px 3px rgba(31,36,33,.07)` | Karten |
| Typo | System-Stack | h1 1.5rem/-0.01em · h2 1.15rem · h3 1rem · Body 1rem/1.5 · `.subtle` 0.88 · `.small` 0.8 · Tab 0.68 · Timer 2.4 tabular |

Sondertöne außerhalb der Tokens (bitte in die neue Palette überführen):
`#274a3a` (Text auf hint-card), `#efeee9` (Badge neutral), `#8fbca6` (App-Icon-Füllung).

## 8. Symbol-Inventar → benötigtes Icon-Set

Komplette Übersicht mit Codepoints: `screenshots/30-symbole-uebersicht.png`.
Alle Zeichen sind Unicode-Platzhalter und sollen durch ein konsistentes
SVG-Icon-Set ersetzt werden:

- **Tabbar (5):** Heute ☀︎ · Vorrat ▤ · Einkauf ✓ · Wissen ✎ · Profil ◍ (je aktiv/inaktiv)
- **Aktionen (9):** Neu würfeln ↻ · AI/Claude ✨ · Kamera 📷 · Barcode ▮▮ · Plus + · Minus − · Entfernen ✕ · Zurück/Weiter ‹ › · Check ✓
- **Inhalt (3):** Tipp 💡 · Idee ✦ · Geschafft 🎉
- **Marke:** App-Icon (Ersatz für Vorratsglas, `icons/icon.svg` + PNG 180/512) · Logo-Mark/Wortmarke (Onboarding-Hero, ggf. Header)

## 9. Tonalität & Textprinzipien (bestehen bleiben)

- Durchgehend **Du-Form**, norddeutsch-locker: „Moin, Max", „Los geht's", „Das fehlt dir: …".
- **Toleranz statt Scheinpräzision**: Mengen immer mit Tilde („~350 g"), nie Dezimalstellen; das Prinzip ist Teil des Markenkerns und wird im Onboarding erklärt.
- Claude-Features werden transparent benannt („Claude liest den Bon …", „Neue Ideen von Claude") und mit ✨ markiert.
- Fußnoten klein und beiläufig (Quellen: Open Food Facts; Ausbaustufen-Hinweise).

## 10. Rückweg der Ergebnisse

1. Neue Tokens als `:root`-Block → ersetzt Abschnitt oben in `css/style.css` (und wandert in Max' brand-core-Pipeline, falls Anbindung gewünscht).
2. Icon-SVGs → `icons/` (inline oder als Sprite; Tab-Icons ersetzen die `<span class="tab-icon">`-Glyphen in `index.html`).
3. App-Icon → `icons/icon.svg`, `icon-180.png`, `icon-512.png` + `theme-color`/`background_color` in `index.html` & `manifest.webmanifest`.
4. Komponenten-Styles → `css/style.css` entlang der Klassennamen aus Abschnitt 6.

## Anhang: Reproduktion

App lokal: `python3 -m http.server 8080` im Repo-Root → `http://localhost:8080`.
Die Screenshots entstanden headless (Chromium/Playwright, 390×844 @2x, de-DE)
mit einem Demo-Datenstand (14 Bestandsartikel, Vorschläge für den Abend-Slot,
gefüllte Einkaufslisten, Historie); Open-Food-Facts- und Claude-API-Antworten
wurden für die Zustände „Barcode-Treffer" und „Bon-Ergebnis" gemockt. Bei
Ganzseiten-Screenshots ist die fixe Tabbar ausgeblendet – sie ist separat in
`31-symbol-tabbar.png` und den Viewport-Shots dokumentiert.

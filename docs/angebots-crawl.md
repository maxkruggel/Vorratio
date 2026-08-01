# Angebots-Crawl – Quelle & Matching (Kap. 4.7 / 7.4)

**Stand: 01.08.2026 · Status: prototypisch umgesetzt** (`js/angebote.js` + `js/data/angebote-demo.js`, UI im Einkauf-Tab)

Löst Punkt 5 der offenen Punkte: „Quelle final festlegen und Matching (Textabgleich) prototypen."

## Entscheidung: Quelle

**Marktguru** (wie in Kap. 7.4 als pragmatischer Einstieg vorgesehen) ist als Quelle festgelegt:

- Inoffizielle, aber frei zugängliche JSON-API, PLZ-basiert, deckt viele Ketten ab (Edeka, Rewe, Lidl, Penny, Aldi, Netto …).
- Endpunkt: `https://api.marktguru.de/api/v1/offers/search?as=web&limit=64&offset=0&q=<begriff>&zipCode=<plz>`
- Auth: zwei Header `x-apikey` und `x-clientkey`. Das sind **öffentliche Keys der Marktguru-Web-App**, kein Account nötig – sie werden aber nicht im Repo eingebrannt (können rotieren, und das Extrahieren bleibt bewusst ein manueller, dokumentierter Schritt):
  1. marktguru.de im Desktop-Browser öffnen, PLZ setzen, irgendein Produkt suchen.
  2. Entwicklertools → Netzwerk → eine Anfrage an `api.marktguru.de` anklicken.
  3. Request-Header `x-apikey` und `x-clientkey` kopieren.
  4. In der App: Einkauf → Angebots-Crawl → Einstellungen → einfügen (wird lokal per Auto-Save gespeichert, wandert mit dem JSON-Export).
- Verworfen: REWE-API (seit 2024 mTLS – Umgehung technischer Schutzmaßnahmen kommt nicht infrage), Bonial/kaufDA (keine offene API).

**Schonender Umgang** (rechtliche Einordnung siehe Recherche 3, Kap. 6): eine Suchanfrage je Listenpunkt, ~450 ms Pause zwischen den Anfragen, Ergebnis wird **eine Kalenderwoche** gecacht (Kap. 4.7: „einmal wöchentlich, z. B. freitags"). Keine Umgehung von Zugangsschutz, keine Massenabfragen.

**CORS-Vorbehalt:** Ob `api.marktguru.de` Anfragen aus fremden Browser-Origins zulässt, konnte aus der Entwicklungsumgebung nicht verifiziert werden (Netzwerk-Policy). Falls der Browser blockt, in den Einstellungen einen eigenen CORS-Proxy-Präfix eintragen (z. B. einen kleinen Cloudflare Worker, der die Anfrage durchreicht) – das Feld ist dafür vorgesehen. Ohne Keys/bei Fehlern fällt die App sauber auf den Demo-Modus zurück.

## Demo-Modus

Ohne Keys (oder per Schalter erzwungen) läuft der Crawl gegen `js/data/angebote-demo.js`: ~50 realistische Prospekt-Angebote über fünf Ketten, inklusive bewusster Fast-Treffer (Reiswaffeln, Milchschokolade, Butterkekse, Erdnussbutter, Apfelsaft, Kokosmilch), an denen sich das Matching beweisen muss. Damit ist der komplette Ablauf offline testbar – gleicher Codepfad wie live, nur die Quelle ist getauscht.

## Matching (Textabgleich)

Je Zutat ein **Suchprofil** (`SUCHPROFILE` in `js/angebote.js`, alle ~85 Kern-Zutaten abgedeckt):

- `q` – Suchbegriff für die API („gehackte tomaten“),
- `muster` – Begriffe, die im Angebotstext zählen,
- `nicht` – Sperrbegriffe gegen falsche Treffer.

Regeln (auf normalisiertem Text: Kleinbuchstaben, ä→ae usw., Satzzeichen raus):

1. Geprüft wird **nur Produktname + Marke** – Beschreibungen („Alpenmilch-Schokolade") erzeugen zu viele falsche Treffer.
2. Ein `nicht`-Begriff irgendwo im Text sperrt das Angebot („Kokosmilch" ↛ Milch, „Reiswaffeln" ↛ Reis).
3. Einzelwort-Muster treffen tokenweise: exakt, Wortanfang, Kompositum-Ende mit ≥ 3 Zeichen Vorbau („basmatireis" zählt für „reis", „preis" nicht) oder – ab 5 Zeichen Musterlänge – enthalten („speisezwiebeln" für „zwiebel").
4. Muster mit Leerzeichen werden als Phrase gesucht.
5. Für unbekannte Zutaten (künftige Nutzer-Anlagen) wird ein Profil aus dem Namen abgeleitet.

## Markt-Empfehlung

Ranking je Markt: **Abdeckung** (wie viele Listenpunkte hat der Markt im Angebot?) vor **Konditionen** (mittlerer Rabatt in %) vor **Angebotszahl** – exakt die drei Kriterien aus Kap. 4.7 („meiste Angebote, meiste Produkte, beste Konditionen"). Je Listenpunkt und Markt zählt das beste Angebot (größter Rabatt, dann günstigster Preis). Angezeigt werden **ein empfohlener Markt plus höchstens zwei Alternativen** – bewusst kein Markt-Hopping (Kap. 4.7).

Der Crawl läuft über alle offenen Einkaufspunkte (Wochenliste + rezeptbezogene Liste, dedupliziert). Das Ergebnis wird per Auto-Save persistiert und gilt eine ISO-Kalenderwoche; danach markiert die UI es als veraltet. Ein automatischer Freitags-Lauf braucht Web Push bzw. Background Sync und hängt an Ausbaustufe „Web-Push für feste Vorschlagszeiten" (offener Punkt 6) – bis dahin stößt Max den Lauf mit einem Tap an.

## Tests

42 Logik-Checks (Matching positiv/negativ, Fallback-Profile, Rabatt, ISO-Woche, kompletter Demo-Crawl inkl. Ranking) plus ein Browser-Smoke-Test (Chromium/Playwright: Sektion rendern, Einstellungen speichern, Demo-Crawl fahren, Persistenz) – Skripte liegen bewusst nicht im Repo, die Läufe sind im PR dokumentiert. Ergebnis des Demo-Laufs für eine 7-Punkte-Liste: Edeka 5/7 (Ø −28 %) vor Rewe 3/7 (Ø −30 %) und Penny 3/7 (Ø −23 %).

## Bekannte Grenzen (Prototyp)

- Textabgleich bleibt heuristisch: „Milchreis" zählt als Reis (vertretbar), Type 405 vs. 1050 wird bei Mehl nicht unterschieden.
- Marktguru-Feldnamen sind inoffiziell und können sich ändern – der Client liest jedes Feld defensiv über mehrere Pfade; bei API-Bruch bleibt der Demo-Modus.
- Preise sind Packungspreise, keine Bedarfsmengen-Rechnung.
- Filial- vs. Ketten-Ebene: Marktguru liefert Ketten am Standort; ob die konkrete Filiale das Angebot führt, bleibt Prospekt-Logik.

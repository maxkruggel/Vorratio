# Icon-Brief: Produkt-Icons für den Vorrat

Stand: 02.08.2026 · Auftraggeber: Max Kruggel · Umsetzung: Claude Code

Das **UI-Icon-Set** aus der Claude-Design-Übergabe ist gebaut und liegt in
`js/icons.js` (Tabbar, Aktionen, Inhalt, Marke). Offen ist der zweite Teil aus
Doku Kap. 8: **Produkt-Icons je Zutat** für die Vorrats- und Rezeptlisten –
laut Doku „eigene, stilistisch coole Produkt-Icons […] statt Produktfotos".

Dieses Dokument ist die Arbeitsliste dafür: **61 Icons decken alle 92 Zutaten**
der Kern-DB ab (Zuordnung unten, vollständig und überschneidungsfrei).

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
- **Motiv = Lebensmittel, nicht Verpackung.** Dose, Glas und Packung sind schon
  über die Mengen-UI abgebildet (Zähler, Silhouetten-Regler, Vorrätig/Leer) –
  darum teilen sich z. B. getrocknete und Dosen-Kichererbsen ein Icon.
- **Erkennbar bei 24 px.** Im Zweifel weniger Details: die Icons laufen in der
  Vorratsliste in Zeilenhöhe, nicht als Illustration.

Referenz zum Abgucken: `js/icons.js`, z. B. `vorrat` (Vorratsglas) und
`tipp` (Glühbirne) – beide zeigen Kontur + genau eine `.duo`-Fläche.

## 2. Technische Einbindung

- Neue Datei **`js/icons-produkte.js`**, gleiche Struktur wie `js/icons.js`:
  ein `PFADE`-Objekt plus `export function produktIcon(name, size = 24)`.
  `js/icons.js` bleibt unangetastet – UI und Produkt sind zwei Sets.
- Dazu die Zuordnung **`zutat_id → Icon-Name`** aus Abschnitt 4 als
  `ZUTAT_ICON`-Map exportieren, mit Fallback auf ein neutrales
  `platzhalter`-Icon, wenn eine Zutat (z. B. aus einem AI-Rezept) nicht in
  der Map steht.
- Einbauorte: Bestandszeile (`vorratZeile()` in `js/app.js`), Erfassen-Chips,
  Zutaten-Checkliste im Rezept-Detail, Einkaufslisten-Zeilen.
- `sw.js`: neue Datei in den Shell-Cache aufnehmen und `CACHE` hochzählen.
- Kein Sprite, kein Build-Step – Inline-SVG als String, wie das bestehende Set.

## 3. Abnahme

- Alle 61 Icons in Light **und** Dark rendern, bei 24 px und bei 44 px.
- Jede der 92 Zutaten zeigt ein Icon, keine Zutat fällt auf den Platzhalter.
- Keine harten Farben im SVG (grep auf `fill="#` und `stroke="#` muss leer sein).

---

## 4. Die 61 Icons

### Getreide & Beilagen (8)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 1 | `reis` | Reis | Weißer Reis (Langkorn) `ing_reis_weiss`<br>Basmatireis `ing_reis_basmati`<br>Vollkornreis/Naturreis `ing_reis_vollkorn` |
| 2 | `nudeln` | Nudeln | Nudeln (Hartweizen) `ing_nudeln` |
| 3 | `reisnudeln` | Reisnudeln | Reisnudeln `ing_reisnudeln` |
| 4 | `haferflocken` | Haferflocken | Haferflocken `ing_haferflocken` |
| 5 | `mehl` | Mehl | Weizenmehl Type 405 `ing_mehl_405`<br>Weizenmehl Type 1050 `ing_mehl_1050` |
| 6 | `brot` | Brot | Brot/Baguette `ing_brot` |
| 7 | `tortilla` | Tortilla / Wrap | Tortillas/Wraps `ing_tortillas` |
| 8 | `popcornmais` | Popcorn-Mais | Popcorn-Mais `ing_popcornmais` |

### Hülsenfrüchte (5)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 9 | `linsen` | Linsen | Rote Linsen `ing_linsen_rot` |
| 10 | `kichererbsen` | Kichererbsen | Kichererbsen getrocknet `ing_kichererbsen_trocken`<br>Kichererbsen (Dose) `ing_kichererbsen_dose` |
| 11 | `bohnen` | Bohnen | Kidneybohnen (Dose) `ing_kidneybohnen_dose`<br>Schwarze Bohnen (Dose) `ing_bohnen_schwarz_dose` |
| 12 | `mais` | Mais | Mais (Dose) `ing_mais_dose` |
| 13 | `erbsen` | Erbsen | Erbsen (TK) `ing_erbsen_tk` |

### Gemüse (16)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 14 | `kartoffel` | Kartoffel | Kartoffeln `ing_kartoffel` |
| 15 | `zwiebel` | Zwiebel | Zwiebeln `ing_zwiebel` |
| 16 | `fruehlingszwiebel` | Frühlingszwiebel | Frühlingszwiebeln `ing_fruehlingszwiebel` |
| 17 | `knoblauch` | Knoblauch | Knoblauch `ing_knoblauch` |
| 18 | `brokkoli` | Brokkoli | Brokkoli `ing_broccoli` |
| 19 | `moehre` | Möhre | Möhren/Karotten `ing_moehre` |
| 20 | `paprika` | Paprika | Paprika `ing_paprika` |
| 21 | `zucchini` | Zucchini | Zucchini `ing_zucchini` |
| 22 | `aubergine` | Aubergine | Aubergine `ing_aubergine` |
| 23 | `lauch` | Lauch | Lauch `ing_lauch` |
| 24 | `gurke` | Gurke | Gurke `ing_gurke` |
| 25 | `tomate` | Tomate | Tomaten (frisch) `ing_tomate_frisch`<br>Tomaten (Dose, stückig) `ing_tomate_dose`<br>Passierte Tomaten `ing_passierte_tomaten`<br>Tomatenmark `ing_tomatenmark` |
| 26 | `salat` | Blattsalat | Römersalat `ing_roemersalat` |
| 27 | `spinat` | Spinat | Blattspinat (frisch/TK) `ing_spinat` |
| 28 | `ingwer` | Ingwer | Ingwer `ing_ingwer` |
| 29 | `olive` | Olive | Oliven `ing_oliven` |

### Obst (5)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 30 | `zitrusfrucht` | Zitrone / Limette | Zitronen `ing_zitrone`<br>Limetten `ing_limette` |
| 31 | `apfel` | Apfel | Äpfel `ing_apfel`<br>Apfelmus (Glas) `ing_apfelmus` |
| 32 | `banane` | Banane | Bananen `ing_banane` |
| 33 | `beeren` | Beeren | Beeren (TK) `ing_beeren_tk` |
| 34 | `dattel` | Dattel | Datteln (entsteint) `ing_datteln` |

### Kühlregal & Protein (11)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 35 | `ei` | Ei | Eier (Größe M) `ing_ei` |
| 36 | `butter` | Butter | Butter `ing_butter` |
| 37 | `milch` | Milch | Milch `ing_milch` |
| 38 | `sahne` | Sahne | Sahne `ing_sahne` |
| 39 | `joghurt` | Joghurt | Naturjoghurt `ing_joghurt_natur` |
| 40 | `hartkaese` | Hartkäse | Parmesan/Hartkäse `ing_parmesan` |
| 41 | `weichkaese` | Weichkäse | Feta `ing_feta`<br>Mozzarella `ing_mozzarella` |
| 42 | `tofu` | Tofu | Tofu natur `ing_tofu_natur` |
| 43 | `gefluegel` | Geflügel | Hähnchenbrustfilet `ing_haehnchenbrust` |
| 44 | `hackfleisch` | Hackfleisch | Rinderhackfleisch `ing_hackfleisch_rind` |
| 45 | `fisch` | Fisch | Lachsfilet `ing_lachs` |

### Fett, Würze, Flüssiges (9)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 46 | `oelflasche` | Öl | Olivenöl `ing_olivenoel`<br>Rapsöl/neutrales Öl `ing_rapsoel`<br>Sesamöl `ing_sesamoel`<br>Kokosöl `ing_kokosoel` |
| 47 | `essig` | Essig | Essig `ing_essig` |
| 48 | `sojasauce` | Sojasauce | Sojasauce `ing_sojasauce` |
| 49 | `paste` | Paste / Mus | Misopaste `ing_misopaste`<br>Currypaste `ing_currypaste`<br>Gochujang `ing_gochujang`<br>Tahin (Sesammus) `ing_tahin`<br>Erdnussmus/-butter `ing_erdnussmus` |
| 50 | `senf` | Senf | Senf `ing_senf` |
| 51 | `bruehe` | Brühe | Gemüsebrühe (Pulver/Fond) `ing_gemuesebruehe`<br>Hühnerbrühe `ing_huehnerbruehe` |
| 52 | `honig` | Honig | Honig `ing_honig` |
| 53 | `zucker` | Zucker | Zucker `ing_zucker` |
| 54 | `hefe` | Hefe | Trockenhefe `ing_trockenhefe` |

### Gewürze & Kräuter (4)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 55 | `salz` | Salz | Salz (jodiert) `ing_salz` |
| 56 | `pfeffer` | Pfeffer | Pfeffer `ing_pfeffer` |
| 57 | `gewuerzglas` | Gewürz (gemahlen/getrocknet) | Currypulver `ing_currypulver`<br>Kreuzkümmel `ing_kreuzkuemmel`<br>Paprikapulver `ing_paprikapulver`<br>Chiliflocken `ing_chiliflocken`<br>Muskat `ing_muskat`<br>Zimt `ing_zimt`<br>Oregano `ing_oregano`<br>Kräuter der Provence `ing_kraeuter_provence` |
| 58 | `kraeuterbund` | Frische Kräuter | Petersilie `ing_petersilie`<br>Basilikum `ing_basilikum`<br>Koriander `ing_koriander`<br>Minze `ing_minze` |

### Nüsse & Süßes (3)

| # | Icon-Name | Motiv | Zutaten (`zutat_id`) |
|---|---|---|---|
| 59 | `nuss` | Nüsse | Erdnüsse `ing_erdnuesse`<br>Mandeln/Nüsse (gemischt) `ing_mandeln` |
| 60 | `schokolade` | Schokolade | Zartbitterschokolade `ing_schoko_zartbitter` |
| 61 | `kokos` | Kokos | Kokosraspel `ing_kokosraspel`<br>Kokosmilch (Dose) `ing_kokosmilch` |

---

**Summe:** 61 Icons für 92 Zutaten. Die Zuordnung ist vollständig und
überschneidungsfrei geprüft – jede `zutat_id` aus `js/data/kerndb.js`
kommt genau einmal vor.

Wächst die Kern-DB (Doku Kap. 9, Punkt 8: Ausbau auf 300–500 Rezepte), kommen
neue Zutaten dazu. Dann gilt: erst prüfen, ob eine bestehende Familie passt,
und nur bei echtem Bedarf ein Icon ergänzen.

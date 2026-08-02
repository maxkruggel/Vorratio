# Recherche 6 — Tofu: Grundlagen, Basistechniken, Rezeptdatensatz

Quellmaterial zu Auftrag 24 („tofu-rezepte", Stand 02.08.2026) und die Zuordnung
zu dem, was davon tatsächlich in der App steht. Die Recherche selbst ist Rohstoff,
kein Wahrheitsstand der App: Verbindlich ist immer der Code in `js/data/`.

## Dateien

| Datei | Inhalt |
|---|---|
| `auftrag.md` | Zielsetzung, Scope, Anforderungen, Abhängigkeiten zu anderen Aufträgen |
| `methodenteil.md` | Vorgehen, Konfidenz je Rezept, bekannte Lücken, Prüfschritte |
| `ids.json` | Namensräume und ID-Vergabe des Datensatzes (T·, BT·, TT·, `tofu_`) |
| `ergebnis.json` | Der Datensatz: 60 Rezepte (20 vollständig, 40 Stub), 12 Basistechniken, Grundlagen, Substitutionen, Kombinationsmatrix, 12 Tipps |

## Umschlüsselung in das Projektschema

`ids.json` führt zwei offene Punkte, beide sind mit dem Einbau entschieden:

**1. T-Präfix → Projektschema.** Das generische `T01…T60` wurde nicht übernommen.
Rezepte tragen die Block-IDs der Kern-DB (`TOF-…`, für Pad Thai `RCP-…`).

**2. Basistechniken bleiben eigene Entität** — als `PREPS` in `js/data/kerndb.js`,
also dieselbe Struktur, die auch Reis kochen und Eier garen trägt. Sie gehen nicht
in die Rezeptschritte auf. Ein `basistechnik_ref`-Feld gibt es nicht: Die Schritte
im `TOF-`Block wiederholen den Handgriff im Klartext, damit der Kochmodus für sich
steht und niemand mitten im Braten in einen anderen Datensatz springen muss.

### Rezepte

Bereits vorhanden, bevor der Datensatz kam (unverändert):

| Datensatz | In der App | Datensatz | In der App |
|---|---|---|---|
| T02 Mapo Tofu | `TOF-002` | T34 Palak Tofu | `TOF-025` |
| T05 Pad Thai | `RCP-011` | T36 Tofu-Gyros | `TOF-007` |
| T08 Rührtofu | `TOF-003` | T37 Tofu-Bowl | `TOF-014`, `TOF-040`, `TOF-049` |
| T09 Tofu-Bolognese | `TOF-004` | T38 Salat mit Räuchertofu | `TOF-019` |
| T12 Miso-Suppe | `TOF-010` | T39 Tofu-Spieße | `TOF-009` |
| T13 Schokomousse | `TOF-022` | T41 Crispy Nuggets | `TOF-023` |
| T15 Teriyaki Tofu | `TOF-014` | T43 Süß-saurer Tofu | `TOF-013` |
| T16 Tofu-Schnitzel | `TOF-005` | T44 Sesam-Tofu | `TOF-001` |
| T19 Veganer Feta | `TOF-012` | T47 Katsu Curry | `TOF-015` |
| T20 Tofu-Frikadellen | `TOF-011` | T50 Tofu-Ricotta | `TOF-051` |
| T26 Stir-Fry mit Brokkoli | `TOF-001` | T54 Schokopudding | `TOF-022` (Variante) |
| T30 Massaman-Curry | `TOF-006` (verwandt) | T56 Tofu-Döner | `TOF-021` |
| T31 Bánh mì | `TOF-027` | T57 Mapo vegan (Pilze) | `TOF-002` (ist die Pilzversion) |
| T32 Sommerrollen | `KMX-033` | T58 Tofu-Laab | `TOF-042` |
| T04 Tofu mit Erdnusssauce | `TOF-016` (verwandt) | T59 Tofu-Karaage | `TOF-043` |
| | | T60 Räuchertofu-Carbonara | `TOF-008` |

Neu angelegt (23 Rezepte, `TOF-056`–`TOF-078`):

| Datensatz | Neu als | Datensatz | Neu als |
|---|---|---|---|
| T03 General Tso's | `TOF-056` | T29 Grünes Curry | `TOF-070` |
| T06 Sundubu Jjigae | `TOF-064` | T33 Tofu Bhurji | `TOF-069` |
| T07 Agedashi Tofu | `TOF-061` | T35 Tofu Makhani | `TOF-068` |
| T10 Tikka Masala | `TOF-067` | T40 „Thunfisch"-Aufstrich | `TOF-073` |
| T11 Salt & Pepper | `TOF-058` | T45 Orange Tofu | `TOF-060` |
| T14 Tofu in Tomatensauce | `TOF-071` | T46 Gochujang-Bowl | `TOF-066` |
| T17 Buffalo Tofu | `TOF-072` | T48 Ofen-Tofu (Meal-Prep) | `TOF-078` |
| T18 Dubu Jorim | `TOF-065` | T51 Tofunaise | `TOF-074` |
| T21 Hiyayakko | `TOF-062` | T52 Seidentofu-Cheesecake | `TOF-075` |
| T22 Tofu-Steak | `TOF-063` | T53 Seidentofu-Smoothie | `TOF-076` |
| T24 Rotgeschmorter Tofu | `TOF-059` | T55 Rührtofu-Sandwich | `TOF-077` |
| T25 Kung Pao Tofu | `TOF-057` | | |

Nicht übernommen, mit Grund:

- **T01 Knuspriger Tofu (Basisrezept)** — kein Rezept, sondern Technik. Steht als
  `PREP-016`, `PREP-019` und `PREP-027`.
- **T28 Inari-Sushi** — braucht Aburaage (frittierte Tofutaschen), Asiamarkt. Die
  Kern-DB bildet ab, was der deutsche Supermarkt führt; dieselbe Begründung schließt
  Yuba, fermentierten und gepressten Tofu aus (`tofu_frittiert`, `tofu_yuba`,
  `tofu_fermentiert`, `tofu_gepresst` haben keine `ing_`-ID bekommen).
- **T27 Mabo Dofu (japanische Variante)** — zu nah an `TOF-002`, wäre eine Dublette
  im Vorschlagspool.
- **T23 Dubu Kimchi**, **T42 Breakfast Burrito**, **T49 Feta-Melonen-Salat** — offen.
  Verwandte Gerichte gibt es (`TOF-026`, `TOF-003`, `TOF-012`), die Gerichte selbst
  nicht. Kandidaten für den nächsten Ausbau.

### Basistechniken und Tipps

| Datensatz | In der App |
|---|---|
| BT01 Pressen · BT02 Einfrieren · BT03 Marinieren · BT04 Stärke-Coating | `PREP-016` – `PREP-019` |
| BT06 Ofen · BT07 Airfryer · BT08 Frittieren · BT09 Krümeln | `PREP-020` – `PREP-023` |
| BT10 Rührtofu · BT11 Blanchieren · BT12 Seidentofu | `PREP-024` – `PREP-026` |
| BT05 Anbraten | `PREP-013` (bestand schon) + `PREP-027` (Ankleben) |
| TT01–TT10 | `TIP-015` – `TIP-023`, teils zusammengefasst |
| TT11 (abreißen statt schneiden), TT12 (Kruste erst zum Schluss in die Sauce) | in die Rezeptschritte eingearbeitet, kein eigener Tipp |

`TIP-020` (Verderb erkennen) und `TIP-024` (Kimchi enthält oft Fischsauce) stammen
nicht aus dem Datensatz — der erste aus dem Grundlagenblock, der zweite aus der
Entscheidung, Kimchi als eigene Zutat zu führen.

### Tofusorten

`tofu_fest` und `tofu_extra_fest` laufen beide auf `ing_tofu_fest`, ergänzt um
`ing_tofu_natur` für Rezepte, die weder Pressen noch extra feste Ware brauchen.
`tofu_seiden` und `tofu_seiden_tetra` → `ing_tofu_seiden`, `tofu_raeucher` →
`ing_raeuchertofu`. Die Sorte ist damit ein Kriterium des Bestandsabgleichs und
braucht kein eigenes Feld — siehe den Konzeptabschnitt in `CLAUDE.md`.

Neue Zutaten aus dem Datensatz: `ing_kala_namak`, `ing_sichuanpfeffer`,
`ing_tamarinde`, `ing_kimchi`.

## Was aus dem Datensatz bewusst nicht übernommen wurde

- **Nährwerte pro Portion als Zahl.** Das Rezeptschema führt `kcal_pro_portion: null`
  und arbeitet mit qualitativer Einordnung — passend zum Toleranzprinzip. Die
  USDA-Werte (FDC 172475 fester Tofu, FDC 172448 Nigari-Tofu) stehen dort im
  `makro_hinweis`, wo sie belastbar sind. Der Methodenteil nennt selbst die Gründe:
  Calcium schwankt je Gerinnungsmittel um mehr als das Dreifache, Räuchertofu je
  Hersteller, Fett bei frittierten Gerichten je Ölaufnahme.
- **Die 40 Stub-Rezepte als Datensatz.** Rezepte ohne Schritte und Mengen wären im
  Kochmodus wertlos und im Vorschlagspool irreführend. Übernommen wurde nur, was
  ausformuliert werden konnte.
- **`prioritaet: top20|erweiterung`.** Vorratio sortiert über `bewerte()` nach
  Bestandsdeckung und Profil, nicht über eine redaktionelle Rangliste.

## Prüfschritte aus dem Methodenteil

1. Sortenlogik gegen den Bestand — geprüft: Ein Audit über alle Soja-Rezepte fand
   keinen Seidentofu in knusprigen Rezepten und keinen festen Tofu in Mousse, Mayo
   oder Smoothie.
2. Timer-Labels — alle neuen Schritte tragen sprechende `timer_name` (validiert).
3. Stubs im UI kennzeichnen — entfällt, es wurden keine Stubs übernommen.
4. Nährwerte als „ca." — entfällt, es stehen keine Zahlen in der App.
5. Doppelte `sub_id` vermeiden — die drei neuen Datensätze heißen `sub_tofu_fest`,
   `sub_tofu_seiden`, `sub_raeuchertofu` und kollidieren nicht mit dem Bestand aus
   `js/data/substitutionen.js`.

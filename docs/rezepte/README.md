# rezepte – Eingangsordner für Rezept-Markdowns

Hier legt Cowork (oder wer auch immer) neue Rezepte als Markdown ab, bevor sie
ins v1-Schema konvertiert und in einen Rezeptblock (`js/data/rezepte-*.js`)
eingetragen werden. Die App liest diese Dateien **nicht** – das hier ist der
Sammelplatz, kein Datenpfad.

**Achtung, öffentlich:** Das Repo läuft auf GitHub Pages, alles hier ist für
jeden sichtbar. Keine privaten Notizen, keine personenbezogenen Angaben.

## Ablauf

1. Rezept als `.md` nach der Vorlage unten hier ablegen
2. Trockenlauf: `node tools/rezept-import.mjs` – liest alle MDs hier, ordnet die
   Zutaten dem Katalog zu und zeigt, was daraus würde. Es wird nichts geschrieben.
3. Bericht lesen. Wichtig ist die Zutatenzuordnung: Ein falscher Treffer bucht
   später den falschen Vorrat ab. `← schwacher Treffer` und `← nicht im Katalog`
   sind die beiden Zeilen, die jemand ansehen muss.
4. `node tools/rezept-import.mjs --schreiben` – trägt die Rezepte in den Block
   ein, vergibt die nächste freie ID, lässt den Validator laufen und verschiebt
   die MDs erst bei grünem Validator nach `erledigt/`.

Zielblock: `- **Block:** tofu` in der MD oder `--block=tofu` für alle Dateien
(alltag · komplex · tofu · welt · fruehstueck). Ohne Angabe landen reine
Frühstücksrezepte in `fruehstueck`, alles andere in `alltag`. Der Kern-Block
(RCP-/SNK-) liegt inline in `kerndb.js` und wird weiter von Hand gepflegt.

Was der Import **nicht** entscheidet: Er behauptet kein Nährwertprofil (ohne
`**Nährwert:**` steht dort `ausgewogen`) und erfindet keine Zutat. Was er
ableitet – Ernährungsform, Allergene, Kategorie, Timer-Namen –, steht im
Bericht, damit es jemand gegenliest.

## Dateiname

`YYYY-MM-DD-kurzname.md`, klein, ohne Umlaute – z. B. `2026-08-02-linsen-dal.md`

## Vorlage

```markdown
# Rezeptname

- **Portionen:** 2
- **Gesamtzeit:** 30 min
- **Schwierigkeit:** einfach | mittel | fortgeschritten
- **Küche:** z. B. indisch
- **Mahlzeit:** fruehstueck | mittag | abend | snack (mehrere möglich)
- **Nährwert:** proteinreich | ballaststoffreich | kohlenhydratreich | fettreich | kalorienarm | ausgewogen
- **Block:** alltag | komplex | tofu | welt | fruehstueck
- **Tags:** budget, schnell, mealprep
- **Kategorie:** z. B. Suppe/Eintopf

## Zutaten

- 200 g rote Linsen
- 1 Dose Kokosmilch (400 ml)
- 1 EL Öl
- Salz nach Bedarf (optional)

## Schritte

1. Zwiebel würfeln und in Öl glasig dünsten. (5 min, aktiv)
2. Linsen und Kokosmilch zugeben, köcheln lassen. (20 min, passiv)
3. Abschmecken.

## Ersatz

- Kokosmilch → Sahne oder Hafercuisine (Weniger süß, dafür säurestabiler)

## Hinweise

Freitext: Allergene-Besonderheiten, Tofusorte (fest/seiden/geräuchert!),
Kerntemperaturen bei Fleisch, Herkunft der Idee.
```

Alles unter „Portionen" bis „Kategorie" außer Portionen/Zeit/Küche/Mahlzeit ist
optional; fehlt es, wird abgeleitet und im Bericht gemeldet. Die Timer-Klammer
im Schritt ist `(Dauer, aktiv|passiv|ofen|ruhen)`, optional mit eigenem
Timer-Namen: `(20 min, passiv, "Linsen köcheln")`. Ohne Klammer bekommt der
Schritt keinen Timer. `## Hinweise` landet als „Gut zu wissen" im Rezept-Detail
– ein Satz, den jemand vor dem Kochen lesen will, keine Quellenangabe.

Mengen mit Toleranz denken (keine Scheinpräzision), Tofusorte immer benennen –
fest, seiden und geräuchert sind getrennte Zutaten und matchen getrennt.

# rezepte – Eingangsordner für Rezept-Markdowns

Hier legt Cowork (oder wer auch immer) neue Rezepte als Markdown ab, bevor sie
ins v1-Schema konvertiert und in einen Rezeptblock (`js/data/rezepte-*.js`)
eingetragen werden. Die App liest diese Dateien **nicht** – das hier ist der
Sammelplatz, kein Datenpfad.

**Achtung, öffentlich:** Das Repo läuft auf GitHub Pages, alles hier ist für
jeden sichtbar. Keine privaten Notizen, keine personenbezogenen Angaben.

## Ablauf

1. Rezept als `.md` nach der Vorlage unten hier ablegen
2. Konvertierung ins v1-Schema (`kruggel-recipe-db/v1`, s. CLAUDE.md) und
   Eintrag in den passenden Block in `js/data/` – neue ID nach Block-Präfix
   (KMX- · TOF- · WLT- · ALL- · FRU-; Kern-Block RCP-/SNK- liegt in kerndb.js)
3. `node tools/validate-db.mjs` muss grün sein
4. Die konvertierte MD-Datei nach `erledigt/` verschieben (bleibt als Quelle
   erhalten) oder löschen

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

## Zutaten

- 200 g rote Linsen
- 1 Dose Kokosmilch (400 ml)
- 1 EL Öl
- Salz nach Bedarf (optional)

## Schritte

1. Zwiebel würfeln und in Öl glasig dünsten. (5 min, aktiv)
2. Linsen und Kokosmilch zugeben, köcheln lassen. (20 min, passiv)
3. Abschmecken.

## Hinweise

Freitext: Allergene-Besonderheiten, Tofusorte (fest/seiden/geräuchert!),
Kerntemperaturen bei Fleisch, Herkunft der Idee.
```

Mengen mit Toleranz denken (keine Scheinpräzision), Tofusorte immer benennen –
fest, seiden und geräuchert sind getrennte Zutaten und matchen getrennt.

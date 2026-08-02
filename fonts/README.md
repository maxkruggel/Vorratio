# Schriften

Beide Familien liegen lokal im Repo – die PWA ist offlinefähig, es darf kein
CDN im Spiel sein (siehe `docs/design-handoff/UEBERGABE-CLAUDE-DESIGN.md`,
Abschnitt 3).

| Datei | Familie | Verwendung |
|---|---|---|
| `bricolage-grotesque-latin.woff2`, `…-latin-ext.woff2` | Bricolage Grotesque (variabel, 400–700) | Display: Überschriften, Wortmarke, Timer, Zahlen |
| `figtree-latin.woff2`, `…-latin-ext.woff2` | Figtree (variabel, 400–700) | Fließtext, Labels, Buttons |

Beide sind variable Fonts über die Achse `wght` 400–700; Bricolage hat
zusätzlich `opsz` (per `font-optical-sizing: auto` in `css/style.css` aktiv).
Es sind die Google-Fonts-Subsets `latin` und `latin-ext` – `vietnamese` ist
bewusst nicht dabei.

Lizenz: **SIL Open Font License 1.1** (`OFL.txt`) für beide Familien.
Copyright Bricolage Grotesque: The Bricolage Grotesque Project Authors
(https://github.com/ateliertriay/bricolage).
Copyright Figtree: The Figtree Project Authors
(https://github.com/erikdkennedy/figtree).

Aktualisieren: Subset-URLs über die Google-Fonts-CSS-API ziehen
(`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Figtree:wght@400..700`)
und die `.woff2`-Dateien unter den obigen Namen ersetzen. Danach die
Cache-Version in `sw.js` hochzählen.

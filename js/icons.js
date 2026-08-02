/* Vorratio – Icon-Set aus der Design-Übergabe (Claude Design, „Vorratio App").
   Duotone auf 24er-Raster, Strich 1,6 px, Duotone-Fläche = --duo.
   Die Strichfarbe erbt über currentColor, die Flächen bekommen Klassen
   (.duo/.ring/.on/.warnfill) – so schaltet ein Kontext (Tabbar aktiv,
   Akzentfläche, Hinweiskarte, Dark Mode) alles über eine Variable um.
   Ersetzt die Unicode-Platzhalter der neutralen Ausbaustufe. */

const PFADE = {
  /* --- Tabbar ------------------------------------------------------- */
  heute: `<circle class="duo" cx="12" cy="12" r="4.4" stroke="currentColor" stroke-width="1.6"/>
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  vorrat: `<path class="duo" d="M6.6 9.2h10.8v9.6a2.6 2.6 0 0 1-2.6 2.6H9.2a2.6 2.6 0 0 1-2.6-2.6z" stroke="currentColor" stroke-width="1.6"/>
    <path d="M8.4 9.2V5.4a1.8 1.8 0 0 1 1.8-1.8h3.6a1.8 1.8 0 0 1 1.8 1.8v3.8M6.6 14.4h10.8" stroke="currentColor" stroke-width="1.6"/>`,
  einkauf: `<path class="duo" d="M4.4 8.6h15.2l-1.5 10a2.2 2.2 0 0 1-2.2 1.9H8.1a2.2 2.2 0 0 1-2.2-1.9z" stroke="currentColor" stroke-width="1.6"/>
    <path d="M8.8 8.6l2.2-5.2M15.2 8.6L13 3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  wissen: `<path class="duo" d="M4 4.6h6.2a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M20 4.6h-6.2a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2H20z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  profil: `<circle class="duo" cx="12" cy="8.4" r="3.8" stroke="currentColor" stroke-width="1.6"/>
    <path d="M4.8 20.4c.7-3.9 3.7-5.9 7.2-5.9s6.5 2 7.2 5.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,

  /* --- Aktionen ----------------------------------------------------- */
  wuerfeln: `<path d="M20 12a8 8 0 1 1-2.6-5.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M20 3.6V8h-4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  claude: `<path class="duo" d="M12 3.2l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path class="ink" d="M18.4 16.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>`,
  kamera: `<rect class="duo" x="2.8" y="6.4" width="18.4" height="13.2" rx="3" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="13" r="3.8" stroke="currentColor" stroke-width="1.6"/>
    <path d="M8.6 6.4l1.3-2.2h4.2l1.3 2.2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  barcode: `<path d="M3.6 5.6v12.8M7 5.6v12.8M10.8 5.6v12.8M14.2 5.6v12.8M17.4 5.6v12.8M20.4 5.6v12.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  erfassen: `<circle class="duo" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
    <path d="M12 7.6v8.8M7.6 12h8.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  plus: `<path d="M12 6.5v11M6.5 12h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  minus: `<path d="M6.5 12h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  /* Gefüllter Haken – Kreis in currentColor, Haken in der Gegenfarbe. */
  check: `<circle class="ink" cx="12" cy="12" r="9"/>
    <path class="on" d="M7.8 12.3l2.9 2.9 5.5-6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  checkLeer: `<circle class="ring" cx="12" cy="12" r="9" stroke-width="1.6"/>`,
  entfernen: `<circle class="warnfill" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
    <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  x: `<path d="M8.4 8.4l7.2 7.2M15.6 8.4l-7.2 7.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  zurueck: `<path d="M14.6 5.4L8 12l6.6 6.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  weiter: `<path d="M9.4 5.4L16 12l-6.6 6.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  runter: `<path d="M6 9.5l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  suche: `<circle cx="11" cy="11" r="6.6" stroke="currentColor" stroke-width="1.7"/>
    <path d="M15.8 15.8l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,

  /* --- Inhalt ------------------------------------------------------- */
  tipp: `<path d="M9.4 18.6h5.2M10 21.2h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <path class="duo" d="M12 2.8a6.4 6.4 0 0 1 3.7 11.6c-.5.4-.8 1-.8 1.6H9.1c0-.6-.3-1.2-.8-1.6A6.4 6.4 0 0 1 12 2.8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  idee: `<path class="duo" d="M12 4.6l2.3 5.1 5.1 2.3-5.1 2.3-2.3 5.1-2.3-5.1L4.6 12l5.1-2.3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  geschafft: `<path class="duo" d="M4.2 20.4l4.6-11 6.6 6.6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M15.4 3.6v2.6M20.4 8.6h-2.6M19.4 4.6l-1.8 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  timer: `<circle class="duo" cx="12" cy="13" r="8.2" stroke="currentColor" stroke-width="1.6"/>
    <path d="M12 9v4.2l2.6 1.6M9.4 2.8h5.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  ziel: `<circle class="duo" cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/>
    <circle class="ink" cx="12" cy="12" r="1.3"/>`,
  lokal: `<rect class="duo" x="3.4" y="9.6" width="17.2" height="9.4" rx="2.6" stroke="currentColor" stroke-width="1.6"/>
    <path d="M7.4 9.6V7a4.6 4.6 0 0 1 9.2 0v2.6" stroke="currentColor" stroke-width="1.6"/>`,
  achtung: `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
    <path d="M12 7.6v5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle class="ink" cx="12" cy="16.3" r="1.1"/>`,
};

/* Inline-SVG als String – das DOM entsteht in app.js aus Template-Strings. */
export function icon(name, size = 22, klasse = "") {
  const d = PFADE[name];
  if (!d) return "";
  return `<svg class="ic${klasse ? " " + klasse : ""}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">${d}</svg>`;
}

/* Wortmarken-Signet „Keimling-V" auf Tanne – gleiche Geometrie wie icons/icon.svg. */
export function logoMark(size = 88) {
  return `<svg class="logo-svg" width="${size}" height="${size}" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
    <rect class="lm-bg" width="128" height="128" rx="28"/>
    <path class="lm-v" d="M38 44 L64 96 L90 44" fill="none" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse class="lm-leaf" cx="79" cy="38" rx="17" ry="9.5" transform="rotate(-32 79 38)"/>
  </svg>`;
}

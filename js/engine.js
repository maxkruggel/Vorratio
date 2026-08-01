/* Vorratio Rezept-Engine: Profilfilter (3 Achsen), Bestandsabgleich,
   Vorschlagslogik (3 Vorschläge je Slot, neu würfeln), Abbuchung mit Toleranz. */

import { REZEPTE, ZUTATEN } from "./data/kerndb.js";
import { FORM_ERLAUBT, ZIELE } from "./data/profil.js";

const ZUTAT_INDEX = Object.fromEntries(ZUTATEN.map((z) => [z.id, z]));

/* Slots: 8:00 Frühstück · 11:30 Mittag · 17:30 Abend */
function aktuellerSlot(now = new Date()) {
  const min = now.getHours() * 60 + now.getMinutes();
  if (min < 11 * 60) return "fruehstueck";
  if (min < 16 * 60) return "mittag";
  return "abend";
}

const SLOT_NAMEN = { fruehstueck: "Frühstück", mittag: "Mittagessen", abend: "Abendessen" };

/* Achse 1+2: Darf dieses Rezept dem Profil überhaupt vorgeschlagen werden? */
function rezeptErlaubt(rezept, profil) {
  const erlaubteTags = FORM_ERLAUBT[profil.ernaehrungsform] || FORM_ERLAUBT.mischkost;
  if (!rezept.ernaehrungsform.some((t) => erlaubteTags.includes(t))) return false;

  const allergene = rezept.allergene || [];
  // Subtypen-Schärfung: lacto = kein Ei, ovo = keine Milch
  if (profil.ernaehrungsform === "lacto" && allergene.includes("ei")) return false;
  if (profil.ernaehrungsform === "ovo" && allergene.includes("laktose")) return false;

  for (const aus of profil.ausschluesse || []) {
    if (allergene.includes(aus)) return false;
    if (aus === "halal" || aus === "koscher") {
      // Konservativ: nur eindeutig unkritische Rezepte zeigen.
      // Koscher: keine Fleisch-Milch-Kombination, keine Weichtiere/Krebstiere.
      const fleisch = rezept.ernaehrungsform.some((t) => t === "mit_fleisch" || t === "mit_gefluegel")
        && !rezept.ernaehrungsform.includes("vegan") && !rezept.ernaehrungsform.includes("vegetarisch");
      if (aus === "koscher" && fleisch && allergene.includes("laktose")) return false;
      if (allergene.includes("krebstiere") || allergene.includes("weichtiere")) return false;
    }
  }
  return true;
}

/* Bestandsabgleich: welche Zutaten eines Rezepts sind da, welche fehlen? */
function bestandsAbgleich(rezept, bestand) {
  const vorhanden = [];
  const fehlt = [];
  for (const z of rezept.zutaten) {
    if (!z.zutat_id) continue;                       // Wasser u. Ä.
    const kat = ZUTAT_INDEX[z.zutat_id];
    if (kat?.basis) continue;                        // Grundausstattung zählt nie als fehlend
    if (z.optional) continue;
    const item = bestand.find((b) => b.zutat_id === z.zutat_id && istVorhanden(b, z));
    (item ? vorhanden : fehlt).push(z);
  }
  return { vorhanden, fehlt, quote: vorhanden.length / Math.max(1, vorhanden.length + fehlt.length) };
}

/* Reicht der Bestandseintrag für die Rezeptmenge? Toleranzprinzip: großzügig
   runden, nie Scheinpräzision – bei Schüttgut gilt "irgendwas Sinnvolles da". */
function istVorhanden(item, rezeptZutat) {
  if (item.art === "pauschal") return item.menge !== 0;
  if (item.menge == null) return true;
  if (item.menge <= 0) return false;
  const noetig = mengeInBestandsEinheit(rezeptZutat, item);
  if (noetig == null) return item.menge > 0;
  return item.menge >= noetig * 0.85;                // −15 % Toleranzband
}

/* Rezeptmenge in die Einheit des Bestandseintrags übersetzen (grobe Küchenmaße). */
function mengeInBestandsEinheit(z, item) {
  if (z.menge == null) return null;
  if (z.einheit === item.einheit) return z.menge;
  const kat = ZUTAT_INDEX[z.zutat_id] || {};
  if (z.einheit === "Dose" && item.einheit === "Dose") return z.menge;
  if (z.einheit === "ml" && item.einheit === "Dose" && kat.inhalt_ml) return z.menge / kat.inhalt_ml;
  if (z.einheit === "g" && item.einheit === "Dose" && kat.inhalt_g) return z.menge / kat.inhalt_g;
  if (z.einheit === "g" && item.einheit === "Stk" && kat.inhalt_g) return z.menge / kat.inhalt_g;
  if (z.einheit === "g" && item.einheit === "Pck" && kat.inhalt_g) return z.menge / kat.inhalt_g;
  if (z.einheit === "EL") return null;               // Küchenmaße: Toleranzprinzip, nicht rechnen
  if (z.einheit === "TL" || z.einheit === "Prise" || z.einheit === "nach_Bedarf") return null;
  if (z.einheit === "Zehe" && item.einheit === "Zehe") return z.menge;
  if (z.einheit === "Zehe") return null;             // Knolle vorhanden reicht
  return null;
}

/* Achse 4: Wie zahlt ein Rezept auf die gewählten Ziele ein? Koppelt an
   naehrwert_einordnung.profil + Tags. fit: +1 bevorzugt · −1 gemieden · 0 neutral.
   Liefert je gewähltem Ziel einen Eintrag – fürs Scoring und für UI-Badges. */
function zielTreffer(rezept, zielIds = []) {
  const profilTag = rezept.naehrwert_einordnung?.profil;
  const tags = rezept.tags || [];
  return ZIELE.filter((z) => zielIds.includes(z.id)).map((z) => ({
    ziel: z,
    fit: z.bevorzugt.profile.includes(profilTag) || z.bevorzugt.tags.some((t) => tags.includes(t)) ? 1
      : z.meidet.profile.includes(profilTag) ? -1 : 0,
  }));
}

/* Ziel-Bonus fürs Scoring: gemittelt über die gewählten Ziele (weiche
   Präferenz, ±18 max – Bestandsdeckung bleibt der dominante Faktor). */
function zielBonus(rezept, profil) {
  const zt = zielTreffer(rezept, profil.ziele || []);
  return zt.length ? 18 * (zt.reduce((sum, t) => sum + t.fit, 0) / zt.length) : 0;
}

/* Reine Snack-Rezepte (Recherche 4) gehören in die Snack-Ecke, nie in die
   Essens-Slots – auch nicht beim Auffüllen dünner Slot-Pools. */
const nurSnack = (r) => r.mahlzeitentyp.every((t) => t === "snack");

/* 3 Vorschläge für den Slot: Profilfilter → Score nach Bestandsdeckung + Stil + Ziele.
   seed steuert das Neu-Würfeln (deterministisch pro Tag+Wurf). */
function vorschlaege(profil, bestand, slot, seed = 0, anzahl = 3, rezepte = REZEPTE) {
  const pool = rezepte
    .filter((r) => r.mahlzeitentyp.includes(slot))
    .filter((r) => rezeptErlaubt(r, profil))
    .map((r) => {
      const abgleich = bestandsAbgleich(r, bestand);
      let score = abgleich.quote * 100;
      if ((profil.stile || []).some((s) => (r.tags || []).includes(s))) score += 15;
      score += zielBonus(r, profil);                 // Achse 4: weiche Ziel-Präferenz
      score += pseudoZufall(r.id, seed) * 20;        // Varianz pro Wurf
      return { rezept: r, abgleich, score };
    })
    .sort((a, b) => b.score - a.score);

  // Bei dünnem Slot-Pool (z. B. Frühstück) mit slot-fremden Treffern auffüllen
  if (pool.length < anzahl) {
    const ids = new Set(pool.map((p) => p.rezept.id));
    const rest = rezepte
      .filter((r) => !ids.has(r.id) && !nurSnack(r) && rezeptErlaubt(r, profil))
      .map((r) => ({ rezept: r, abgleich: bestandsAbgleich(r, bestand), score: 0 }));
    pool.push(...rest);
  }
  return pool.slice(0, anzahl);
}

/* Snack-Ecke: Vorschläge unabhängig von den Essenszeiten (Kap. Snacks).
   Gleiche Score-Logik wie die Slots (inkl. Ziel-Bonus), nur "snack"-Typ. */
function snackVorschlaege(profil, bestand, seed = 0, anzahl = 2, rezepte = REZEPTE) {
  return rezepte
    .filter((r) => r.mahlzeitentyp.includes("snack"))
    .filter((r) => rezeptErlaubt(r, profil))
    .map((r) => {
      const abgleich = bestandsAbgleich(r, bestand);
      let score = abgleich.quote * 100;
      if ((profil.stile || []).some((s) => (r.tags || []).includes(s))) score += 15;
      score += zielBonus(r, profil);                 // Achse 4: weiche Ziel-Präferenz
      score += pseudoZufall(r.id, seed) * 20;
      return { rezept: r, abgleich, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, anzahl);
}

/* FNV-1a mit Avalanche-Finalizer: nichtlinear im Seed, damit "Neu würfeln"
   und der Tageswechsel die Rangfolge wirklich durchmischen. */
function pseudoZufall(id, seed) {
  let h = 2166136261 ^ seed;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

/* Tagesseed: Datum + Wurf → pro Tag neue Rezeptideen (Kap. 4.3), innerhalb
   eines Slots stabil, "Neu würfeln" zählt den Wurf hoch. */
function tagesSeed(datumStr, wurf = 0) {
  let h = 0;
  for (const c of datumStr) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h) + wurf * 7919;
}

/* Abbuchung nach "Gekocht": Bestand um Rezeptmengen × Portionsfaktor reduzieren.
   Toleranzprinzip ±10–15 % – Anzeige bleibt immer Näherung. */
function abbuchen(rezept, bestand, portionen) {
  const faktor = portionen / (rezept.portionen || portionen || 1);
  const gebucht = [];
  for (const z of rezept.zutaten) {
    if (!z.zutat_id) continue;
    const item = bestand.find((b) => b.zutat_id === z.zutat_id);
    if (!item || item.art === "pauschal" || item.menge == null) continue;
    const noetig = mengeInBestandsEinheit(z, item);
    if (noetig == null) continue;
    const abzug = noetig * faktor;
    item.menge = Math.max(0, rund(item.menge - abzug, item.einheit));
    item.updated = new Date().toISOString();
    gebucht.push({ name: item.name, abzug: rund(abzug, item.einheit), einheit: item.einheit });
  }
  return gebucht;
}

function rund(v, einheit) {
  if (einheit === "g" || einheit === "ml") return Math.round(v / 10) * 10;
  return Math.round(v * 10) / 10;
}

/* Anzeige immer als Näherung ("~500 g"), nie Scheinpräzision. */
function mengeAnzeige(item) {
  if (item.art === "pauschal") return item.menge === 0 ? "leer" : "vorrätig";
  if (item.menge == null) return "vorrätig";
  if (item.menge <= 0) return "leer";
  if (item.art === "schuettgut") return `~${item.menge} ${item.einheit}`;
  return `${item.menge} ${item.einheit}`;
}

/* Wocheneinkauf: leere oder fast leere Vorräte (≤ 1/5 der Packung) einsammeln. */
function wochenKandidaten(bestand) {
  return bestand.filter((item) => {
    if (item.art === "pauschal") return item.menge === 0;
    if (item.menge == null) return false;
    const kat = ZUTAT_INDEX[item.zutat_id] || {};
    const voll = item.packung || kat.packung || null;
    if (voll) return item.menge <= voll * 0.2;
    return item.menge <= (item.art === "zaehlbar" ? 1 : 0);
  });
}

export {
  ZUTAT_INDEX, aktuellerSlot, SLOT_NAMEN, rezeptErlaubt, bestandsAbgleich,
  vorschlaege, snackVorschlaege, zielTreffer, tagesSeed, abbuchen, mengeAnzeige,
  wochenKandidaten, mengeInBestandsEinheit,
};

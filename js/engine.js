/* Vorratio Rezept-Engine: Profilfilter (3 Achsen), Bestandsabgleich,
   Vorschlagslogik (3 Vorschläge je Slot, neu würfeln), Abbuchung mit Toleranz. */

import { REZEPTE, ZUTATEN } from "./data/kerndb.js";
import { FORM_ERLAUBT, ZIELE, gewaehlteVorlieben } from "./data/profil.js";
import { allergeneFuerRezept, enthaeltSchwein, enthaeltAlkohol } from "./data/allergene.js";

const ZUTAT_INDEX = Object.fromEntries(ZUTATEN.map((z) => [z.id, z]));

/* Slots: 8:00 Frühstück · 11:30 Mittag · 17:30 Abend */
function aktuellerSlot(now = new Date()) {
  const min = now.getHours() * 60 + now.getMinutes();
  if (min < 11 * 60) return "fruehstueck";
  if (min < 16 * 60) return "mittag";
  return "abend";
}

const SLOT_NAMEN = { fruehstueck: "Frühstück", mittag: "Mittagessen", abend: "Abendessen" };

/* Enthält das Rezept Fleisch als tragende Zutat? (für die koschere
   Fleisch-Milch-Trennung – vegetarische Varianten zählen nicht mit) */
function istFleischgericht(rezept) {
  const formen = rezept.ernaehrungsform || [];
  return formen.some((t) => t === "mit_fleisch" || t === "mit_gefluegel")
    && !formen.includes("vegan") && !formen.includes("vegetarisch");
}

/* Religiöse Ausschlüsse (Achse 2). Bewusst konservativ: im Zweifel ausblenden.
   · halal   – kein Schweinefleisch, kein Alkohol (auch verkocht: das ist eine
               Gewissensfrage, keine Frage des Restalkohols). Krebs- und
               Weichtiere sind zwischen den Rechtsschulen strittig (hanafitisch
               nicht erlaubt) und bleiben deshalb außen vor.
   · koscher – kein Schweinefleisch, keine Krebs-/Weichtiere, keine Fleisch-
               Milch-Kombination. Schächtung und getrennte Küche kann die App
               nicht beurteilen – der Hinweis dazu steht im Profil. */
const RELIGIOES = {
  halal: (rezept, allergene) => enthaeltSchwein(rezept) || enthaeltAlkohol(rezept)
    || allergene.has("krebstiere") || allergene.has("weichtiere"),
  koscher: (rezept, allergene) => enthaeltSchwein(rezept)
    || allergene.has("krebstiere") || allergene.has("weichtiere")
    || (istFleischgericht(rezept) && allergene.has("laktose")),
};

/* Achse 1+2: Darf dieses Rezept dem Profil überhaupt vorgeschlagen werden?
   Die Allergene kommen aus allergeneFuerRezept() – Deklaration UND Ableitung
   aus den Zutaten. Ein AI-Rezept, das sein `allergene`-Feld falsch ausfüllt,
   rutscht damit trotzdem nicht durch. */
function rezeptErlaubt(rezept, profil) {
  const erlaubteTags = FORM_ERLAUBT[profil.ernaehrungsform] || FORM_ERLAUBT.mischkost;
  if (!rezept.ernaehrungsform.some((t) => erlaubteTags.includes(t))) return false;

  const allergene = allergeneFuerRezept(rezept);
  // Subtypen-Schärfung: lacto = kein Ei, ovo = keine Milch
  if (profil.ernaehrungsform === "lacto" && allergene.has("ei")) return false;
  if (profil.ernaehrungsform === "ovo" && allergene.has("laktose")) return false;

  for (const aus of profil.ausschluesse || []) {
    if (allergene.has(aus)) return false;
    if (RELIGIOES[aus]?.(rezept, allergene)) return false;
  }

  // Selbst eingetragene Ausschlüsse ("Rosenkohl", "Koriander"): Freitext gegen
  // Rezeptname und Zutatennamen prüfen – gleiche Härte wie die Standardfilter.
  for (const eigen of profil.eigeneAusschluesse || []) {
    const begriff = String(eigen).trim().toLowerCase();
    if (begriff.length < 2) continue;
    if (rezept.name.toLowerCase().includes(begriff)) return false;
    if (rezept.zutaten.some((z) => String(z.zutat_name || "").toLowerCase().includes(begriff))) return false;
  }
  return true;
}

/* Alle Bestandsposten zu einer Zutat. Dieselbe Zutat darf mehrfach im Bestand
   stehen (angebrochene und neue Packung, zwei Einkäufe) – Abgleich und
   Abbuchung müssen dieselbe Menge sehen, sonst zeigt die App "alles da" und
   bucht danach von der falschen Position ab. */
function bestandsPosten(bestand, zutatId) {
  return bestand.filter((b) => b.zutat_id === zutatId);
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
    const da = istVorhanden(bestandsPosten(bestand, z.zutat_id), z);
    (da ? vorhanden : fehlt).push(z);
  }
  return { vorhanden, fehlt, quote: vorhanden.length / Math.max(1, vorhanden.length + fehlt.length) };
}

/* Reichen die Bestandsposten für die Rezeptmenge? Toleranzprinzip: großzügig
   runden, nie Scheinpräzision – bei Schüttgut gilt "irgendwas Sinnvolles da".
   Mengen werden über alle Posten derselben Einheit summiert. */
function istVorhanden(posten, rezeptZutat) {
  if (!Array.isArray(posten)) posten = [posten];     // Toleranz für Einzelposten
  if (!posten.length) return false;
  // "Da oder leer" bzw. unbestimmte Menge: ein einziger Posten genügt
  if (posten.some((p) => (p.art === "pauschal" ? p.menge !== 0 : p.menge == null))) return true;
  const mengen = posten.filter((p) => p.menge > 0);
  if (!mengen.length) return false;
  const einheit = mengen[0].einheit;
  const gesamt = mengen.filter((p) => p.einheit === einheit).reduce((s, p) => s + p.menge, 0);
  const noetig = mengeInBestandsEinheit(rezeptZutat, mengen[0]);
  if (noetig == null) return true;                   // nicht rechnen: Toleranzprinzip
  return gesamt >= noetig * 0.85;                    // −15 % Toleranzband
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

/* Achse 3: Vorlieben – trifft das Rezept eine der gewählten Lieblingszutaten?
   Geprüft wird über die zutat_id (Kern-DB) und zusätzlich über Zutaten- und
   Rezeptnamen, damit auch AI-Rezepte mit freien Zutaten ("Tempeh-Bowl")
   erkannt werden. */
function trifftVorliebe(rezept, vorliebe) {
  const ids = vorliebe.zutaten || [];
  const muster = vorliebe.muster || [];
  if (rezept.zutaten.some((z) => ids.includes(z.zutat_id))) return true;
  const text = `${rezept.name} ${rezept.zutaten.map((z) => z.zutat_name || "").join(" ")}`.toLowerCase();
  return muster.some((m) => text.includes(m));
}

/* Welche gewählten Vorlieben bedient dieses Rezept? (Scoring + UI-Hinweis) */
function vorliebenTreffer(rezept, profil) {
  const ids = profil.vorlieben || [];
  if (!ids.length) return [];
  return gewaehlteVorlieben(profil.ernaehrungsform, ids).filter((v) => trifftVorliebe(rezept, v));
}

/* Vorlieben-Bonus: weiche Präferenz, gedeckelt bei +14 – bleibt damit unter
   dem Gewicht der Bestandsdeckung. Nichts wird ausgefiltert, nur sortiert. */
function vorliebenBonus(rezept, profil) {
  return Math.min(14, vorliebenTreffer(rezept, profil).length * 8);
}

/* Achse 5: Wie zahlt ein Rezept auf die gewählten Ziele ein? Koppelt an
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

/* Ein Rezept bewerten – die eine Stelle, an der die Gewichtung steht.
   Bestandsdeckung dominiert (×100), alles andere schiebt nur:
   Stil +15 · Vorlieben bis +14 · Ziele ±18 · Wurf-Varianz bis +20. */
function bewerte(rezept, profil, bestand, seed) {
  const abgleich = bestandsAbgleich(rezept, bestand);
  let score = abgleich.quote * 100;
  if ((profil.stile || []).some((s) => (rezept.tags || []).includes(s))) score += 15;
  score += vorliebenBonus(rezept, profil);           // Achse 3: Lieblingszutaten
  score += zielBonus(rezept, profil);                // Achse 5: weiche Ziel-Präferenz
  score += pseudoZufall(rezept.id, seed) * 20;       // Varianz pro Wurf
  return { rezept, abgleich, score };
}

/* 3 Vorschläge für den Slot: Profilfilter → Score nach Bestandsdeckung + Stil + Ziele.
   seed steuert das Neu-Würfeln (deterministisch pro Tag+Wurf). */
function vorschlaege(profil, bestand, slot, seed = 0, anzahl = 3, rezepte = REZEPTE) {
  const erlaubt = rezepte.filter((r) => rezeptErlaubt(r, profil));
  const pool = erlaubt
    .filter((r) => r.mahlzeitentyp.includes(slot))
    .map((r) => bewerte(r, profil, bestand, seed))
    .sort((a, b) => b.score - a.score);

  // Bei dünnem Slot-Pool (z. B. Frühstück bei mehreren Ausschlüssen) mit
  // slot-fremden Treffern auffüllen. Die werden genauso bewertet und sortiert
  // wie die echten – sonst stünde dort die Datenbankreihenfolge statt dessen,
  // was der Bestand hergibt. `slotFremd` macht es in der UI sichtbar.
  if (pool.length < anzahl) {
    const ids = new Set(pool.map((p) => p.rezept.id));
    const rest = erlaubt
      .filter((r) => !ids.has(r.id) && !nurSnack(r))
      .map((r) => ({ ...bewerte(r, profil, bestand, seed), slotFremd: true }))
      .sort((a, b) => b.score - a.score);
    pool.push(...rest);
  }
  return pool.slice(0, anzahl);
}

/* Snack-Ecke: Vorschläge unabhängig von den Essenszeiten (Kap. Snacks).
   Gleiche Score-Logik wie die Slots, nur "snack"-Typ. */
function snackVorschlaege(profil, bestand, seed = 0, anzahl = 2, rezepte = REZEPTE) {
  return rezepte
    .filter((r) => r.mahlzeitentyp.includes("snack"))
    .filter((r) => rezeptErlaubt(r, profil))
    .map((r) => bewerte(r, profil, bestand, seed))
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
   Toleranzprinzip ±10–15 % – Anzeige bleibt immer Näherung.
   Liegt eine Zutat auf mehreren Posten (angebrochene + neue Packung), wird der
   Reihe nach abgeräumt: erst die angebrochene leeren, dann die nächste. */
function abbuchen(rezept, bestand, portionen) {
  const faktor = portionen / (rezept.portionen || portionen || 1);
  const gebucht = [];
  const jetzt = new Date().toISOString();
  for (const z of rezept.zutaten) {
    if (!z.zutat_id) continue;
    const posten = bestandsPosten(bestand, z.zutat_id)
      .filter((b) => b.art !== "pauschal" && b.menge != null);
    if (!posten.length) continue;
    const noetig = mengeInBestandsEinheit(z, posten[0]);
    if (noetig == null) continue;                    // EL/TL/Prise: nicht rechnen
    const einheit = posten[0].einheit;
    let offen = noetig * faktor;
    let summe = 0;
    for (const item of posten) {
      if (offen <= 0) break;
      if (item.einheit !== einheit || !(item.menge > 0)) continue;
      const nimmt = Math.min(item.menge, offen);
      item.menge = Math.max(0, rund(item.menge - nimmt, item.einheit));
      item.updated = jetzt;
      offen -= nimmt;
      summe += nimmt;
    }
    if (summe > 0) gebucht.push({ name: posten[0].name, abzug: rund(summe, einheit), einheit });
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

/* Ab welchem Rest gilt ein zählbarer Artikel ohne Packungsgröße als
   nachzukaufen? Nach Kategorie, nicht pauschal: die letzte Möhre im Gemüsefach
   ist ein Rest, die letzte Dose im Schrank ist Vorrat. Ohne diese Trennung
   stünde alles, wovon man üblicherweise genau eins hat (ein Glas
   Wacholderbeeren, ein Päckchen Vanillezucker), dauerhaft auf der Liste. */
const REST_SCHWELLE = { frisch: 1, kuehl: 1 };

/* Ist der gesamte Bestand einer Zutat leer oder fast leer (≤ 1/5 der Packung)?
   `posten` sind alle Bestandszeilen derselben zutat_id. */
function nachkaufReif(posten) {
  const leit = posten[0];
  const kat = ZUTAT_INDEX[leit.zutat_id] || {};
  // "Da oder leer": ein einziger vorrätiger Posten genügt.
  if (leit.art === "pauschal") return posten.every((p) => p.menge === 0);
  // Unbestimmte Menge zählt als vorhanden – nie gegen eine Schwelle rechnen.
  if (posten.some((p) => p.menge == null)) return false;
  const summe = posten.reduce((n, p) => n + (Number(p.menge) || 0), 0);
  const voll = leit.packung || kat.packung || null;
  if (voll) return summe <= voll * 0.2;
  if (leit.art === "zaehlbar") return summe <= (REST_SCHWELLE[leit.kategorie] ?? 0);
  return summe <= 0;
}

/* Wocheneinkauf: leere oder fast leere Vorräte einsammeln – je Zutat ein
   Treffer, über alle Posten summiert. Eine angebrochene Packung neben einer
   vollen ist kein Grund zum Nachkaufen (Kap. 4.7). */
function wochenKandidaten(bestand) {
  const gruppen = new Map();
  for (const item of bestand) {
    if (!item.zutat_id) continue;
    if (!gruppen.has(item.zutat_id)) gruppen.set(item.zutat_id, []);
    gruppen.get(item.zutat_id).push(item);
  }
  return [...gruppen.values()].filter(nachkaufReif).map((posten) => posten[0]);
}

/* Grundzutat = Öl, Essig, Brühe, Gewürze (basis: true in der Kern-DB). Die
   wandern ohne Rückfrage auf die Liste: sie sind erst Kandidat, wenn sie von
   Hand auf "leer" gesetzt wurden – da gibt es nichts mehr zu fragen. */
function istGrundzutat(zutatId) {
  return Boolean(ZUTAT_INDEX[zutatId]?.basis);
}

export {
  ZUTAT_INDEX, aktuellerSlot, SLOT_NAMEN, rezeptErlaubt, bestandsAbgleich, bestandsPosten,
  istVorhanden, bewerte, vorschlaege, snackVorschlaege, zielTreffer, vorliebenTreffer,
  tagesSeed, pseudoZufall, abbuchen, mengeAnzeige, wochenKandidaten, istGrundzutat,
  mengeInBestandsEinheit,
};

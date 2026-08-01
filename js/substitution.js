/* Vorratio Substitutions-Logik: Alternativen je Zutat priorisiert vorschlagen,
   gefiltert nach Profil-Ausschlüssen (harte Filter, wie überall in der App)
   und optional nach Anwendungsfall (backen/aufschlagen/überbacken …).

   Rangfolge (Recherche Substitutionen):
   1. Harte Filter: Allergie-Ausschlüsse über Basis (Soja → soja/tofu/tempeh,
      Nüsse → cashew/mandel, Gluten → weizen_seitan, Lupinen → lupine).
   2. Anwendungsfall: nur Alternativen mit passendem geeignet_fuer.
   3. Sortierung nach prioritaet (1 = neutralste/verlässlichste Wahl). */

import { SUBSTITUTIONEN, BASIS_ALLERGENE } from "./data/substitutionen.js";

const SUB_INDEX = Object.fromEntries(SUBSTITUTIONEN.map((s) => [s.id, s]));

/* Allergene einer Alternative: explizites Feld schlägt die Basis-Zuordnung. */
function altAllergene(alt) {
  return alt.allergene ?? BASIS_ALLERGENE[alt.basis] ?? [];
}

/* Verstößt eine Alternative gegen die Profil-Ausschlüsse? */
function altAusgeschlossen(alt, profil) {
  const aus = profil?.ausschluesse || [];
  return altAllergene(alt).some((a) => aus.includes(a));
}

/* Erlaubte Alternativen eines Datensatzes, priorisiert.
   anwendung (optional): nur Alternativen, die dafür geeignet sind. */
function alternativenFuer(sub, profil = null, anwendung = null) {
  const erlaubt = sub.alternativen
    .filter((a) => !altAusgeschlossen(a, profil))
    .filter((a) => !anwendung || (a.geeignet_fuer || []).includes(anwendung))
    .sort((a, b) => a.prioritaet - b.prioritaet);
  const ausgeblendet = sub.alternativen.length
    - sub.alternativen.filter((a) => !altAusgeschlossen(a, profil)).length;
  return { alternativen: erlaubt, ausgeblendet };
}

/* Datensätze nach Kategorie/Anwendung filtern (Wissens-Tab "Ersatz").
   Datensätze ohne verbleibende Alternative fallen raus. */
function subsFiltern({ kategorie = null, anwendung = null, profil = null } = {}) {
  return SUBSTITUTIONEN
    .filter((s) => !kategorie || s.kategorie === kategorie)
    .map((s) => ({ sub: s, ...alternativenFuer(s, profil, anwendung) }))
    .filter((e) => e.alternativen.length > 0);
}

/* Substitutions-Datensätze zu einer Zutat der Kern-DB (Bestandsabgleich).
   Beim Ei kommen mehrere funktionsbasierte Datensätze zurück. */
function subsFuerZutat(zutatId) {
  return SUBSTITUTIONEN.filter((s) => (s.zutat_ids || []).includes(zutatId));
}

/* Kompakte Ersatz-Vorschläge für eine fehlende Rezept-Zutat: je Datensatz die
   beste erlaubte Alternative → [{ original, funktion, name, verhaeltnis }]. */
function ersatzVorschlaege(zutatId, profil = null) {
  const out = [];
  for (const sub of subsFuerZutat(zutatId)) {
    const { alternativen } = alternativenFuer(sub, profil);
    if (!alternativen.length) continue;
    const top = alternativen[0];
    out.push({
      subId: sub.id,
      original: sub.original_zutat,
      funktion: sub.funktion_name || null,
      name: top.alternative_name,
      verhaeltnis: top.verhaeltnis,
    });
  }
  return out;
}

/* Handelsprodukte fürs UI: Eigenmarken zuerst (Preis/Verfügbarkeit),
   Markenprodukte als Fallback – Reihenfolge innerhalb der Gruppen bleibt. */
function produkteSortiert(alt) {
  const p = alt.handelsprodukte_beispiele || [];
  return [...p.filter((x) => x.eigenmarke), ...p.filter((x) => !x.eigenmarke)];
}

export { SUB_INDEX, alternativenFuer, subsFiltern, subsFuerZutat, ersatzVorschlaege, produkteSortiert };

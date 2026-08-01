/* Vorratio Angebots-Crawl (Kap. 4.7 / 7.4): Wocheneinkaufsliste × Standort-Angebote
   → Markt-Empfehlung mit Abdeckung und Konditionen. Bewusst kein Markt-Hopping:
   empfohlen wird ein Markt plus höchstens zwei Alternativen.

   Quelle (Kap. 7.4, festgelegt): Marktguru – inoffizielle, zugängliche API,
   PLZ-basiert, viele Ketten. Schonender Umgang: eine Suchanfrage je Listenpunkt,
   Pause zwischen den Anfragen, Ergebnis wird eine Woche gecacht. Keine Umgehung
   technischer Schutzmaßnahmen. Ohne API-Keys läuft der Demo-Modus mit einem
   realistischen Beispieldatensatz – damit ist das Matching offline testbar. */

import { DEMO_ANGEBOTE } from "./data/angebote-demo.js";

const MARKTGURU_BASIS = "https://api.marktguru.de/api/v1";
const SUCH_LIMIT = 64;          // Angebote je Suchbegriff
const PAUSE_MS = 450;           // Abstand zwischen Live-Anfragen (schonend)
const MAX_MAERKTE = 3;          // kein Markt-Hopping: 1 Empfehlung + max. 2 Alternativen

/* ---------------------------------------------------- Textnormalisierung */
/* Kleinbuchstaben, Umlaute → ae/oe/ue/ss, alles außer a-z0-9 wird Leerraum.
   Beispiel: "Müller's H-Milch 3,5 %" → "muellers h milch 3 5" */
function normText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------ Suchprofile
   Je Zutat: q = Suchbegriff für die Angebots-API, muster = Begriffe, die im
   Angebotstext zählen (tokenweise; Komposita über Wortanfang/-ende),
   nicht = Ausschlüsse gegen falsche Treffer ("Kokosmilch" ist keine Milch,
   "Aktionspreis" ist kein Reis). Alles in normalisierter Schreibweise. */
const SUCHPROFILE = {
  ing_reis_weiss:           { q: "reis",              muster: ["reis", "langkornreis"], nicht: ["preis", "waffel", "reisdrink", "reismehl", "reisnudel"] },
  ing_reis_basmati:         { q: "basmati",           muster: ["basmati", "reis"], nicht: ["preis", "waffel", "reisdrink", "reisnudel"] },
  ing_reis_vollkorn:        { q: "vollkornreis",      muster: ["vollkornreis", "naturreis", "reis"], nicht: ["preis", "waffel", "reisdrink", "reisnudel"] },
  ing_nudeln:               { q: "nudeln",            muster: ["nudel", "spaghetti", "penne", "fusilli", "rigatoni", "tagliatelle", "makkaroni", "farfalle", "pasta"], nicht: ["reisnudel", "glasnudel", "instant"] },
  ing_reisnudeln:           { q: "reisnudeln",        muster: ["reisnudel", "glasnudel"], nicht: [] },
  ing_kartoffel:            { q: "kartoffeln",        muster: ["kartoffel", "speisekartoffel"], nicht: ["chips", "salat", "knoedel", "kloesse", "puree", "pommes", "suess"] },
  ing_linsen_rot:           { q: "linsen",            muster: ["linsen"], nicht: ["suppe", "eintopf"] },
  ing_kichererbsen_trocken: { q: "kichererbsen",      muster: ["kichererbse"], nicht: [] },
  ing_kichererbsen_dose:    { q: "kichererbsen",      muster: ["kichererbse"], nicht: [] },
  ing_kidneybohnen_dose:    { q: "kidneybohnen",      muster: ["kidney"], nicht: [] },
  ing_bohnen_schwarz_dose:  { q: "schwarze bohnen",   muster: ["schwarze bohnen"], nicht: [] },
  ing_mais_dose:            { q: "mais",              muster: ["mais"], nicht: ["chips", "waffel", "popcorn", "maismehl"] },
  ing_ei:                   { q: "eier",              muster: ["eier"], nicht: ["nudel", "teig", "likoer", "ueberraschung", "schoko"] },
  ing_zwiebel:              { q: "zwiebeln",          muster: ["zwiebel"], nicht: ["roest", "fruehlings", "lauch"] },
  ing_knoblauch:            { q: "knoblauch",         muster: ["knoblauch"], nicht: ["sauce", "baguette", "butter"] },
  ing_tomate_dose:          { q: "gehackte tomaten",  muster: ["gehackte tomaten", "dosentomaten", "tomaten"], nicht: ["passiert", "mark", "ketchup", "getrocknet", "rispen", "cherry", "strauch", "frisch", "sauce"] },
  ing_passierte_tomaten:    { q: "passierte tomaten", muster: ["passiert"], nicht: [] },
  ing_tomatenmark:          { q: "tomatenmark",       muster: ["tomatenmark"], nicht: [] },
  ing_broccoli:             { q: "brokkoli",          muster: ["brokkoli", "broccoli"], nicht: [] },
  ing_moehre:               { q: "moehren",           muster: ["moehre", "karotte"], nicht: ["saft"] },
  ing_spinat:               { q: "spinat",            muster: ["spinat"], nicht: [] },
  ing_paprika:              { q: "paprika",           muster: ["paprika"], nicht: ["pulver", "gewuerz", "chips", "edelsuess", "geraeuchert"] },
  ing_zucchini:             { q: "zucchini",          muster: ["zucchini"], nicht: [] },
  ing_aubergine:            { q: "aubergine",         muster: ["aubergine"], nicht: [] },
  ing_lauch:                { q: "lauch",             muster: ["lauch", "porree"], nicht: ["zwiebel"] },
  ing_gurke:                { q: "gurken",            muster: ["gurke"], nicht: ["gewuerz", "essig", "senf", "cornichon"] },
  ing_tomate_frisch:        { q: "tomaten",           muster: ["tomate", "rispentomate", "cherrytomate", "strauchtomate"], nicht: ["dose", "gehackt", "passiert", "mark", "ketchup", "getrocknet", "stueckig", "sauce"] },
  ing_roemersalat:          { q: "salat",             muster: ["roemersalat", "romana", "salatherz"], nicht: [] },
  ing_fruehlingszwiebel:    { q: "fruehlingszwiebeln", muster: ["fruehlingszwiebel", "lauchzwiebel"], nicht: [] },
  ing_zitrone:              { q: "zitronen",          muster: ["zitrone"], nicht: ["saft", "limonade", "kuchen"] },
  ing_limette:              { q: "limetten",          muster: ["limette"], nicht: [] },
  ing_apfel:                { q: "aepfel",            muster: ["apfel", "aepfel", "elstar", "braeburn", "gala", "boskoop", "jonagold", "pink lady"], nicht: ["saft", "mus", "schorle", "essig", "kuchen", "ringe"] },
  ing_banane:               { q: "bananen",           muster: ["banane"], nicht: ["schoko", "chips", "milch"] },
  ing_beeren_tk:            { q: "beeren",            muster: ["beeren", "beerenmix", "himbeere", "erdbeere", "heidelbeere", "blaubeere"], nicht: ["marmelade", "konfituere", "joghurt", "saft"] },
  ing_erbsen_tk:            { q: "erbsen",            muster: ["erbsen"], nicht: ["kicher", "suppe"] },
  ing_olivenoel:            { q: "olivenoel",         muster: ["olivenoel"], nicht: [] },
  ing_rapsoel:              { q: "rapsoel",           muster: ["rapsoel", "sonnenblumenoel", "pflanzenoel"], nicht: [] },
  ing_sesamoel:             { q: "sesamoel",          muster: ["sesamoel"], nicht: [] },
  ing_butter:               { q: "butter",            muster: ["butter", "markenbutter"], nicht: ["erdnuss", "keks", "buttermilch", "kraeuter", "gebaeck", "croissant"] },
  ing_mehl_405:             { q: "weizenmehl",        muster: ["weizenmehl", "mehl"], nicht: ["dinkel", "roggen", "reismehl", "maismehl", "mandelmehl"] },
  ing_mehl_1050:            { q: "weizenmehl",        muster: ["weizenmehl", "mehl"], nicht: ["dinkel", "roggen", "reismehl", "maismehl", "mandelmehl"] },
  ing_zucker:               { q: "zucker",            muster: ["zucker"], nicht: ["vanill", "gelier", "suessstoff"] },
  ing_trockenhefe:          { q: "trockenhefe",       muster: ["hefe"], nicht: ["teig", "zopf", "gebaeck"] },
  ing_milch:                { q: "milch",             muster: ["milch", "vollmilch", "frischmilch", "weidemilch", "landmilch"], nicht: ["kokos", "schoko", "kakao", "hafer", "mandel", "soja", "reis", "butter", "dick", "saure", "kondens", "schnitte"] },
  ing_sahne:                { q: "sahne",             muster: ["sahne", "schlagsahne", "kochsahne"], nicht: ["sauer", "joghurt", "eis", "schoko"] },
  ing_joghurt_natur:        { q: "naturjoghurt",      muster: ["naturjoghurt", "joghurt"], nicht: ["frucht", "kirsch", "erdbeer", "vanille", "schoko", "drink", "dressing"] },
  ing_parmesan:             { q: "parmesan",          muster: ["parmesan", "parmigiano", "grana padano", "hartkaese", "pecorino"], nicht: [] },
  ing_feta:                 { q: "feta",              muster: ["feta", "hirtenkaese", "schafskaese"], nicht: [] },
  ing_mozzarella:           { q: "mozzarella",        muster: ["mozzarella"], nicht: [] },
  ing_tofu_natur:           { q: "tofu",              muster: ["tofu"], nicht: [] },
  ing_haehnchenbrust:       { q: "haehnchenbrust",    muster: ["haehnchenbrust", "huehnerbrust"], nicht: [] },
  ing_hackfleisch_rind:     { q: "rinderhackfleisch", muster: ["rinderhack", "hackfleisch", "hack"], nicht: ["gemischt", "schweine", "gefluegel"] },
  ing_lachs:                { q: "lachsfilet",        muster: ["lachs"], nicht: ["raeucher", "geraeuchert", "stremel", "ersatz"] },
  ing_kokosmilch:           { q: "kokosmilch",        muster: ["kokosmilch", "kokosnussmilch"], nicht: [] },
  ing_sojasauce:            { q: "sojasauce",         muster: ["sojasauce", "sojasosse"], nicht: [] },
  ing_misopaste:            { q: "miso",              muster: ["miso"], nicht: [] },
  ing_currypaste:           { q: "currypaste",        muster: ["currypaste"], nicht: [] },
  ing_gochujang:            { q: "gochujang",         muster: ["gochujang"], nicht: [] },
  ing_tahin:                { q: "tahin",             muster: ["tahin", "tahini", "sesammus"], nicht: [] },
  ing_erdnuesse:            { q: "erdnuesse",         muster: ["erdnuess", "erdnuss"], nicht: ["butter", "mus", "flips", "riegel"] },
  ing_haferflocken:         { q: "haferflocken",      muster: ["haferflocken"], nicht: [] },
  ing_gemuesebruehe:        { q: "gemuesebruehe",     muster: ["gemuesebruehe", "bruehe", "fond"], nicht: ["huehner", "rinder", "fleisch"] },
  ing_huehnerbruehe:        { q: "huehnerbruehe",     muster: ["huehnerbruehe", "huehnerfond", "gefluegelbruehe"], nicht: [] },
  ing_essig:                { q: "essig",             muster: ["essig", "balsamico"], nicht: ["gurke", "reiniger"] },
  ing_senf:                 { q: "senf",              muster: ["senf"], nicht: ["gurke", "dressing", "sauce"] },
  ing_brot:                 { q: "brot",              muster: ["brot", "baguette", "ciabatta"], nicht: ["aufstrich", "chips"] },
  ing_tortillas:            { q: "tortilla",          muster: ["tortilla", "wrap"], nicht: ["chips"] },
  ing_oliven:               { q: "oliven",            muster: ["oliven"], nicht: ["oel"] },
  ing_salz:                 { q: "salz",              muster: ["salz", "meersalz", "jodsalz"], nicht: ["stangen", "brezel", "gebaeck", "kraeuter"] },
  ing_pfeffer:              { q: "pfeffer",           muster: ["pfeffer"], nicht: ["minz", "kuchen", "sauce"] },
  ing_currypulver:          { q: "currypulver",       muster: ["currypulver", "curry"], nicht: ["paste", "wurst", "sauce", "ketchup"] },
  ing_kreuzkuemmel:         { q: "kreuzkuemmel",      muster: ["kreuzkuemmel", "cumin"], nicht: [] },
  ing_paprikapulver:        { q: "paprikapulver",     muster: ["paprikapulver", "edelsuess"], nicht: [] },
  ing_chiliflocken:         { q: "chiliflocken",      muster: ["chiliflocken", "chili"], nicht: ["sauce", "con carne", "cheese"] },
  ing_muskat:               { q: "muskat",            muster: ["muskat"], nicht: [] },
  ing_zimt:                 { q: "zimt",              muster: ["zimt"], nicht: ["schnecke", "stern", "gebaeck"] },
  ing_oregano:              { q: "oregano",           muster: ["oregano"], nicht: [] },
  ing_kraeuter_provence:    { q: "kraeuter der provence", muster: ["provence"], nicht: [] },
  ing_petersilie:           { q: "petersilie",        muster: ["petersilie"], nicht: [] },
  ing_basilikum:            { q: "basilikum",         muster: ["basilikum"], nicht: ["pesto"] },
  ing_koriander:            { q: "koriander",         muster: ["koriander"], nicht: [] },
  ing_minze:                { q: "minze",             muster: ["minze"], nicht: ["tee", "bonbon", "kaugummi"] },
  ing_ingwer:               { q: "ingwer",            muster: ["ingwer"], nicht: ["tee", "shot", "sirup"] },
};

/* Profil holen; für unbekannte Zutaten wird eines aus dem Namen abgeleitet. */
function suchprofil(zutatId, name) {
  if (SUCHPROFILE[zutatId]) return SUCHPROFILE[zutatId];
  const basis = normText(String(name || "").replace(/\(.*?\)/g, ""));
  const stopp = new Set(["type", "frisch", "tk", "dose", "getrocknet", "stueckig", "der", "die", "das", "und", "mit"]);
  const tokens = basis.split(" ").filter((t) => t.length >= 3 && !stopp.has(t));
  const q = [...tokens].sort((a, b) => b.length - a.length)[0] || basis;
  return { q, muster: tokens.length ? tokens : [basis], nicht: [] };
}

/* ------------------------------------------------------ Matching (Textabgleich)
   Geprüft wird nur Produktname + Marke – Beschreibungen ("Alpenmilch-Schokolade")
   erzeugen zu viele falsche Treffer. Ein nicht-Begriff irgendwo im Text sperrt
   das Angebot komplett ("Kokosmilch" ist keine Milch, "Reiswaffeln" kein Reis).
   Einzelwort-Muster treffen tokenweise: exakt, Wortanfang, Kompositum-Ende mit
   mindestens 3 Zeichen Vorbau ("basmatireis" zählt für "reis", "preis" nicht)
   oder – ab 5 Zeichen Musterlänge – enthalten ("speisezwiebeln" für "zwiebel").
   Muster mit Leerzeichen werden als Phrase gesucht. */
function passtAngebot(angebot, profil) {
  const text = normText([angebot.produkt, angebot.marke].filter(Boolean).join(" "));
  if (!text) return false;
  if ((profil.nicht || []).some((n) => text.includes(n))) return false;
  const tokens = text.split(" ");

  for (const roh of profil.muster || []) {
    const m = normText(roh);
    if (!m) continue;
    if (m.includes(" ")) {
      if (text.includes(m)) return true;
      continue;
    }
    for (const tok of tokens) {
      if (tok === m || tok.startsWith(m)) return true;
      if (tok.endsWith(m) && tok.length - m.length >= 3) return true;
      if (m.length >= 5 && tok.includes(m)) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------ Marktguru-Client */
function liveKonfiguriert(cfg) {
  return Boolean(cfg?.apikey && cfg?.clientkey && /^\d{5}$/.test(cfg?.plz || ""));
}

async function marktguruSuche(q, cfg) {
  const url = `${cfg.proxy || ""}${MARKTGURU_BASIS}/offers/search`
    + `?as=web&limit=${SUCH_LIMIT}&offset=0&q=${encodeURIComponent(q)}&zipCode=${encodeURIComponent(cfg.plz)}`;
  const res = await fetch(url, {
    headers: { "x-apikey": cfg.apikey, "x-clientkey": cfg.clientkey },
  });
  if (!res.ok) throw new Error(`Marktguru antwortet mit ${res.status}`);
  const data = await res.json();
  return (data.results || data.offers || []).map(normalisiereRohangebot).filter(Boolean);
}

/* Rohes API-Angebot defensiv in unser Schema bringen – die inoffizielle API
   kann Felder umbenennen, deshalb mehrere Pfade je Feld. */
function normalisiereRohangebot(o) {
  if (!o || typeof o !== "object") return null;
  const produkt = o.product?.name || o.name || "";
  if (!produkt) return null;
  const menge = o.quantity ?? o.amount ?? null;
  const einheit = o.unit?.shortName || o.unit?.name || "";
  return {
    produkt,
    marke: o.brand?.name || "",
    beschreibung: o.description || "",
    preis: zahl(o.price),
    altpreis: zahl(o.oldPrice ?? o.regularPrice),
    mengeText: menge != null ? `${menge} ${einheit}`.trim() : einheit || "",
    markt: o.advertisers?.[0]?.name || o.advertiser?.name || "",
    gueltigBis: o.validityDates?.[0]?.to || o.validTo || null,
  };
}

function zahl(v) {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return Number.isFinite(n) ? n : null;
}

/* Demo-Quelle: liefert immer den ganzen Beispieldatensatz, das Matching
   filtert danach – gleicher Pfad wie live. */
async function demoSuche() {
  return DEMO_ANGEBOTE;
}

/* ------------------------------------------------------ Auswertung */
function marktName(roh) {
  const s = String(roh || "").trim();
  if (!s) return "Unbekannter Markt";
  return s.split(/\s+/).map((w) => (w.length > 3 || /^[a-zäöü]/i.test(w) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
}

function angebotGueltig(a, heute = new Date()) {
  if (!a.gueltigBis) return true;
  const bis = new Date(a.gueltigBis);
  if (Number.isNaN(bis.getTime())) return true;
  // Bis-Datum zählt inklusive des Tages
  return bis.getTime() >= new Date(heute.toISOString().slice(0, 10)).getTime();
}

/* Angebote innerhalb eines Listenpunkts sortieren: größter Rabatt zuerst,
   dann günstigster Preis. */
function angebotSort(a, b) {
  const ra = rabattPct(a) ?? -1;
  const rb = rabattPct(b) ?? -1;
  if (rb !== ra) return rb - ra;
  return (a.preis ?? Infinity) - (b.preis ?? Infinity);
}

function rabattPct(a) {
  if (a.preis == null || a.altpreis == null || a.altpreis <= a.preis) return null;
  return Math.round(((a.altpreis - a.preis) / a.altpreis) * 100);
}

/* Markt-Ranking: Abdeckung (wie viele Listenpunkte hat der Markt im Angebot?)
   vor Konditionen (mittlerer Rabatt) vor Angebotszahl. */
function marktAuswertung(items) {
  const maerkte = new Map();
  for (const item of items) {
    for (const a of item.angebote) {
      const key = a.markt;
      let m = maerkte.get(key);
      if (!m) { m = { name: key, gedeckt: new Map(), angebote: 0, rabatte: [] }; maerkte.set(key, m); }
      m.angebote++;
      const r = rabattPct(a);
      if (r != null) m.rabatte.push(r);
      const bisher = m.gedeckt.get(item.zutat_id);
      if (!bisher || angebotSort(a, bisher.angebot) < 0) m.gedeckt.set(item.zutat_id, { name: item.name, angebot: a });
    }
  }
  return [...maerkte.values()]
    .map((m) => ({
      name: m.name,
      deckung: m.gedeckt.size,
      angebote: m.angebote,
      ersparnisPct: m.rabatte.length ? Math.round(m.rabatte.reduce((s, r) => s + r, 0) / m.rabatte.length) : null,
      positionen: [...m.gedeckt.entries()].map(([zutat_id, e]) => ({ zutat_id, name: e.name, angebot: e.angebot })),
    }))
    .sort((a, b) => b.deckung - a.deckung || (b.ersparnisPct ?? 0) - (a.ersparnisPct ?? 0) || b.angebote - a.angebote);
}

/* ------------------------------------------------------ Crawl */
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* Ein Lauf: je Listenpunkt eine Suche, Matching, dann Markt-Ranking.
   liste: [{ zutat_id, name }] · cfg: { plz, apikey, clientkey, proxy, demo } */
async function angebotsCrawl(liste, cfg = {}, opts = {}) {
  const live = liveKonfiguriert(cfg) && !cfg.demo;
  const quelle = opts.quelle || (live ? "marktguru" : "demo");
  const suche = quelle === "marktguru" ? (q) => marktguruSuche(q, cfg) : demoSuche;

  const items = [];
  const fehler = [];
  let i = 0;
  for (const punkt of liste) {
    i++;
    opts.onProgress?.(i, liste.length, punkt.name);
    const profil = suchprofil(punkt.zutat_id, punkt.name);
    let roh = [];
    try {
      roh = await suche(profil.q);
    } catch (e) {
      fehler.push(`${punkt.name}: ${e.message || e}`);
    }
    const angebote = roh
      .filter((a) => angebotGueltig(a))
      .filter((a) => passtAngebot(a, profil))
      .map((a) => ({ ...a, markt: marktName(a.markt) }))
      .sort(angebotSort);
    items.push({ zutat_id: punkt.zutat_id, name: punkt.name, angebote });
    if (quelle === "marktguru" && i < liste.length) await pause(PAUSE_MS);
  }

  const maerkte = marktAuswertung(items);
  return {
    datum: new Date().toISOString(),
    kw: isoWoche(new Date()),
    plz: cfg.plz || null,
    quelle,
    listeGroesse: liste.length,
    items,
    maerkte,
    empfehlung: maerkte.slice(0, MAX_MAERKTE),
    ohneAngebot: items.filter((it) => it.angebote.length === 0).map((it) => it.name),
    fehler,
  };
}

/* ISO-Kalenderwoche ("2026-W31") – der Crawl gilt eine Woche (Kap. 4.7:
   einmal wöchentlich, z. B. freitags). */
function isoWoche(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const anfang = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const woche = Math.ceil(((t - anfang) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(woche).padStart(2, "0")}`;
}

export {
  angebotsCrawl, isoWoche, liveKonfiguriert, suchprofil, passtAngebot,
  normText, rabattPct, marktAuswertung, marktName, angebotGueltig, SUCHPROFILE,
};

#!/usr/bin/env node
/* Ist dieser Branch noch aktuell genug für einen Pull Request?

   An diesem Repo arbeiten mehrere Prozesse parallel: Während ein Branch
   reift, wandern andere PRs nach main. Wer dann eine PR aufmacht (oder sie
   für fertig erklärt), stellt womöglich einen Stand aus, der sich nicht mehr
   mergen lässt – gemerkt wird das erst beim Klick auf „Merge".

   Dieses Skript nimmt die Antwort vorweg. Es prüft drei Dinge:
     1. Ist alles committet? (sonst zeigt die PR weniger, als lokal fertig ist)
     2. Ist alles gepusht?   (sonst zeigt die PR einen älteren Head)
     3. Hat main Commits, die dieser Branch nicht hat – und mergen die sauber?

   Exit-Code 0 = kann raus. 1 = vorher nachziehen (die Ausgabe sagt, wie).
   Ohne Netz oder außerhalb eines Repos: Exit 2, damit ein „geht nicht" nicht
   als „alles gut" durchgeht.

   Aufruf:  node tools/pr-aktuell.mjs [--basis main] [--remote origin]  */

import { execFileSync } from "node:child_process";

const arg = (name, standard) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : standard;
};
const BASIS = arg("basis", "main");
const REMOTE = arg("remote", "origin");

/* stderr wird eingefangen statt durchgereicht – sonst landen erwartete
   git-Meldungen ("Needed a single revision") mitten im Bericht. */
const roh = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const git = (...args) => roh(...args).trim();
const gitStill = (...args) => {
  try { return { ok: true, out: roh(...args).trim(), err: "" }; }
  catch (e) { return { ok: false, out: (e.stdout || "").trim(), err: (e.stderr || "").trim() }; }
};

const rot = (t) => `\x1b[31m${t}\x1b[0m`;
const gruen = (t) => `\x1b[32m${t}\x1b[0m`;
const gelb = (t) => `\x1b[33m${t}\x1b[0m`;

let probleme = 0;
const melde = (zeile) => { console.log("  " + rot("✗") + " " + zeile); probleme++; };
const ok = (zeile) => console.log("  " + gruen("ok") + "  " + zeile);

if (!gitStill("rev-parse", "--git-dir").ok) {
  console.error("Kein Git-Repository – hier gibt es nichts zu prüfen.");
  process.exit(2);
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch === BASIS) {
  console.error(`Aktueller Branch ist ${BASIS} selbst – für eine PR erst einen Feature-Branch anlegen.`);
  process.exit(2);
}
console.log(`\nBranch ${gelb(branch)} gegen ${gelb(`${REMOTE}/${BASIS}`)}\n`);

/* 1. Arbeitsbaum sauber? -------------------------------------------------- */
const offen = git("status", "--porcelain").split("\n").filter(Boolean);
if (offen.length) {
  melde(`${offen.length} nicht committete Änderung(en) – die PR würde sie nicht enthalten:`);
  offen.slice(0, 10).forEach((z) => console.log("       " + z));
  if (offen.length > 10) console.log(`       … und ${offen.length - 10} weitere`);
} else {
  ok("Arbeitsbaum sauber");
}

/* 2. Basis frisch holen --------------------------------------------------- */
const fetch = gitStill("fetch", "--quiet", REMOTE, BASIS);
if (!fetch.ok) {
  console.error(`\nKonnte ${REMOTE}/${BASIS} nicht holen – ohne frische Basis ist die Prüfung wertlos:`);
  console.error(fetch.out);
  process.exit(2);
}
const basisRef = `${REMOTE}/${BASIS}`;

/* 3. Alles gepusht? ------------------------------------------------------- */
const remoteBranch = `${REMOTE}/${branch}`;
if (gitStill("rev-parse", "--verify", remoteBranch).ok) {
  gitStill("fetch", "--quiet", REMOTE, branch);
  const nichtGepusht = git("rev-list", "--count", `${remoteBranch}..HEAD`);
  if (nichtGepusht !== "0") {
    melde(`${nichtGepusht} Commit(s) noch nicht gepusht – die PR zeigt einen älteren Stand.`);
    console.log(`       → git push -u ${REMOTE} ${branch}`);
  } else {
    ok("alles gepusht");
  }
} else {
  melde(`Branch existiert auf ${REMOTE} noch nicht.`);
  console.log(`       → git push -u ${REMOTE} ${branch}`);
}

/* 4. Basis-Commits, die hier fehlen --------------------------------------- */
const fehlend = git("log", "--oneline", `HEAD..${basisRef}`).split("\n").filter(Boolean);
if (fehlend.length) {
  melde(`${basisRef} hat ${fehlend.length} Commit(s), die dieser Branch nicht kennt:`);
  fehlend.slice(0, 10).forEach((z) => console.log("       " + z));
  if (fehlend.length > 10) console.log(`       … und ${fehlend.length - 10} weitere`);
  console.log(`       → git merge ${basisRef}`);
} else {
  ok(`enthält ${basisRef} vollständig`);
}

/* 5. Würde der Merge sauber laufen? --------------------------------------- */
/* git merge-tree --write-tree rechnet den Merge durch, ohne den Arbeitsbaum
   anzufassen: Exit ungleich 0 heißt Konflikt, die Ausgabe nennt die Dateien. */
const probe = gitStill("merge-tree", "--write-tree", "--name-only", "HEAD", basisRef);
if (probe.ok) {
  ok("Merge liefe konfliktfrei");
} else {
  /* Ausgabe von --write-tree --name-only: Zeile 1 ist die Tree-OID, danach die
     Konfliktdateien, dann eine Leerzeile und die Fließtext-Meldungen. Nur der
     erste Abschnitt interessiert. */
  const [kopf = ""] = probe.out.split(/\n\s*\n/);
  const dateien = kopf.split("\n").slice(1).map((z) => z.trim()).filter(Boolean);
  melde(`Merge-Konflikt in ${dateien.length} Datei(en) – muss von Hand aufgelöst werden:`);
  dateien.slice(0, 15).forEach((z) => console.log("       " + z));
  if (dateien.length > 15) console.log(`       … und ${dateien.length - 15} weitere`);
  console.log(`       → git merge ${basisRef}   (danach die Konflikte auflösen)`);
}

/* Fazit ------------------------------------------------------------------- */
if (probleme) {
  console.log(`\n${rot("Noch nicht ausstellbar")} – ${probleme} Punkt(e) offen. Nach dem Nachziehen:`);
  console.log("  node tools/validate-db.mjs && node tools/pr-aktuell.mjs\n");
  process.exit(1);
}
console.log(`\n${gruen("Aktuell")} – der Branch enthält ${basisRef} und lässt sich sauber mergen.\n`);

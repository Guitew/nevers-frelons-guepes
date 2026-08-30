#!/usr/bin/env node
/**
 * État de l'annuaire en une commande — le pendant console du tableau de bord.
 * Utile en local, et lisible dans les journaux d'une exécution planifiée.
 */

import config from "./lib/config.mjs";
import { lireFiches, urlFiche, ETATS } from "./lib/fiches.mjs";
import { categorieParSlug } from "./lib/categories.mjs";
import { lireJournal } from "./lib/journal.mjs";
import { dateLisible, joursDepuis } from "./lib/texte.mjs";

const fiches = lireFiches();
const publiees = fiches.filter((f) => f.statut === ETATS.PUBLIEE);
const retirees = fiches.filter((f) => f.statut === ETATS.RETIREE);
const archivees = fiches.filter((f) => f.statut === ETATS.ARCHIVEE);

const parEtat = {};
for (const f of publiees) {
  const e = f.backlink?.etat || "en-attente";
  parEtat[e] = (parEtat[e] || 0) + 1;
}

const parCategorie = {};
for (const f of publiees) parCategorie[f.categorie] = (parCategorie[f.categorie] || 0) + 1;

console.log(`\n  ANNUAIRE — ${fiches.length} fiche(s)\n  ${"─".repeat(46)}`);
console.log(`  Publiées ............ ${publiees.length}`);
console.log(`  Retirées ............ ${retirees.length}`);
for (const [mode, n] of Object.entries(
  retirees.reduce((a, f) => ({ ...a, [f.retrait?.mode || "?"]: (a[f.retrait?.mode || "?"] || 0) + 1 }), {})
)) {
  console.log(`     dont ${mode} ........ ${n}`);
}

console.log(`  Archivées ........... ${archivees.length}  (règle purgée, 404 naturel)`);

console.log(`\n  BACKLINKS GMB`);
for (const [etat, n] of Object.entries(parEtat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${etat.padEnd(20, ".")} ${n}`);
}

const menacees = publiees
  .filter((f) => ["absent", "externe", "introuvable"].includes(f.backlink?.etat))
  .filter((f) => (f.backlink?.echecs || 0) < config.backlinks.echecsAvantRetrait);
if (menacees.length) {
  console.log(`\n  À SURVEILLER (${menacees.length}) — un échec de plus déclenche le retrait`);
  for (const f of menacees.slice(0, 15)) {
    console.log(`  · ${urlFiche(f)} (${f.backlink.etat}, ${f.backlink.echecs} échec(s))`);
  }
}

const attente = publiees.filter((f) => !f.backlink?.premiere_detection);
if (attente.length) {
  const bientot = attente.filter(
    (f) => (joursDepuis(f.dates?.publication) || 0) >= config.backlinks.delaiDeGraceJours - 7
  );
  console.log(
    `\n  EN ATTENTE DE BACKLINK : ${attente.length}` +
      (bientot.length ? ` (dont ${bientot.length} en fin de délai de grâce)` : "")
  );
}

const suggAttente = publiees.filter((f) => f.suggestion?.etat === "en-attente" && !f.exemple);
const suggSoumises = publiees.filter((f) => f.suggestion?.etat === "soumise");
if (suggAttente.length || suggSoumises.length) {
  console.log(`\n  SUGGESTIONS GMB`);
  console.log(`  En attente .......... ${suggAttente.length}`);
  console.log(`  Soumises ............ ${suggSoumises.length}`);
}

console.log(`\n  TOP CATÉGORIES`);
for (const [slug, n] of Object.entries(parCategorie).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${(categorieParSlug(slug)?.nom || slug).padEnd(34, ".")} ${n}`);
}

const journal = lireJournal().slice(0, 8);
if (journal.length) {
  console.log(`\n  DERNIERS ÉVÉNEMENTS`);
  for (const e of journal) {
    console.log(`  ${dateLisible(e.date.slice(0, 10))} — ${e.type} ${e.nom ? `— ${e.nom}` : ""}`);
  }
}
console.log("");

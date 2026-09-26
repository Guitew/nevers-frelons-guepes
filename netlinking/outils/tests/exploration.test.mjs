/** Frontière d'exploration : priorités, plafonds par hôte, alternance, blocages. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ajouterFrontiere, creerExploration, dejaVue, ecrireExploration, elaguer, hoteBloque, lireExploration, marquerVue, prioriteLien, prochaine } from "../lib/exploration.mjs";

const config = { exploration: { pagesParHote: 3, revisiteJours: 90, frontiereMax: 5 } };

test("les URLs qui ressemblent à des spots passent devant", () => {
  const p = (url, origine = "lien-interne") => prioriteLien({ url, origine, hote: "site.fr", etat: creerExploration(), config });
  assert.ok(p("https://site.fr/livre-d-or/") > p("https://site.fr/blog/article/"));
  assert.ok(p("https://site.fr/annuaire/ajouter-un-site/") > p("https://site.fr/annuaire/"));
  assert.ok(p("https://site.fr/forum/viewtopic.php?t=1") > p("https://site.fr/a-propos/"));
  assert.ok(p("https://site.fr/wp-login.php") < p("https://site.fr/a-propos/"));
  assert.ok(p("https://site.fr/x", "graine") > p("https://site.fr/x", "requete"));
  assert.ok(p("https://site.fr/x", "requete") > p("https://site.fr/x", "lien-externe"));
  assert.ok(p("https://site.fr/x", "lien-externe") > p("https://site.fr/x", "lien-interne"));
});

test("dédoublonnage, binaires, plafond par hôte, alternance des hôtes", () => {
  const etat = creerExploration();
  assert.ok(ajouterFrontiere(etat, { url: "https://a.fr/1", origine: "graine" }, config));
  assert.ok(!ajouterFrontiere(etat, { url: "https://a.fr/1#x", origine: "graine" }, config), "doublon");
  assert.ok(!ajouterFrontiere(etat, { url: "https://a.fr/doc.pdf", origine: "graine" }, config), "binaire");
  assert.ok(ajouterFrontiere(etat, { url: "https://a.fr/2", origine: "lien-interne" }, config));
  assert.ok(ajouterFrontiere(etat, { url: "https://b.fr/1", origine: "lien-interne" }, config));
  const premiere = prochaine(etat, { config });
  assert.equal(premiere.url, "https://a.fr/1");
  const deuxieme = prochaine(etat, { hotesOccupes: new Set(["a.fr"]), config });
  assert.equal(deuxieme.url, "https://b.fr/1", "l'hôte occupé est évité");
  marquerVue(etat, "https://a.fr/1", { statut: 200 });
  marquerVue(etat, "https://a.fr/3", { statut: 200 });
  marquerVue(etat, "https://a.fr/4", { statut: 200 });
  assert.equal(etat.hotes["a.fr"].pages, 3);
  assert.ok(!ajouterFrontiere(etat, { url: "https://a.fr/5", origine: "lien-interne" }, config), "hôte saturé");
  assert.ok(ajouterFrontiere(etat, { url: "https://a.fr/6", origine: "utile" }, config), "les liens utiles passent malgré le plafond");
  assert.equal(prochaine(etat, { config }).url, "https://a.fr/6");
  assert.equal(prochaine(etat, { config }), null, "a.fr/2 est purgée : hôte saturé");
  assert.ok(dejaVue(etat, "https://a.fr/1", config));
  assert.ok(!dejaVue(etat, "https://a.fr/99", config));
});

test("un hôte bloqué le reste pendant revisiteJours seulement", () => {
  const etat = creerExploration();
  marquerVue(etat, "https://mort.fr/", { statut: 0, bloque: true });
  assert.ok(hoteBloque(etat.hotes["mort.fr"], config));
  etat.hotes["mort.fr"].bloqueLe = "2020-01-01";
  assert.ok(!hoteBloque(etat.hotes["mort.fr"], config));
});

test("élagage et persistance", () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "netlinking-exploration-"));
  const chemin = path.join(dossier, "exploration.json");
  const etat = creerExploration();
  for (let i = 0; i < 10; i++) ajouterFrontiere(etat, { url: `https://h${i}.fr/`, origine: "lien-interne", priorite: i }, config);
  etat.vues["https://vieux.fr/"] = { date: "2019-01-01", statut: 200 };
  elaguer(etat, config);
  assert.equal(etat.frontiere.length, 5);
  assert.deepEqual(etat.frontiere.map((e) => e.priorite).sort((a, b) => b - a), [9, 8, 7, 6, 5]);
  assert.ok(!etat.vues["https://vieux.fr/"]);
  ecrireExploration(chemin, etat);
  const relu = lireExploration(chemin);
  assert.equal(relu.frontiere.length, 5);
  assert.equal(relu.frontiere[0].priorite, 9, "écrit trié par priorité");
  assert.ok(!("_index" in JSON.parse(fs.readFileSync(chemin, "utf8"))), "l'index mémoire n'est pas sérialisé");
  fs.rmSync(dossier, { recursive: true, force: true });
});

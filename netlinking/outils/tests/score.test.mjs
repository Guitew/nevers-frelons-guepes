/** Notation et choix de la cible (niveau 1 site / niveau 2 relais). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { completerConfig } from "../lib/config.mjs";
import { CONFIG_JSON } from "../lib/chemins.mjs";
import { qualifierPage } from "../lib/qualification.mjs";
import { analyserRobots } from "../lib/robots.mjs";
import { choisirCible } from "../lib/score.mjs";
import * as F from "./fixtures/site.mjs";

const config = completerConfig(JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8")));
config.concurrents.domaines = ["desinsectisation-nord.fr"];
const cibles = JSON.parse(fs.readFileSync(new URL("../../donnees/cibles.json", import.meta.url), "utf8"));
const robots = analyserRobots(F.ROBOTS);

const qualifier = (html, url, extra = {}) => qualifierPage({ url, corps: html.replace(/https:\/\/SITE/g, "https://site.fr"), robots, config, cibles, ...extra });

test("ordre des priorités : liste > mention > forum dofollow > commentaire nofollow > page noindex", () => {
  const liste = qualifier(F.LISTE_PROS, "https://site.fr/liste-professionnels/").spot;
  const mention = qualifier(F.MENTION, "https://site.fr/mention/").spot;
  const forum = qualifier(F.FORUM, "https://site.fr/forum/viewtopic.php?t=12").spot;
  const commentaire = qualifier(F.ARTICLE, "https://site.fr/blog/nid-de-frelons/").spot;
  const noindex = qualifier(F.NOINDEX, "https://site.fr/noindex/").spot;
  assert.ok(liste.scores.priorite > mention.scores.priorite, "liste > mention");
  assert.ok(mention.scores.priorite >= forum.scores.priorite - 5, "mention ≈ forum");
  assert.ok(forum.scores.priorite > commentaire.scores.priorite, "forum dofollow > commentaire nofollow");
  assert.ok(commentaire.scores.priorite > noindex.scores.priorite + 20, "commentaire indexable ≫ noindex");
  assert.equal(noindex.indexabilite.indexable, false);
  assert.ok(noindex.indexabilite.motifs[0].includes("noindex"));
  assert.ok(liste.scores.seo >= 85 && liste.scores.seo <= 100);
  assert.ok(commentaire.scores.seo >= 35 && commentaire.scores.seo <= 60, `commentaire seo=${commentaire.scores.seo}`);
});

test("les robots IA bloqués font chuter le score IA", () => {
  const ouvert = qualifier(F.FORUM, "https://site.fr/forum/", { robots: analyserRobots("") }).spot;
  const ferme = qualifier(F.FORUM, "https://site.fr/forum/", { robots: analyserRobots("User-agent: GPTBot\nUser-agent: ClaudeBot\nUser-agent: PerplexityBot\nUser-agent: OAI-SearchBot\nUser-agent: Google-Extended\nDisallow: /") }).spot;
  assert.ok(ouvert.scores.ia > ferme.scores.ia + 25, `${ouvert.scores.ia} vs ${ferme.scores.ia}`);
  assert.equal(ferme.ia.autorises.length, 0);
  assert.equal(ouvert.ia.taux, 100);
});

test("Googlebot exclu par robots.txt → non indexable", () => {
  const r = analyserRobots("User-agent: Googlebot\nDisallow: /blog/");
  const s = qualifier(F.ARTICLE, "https://site.fr/blog/nid-de-frelons/", { robots: r }).spot;
  assert.equal(s.indexabilite.indexable, false);
  assert.ok(s.indexabilite.motifs.includes("Googlebot exclu par robots.txt"));
  assert.equal(s.indexabilite.bingbot, true);
});

test("cible : spots éditoriaux → site (niveau 1, page thématique), spots de masse → relais (niveau 2)", () => {
  const liste = qualifier(F.LISTE_PROS, "https://site.fr/liste-professionnels/").spot;
  assert.equal(liste.cible.niveau, 1);
  assert.equal(liste.cible.url, "https://allo-frelons.fr/entreprise-anti-nuisibles-nord-59");
  assert.ok(liste.cible.ancres.includes("ALLO FRELONS"));
  const commentaire = qualifier(F.ARTICLE, "https://site.fr/blog/nid-de-frelons/").spot;
  assert.equal(commentaire.cible.niveau, 2);
  assert.ok(commentaire.cible.url.startsWith("https://observatoire-biodiversite-npdc.fr/"));
  const mention = qualifier(F.MENTION, "https://site.fr/mention/").spot;
  assert.equal(mention.cible.niveau, 1);
});

test("cible : sans relais connu, un spot de masse retombe sur le site avec une ancre de marque", () => {
  const sansRelais = { pages: cibles.pages, relais: [] };
  const commentaire = qualifierPage({ url: "https://site.fr/blog/nid-de-frelons/", corps: F.ARTICLE.replace(/https:\/\/SITE/g, "https://site.fr"), robots, config, cibles: sansRelais }).spot;
  assert.equal(commentaire.cible.niveau, 1);
  assert.ok(commentaire.cible.motif.includes("aucune page relais"));
  assert.equal(commentaire.cible.ancres[0], "ALLO FRELONS");
});

test("cible : un relais sur le même domaine que le spot n'est jamais proposé", () => {
  const spot = { url: "https://observatoire-biodiversite-npdc.fr/x", domaine: "observatoire-biodiversite-npdc.fr", type: "commentaire", scores: { seo: 40 }, liens: { commentaires: "nofollow" }, indexabilite: { indexable: true }, themes: [] };
  const c = choisirCible({ spot, page: { titre: "x", h1: "" }, cibles, config });
  assert.equal(c.niveau, 1);
});

test("une URL mal encodée (%E9) ne fait pas échouer la qualification", () => {
  const r = qualifier(F.ARTICLE, "https://site.fr/blog/nid-de-frelons/%E9t%E9/");
  assert.equal(r.spot.type, "commentaire");
});

test("un spot déjà lié au site (relais) n'est pas un spot", () => {
  const r = qualifier(F.RELAIS, "https://site.fr/relais/");
  assert.equal(r.spot, null);
  assert.ok(r.relais);
});

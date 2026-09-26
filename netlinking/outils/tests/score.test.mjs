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
// Cibles figées : le fichier donnees/cibles.json évolue à chaque cycle hebdomadaire.
const cibles = {
  principal: "https://allo-frelons.fr/",
  pages: [
    { url: "https://allo-frelons.fr/", titre: "ALLO FRELONS", motsCles: ["allo", "frelons"], principale: true },
    { url: "https://allo-frelons.fr/frelon-asiatique", titre: "Frelon asiatique", motsCles: ["frelon", "asiatique"] },
    { url: "https://allo-frelons.fr/guepes", titre: "Les guêpes", motsCles: ["guepes"] },
    { url: "https://allo-frelons.fr/entreprise-anti-nuisibles-nord-59", titre: "Entreprise anti-nuisibles dans le Nord (59)", motsCles: ["entreprise", "anti", "nuisibles", "nord", "dep59"] },
    { url: "https://allo-frelons.fr/nids-de-guepes-et-frelons-dans-le-pas-de-calais-62", titre: "Nids de guêpes et frelons dans le Pas-de-Calais (62)", motsCles: ["nids", "guepes", "frelons", "calais", "dep62"] },
    { url: "https://allo-frelons.fr/entreprise-frelons-guepes-frelon-asiatique-pyrenees-atlantiques-64", titre: "", motsCles: ["entreprise", "frelons", "guepes", "frelon", "asiatique", "pyrenees", "atlantiques", "dep64"] },
  ],
  relais: [
    { url: "https://observatoire-biodiversite-npdc.fr/especes/frelon-asiatique/", domaine: "observatoire-biodiversite-npdc.fr", titre: "Frelon asiatique (Vespa velutina) — Observatoire de la biodiversité", motsCles: ["especes", "frelon", "asiatique", "vespa", "velutina"], etat: "present" },
    { url: "https://observatoire-biodiversite-npdc.fr/dossiers/que-faire-nid-frelon-asiatique-signalement/", domaine: "observatoire-biodiversite-npdc.fr", titre: "Que faire face à un nid de frelon asiatique : signalement et intervention", motsCles: ["dossiers", "faire", "nid", "frelon", "asiatique", "signalement"], etat: "present" },
  ],
};
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

test("cible localisée : un spot sur le Var (83) vise la page locale du site, pas la page la plus bavarde", () => {
  const ciblesLocales = {
    pages: [
      ...cibles.pages,
      { url: "https://allo-frelons.fr/entreprise-frelons-guepes-frelon-asiatique-var-83", titre: "", motsCles: ["entreprise", "frelons", "guepes", "frelon", "asiatique", "var", "dep83"] },
      { url: "https://allo-frelons.fr/vespai-detection-precoce-frelon-asiatique-vespa-velutina-intelligence-artificielle", titre: "", motsCles: ["vespai", "detection", "precoce", "frelon", "asiatique", "vespa", "velutina", "intelligence", "artificielle"] },
    ],
    relais: [],
  };
  const spot = { url: "https://frelons-asiatiques.fr/societe/83-Var", domaine: "frelons-asiatiques.fr", type: "liste-prestataires", scores: { seo: 90 }, liens: { contenu: "dofollow" }, indexabilite: { indexable: true }, themes: ["frelon"], zonesTrouvees: ["Var"] };
  const c = choisirCible({ spot, page: { titre: "Var (83) - Sociétés de destruction de nids de frelons asiatiques", h1: "" }, cibles: ciblesLocales, config });
  assert.equal(c.url, "https://allo-frelons.fr/entreprise-frelons-guepes-frelon-asiatique-var-83");
  // Sans lieu reconnu, la page pilier du thème l'emporte sur les pages locales.
  const generique = choisirCible({ spot: { ...spot, url: "https://blog.fr/reconnaitre-le-frelon-asiatique/", zonesTrouvees: [] }, page: { titre: "Reconnaître le frelon asiatique", h1: "" }, cibles: ciblesLocales, config });
  assert.equal(generique.url, "https://allo-frelons.fr/frelon-asiatique");
  // Un mot ordinaire seul (« ville ») ne suffit pas : repli sur la page pilier du thème cité.
  const faible = choisirCible({ spot: { ...spot, url: "https://ville.be/frelons/", zonesTrouvees: [] }, page: { titre: "Frelons asiatiques | Ville de Bruxelles", h1: "" }, cibles: ciblesLocales, config });
  assert.equal(faible.url, "https://allo-frelons.fr/frelon-asiatique");
  // Sans mot de thème ni lieu : page d'accueil.
  const rien = choisirCible({ spot: { ...spot, url: "https://site.fr/partenaires/", zonesTrouvees: [] }, page: { titre: "Site Partenaires", h1: "" }, cibles: ciblesLocales, config });
  assert.equal(rien.url, "https://allo-frelons.fr/");
});

test("pas de spot sur le site d'un concurrent", () => {
  const html = F.ARTICLE.replace(/https:\/\/SITE/g, "https://www.desinsectisation-nord.fr");
  const r = qualifierPage({ url: "https://www.desinsectisation-nord.fr/blog/nid-de-frelons/", corps: html, robots, config, cibles });
  assert.equal(r.detection.type, "commentaire");
  assert.equal(r.spot, null);
});

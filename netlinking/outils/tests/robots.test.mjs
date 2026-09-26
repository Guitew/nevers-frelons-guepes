/** robots.txt : politesse de notre robot et qualification des accès moteurs / IA. */
import test from "node:test";
import assert from "node:assert/strict";
import { AGENTS_IA, analyserRobots, autorisations, delaiExploration, estAutorise, groupePour, motifCorrespond, ROBOTS_VIDE } from "../lib/robots.mjs";

const TEXTE = `
# commentaire
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /prive
Disallow: /*.pdf$
Disallow: /recherche?

User-agent: GPTBot
User-agent: ClaudeBot
Disallow: /

User-agent: Googlebot
Disallow:
Crawl-delay: 2

user-agent: AlloFrelonsBot
disallow: /interdit/
crawl-delay: 1,5

Sitemap: https://site.fr/sitemap.xml
`;

test("analyse : groupes, agents multiples, sitemaps", () => {
  const r = analyserRobots(TEXTE);
  assert.equal(r.groupes.length, 4);
  assert.deepEqual(r.groupes[1].agents, ["gptbot", "claudebot"]);
  assert.deepEqual(r.sitemaps, ["https://site.fr/sitemap.xml"]);
  assert.equal(r.groupes[3].delai, 1.5);
});

test("groupe le plus spécifique, insensible à la casse, repli sur *", () => {
  const r = analyserRobots(TEXTE);
  assert.deepEqual(groupePour(r, "Mozilla/5.0 (compatible; ClaudeBot/1.0)").agents, ["gptbot", "claudebot"]);
  assert.deepEqual(groupePour(r, "bingbot").agents, ["*"]);
  assert.deepEqual(groupePour(r, "Googlebot-Image").agents, ["googlebot"]);
  assert.equal(groupePour(ROBOTS_VIDE, "x"), null);
});

test("règle la plus longue gagnante, Allow prioritaire à égalité, jokers et ancres", () => {
  const r = analyserRobots(TEXTE);
  assert.equal(estAutorise(r, "bingbot", "/wp-admin/post.php"), false);
  assert.equal(estAutorise(r, "bingbot", "/wp-admin/admin-ajax.php"), true);
  assert.equal(estAutorise(r, "bingbot", "/prive-jardin"), false); // préfixe
  assert.equal(estAutorise(r, "bingbot", "/doc/fiche.pdf"), false);
  assert.equal(estAutorise(r, "bingbot", "/doc/fiche.pdf?x=1"), true); // l'ancre $ exige la fin
  assert.equal(estAutorise(r, "bingbot", "/recherche?q=frelon"), false);
  assert.equal(estAutorise(r, "bingbot", "/blog/frelons/"), true);
  assert.equal(estAutorise(r, "GPTBot", "/blog/"), false);
  assert.equal(estAutorise(r, "Googlebot", "/wp-admin/"), true); // Disallow vide = tout permis
  assert.equal(estAutorise(r, "AlloFrelonsBot", "/interdit/x"), false);
  assert.equal(estAutorise(r, "AlloFrelonsBot", "/wp-admin/"), true); // son groupe propre, pas celui de *
  assert.equal(estAutorise(ROBOTS_VIDE, "n'importe", "/x"), true);
  assert.ok(motifCorrespond("/a*b$", "/axxb"));
  assert.ok(!motifCorrespond("/a*b$", "/axxbc"));
  assert.ok(motifCorrespond("/a(b)", "/a(b)/c"));
});

test("crawl-delay et autorisations par agent", () => {
  const r = analyserRobots(TEXTE);
  assert.equal(delaiExploration(r, "Googlebot"), 2);
  assert.equal(delaiExploration(r, "bingbot"), null);
  const acces = autorisations(r, "/page", AGENTS_IA);
  assert.equal(acces.GPTBot, false);
  assert.equal(acces.ClaudeBot, false);
  assert.equal(acces.PerplexityBot, true);
});

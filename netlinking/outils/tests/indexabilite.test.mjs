import test from "node:test";
import assert from "node:assert/strict";
import { analyserHtml } from "../lib/html.mjs";
import { evaluerIa, evaluerIndexabilite } from "../lib/indexabilite.mjs";
import { analyserRobots } from "../lib/robots.mjs";

test("indexabilité : statut, X-Robots-Tag, canonique", () => {
  const page = analyserHtml(`<html><head><link rel="canonical" href="https://site.fr/autre/"></head><body></body></html>`, "https://site.fr/page/");
  const r = evaluerIndexabilite({ url: "https://site.fr/page/", statut: 200, entetes: { "x-robots-tag": "noindex" }, page, robots: analyserRobots("") });
  assert.equal(r.indexable, false);
  assert.ok(r.motifs.includes("noindex (en-tête X-Robots-Tag)"));
  assert.ok(r.canoniqueDifferente);
  const ok = evaluerIndexabilite({ url: "https://site.fr/page/", statut: 200, page: analyserHtml(`<link rel="canonical" href="http://www.site.fr/page">`, "https://site.fr/page/"), robots: analyserRobots("") });
  assert.equal(ok.indexable, true, "www/http/barre finale ne font pas une canonique différente");
  const erreur = evaluerIndexabilite({ url: "https://site.fr/page/", statut: 404, page: analyserHtml("", ""), robots: analyserRobots("") });
  assert.deepEqual(erreur.motifs, ["statut HTTP 404"]);
});

test("accès IA : taux et robots principaux", () => {
  const r = evaluerIa(analyserRobots("User-agent: GPTBot\nDisallow: /\nUser-agent: CCBot\nDisallow: /"), "https://site.fr/x");
  assert.ok(r.bloques.includes("GPTBot") && r.bloques.includes("CCBot"));
  assert.ok(r.autorises.includes("ClaudeBot"));
  assert.deepEqual(r.principauxBloques, ["GPTBot"]);
  assert.ok(r.taux > 80 && r.taux < 100);
});

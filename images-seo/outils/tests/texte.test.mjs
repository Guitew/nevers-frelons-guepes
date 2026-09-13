import { test } from "node:test";
import assert from "node:assert/strict";
import { slugifier, tronquer, joursEntre, dateDuJour, moisDe, empreinte } from "../lib/texte.mjs";

test("slugifier : accents, apostrophes et espaces → nom de fichier propre", () => {
  assert.equal(slugifier("Nid de guêpes : toiture"), "nid-de-guepes-toiture");
  assert.equal(slugifier("Piqûre de frelon d'Asie"), "piqure-de-frelon-d-asie");
  assert.equal(slugifier("  Frelon   asiatique  "), "frelon-asiatique");
});

test("tronquer : coupe sur un mot et ajoute une ellipse", () => {
  const t = tronquer("un texte assez long pour être coupé quelque part", 20);
  assert.ok(t.length <= 20 && t.endsWith("…"));
  assert.equal(tronquer("court", 20), "court");
});

test("joursEntre : calendaire, indépendant de l'heure", () => {
  assert.equal(joursEntre("2026-07-01", "2026-07-08"), 7);
  assert.equal(joursEntre("2026-07-08T23:59:00Z", "2026-07-09T00:01:00Z"), 1);
});

test("dateDuJour et moisDe", () => {
  assert.match(dateDuJour(new Date("2026-03-05T12:00:00Z"), "Europe/Paris"), /^2026-03-05$/);
  assert.equal(moisDe("2026-11-02"), 11);
  assert.equal(empreinte("a"), empreinte("a"));
  assert.notEqual(empreinte("a"), empreinte("b"));
});

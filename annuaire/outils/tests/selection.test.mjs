/**
 * Sélection à la collecte : on ne publie que des pages que quelqu'un cherchera.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { motifHorsCible, categoriesACollecter } from "../lib/selection.mjs";
import { categories } from "../lib/categories.mjs";

const R = {
  categoriesExclues: ["transport-demenagement", "comptabilite-conseil"],
  typesExclus: ["storage", "moving_company", "corporate_office"],
  avisMinimum: 20,
  noteMinimale: 3.5,
};
const lieu = (extra) => ({ type_principal: "restaurant", types: ["restaurant", "food"], categorie_gmb: "Restaurant", note: 4.4, avis: 120, ...extra });

test("un restaurant bien noté et commenté est une cible", () => {
  assert.equal(motifHorsCible(lieu(), R), null);
});

test("les types Google exclus sont rejetés, même en type secondaire", () => {
  assert.match(motifHorsCible(lieu({ type_principal: "storage", types: ["storage"] }), R), /type Google exclu \(storage\)/);
  assert.match(motifHorsCible(lieu({ types: ["restaurant", "corporate_office"] }), R), /corporate_office/);
});

test("les rubriques exclues sont rejetées après classification", () => {
  const m = motifHorsCible(lieu({ type_principal: "taxi_service", types: ["taxi_service"], categorie_gmb: "Taxi" }), R);
  assert.match(m, /rubrique exclue \(transport-demenagement\)/);
  const c = motifHorsCible(lieu({ type_principal: "accounting", types: ["accounting"], categorie_gmb: "Comptable" }), R);
  assert.match(c, /comptabilite-conseil/);
});

test("note et nombre d'avis minimaux", () => {
  assert.match(motifHorsCible(lieu({ avis: 12 }), R), /12 avis < 20/);
  assert.match(motifHorsCible(lieu({ note: 3.1 }), R), /note 3.1 < 3.5/);
  assert.equal(motifHorsCible(lieu({ avis: 0, note: null }), {}), null, "sans réglage, pas de seuil");
});

test("categoriesACollecter retire les rubriques exclues et respecte une liste ciblée", () => {
  const toutes = categoriesACollecter(categories, R).map((c) => c.slug);
  assert.ok(!toutes.includes("transport-demenagement") && !toutes.includes("comptabilite-conseil"));
  assert.ok(toutes.includes("restaurants"));
  assert.equal(toutes.length, categories.length - 2);
  assert.deepEqual(categoriesACollecter(categories, { categoriesCiblees: ["restaurants", "transport-demenagement"], categoriesExclues: ["transport-demenagement"] }).map((c) => c.slug), ["restaurants"]);
});

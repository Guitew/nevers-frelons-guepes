/**
 * Exploration nationale : maillage par département et ordre de passage.
 * Sans cela, la collecte nationale interrogeait chaque jour le même point et
 * s'est tarie en dix jours (0 fiche du 12 au 18 septembre 2026).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  cleProgression,
  grilleDepartement,
  compterParDepartement,
  normaliserCode,
  ordonnerDepartements,
} from "../lib/national.mjs";
import { lotsDeTypes, planifier } from "../lib/maillage.mjs";

const DEPTS = [
  { code: "01", nom: "Ain", ville: "Bourg-en-Bresse", lat: 46.21, lng: 5.23 },
  { code: "48", nom: "Lozère", ville: "Mende", lat: 44.52, lng: 3.5 },
  { code: "58", nom: "Nièvre", ville: "Nevers", lat: 46.99, lng: 3.16 },
];

test("chaque département est découpé en cellules fines, du chef-lieu vers la périphérie", () => {
  const grille = grilleDepartement(DEPTS[1], { rayonNational: 15000, mailleNationaleMetres: 2500 });
  assert.ok(grille.length > 20, `trop peu de cellules : ${grille.length}`);
  assert.equal(grille[0].rayonMetres, 2500);
  assert.ok(Math.abs(grille[0].latitude - 44.52) < 0.01 && Math.abs(grille[0].longitude - 3.5) < 0.01);
  for (let i = 1; i < grille.length; i++) assert.ok(grille[i].distance >= grille[i - 1].distance);
});

test("le point interrogé change d'un passage à l'autre grâce au curseur", () => {
  const grille = grilleDepartement(DEPTS[1]);
  const lots = lotsDeTypes([{ gmb: ["bakery"] }]);
  const premier = planifier(grille, lots, { cellule: 0, lot: 0, tour: 0 }, 1);
  const second = planifier(grille, lots, premier.curseur, 1);
  assert.notDeepEqual(
    [premier.etapes[0].cellule.latitude, premier.etapes[0].cellule.longitude],
    [second.etapes[0].cellule.latitude, second.etapes[0].cellule.longitude]
  );
});

test("les codes de département se comparent sans zéro de tête ni casse", () => {
  assert.equal(normaliserCode("048"), "48");
  assert.equal(normaliserCode("48"), "48");
  assert.equal(normaliserCode("8"), "08");
  assert.equal(normaliserCode("2a"), "2A");
  assert.equal(normaliserCode(undefined), "");
});

test("la couverture ne compte que les fiches publiées", () => {
  const fiches = [
    { statut: "publiee", adresse: { departement: "48" } },
    { statut: "publiee", adresse: { departement: "048" } },
    { statut: "retiree", adresse: { departement: "48" } },
    { statut: "publiee", adresse: {} },
  ];
  assert.deepEqual(compterParDepartement(fiches), { 48: 2 });
});

test("les départements les moins couverts passent en premier", () => {
  const ordre = ordonnerDepartements(DEPTS, { 58: 27, 48: 2, "01": 2 });
  assert.deepEqual(ordre.map((d) => d.code), ["01", "48", "58"]);
});

test("à couverture égale, le moins récemment exploré passe en premier", () => {
  const progression = { [cleProgression(DEPTS[0])]: { cellule: 3, lot: 0, tour: 0, date: "2026-09-18" } };
  const ordre = ordonnerDepartements(DEPTS, { 58: 27, 48: 2, "01": 2 }, progression);
  assert.deepEqual(ordre.map((d) => d.code), ["48", "01", "58"]);
});

test("le curseur d'un département a une clé distincte des zones locales", () => {
  assert.equal(cleProgression(DEPTS[2]), "departement-58");
});

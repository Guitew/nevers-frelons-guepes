/**
 * Maillage d'exploration et curseur de progression.
 * C'est ce qui empêche la collecte de se tarir : sans maillage, l'API rendrait
 * chaque jour les 20 mêmes établissements les plus populaires de la zone.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { cellules, lotsDeTypes, planifier, TYPES_PAR_LOT } from "../lib/maillage.mjs";

const ZONE = { libelle: "Nevers", latitude: 46.9896, longitude: 3.1572, rayonMetres: 12000 };

test("toutes les cellules tiennent dans la zone", () => {
  const grille = cellules(ZONE, 800);
  assert.ok(grille.length > 100, `maillage trop grossier : ${grille.length} cellules`);
  for (const c of grille) {
    assert.ok(c.distance <= ZONE.rayonMetres, `cellule hors zone : ${c.distance} m`);
    assert.equal(c.rayonMetres, 800);
    assert.ok(Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }
});

test("les cellules sont rendues du centre vers la périphérie", () => {
  const grille = cellules(ZONE, 800);
  const distances = grille.map((c) => c.distance);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
  assert.equal(Math.round(distances[0]), 0);
});

test("une maille plus fine couvre la zone avec plus de cellules", () => {
  assert.ok(cellules(ZONE, 400).length > cellules(ZONE, 800).length);
  assert.ok(cellules(ZONE, 800).length > cellules(ZONE, 1600).length);
});

test("une zone plus petite que la maille garde au moins une cellule", () => {
  const grille = cellules({ ...ZONE, rayonMetres: 100 }, 800);
  assert.equal(grille.length, 1);
  assert.equal(grille[0].latitude, ZONE.latitude);
});

test("les cellules se recouvrent : pas d'angle mort entre voisines", () => {
  const grille = cellules(ZONE, 800);
  // La cellule la plus proche du centre doit être à moins de deux rayons,
  // sinon un établissement pourrait tomber entre deux disques.
  const centre = grille[0];
  const plusProche = Math.min(
    ...grille.slice(1).map((c) => Math.hypot(c.distance - centre.distance) || distanceEntre(centre, c))
  );
  assert.ok(plusProche < 1600, `cellules trop espacées : ${plusProche} m`);
});

function distanceEntre(a, b) {
  const dy = (a.latitude - b.latitude) * 111320;
  const dx = (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

test("les types sont dédoublonnés et découpés sous la limite de l'API", () => {
  const categories = [
    { gmb: ["bakery", "pastry_shop"] },
    { gmb: ["bakery", "restaurant"] }, // « bakery » partagé
  ];
  assert.deepEqual(lotsDeTypes(categories), [["bakery", "pastry_shop", "restaurant"]]);

  const nombreux = [{ gmb: Array.from({ length: 130 }, (_, i) => `type_${i}`) }];
  const lots = lotsDeTypes(nombreux);
  assert.equal(lots.length, 3);
  for (const lot of lots) assert.ok(lot.length <= TYPES_PAR_LOT);
  assert.equal(lots.flat().length, 130);
});

test("le curseur reprend exactement où il s'est arrêté", () => {
  const grille = cellules(ZONE, 800);
  const lots = [["a"], ["b"], ["c"]];

  const premier = planifier(grille, lots, {}, 5);
  assert.equal(premier.etapes.length, 5);
  assert.deepEqual(
    premier.etapes.map((e) => `${e.indexCellule}/${e.indexLot}`),
    ["0/0", "0/1", "0/2", "1/0", "1/1"]
  );

  const second = planifier(grille, lots, premier.curseur, 2);
  assert.deepEqual(second.etapes.map((e) => `${e.indexCellule}/${e.indexLot}`), ["1/2", "2/0"]);
});

test("chaque étape porte le curseur qui la suit, pour un arrêt anticipé", () => {
  const grille = cellules(ZONE, 800);
  const lots = [["a"], ["b"]];
  const { etapes } = planifier(grille, lots, {}, 4);
  // La collecte s'arrête après la deuxième étape : on reprend à la troisième.
  const reprise = planifier(grille, lots, etapes[1].suivant, 1);
  assert.equal(reprise.etapes[0].indexCellule, etapes[2].indexCellule);
  assert.equal(reprise.etapes[0].indexLot, etapes[2].indexLot);
});

test("la zone parcourue en entier repart du centre au tour suivant", () => {
  const grille = cellules({ ...ZONE, rayonMetres: 2500 }, 800); // zone réduite
  const lots = [["a"]];
  assert.ok(grille.length > 1, "la zone de test doit compter plusieurs cellules");

  // Un appel de plus qu'il n'y a de cellules : la dernière étape entame le tour suivant.
  const { etapes } = planifier(grille, lots, {}, grille.length + 1);
  assert.equal(etapes[0].tour, 0);
  assert.equal(etapes[grille.length - 1].tour, 0, "la dernière cellule appartient encore au tour 0");
  assert.equal(etapes[grille.length].tour, 1, "le compteur de tour doit s'incrémenter");
  assert.equal(etapes[grille.length].indexCellule, 0, "on doit repartir de la cellule centrale");
});

test("une planification sans cellule ou sans type ne produit rien", () => {
  assert.deepEqual(planifier([], [["a"]], {}, 5).etapes, []);
  assert.deepEqual(planifier(cellules(ZONE, 800), [], {}, 5).etapes, []);
});

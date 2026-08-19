/**
 * Classification, normalisation et lecture des sources de données.
 * Une erreur ici produit des pages mal rangées ou des horaires faux, à
 * l'échelle de milliers de fiches.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { classer } from "../lib/categories.mjs";
import { analyser, analyserHoraires, normaliser as normaliserCsv } from "../lib/fournisseurs/csv.mjs";
import { normaliser as normaliserPlaces } from "../lib/fournisseurs/google-places.mjs";
import { slugifier, telephoneLisible, telephoneLien, tronquer } from "../lib/texte.mjs";
import { slugDisponible } from "../lib/fiches.mjs";
import { estNotreUrl, estNotreDomaine } from "../lib/site.mjs";

test("le type principal Google prime sur tout", () => {
  assert.equal(classer({ typePrincipal: "bakery", libelle: "Garage" }), "boulangeries-patisseries");
});

test("un type secondaire sert de repli", () => {
  assert.equal(classer({ typePrincipal: "inconnu", types: ["store", "plumber"] }), "plomberie-chauffage");
});

test("le libellé affiché sert de dernier recours", () => {
  assert.equal(classer({ typePrincipal: "x", libelle: "Salon de coiffure mixte" }), "coiffure-beaute");
  assert.equal(classer({ typePrincipal: "x", libelle: "Cabinet d'avocat" }), "avocats-notaires-juridique");
});

test("une activité non rattachable est écartée plutôt que rangée au hasard", () => {
  assert.equal(classer({ typePrincipal: "rocket_factory", libelle: "Fabricant de fusées" }), null);
});

test("les identifiants d'URL sont propres et bornés", () => {
  assert.equal(slugifier("Chez Léon & Fils (Nevers)"), "chez-leon-fils-nevers");
  assert.equal(slugifier("Crêperie l'Hermine"), "creperie-l-hermine");
  assert.ok(slugifier("a".repeat(200)).length <= 80);
});

test("les homonymes reçoivent un suffixe, jamais l'identifiant Google", () => {
  const occupes = new Set(["nevers/le-bistrot"]);
  assert.equal(slugDisponible("Le Bistrot", "nevers", occupes), "le-bistrot-2");
  assert.equal(slugDisponible("Le Bistrot", "decize", occupes), "le-bistrot");
});

test("les numéros de téléphone sont lisibles et appelables", () => {
  assert.equal(telephoneLisible("+33386591234"), "03 86 59 12 34");
  assert.equal(telephoneLisible("0386591234"), "03 86 59 12 34");
  assert.equal(telephoneLien("03 86 59 12 34"), "+33386591234");
  assert.equal(telephoneLisible("numéro inconnu"), "numéro inconnu");
});

test("les méta-descriptions sont tronquées sur un mot entier", () => {
  const t = tronquer("Boulangerie artisanale du centre-ville de Nevers depuis 1932", 30);
  assert.ok(t.length <= 31, t);
  assert.ok(t.endsWith("…"));
  assert.ok(!t.includes("  "));
});

test("le CSV respecte les guillemets et les deux séparateurs", () => {
  const lignes = analyser('nom;ville\n"Chez; Léon";Nevers\nBar du Pont;Decize\n');
  assert.deepEqual(lignes, [
    { nom: "Chez; Léon", ville: "Nevers" },
    { nom: "Bar du Pont", ville: "Decize" },
  ]);
  assert.deepEqual(analyser("nom,ville\nA,B\n"), [{ nom: "A", ville: "B" }]);
});

test("les horaires CSV se lisent en semaine commençant le lundi", () => {
  const h = analyserHoraires("lun:ferme|mar:07:00-13:00,15:30-19:00|dim:08:00-12:00");
  assert.equal(h.length, 7);
  assert.equal(h[0].ferme, true);
  assert.deepEqual(h[1].creneaux, [["07:00", "13:00"], ["15:30", "19:00"]]);
  assert.deepEqual(h[6].creneaux, [["08:00", "12:00"]]);
  assert.equal(analyserHoraires(""), null);
});

test("l'API Places convertit le dimanche Google (jour 0) en fin de semaine", () => {
  const lieu = {
    id: "X",
    displayName: { text: "Le Fournil" },
    addressComponents: [
      { longText: "1", types: ["street_number"] },
      { longText: "rue A", types: ["route"] },
      { longText: "Nevers", types: ["locality"] },
      { longText: "58000", types: ["postal_code"] },
    ],
    regularOpeningHours: {
      periods: [
        { open: { day: 1, hour: 7, minute: 0 }, close: { day: 1, hour: 13, minute: 0 } },
        { open: { day: 0, hour: 8, minute: 0 }, close: { day: 0, hour: 12, minute: 30 } },
      ],
    },
  };
  const f = normaliserPlaces(lieu);
  assert.equal(f.ville, "Nevers");
  assert.equal(f.adresse.rue, "1 rue A");
  assert.equal(f.adresse.departement, "58");
  assert.deepEqual(f.horaires[0].creneaux, [["07:00", "13:00"]]); // lundi
  assert.deepEqual(f.horaires[6].creneaux, [["08:00", "12:30"]]); // dimanche
  assert.equal(f.horaires[2].ferme, true);
  assert.equal(f.site_web_gmb, null);
});

test("une plage sans fermeture vaut ouverture continue", () => {
  const f = normaliserPlaces({ id: "X", regularOpeningHours: { periods: [{ open: { day: 3, hour: 0, minute: 0 } }] } });
  assert.deepEqual(f.horaires[2].creneaux, [["00:00", "23:59"]]);
});

test("le CSV marque les fiches de démonstration", () => {
  assert.equal(normaliserCsv({ nom: "A", ville: "Nevers", exemple: "1" }).exemple, true);
  assert.equal(normaliserCsv({ nom: "A", ville: "Nevers" }).exemple, false);
});

test("la comparaison de backlink ignore protocole, www et barre finale", () => {
  const chemin = "/boulangeries-patisseries/nevers/le-fournil/";
  for (const variante of [
    "https://vitrine-locale.fr/boulangeries-patisseries/nevers/le-fournil/",
    "http://www.vitrine-locale.fr/boulangeries-patisseries/nevers/le-fournil",
    "https://vitrine-locale.fr/boulangeries-patisseries/nevers/le-fournil/?utm_source=gmb",
  ]) {
    assert.equal(estNotreUrl(variante, chemin), true, variante);
  }
  assert.equal(estNotreUrl("https://autre-annuaire.fr/le-fournil/", chemin), false);
  assert.equal(estNotreUrl("", chemin), false);
});

test("une autre page de notre domaine n'est pas le bon backlink", () => {
  const chemin = "/boulangeries-patisseries/nevers/le-fournil/";
  const autre = "https://vitrine-locale.fr/restaurants/nevers/le-bistrot/";
  assert.equal(estNotreUrl(autre, chemin), false);
  assert.equal(estNotreDomaine(autre), true);
  assert.equal(estNotreDomaine("https://vitrine-locale.fr.exemple.com/"), false);
});

/**
 * Prestations Google : rien n'est affiché sans donnée, et la rédaction
 * n'écrit que ce que la fiche déclare (invariant 1).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { extraireServices, libellesServices, prixLisible, CHAMPS_SERVICES } from "../lib/services.mjs";
import { rediger, titreSerp, descriptionSerp } from "../lib/redaction.mjs";

const DETAIL = {
  priceLevel: "PRICE_LEVEL_MODERATE",
  editorialSummary: { text: "Bistrot de quartier aux plats traditionnels.", languageCode: "fr" },
  dineIn: true,
  takeout: true,
  delivery: false,
  reservable: true,
  outdoorSeating: true,
  servesVegetarianFood: false,
  paymentOptions: { acceptsCreditCards: true, acceptsNfc: true, acceptsCashOnly: false },
  parkingOptions: { freeStreetParking: true },
};

const FICHE = {
  id: "ChIJ-services",
  slug: "le-bistrot",
  nom: "Le Bistrot",
  categorie: "restaurants",
  categorie_gmb: "Restaurant français",
  ville: "Nevers",
  ville_slug: "nevers",
  adresse: { rue: "2 place Carnot", code_postal: "58000", complete: "2 place Carnot, 58000 Nevers" },
  telephone: "+33386000000",
  geo: { latitude: 46.99, longitude: 3.15 },
  note: 4.4,
  avis: 321,
  attributs: [],
  horaires: [0, 1, 2, 3, 4, 5].map((j) => ({ jour: j, ferme: false, creneaux: [["12:00", "14:00"], ["19:00", "22:00"]] })).concat([{ jour: 6, ferme: true, creneaux: [] }]),
  dates: { collecte: "2026-10-18", maj: "2026-10-18" },
};

test("extraireServices ne garde que les champs déclarés, null si rien", () => {
  const s = extraireServices(DETAIL, "2026-10-18");
  assert.equal(s.prix, "PRICE_LEVEL_MODERATE");
  assert.equal(s.resume, "Bistrot de quartier aux plats traditionnels.");
  assert.deepEqual(s.options, { dineIn: true, takeout: true, delivery: false, reservable: true, outdoorSeating: true, servesVegetarianFood: false });
  assert.deepEqual(s.paiement, ["carte bancaire", "paiement sans contact"]);
  assert.deepEqual(s.parking, ["stationnement gratuit dans la rue"]);
  assert.equal(extraireServices({ id: "x", displayName: { text: "X" } }, "2026-10-18"), null);
  assert.equal(extraireServices(null, "2026-10-18"), null);
  assert.ok(CHAMPS_SERVICES.includes("priceLevel") && CHAMPS_SERVICES.includes("reservable"));
});

test("libellesServices sépare proposé et non proposé, prixLisible traduit le niveau", () => {
  const s = extraireServices(DETAIL, "2026-10-18");
  const l = libellesServices(s);
  assert.deepEqual(l.oui, ["sur place", "à emporter", "réservation possible", "terrasse"]);
  assert.deepEqual(l.non, ["livraison", "plats végétariens"]);
  assert.equal(prixLisible(s), "€€ (modéré)");
  assert.equal(prixLisible(null), "");
  assert.deepEqual(libellesServices(null), { oui: [], non: [], paiement: [], parking: [] });
});

test("la rédaction v2 répond aux intentions (horaires, dimanche, réservation, emporter, prix) sans parler de la page", () => {
  const r = rediger({ ...FICHE, services: extraireServices(DETAIL, "2026-10-18") }, "2026-10-18");
  const texte = JSON.stringify(r);
  assert.equal(r.version, 2);
  assert.match(r.chapo, /Téléphone : /);
  assert.match(r.chapo, /Note Google : 4,4 sur 5 pour 321 avis/);
  assert.match(r.chapo, /sauf le dimanche/);
  const prestations = r.sections.find((s) => s.id === "prestations");
  assert.match(prestations.paragraphes[0], /Proposé : sur place, à emporter, réservation possible et terrasse\./);
  assert.match(prestations.paragraphes[1], /Non proposé selon la fiche Google : livraison et plats végétariens\./);
  assert.match(r.sections.find((s) => s.id === "presentation").paragraphes[0], /Présentation donnée par Google : « Bistrot/);
  const questions = r.faq.map((q) => q.q).join(" | ");
  assert.match(questions, /ouvert le dimanche/);
  assert.match(questions, /Peut-on réserver/);
  assert.match(questions, /vente à emporter ou la livraison/);
  assert.match(questions, /niveau de prix/);
  assert.match(r.faq.find((q) => /dimanche/.test(q.q)).r, /^Non/);
  // Plus aucune phrase sur la page elle-même ni sur l'absence de site.
  assert.doesNotMatch(texte, /aucune adresse web|Cette page rassemble|Si vous dirigez|appartiennent à Google|consultées localement|site internet/i);
});

test("sans prestations ni résumé : pas de section prestations, FAQ limitée aux données", () => {
  const r = rediger(FICHE, "2026-10-18");
  assert.equal(r.sections.find((s) => s.id === "prestations"), undefined);
  const questions = r.faq.map((q) => q.q).join(" | ");
  assert.doesNotMatch(questions, /réserver|emporter|niveau de prix/);
  assert.match(questions, /dimanche/);
});

test("titre et description SERP : réponses annoncées, longueurs respectées", () => {
  const c = { nom: "Restaurant" };
  assert.equal(titreSerp(FICHE, c), "Le Bistrot à Nevers : horaires, avis, téléphone");
  assert.equal(titreSerp({ ...FICHE, horaires: null, note: null, avis: 0, telephone: "" }, c), "Le Bistrot, restaurant à Nevers");
  const long = titreSerp({ ...FICHE, nom: "Établissement au nom particulièrement long pour un titre" }, c);
  assert.ok(long.length <= 60, long);
  const d = descriptionSerp(FICHE, c);
  assert.ok(d.length <= 155, d);
  assert.match(d, /horaires d'ouverture, note Google 4,4\/5 \(321 avis\), téléphone, adresse et itinéraire\./);
});

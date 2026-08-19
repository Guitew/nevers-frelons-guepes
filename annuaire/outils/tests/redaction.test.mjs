/**
 * Rédaction et données structurées.
 * Deux garanties sont verrouillées ici, parce qu'elles engagent le site :
 * ne rien inventer, et ne pas baliser la note Google.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { rediger, resumeHoraires, journeeLisible, heureLisible } from "../lib/redaction.mjs";
import { schemaFiche, schemaFaq, schemaFil } from "../lib/schema.mjs";

const COMPLETE = {
  id: "ChIJ-exemple",
  slug: "le-fournil",
  nom: "Le Fournil",
  categorie: "boulangeries-patisseries",
  ville: "Nevers",
  ville_slug: "nevers",
  url: "/boulangeries-patisseries/nevers/le-fournil/",
  adresse: { rue: "14 rue du Croux", code_postal: "58000", complete: "14 rue du Croux, 58000 Nevers" },
  telephone: "+33386211457",
  geo: { latitude: 46.99012, longitude: 3.1534 },
  note: 4.6,
  avis: 213,
  attributs: ["Entrée accessible en fauteuil roulant"],
  horaires: [
    { jour: 0, ferme: true, creneaux: [] },
    { jour: 1, ferme: false, creneaux: [["07:00", "13:00"], ["15:30", "19:00"]] },
    { jour: 2, ferme: false, creneaux: [["07:00", "13:00"]] },
    { jour: 3, ferme: false, creneaux: [["07:00", "13:00"]] },
    { jour: 4, ferme: false, creneaux: [["07:00", "19:00"]] },
    { jour: 5, ferme: false, creneaux: [["07:00", "19:00"]] },
    { jour: 6, ferme: false, creneaux: [["07:30", "12:30"]] },
  ],
  lien_google: "https://maps.google.com/?cid=1",
  dates: { collecte: "2026-08-18", maj: "2026-08-18" },
};

const MINIMALE = {
  id: "ChIJ-minimal",
  slug: "atelier-x",
  nom: "Atelier X",
  categorie: "menuiserie-serrurerie",
  ville: "Decize",
  ville_slug: "decize",
  adresse: { rue: "", code_postal: "", complete: "" },
  telephone: "",
  geo: null,
  note: null,
  avis: 0,
  attributs: [],
  horaires: null,
  dates: { collecte: "2026-08-18", maj: "2026-08-18" },
};

test("la rédaction est déterministe : même fiche, même texte", () => {
  const a = rediger(COMPLETE, "2026-08-18");
  const b = rediger({ ...COMPLETE }, "2026-08-18");
  assert.deepEqual(a, b);
});

test("deux fiches différentes ne reçoivent pas le même texte", () => {
  const variantes = new Set(
    ["a", "b", "c", "d", "e", "f"].map((id) => rediger({ ...COMPLETE, id }, "2026-08-18").chapo)
  );
  assert.ok(variantes.size > 1, "toutes les fiches partagent le même chapô");
});

test("une donnée absente ne produit aucune phrase", () => {
  const r = rediger(MINIMALE, "2026-08-18");
  const texte = JSON.stringify(r);
  assert.ok(!texte.includes("undefined"), texte.slice(0, 200));
  assert.ok(!texte.includes("null"));
  assert.ok(!/note de/.test(texte), "une note inexistante ne doit pas être commentée");
  assert.equal(r.sections.find((s) => s.id === "avis"), undefined);
  assert.equal(r.sections.find((s) => s.id === "acces"), undefined);
});

test("l'absence de téléphone est dite explicitement, pas passée sous silence", () => {
  const r = rediger(MINIMALE, "2026-08-18");
  const contact = r.sections.find((s) => s.id === "contact");
  assert.match(contact.paragraphes[0], /Aucun numéro de téléphone/);
});

test("la FAQ ne pose que des questions auxquelles les données répondent", () => {
  const complete = rediger(COMPLETE, "2026-08-18").faq.map((q) => q.q).join(" ");
  assert.match(complete, /horaires/i);
  assert.match(complete, /Où se trouve/);
  assert.match(complete, /Comment contacter/);
  assert.match(complete, /mobilité réduite/);

  const minimale = rediger(MINIMALE, "2026-08-18").faq.map((q) => q.q).join(" ");
  assert.doesNotMatch(minimale, /horaires/i);
  assert.doesNotMatch(minimale, /Comment contacter/);
  assert.match(minimale, /site internet/); // la seule question toujours pertinente
});

test("les métadonnées respectent les longueurs utiles en SERP", () => {
  const r = rediger(COMPLETE, "2026-08-18");
  assert.ok(r.meta_titre.length <= 60, r.meta_titre);
  assert.ok(r.meta_description.length <= 155, r.meta_description);
  assert.ok(r.meta_description.includes("Nevers"));
});

test("les horaires se résument en français correct", () => {
  assert.equal(resumeHoraires(COMPLETE.horaires), "ouvert tous les jours sauf le lundi");
  assert.equal(resumeHoraires(null), null);
  assert.equal(resumeHoraires(COMPLETE.horaires.map((j) => ({ ...j, ferme: false, creneaux: [["09:00", "18:00"]] }))), "ouvert sept jours sur sept");
  assert.equal(journeeLisible({ ferme: true }), "fermé");
  assert.equal(journeeLisible(COMPLETE.horaires[1]), "de 7 h à 13 h et de 15 h 30 à 19 h");
  assert.equal(heureLisible("14:30"), "14 h 30");
  assert.equal(heureLisible("09:00"), "9 h");
});

test("le JSON-LD ne balise JAMAIS la note Google en aggregateRating", () => {
  const s = schemaFiche({ ...COMPLETE, redaction: rediger(COMPLETE, "2026-08-18") });
  const brut = JSON.stringify(s);
  assert.ok(!brut.includes("aggregateRating"), "règles Google : avis d'une plateforme tierce");
  assert.ok(!brut.includes("ratingValue"));
  assert.ok(!brut.includes("review"));
});

test("le type schema.org suit la catégorie", () => {
  assert.equal(schemaFiche({ ...COMPLETE, redaction: {} })["@type"], "Bakery");
  assert.equal(schemaFiche({ ...COMPLETE, categorie: "plomberie-chauffage", redaction: {} })["@type"], "Plumber");
  assert.equal(schemaFiche({ ...COMPLETE, categorie: "inconnue", redaction: {} })["@type"], "LocalBusiness");
});

test("les horaires sont exposés en openingHoursSpecification", () => {
  const s = schemaFiche({ ...COMPLETE, redaction: {} });
  // 6 jours ouverts, dont le mardi à deux créneaux → 7 spécifications.
  assert.equal(s.openingHoursSpecification.length, 7);
  const mardi = s.openingHoursSpecification.filter((h) => h.dayOfWeek.endsWith("Tuesday"));
  assert.equal(mardi.length, 2);
  assert.deepEqual(mardi.map((h) => [h.opens, h.closes]), [["07:00", "13:00"], ["15:30", "19:00"]]);
  // Le lundi est fermé : il ne doit apparaître nulle part.
  assert.ok(!s.openingHoursSpecification.some((h) => h.dayOfWeek.endsWith("Monday")));
});

test("une fiche sans coordonnées ne produit pas de nœuds vides", () => {
  const s = schemaFiche({ ...MINIMALE, url: "/menuiserie-serrurerie/decize/atelier-x/", redaction: {} });
  assert.equal(s.geo, undefined);
  assert.equal(s.telephone, undefined);
  assert.equal(s.address, undefined);
  assert.equal(s.openingHoursSpecification, undefined);
});

test("la FAQ et le fil d'Ariane produisent un balisage complet", () => {
  const faq = schemaFaq(rediger(COMPLETE, "2026-08-18").faq);
  assert.equal(faq["@type"], "FAQPage");
  assert.ok(faq.mainEntity.every((q) => q.acceptedAnswer.text.length > 20));
  assert.equal(schemaFaq([]), null);

  const fil = schemaFil([{ titre: "Boulangeries", url: "/boulangeries-patisseries/" }]);
  assert.equal(fil.itemListElement[0].name, "Accueil");
  assert.equal(fil.itemListElement[1].position, 2);
  assert.ok(fil.itemListElement[1].item.startsWith("https://"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { planifier, scorePage, historiquePages } from "../lib/planification.mjs";
import { formatSourcePour, serpsCompatibles } from "../lib/serps.mjs";

const config = { cadence: { imagesParJour: 2, pagesDistinctesParJour: true, joursMinimumEntreDeuxImagesMemePage: 7 }, charte: {} };
const site = { nom: "T", url: "https://t.fr", baseImages: "https://t.fr/img/" };
const page = (id, extra = {}) => ({
  id,
  url: `https://t.fr/${id}`,
  titre: id,
  mot_cle: id,
  serps: ["google-images"],
  priorite: 2,
  saison: [],
  visuels: [
    { angle: `${id} angle A`, requete: `${id} a` },
    { angle: `${id} angle B`, requete: `${id} b` },
  ],
  ...extra,
});

test("planifier : 2 images sur 2 pages distinctes, déterministe pour une date", () => {
  const pages = [page("p1"), page("p2"), page("p3")];
  const a = planifier({ pages, date: "2026-07-01", config, site });
  const b = planifier({ pages, date: "2026-07-01", config, site });
  assert.equal(a.length, 2);
  assert.notEqual(a[0].page, a[1].page);
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.match(a[0].id, /^2026-07-01-01-/);
  assert.equal(a[0].statut, "a_generer");
  assert.ok(a[0].prompt.length > 200);
});

test("planifier : ignore les pages sans URL sauf en essai ; complète la cadence avec un second visuel s'il le faut", () => {
  const pages = [page("p1", { url: "", a_completer: true }), page("p2")];
  const plan = planifier({ pages, date: "2026-07-01", config, site });
  assert.equal(plan.length, 2);
  assert.ok(plan.every((it) => it.page === "p2"));
  assert.notEqual(plan[0].visuel, plan[1].visuel);
  const essai = planifier({ pages, date: "2026-07-01", config, site, essai: true });
  assert.deepEqual(essai.map((it) => it.page).sort(), ["p1", "p2"]);
  const unSeul = planifier({ pages: [page("p3", { visuels: [{ angle: "x", requete: "x" }] })], date: "2026-07-01", config, site });
  assert.equal(unSeul.length, 1);
});

test("planifier : ne revient pas sur une page avant le délai minimum, et tourne les visuels", () => {
  const pages = [page("p1"), page("p2"), page("p3")];
  const j1 = planifier({ pages, date: "2026-07-01", config, site });
  const journal = j1.map((it) => ({ type: "publie", date: "2026-07-01T10:00:00Z", page: it.page, visuel: it.visuel }));
  const j2 = planifier({ pages, date: "2026-07-02", journal, config, site });
  const pagesJ1 = j1.map((x) => x.page);
  // Trois pages, deux servies hier : seules les images de la troisième sont possibles
  assert.ok(j2.length >= 1 && j2.every((x) => !pagesJ1.includes(x.page)));
  // Huit jours plus tard, la page servie repasse, et son visuel inédit vient en premier
  const j9 = planifier({ pages: [pages.find((p) => p.id === j1[0].page)], date: "2026-07-09", journal, config, site });
  assert.ok(j9.length >= 1);
  assert.notEqual(j9[0].visuel, j1[0].visuel);
});

test("planifier : idempotent le même jour — complète la cadence, ne l'excède jamais", () => {
  const pages = [page("p1"), page("p2"), page("p3")];
  const j1 = planifier({ pages, date: "2026-07-01", config, site });
  assert.equal(planifier({ pages, date: "2026-07-01", file: j1, config, site }).length, 0);
  const complement = planifier({ pages, date: "2026-07-01", file: [j1[0]], config, site });
  assert.equal(complement.length, 1);
  assert.notEqual(complement[0].page, j1[0].page);
  assert.match(complement[0].id, /^2026-07-01-02-/);
});

test("scorePage : la saison et la priorité pèsent, le délai minimum exclut", () => {
  const histo = historiquePages([{ type: "publie", date: "2026-06-30T00:00:00Z", page: "p1", visuel: 0 }]);
  assert.equal(scorePage(page("p1"), "2026-07-01", histo, config.cadence), -1);
  const enSaison = scorePage(page("s", { saison: [7] }), "2026-07-01", {}, config.cadence);
  const horsSaison = scorePage(page("s", { saison: [1] }), "2026-07-01", {}, config.cadence);
  assert.ok(enSaison > horsSaison);
  assert.ok(scorePage(page("a", { priorite: 1 }), "2026-07-01", {}, config.cadence) > scorePage(page("a", { priorite: 3 }), "2026-07-01", {}, config.cadence));
});

test("serps : orientation maître et surfaces compatibles", () => {
  assert.equal(formatSourcePour(["google-images", "discover"]), "paysage");
  assert.equal(formatSourcePour(["pinterest"]), "portrait");
  assert.equal(formatSourcePour(["google-images", "pinterest"]), "paysage");
  assert.equal(formatSourcePour(["google-images"], "portrait"), "portrait");
  assert.deepEqual(serpsCompatibles(["google-images", "pinterest"], "paysage"), ["google-images"]);
  assert.deepEqual(serpsCompatibles(["google-images", "pinterest"], "portrait"), ["pinterest"]);
});

test("planifier : un visuel imposé en portrait produit la déclinaison Pinterest", () => {
  const pages = [page("p1", { serps: ["google-images", "pinterest"], visuels: [{ angle: "comparatif vertical", requete: "p1 vertical", format: "portrait", surcouche: "Titre" }] })];
  const plan = planifier({ pages, date: "2026-07-01", config, site });
  assert.deepEqual(plan[0].serps, ["pinterest"]);
  assert.equal(plan[0].formatSource, "portrait");
});

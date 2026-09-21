/**
 * Couverture Google : sélection des pages à inspecter et lecture des verdicts.
 * Ces règles retirent des URLs publiques : elles sont verrouillées ici.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { interpreter, selectionner, estNonIndexee, reglagesCouverture } from "../lib/couverture.mjs";

const MAINTENANT = new Date("2026-09-21T09:00:00Z");
const R = reglagesCouverture({ inspectionsParJour: 2 });

function fiche(extra = {}) {
  return { statut: "publiee", dates: { publication: "2026-07-01" }, ...extra };
}

test("le verdict PASS signifie indexée, tout le reste non indexée", () => {
  const pass = interpreter({ inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed", lastCrawlTime: "2026-09-20T01:00:00Z" } } });
  assert.equal(pass.etat, "indexee");
  assert.equal(pass.couverture, "Submitted and indexed");
  const neutre = interpreter({ inspectionResult: { indexStatusResult: { verdict: "NEUTRAL", coverageState: "Crawled - currently not indexed" } } });
  assert.equal(neutre.etat, "non-indexee");
  assert.equal(interpreter({}).etat, "non-indexee");
});

test("une page avec des impressions récentes est indexée sans appel d'API", () => {
  const f = fiche({ audience: { impressions: 12, clics: 0, date: "2026-09-20" } });
  const { parImpressions, aInspecter } = selectionner([f], R, MAINTENANT);
  assert.equal(parImpressions.length, 1);
  assert.equal(aInspecter.length, 0);
});

test("les pages trop jeunes, retirées ou de démonstration ne sont pas inspectées", () => {
  const jeune = fiche({ dates: { publication: "2026-09-10" } });
  const retiree = fiche({ statut: "retiree" });
  const demo = fiche({ exemple: true });
  const { aInspecter, ignorees } = selectionner([jeune, retiree, demo], R, MAINTENANT);
  assert.equal(aInspecter.length, 0);
  assert.equal(ignorees.length, 3);
});

test("le quota est respecté, les jamais inspectées d'abord puis les verdicts les plus anciens", () => {
  const a = fiche({ slug: "a", indexation: { etat: "indexee", date: "2026-09-15" } });
  const b = fiche({ slug: "b" });
  const c = fiche({ slug: "c", indexation: { etat: "indexee", date: "2026-09-01" } });
  const { aInspecter } = selectionner([a, b, c], R, MAINTENANT);
  assert.deepEqual(aInspecter.map((f) => f.slug), ["b", "c"]);
});

test("le retrait exige un verdict non indexée, récent, sur une page d'au moins 45 jours", () => {
  const nonIndexee = fiche({ indexation: { etat: "non-indexee", date: "2026-09-20" } });
  assert.equal(estNonIndexee(nonIndexee, R, MAINTENANT), true);
  const indexee = fiche({ indexation: { etat: "indexee", date: "2026-09-20" } });
  assert.equal(estNonIndexee(indexee, R, MAINTENANT), false);
  const perime = fiche({ indexation: { etat: "non-indexee", date: "2026-08-01" } });
  assert.equal(estNonIndexee(perime, R, MAINTENANT), false, "un verdict périmé ne fonde pas un retrait");
  const jeune = fiche({ dates: { publication: "2026-08-20" }, indexation: { etat: "non-indexee", date: "2026-09-20" } });
  assert.equal(estNonIndexee(jeune, R, MAINTENANT), false, "32 jours : trop tôt");
  assert.equal(estNonIndexee(fiche(), R, MAINTENANT), false, "sans verdict, rien");
});

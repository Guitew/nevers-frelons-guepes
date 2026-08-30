/**
 * Règles de cycle de vie d'une fiche.
 * Ce sont les seules règles du projet qui font disparaître une URL publique :
 * elles méritent d'être verrouillées.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { deciderRetrait, deciderArchivage, deciderRepublication } from "../lib/politique.mjs";

const REGLAGES = {
  delaiDeGraceJours: 45,
  echecsAvantRetrait: 2,
  modeRetraitParDefaut: "301",
  modeRetraitSiJamaisLie: "410",
  joursConservation410: 180,
  joursConservation301: 365,
};

const MAINTENANT = new Date("2026-08-19T09:00:00Z");

function fiche(backlink = {}, dates = {}, extra = {}) {
  return {
    nom: "Test",
    backlink: { etat: "en-attente", echecs: 0, premiere_detection: null, ...backlink },
    dates: { publication: "2026-08-01", ...dates },
    ...extra,
  };
}

test("un backlink présent ne déclenche aucun retrait", () => {
  assert.equal(deciderRetrait(fiche({ etat: "present", premiere_detection: "2026-06-01" }), REGLAGES, MAINTENANT), null);
});

test("un backlink perdu attend le seuil d'échecs avant de retirer", () => {
  const f = fiche({ etat: "absent", echecs: 1, premiere_detection: "2026-06-01" });
  assert.equal(deciderRetrait(f, REGLAGES, MAINTENANT), null);
  f.backlink.echecs = 2;
  assert.equal(deciderRetrait(f, REGLAGES, MAINTENANT).mode, "301");
});

test("un lien retiré après avoir existé donne une 301, pas une 410", () => {
  const d = deciderRetrait(fiche({ etat: "absent", echecs: 2, premiere_detection: "2026-06-01" }), REGLAGES, MAINTENANT);
  assert.equal(d.mode, "301");
  assert.match(d.motif, /retiré/);
});

test("un site propre déclaré à la place donne une 301 et le mentionne", () => {
  const d = deciderRetrait(
    fiche({ etat: "externe", echecs: 2, premiere_detection: "2026-06-01", url_detectee: "https://exemple.fr" }),
    REGLAGES,
    MAINTENANT
  );
  assert.equal(d.mode, "301");
  assert.match(d.motif, /exemple\.fr/);
});

test("une fiche Google introuvable donne une 410 sans attendre le délai de grâce", () => {
  const d = deciderRetrait(fiche({ etat: "introuvable", echecs: 2 }), REGLAGES, MAINTENANT);
  assert.equal(d.mode, "410");
});

test("le délai de grâce protège une fiche jamais liée", () => {
  // Publiée il y a 18 jours : intouchable, même avec des échecs.
  const jeune = fiche({ etat: "absent", echecs: 5 }, { publication: "2026-08-01" });
  assert.equal(deciderRetrait(jeune, REGLAGES, MAINTENANT), null);

  // Publiée il y a 49 jours : le délai de 45 jours est dépassé.
  const vieille = fiche({ etat: "absent", echecs: 5 }, { publication: "2026-07-01" });
  const d = deciderRetrait(vieille, REGLAGES, MAINTENANT);
  assert.equal(d.mode, "410");
  assert.match(d.motif, /jamais posé/);
});

test("le délai de grâce se compte au jour près", () => {
  const veille = fiche({ etat: "absent", echecs: 2 }, { publication: "2026-07-06" }); // 44 jours
  assert.equal(deciderRetrait(veille, REGLAGES, MAINTENANT), null);
  const jour = fiche({ etat: "absent", echecs: 2 }, { publication: "2026-07-05" }); // 45 jours
  assert.equal(deciderRetrait(jour, REGLAGES, MAINTENANT).mode, "410");
});

test("une règle 410 est purgée à 180 jours, une 301 à un an", () => {
  const gone = { retrait: { mode: "410", date: "2026-01-15" }, backlink: { etat: "absent" } };
  assert.equal(deciderArchivage(gone, REGLAGES, MAINTENANT).age, 216);

  const recent = { retrait: { mode: "410", date: "2026-06-01" }, backlink: { etat: "absent" } };
  assert.equal(deciderArchivage(recent, REGLAGES, MAINTENANT), null);

  // Même âge, mais une 301 se conserve un an.
  const redirige = { retrait: { mode: "301", date: "2026-01-15" }, backlink: { etat: "absent" } };
  assert.equal(deciderArchivage(redirige, REGLAGES, MAINTENANT), null);

  const vieilleRedirection = { retrait: { mode: "301", date: "2025-01-15" }, backlink: { etat: "absent" } };
  assert.ok(deciderArchivage(vieilleRedirection, REGLAGES, MAINTENANT));
});

test("une fiche dont le lien est revenu n'est jamais archivée", () => {
  const f = { retrait: { mode: "410", date: "2020-01-01" }, backlink: { etat: "present" } };
  assert.equal(deciderArchivage(f, REGLAGES, MAINTENANT), null);
});

test("le lien revenu republie la fiche, sauf après un retrait demandé", () => {
  assert.equal(deciderRepublication({ backlink: { etat: "present" }, retrait: { motif: "backlink GMB retiré" } }), true);
  assert.equal(deciderRepublication({ backlink: { etat: "present" }, retrait: { motif: "retrait manuel" } }), false);
  assert.equal(deciderRepublication({ backlink: { etat: "absent" }, retrait: {} }), false);
});

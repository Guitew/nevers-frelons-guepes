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
  assert.equal(deciderRepublication({ backlink: { etat: "present" }, retrait: { motif: "backlink GMB retiré" } }), "backlink GMB retrouvé");
  assert.equal(deciderRepublication({ backlink: { etat: "present" }, retrait: { motif: "retrait manuel" } }), null);
  assert.equal(deciderRepublication({ backlink: { etat: "absent" }, retrait: {} }), null);
});

// ---------------------------------------------------------------------------
//  Audience Search Console : une page qui amène des visiteurs reste en ligne
// ---------------------------------------------------------------------------
import { estProtegee, delaiDeGrace } from "../lib/politique.mjs";

const AUDIENCE = {
  fenetreJours: 90,
  fraicheurJours: 7,
  clicsProtection: 1,
  impressionsProlongation: 100,
  prolongationJours: 45,
};
const AVEC_AUDIENCE = { ...REGLAGES, audience: AUDIENCE };
const RELEVE = "2026-08-18"; // la veille de MAINTENANT

test("une page avec des clics Google n'est pas retirée, même sans lien après le délai de grâce", () => {
  const f = fiche({ etat: "absent", echecs: 30 }, { publication: "2026-06-01" }, {
    audience: { clics: 2, impressions: 40, date: RELEVE },
  });
  assert.equal(deciderRetrait(f, REGLAGES, MAINTENANT).mode, "410");
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT), null);
  assert.deepEqual(estProtegee(f, AUDIENCE, MAINTENANT), { clics: 2 });
});

test("une page avec des clics n'est pas redirigée quand son lien disparaît", () => {
  const f = fiche({ etat: "absent", echecs: 2, premiere_detection: "2026-06-01" }, {}, {
    audience: { clics: 1, impressions: 10, date: RELEVE },
  });
  assert.equal(deciderRetrait(f, REGLAGES, MAINTENANT).mode, "301");
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT), null);
});

test("des clics anciens (sans rythme hebdomadaire) ne sauvent pas une fiche Google disparue", () => {
  const f = fiche({ etat: "introuvable", echecs: 2 }, {}, {
    audience: { clics: 9, impressions: 500, date: RELEVE },
  });
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT).mode, "410");
});

test("des impressions sans clic prolongent le délai de grâce, sans l'annuler", () => {
  const f = fiche({ etat: "absent", echecs: 30 }, { publication: "2026-06-20" }, {
    audience: { clics: 0, impressions: 250, date: RELEVE },
  });
  // 59 jours après publication : au-delà des 45 jours, mais sous 45 + 45.
  assert.equal(delaiDeGrace(f, AVEC_AUDIENCE, MAINTENANT), 90);
  assert.equal(deciderRetrait(f, REGLAGES, MAINTENANT).mode, "410");
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT), null);
  f.dates.publication = "2026-05-01"; // 110 jours : le délai prolongé est dépassé
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT).mode, "410");
});

test("trop peu d'impressions ne prolongent rien", () => {
  const f = fiche({ etat: "absent", echecs: 30 }, { publication: "2026-06-20" }, {
    audience: { clics: 0, impressions: 12, date: RELEVE },
  });
  assert.equal(delaiDeGrace(f, AVEC_AUDIENCE, MAINTENANT), 45);
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT).mode, "410");
});

test("un relevé d'audience trop ancien ne protège plus", () => {
  const f = fiche({ etat: "absent", echecs: 30 }, { publication: "2026-06-01" }, {
    audience: { clics: 5, impressions: 300, date: "2026-07-01" },
  });
  assert.equal(estProtegee(f, AUDIENCE, MAINTENANT), null);
  assert.equal(delaiDeGrace(f, AVEC_AUDIENCE, MAINTENANT), 45);
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT).mode, "410");
});

test("sans relevé d'audience, la politique de backlink s'applique telle quelle", () => {
  const f = fiche({ etat: "absent", echecs: 30 }, { publication: "2026-06-01" });
  assert.equal(deciderRetrait(f, AVEC_AUDIENCE, MAINTENANT).mode, "410");
});

// ---------------------------------------------------------------------------
//  Couverture : une page que Google n'indexe pas est retirée proprement
// ---------------------------------------------------------------------------
const COUVERTURE = { retraitSiNonIndexeeJours: 45, fraicheurJours: 7 };
const AVEC_COUVERTURE = { ...REGLAGES, audience: AUDIENCE, couverture: COUVERTURE };
const NON_INDEXEE = { etat: "non-indexee", couverture: "Crawled - currently not indexed", date: RELEVE };

test("une page jamais liée et non indexée à 45 jours part en 410", () => {
  const f = fiche({ etat: "absent", echecs: 30 }, { publication: "2026-06-20" }, { indexation: NON_INDEXEE });
  const d = deciderRetrait(f, AVEC_COUVERTURE, MAINTENANT);
  assert.equal(d.mode, "410");
  assert.equal(d.cause, "non-indexee");
  assert.match(d.motif, /non indexée par Google 60 jours/);
});

test("une page non indexée mais dont le lien GMB existe est redirigée en 301, pas supprimée", () => {
  const f = fiche({ etat: "present", echecs: 0, premiere_detection: "2026-07-01" }, { publication: "2026-06-20" }, { indexation: NON_INDEXEE });
  assert.equal(deciderRetrait(f, REGLAGES, MAINTENANT), null, "sans la règle : un lien présent protège");
  const d = deciderRetrait(f, AVEC_COUVERTURE, MAINTENANT);
  assert.equal(d.mode, "301");
  assert.equal(d.cause, "non-indexee");
});

test("les clics protègent aussi d'un retrait pour défaut d'indexation", () => {
  const f = fiche({ etat: "absent", echecs: 30 }, { publication: "2026-06-20" }, {
    indexation: NON_INDEXEE,
    audience: { clics: 3, impressions: 40, date: RELEVE },
  });
  assert.equal(deciderRetrait(f, AVEC_COUVERTURE, MAINTENANT), null);
});

test("une page indexée, liée, reste en ligne ; non inspectée, la règle ne s'applique pas", () => {
  const liee = fiche({ etat: "present", premiere_detection: "2026-07-01" }, { publication: "2026-06-20" }, {
    indexation: { etat: "indexee", date: RELEVE },
  });
  assert.equal(deciderRetrait(liee, AVEC_COUVERTURE, MAINTENANT), null);
  const inconnue = fiche({ etat: "present", premiere_detection: "2026-07-01" }, { publication: "2026-06-20" });
  assert.equal(deciderRetrait(inconnue, AVEC_COUVERTURE, MAINTENANT), null);
});

test("une page retirée pour défaut d'indexation n'est pas republiée quand le lien revient", () => {
  const f = fiche({ etat: "present" }, {}, { retrait: { mode: "301", cause: "non-indexee", motif: "page non indexée…" } });
  assert.equal(deciderRepublication(f), null);
  const g = fiche({ etat: "present" }, {}, { retrait: { mode: "301", motif: "backlink GMB retiré" } });
  assert.equal(deciderRepublication(g), "backlink GMB retrouvé");
});

// ---------------------------------------------------------------------------
//  Performance : une page qui amène ≥ 1 clic Google par semaine ne disparaît pas
// ---------------------------------------------------------------------------
import { estPerformante } from "../lib/politique.mjs";

const PERF = { ...AUDIENCE, clicsParSemaineMaintien: 1, fenetreRecenteJours: 28 };
const AVEC_PERF = { ...REGLAGES, audience: PERF, couverture: COUVERTURE };

test("une page qui performe reste en ligne même si sa fiche Google est introuvable", () => {
  const f = fiche({ etat: "introuvable", echecs: 19, premiere_detection: "2026-07-01" }, {}, {
    audience: { clics: 83, clicsRecents: 40, fenetreRecenteJours: 28, date: RELEVE },
  });
  assert.equal(deciderRetrait(f, REGLAGES, MAINTENANT).mode, "410", "sans relevé d'audience : 410");
  assert.equal(deciderRetrait(f, AVEC_PERF, MAINTENANT), null);
  assert.deepEqual(estPerformante(f, PERF, MAINTENANT), { clics: 40, jours: 28 });
});

test("le seuil est d'un clic par semaine en moyenne sur la fenêtre récente", () => {
  const f = fiche({ etat: "introuvable", echecs: 5 }, {}, {
    audience: { clics: 3, clicsRecents: 3, fenetreRecenteJours: 28, date: RELEVE },
  });
  assert.equal(estPerformante(f, PERF, MAINTENANT), null, "3 clics en 4 semaines : sous le seuil");
  assert.equal(deciderRetrait(f, AVEC_PERF, MAINTENANT).mode, "410");
  f.audience.clicsRecents = 4;
  assert.equal(deciderRetrait(f, AVEC_PERF, MAINTENANT), null, "4 clics en 4 semaines : maintenue");
});

test("une page qui performe n'est retirée ni pour lien perdu ni pour non-indexation", () => {
  const f = fiche({ etat: "absent", echecs: 30, premiere_detection: "2026-07-01" }, { publication: "2026-06-20" }, {
    indexation: NON_INDEXEE,
    audience: { clics: 0, clicsRecents: 10, fenetreRecenteJours: 28, date: RELEVE },
  });
  assert.equal(deciderRetrait(f, AVEC_PERF, MAINTENANT), null);
});

test("une fiche retirée qui performe encore est republiée, sauf retrait manuel", () => {
  const audience = { clics: 31, clicsRecents: 31, fenetreRecenteJours: 28, date: RELEVE };
  const f = fiche({ etat: "absent", echecs: 20 }, {}, { audience, retrait: { mode: "301", motif: "backlink GMB retiré" } });
  assert.match(deciderRepublication(f, PERF, MAINTENANT), /performe encore \(31 clic/);
  const g = fiche({ etat: "introuvable" }, {}, { audience, retrait: { mode: "410", cause: "non-indexee", motif: "…" } });
  assert.ok(deciderRepublication(g, PERF, MAINTENANT), "même après une 410");
  const h = fiche({ etat: "present" }, {}, { audience, retrait: { mode: "410", motif: "demande du dirigeant", manuel: true } });
  assert.equal(deciderRepublication(h, PERF, MAINTENANT), null);
  assert.equal(deciderArchivage(f, { ...AVEC_PERF, joursConservation301: 0 }, MAINTENANT), null, "pas d'archivage non plus");
});

test("un maintien manuel empêche tout retrait automatique", () => {
  const f = fiche({ etat: "introuvable", echecs: 30 }, {}, { maintien: { date: RELEVE, motif: "page qui performe" } });
  assert.equal(deciderRetrait(f, AVEC_PERF, MAINTENANT), null);
});

test("un relevé périmé ne rend pas une page performante", () => {
  const f = fiche({ etat: "introuvable", echecs: 5 }, {}, {
    audience: { clics: 50, clicsRecents: 50, fenetreRecenteJours: 28, date: "2026-07-01" },
  });
  assert.equal(estPerformante(f, PERF, MAINTENANT), null);
  assert.equal(deciderRetrait(f, AVEC_PERF, MAINTENANT).mode, "410");
});

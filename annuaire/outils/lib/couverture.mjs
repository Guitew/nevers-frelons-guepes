/**
 * Couverture Google : quelles pages sont réellement indexées ?
 *
 * Une page que Google refuse d'indexer 45 jours après sa mise en ligne ne
 * rapportera rien : la garder gonfle le site de pages « explorées, non
 * indexées », signal de faible qualité qui pèse sur l'ensemble. Autant la
 * retirer proprement.
 *
 * Deux sources, de la moins chère à la plus précise :
 *   1. le relevé d'audience (audience.mjs) : une page avec des impressions est
 *      indexée par définition — aucun appel d'API n'est nécessaire ;
 *   2. l'API d'inspection d'URL de la Search Console, pour les pages sans
 *      impression : verdict PASS = indexée, NEUTRAL/FAIL = non indexée.
 *      Quota : 2 000 inspections par jour et par propriété ; on n'inspecte
 *      que les pages assez âgées pour que le verdict compte, les plus
 *      anciennement inspectées d'abord.
 *
 * Le verdict est écrit sur la fiche :
 *   "indexation": { "etat": "indexee" | "non-indexee", "verdict", "couverture",
 *                   "derniere_exploration", "source": "impressions" | "inspection",
 *                   "date": "AAAA-MM-JJ" }
 *
 * Fonctions pures, testables hors ligne ; l'appel réseau est dans couverture.mjs.
 */

import { joursDepuis } from "./texte.mjs";

export const REGLAGES_PAR_DEFAUT = {
  retraitSiNonIndexeeJours: 45, // âge à partir duquel une page non indexée est retirée
  ageMinimumInspectionJours: 38, // on n'inspecte pas plus tôt : Google prend son temps
  inspectionsParJour: 200, // sous le quota de 2 000, marge pour les autres usages
  fraicheurJours: 7, // un verdict plus ancien ne fonde plus un retrait
};

export function reglagesCouverture(brut) {
  return { ...REGLAGES_PAR_DEFAUT, ...(brut || {}) };
}

/** Traduit une réponse de l'API d'inspection en état de la fiche. */
export function interpreter(reponse) {
  const r = reponse?.inspectionResult?.indexStatusResult || {};
  const verdict = r.verdict || "VERDICT_UNSPECIFIED";
  return {
    etat: verdict === "PASS" ? "indexee" : "non-indexee",
    verdict,
    couverture: r.coverageState || null,
    derniere_exploration: r.lastCrawlTime || null,
    canonique_google: r.googleCanonical || null,
    source: "inspection",
  };
}

function age(fiche, maintenant) {
  return joursDepuis(fiche.dates?.publication, maintenant);
}

/**
 * Répartit les fiches publiées en trois groupes :
 *   - parImpressions : indexées sans appel (audience récente avec impressions) ;
 *   - aInspecter     : à interroger aujourd'hui, dans la limite du quota ;
 *   - ignorees       : trop jeunes, de démonstration ou non publiées.
 */
export function selectionner(fiches, reglages, maintenant = new Date()) {
  const r = reglagesCouverture(reglages);
  const parImpressions = [];
  const candidates = [];
  const ignorees = [];
  for (const f of fiches) {
    if (f.statut !== "publiee" || f.exemple) {
      ignorees.push(f);
      continue;
    }
    const a = age(f, maintenant);
    if (a === null || a < r.ageMinimumInspectionJours) {
      ignorees.push(f);
      continue;
    }
    const audienceFraiche =
      f.audience?.date && (joursDepuis(f.audience.date, maintenant) ?? Infinity) <= r.fraicheurJours;
    if (audienceFraiche && (f.audience.impressions || 0) > 0) {
      parImpressions.push(f);
      continue;
    }
    candidates.push(f);
  }
  // Jamais inspectées d'abord, puis les verdicts les plus anciens.
  candidates.sort((x, y) => (x.indexation?.date || "").localeCompare(y.indexation?.date || ""));
  return { parImpressions, aInspecter: candidates.slice(0, r.inspectionsParJour), ignorees };
}

/**
 * La page est-elle à retirer pour défaut d'indexation ?
 * Trois conditions : un verdict « non indexée », récent, sur une page assez
 * âgée. Un verdict périmé ne compte pas : si l'inspection tombe en panne, la
 * règle s'éteint au lieu de retirer à l'aveugle.
 */
export function estNonIndexee(fiche, reglages, maintenant = new Date()) {
  const r = reglagesCouverture(reglages);
  const ix = fiche.indexation;
  if (!ix || ix.etat !== "non-indexee" || !ix.date) return false;
  const fraicheur = joursDepuis(ix.date, maintenant);
  if (fraicheur === null || fraicheur > r.fraicheurJours) return false;
  const a = age(fiche, maintenant);
  return a !== null && a >= r.retraitSiNonIndexeeJours;
}

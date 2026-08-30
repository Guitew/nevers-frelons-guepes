/**
 * Politique de cycle de vie d'une fiche — les règles les plus lourdes de
 * conséquences du projet : ce sont elles qui décident qu'une URL publique
 * disparaît.
 *
 * Elles sont isolées ici, sans effet de bord ni accès disque, pour deux
 * raisons : les rendre lisibles d'un seul tenant, et les rendre testables
 * (voir outils/tests/politique.test.mjs). « maintenant » est un paramètre
 * plutôt qu'un appel à Date.now() afin que les tests puissent faire vieillir
 * une fiche sans attendre six mois.
 */

import { joursDepuis } from "./texte.mjs";

const PERDUS = ["absent", "externe", "introuvable"];

/**
 * Faut-il retirer cette fiche publiée ?
 * @returns {{mode: "301"|"410", motif: string}|null}
 */
export function deciderRetrait(fiche, reglages, maintenant = new Date()) {
  const bl = fiche.backlink || {};
  const echecs = bl.echecs || 0;

  // Fiche Google disparue : rien à transmettre, l'établissement n'existe plus.
  if (bl.etat === "introuvable" && echecs >= reglages.echecsAvantRetrait) {
    return { mode: "410", motif: "fiche Google introuvable (établissement fermé ou supprimé)" };
  }

  if (!PERDUS.includes(bl.etat)) return null;
  if (echecs < reglages.echecsAvantRetrait) return null;

  // Le lien a existé : l'URL a de la valeur, on la redirige.
  if (bl.premiere_detection) {
    return {
      mode: reglages.modeRetraitParDefaut,
      motif:
        bl.etat === "externe"
          ? `backlink remplacé par un site propre (${bl.url_detectee})`
          : "backlink GMB retiré",
    };
  }

  // Le lien n'a jamais été posé : délai de grâce, puis retrait sec.
  const age = joursDepuis(fiche.dates?.publication, maintenant);
  if (age !== null && age >= reglages.delaiDeGraceJours) {
    return {
      mode: reglages.modeRetraitSiJamaisLie,
      motif: `backlink jamais posé après ${age} jours de délai de grâce`,
    };
  }
  return null;
}

/**
 * La règle de redirection de cette fiche retirée a-t-elle fait son temps ?
 * Passé ce délai, la garder ne sert plus qu'à ralentir Apache.
 * @returns {{age: number, plafond: number}|null}
 */
export function deciderArchivage(fiche, reglages, maintenant = new Date()) {
  if (!fiche.retrait) return null;
  if (fiche.backlink?.etat === "present") return null; // republication en vue
  const age = joursDepuis(fiche.retrait.date, maintenant);
  if (age === null) return null;
  const plafond =
    fiche.retrait.mode === "410"
      ? reglages.joursConservation410
      : reglages.joursConservation301;
  return age >= plafond ? { age, plafond } : null;
}

/**
 * Une fiche retirée dont le lien réapparaît revient en ligne — sauf si son
 * retrait résultait d'une demande explicite du dirigeant, qui prime sur tout.
 */
export function deciderRepublication(fiche) {
  return fiche.backlink?.etat === "present" && fiche.retrait?.motif !== "retrait manuel";
}

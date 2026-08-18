/**
 * Agrégats du tableau de bord privé.
 * Isolé ici pour que le gabarit reste déclaratif et que ces calculs soient
 * testables sans passer par une compilation Eleventy complète.
 */

import config from "./config.mjs";
import { joursDepuis } from "./texte.mjs";
import { ETATS } from "./fiches.mjs";

export function pilotage(fiches) {
  const liste = fiches || [];
  const lignes = liste.map((f) => ({ ...f, etat: f.backlink?.etat || "en-attente" }));
  const publiees = lignes.filter((f) => f.statut === ETATS.PUBLIEE);
  const retirees = lignes.filter((f) => f.statut === ETATS.RETIREE);

  const present = publiees.filter((f) => f.etat === "present").length;
  const enAttente = publiees.filter((f) => !f.backlink?.premiere_detection).length;
  const menacees = publiees.filter((f) =>
    ["absent", "externe", "introuvable"].includes(f.etat)
  ).length;

  // Taux de pose : part des fiches ayant, à un moment, porté le lien.
  // C'est l'indicateur qui dit si le contrat proposé aux entreprises prend.
  const aEuLeLien = lignes.filter((f) => f.backlink?.premiere_detection).length;
  const tauxConversion = lignes.length ? Math.round((aEuLeLien / lignes.length) * 100) : 0;

  const seuilRelance = Math.max(1, config.backlinks.delaiDeGraceJours - 7);
  const aRelancer = publiees
    .filter((f) => !f.backlink?.premiere_detection)
    .map((f) => ({ ...f, age: joursDepuis(f.dates?.publication) || 0 }))
    .filter((f) => f.age >= seuilRelance)
    .sort((a, b) => b.age - a.age);

  return {
    total: lignes.length,
    publiees: publiees.length,
    present,
    enAttente,
    menacees,
    retirees301: retirees.filter((f) => f.retrait?.mode === "301").length,
    retirees410: retirees.filter((f) => f.retrait?.mode === "410").length,
    jamaisVerifiees: lignes.filter((f) => !f.backlink?.derniere_verification).length,
    tauxConversion,
    aRelancer,
    lignes: lignes.sort(
      (a, b) =>
        (b.dates?.publication || "").localeCompare(a.dates?.publication || "") ||
        a.nom.localeCompare(b.nom, "fr")
    ),
  };
}

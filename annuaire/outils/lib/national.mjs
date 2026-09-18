/**
 * Exploration nationale : un maillage par département, avec curseur.
 *
 * Le mode national interrogeait chaque jour le même point (le centre du
 * chef-lieu, rayon 15 km). Or « searchNearby » rend au plus 20 établissements
 * classés par popularité, sans pagination : passé trois jours (un par lot de
 * types), il n'y avait plus rien de neuf à trouver et la collecte s'est tarie
 * — zéro fiche du 12 au 18 septembre 2026, 60 appels par jour pour rien.
 *
 * La parade est celle du mode local (voir maillage.mjs) : l'aire de chaque
 * chef-lieu est découpée en cellules parcourues du centre vers la périphérie,
 * chaque département gardant son propre curseur dans progression.json.
 * Chaque jour, quelques départements avancent d'une cellule ; les moins
 * couverts et les moins récemment explorés passent en premier, pour que
 * l'annuaire s'étende partout à la fois plutôt que de saturer une ville.
 */

import { cellules } from "./maillage.mjs";

/** Rayon d'une cellule d'exploration nationale, en mètres. */
export const MAILLE_NATIONALE_METRES = 2500;

/** Rayon exploré autour de chaque chef-lieu, en mètres. */
export const RAYON_NATIONAL_METRES = 15000;

/** Clé du curseur d'un département dans progression.json. */
export function cleProgression(departement) {
  return `departement-${departement.code}`;
}

/** Cellules d'exploration d'un département, du chef-lieu vers la périphérie. */
export function grilleDepartement(departement, reglages = {}) {
  return cellules(
    {
      libelle: departement.nom,
      latitude: departement.lat,
      longitude: departement.lng,
      rayonMetres: reglages.rayonNational || RAYON_NATIONAL_METRES,
    },
    reglages.mailleNationaleMetres || MAILLE_NATIONALE_METRES
  );
}

/** Nombre de fiches publiées par département ({ "58": 27, … }). */
export function compterParDepartement(fiches) {
  const compteur = {};
  for (const f of fiches) {
    if (f.statut !== "publiee") continue;
    const code = normaliserCode(f.adresse?.departement);
    if (code) compteur[code] = (compteur[code] || 0) + 1;
  }
  return compteur;
}

/** « 048 », « 48 » et « 48 » désignent le même département ; « 2A » reste « 2A ». */
export function normaliserCode(code) {
  const c = String(code || "").trim().toUpperCase();
  return /^\d+$/.test(c) ? String(Number(c)).padStart(2, "0") : c;
}

/**
 * Ordre de passage des départements pour la journée.
 *
 * 1. les moins couverts (nombre de fiches publiées croissant) ;
 * 2. à couverture égale, les moins récemment explorés (jamais explorés d'abord) ;
 * 3. à égalité complète, l'ordre du code, pour un résultat déterministe.
 *
 * Un département qui ne rend rien avance quand même son curseur : il finit
 * par sortir du centre-ville, et sa date d'exploration le fait céder la place
 * aux autres le lendemain.
 */
export function ordonnerDepartements(departements, compteur = {}, progression = {}) {
  const couverture = (d) => compteur[normaliserCode(d.code)] || 0;
  const derniere = (d) => progression[cleProgression(d)]?.date || "";
  return [...departements].sort(
    (a, b) =>
      couverture(a) - couverture(b) ||
      derniere(a).localeCompare(derniere(b)) ||
      a.code.localeCompare(b.code)
  );
}

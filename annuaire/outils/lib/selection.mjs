/**
 * Sélection des établissements à la collecte : ne publier que des pages que
 * quelqu'un cherchera.
 *
 * Constat du 18/10/2026 sur 154 fiches assez âgées pour avoir un verdict
 * Google : le nombre d'avis ne prédit presque pas l'indexation (15 % de
 * pages avec impressions au-dessus comme au-dessous de 50 avis), la
 * catégorie, si : 6 % pour transport-déménagement (garde-meubles,
 * déménageurs, entrepôts logistiques : personne ne les cherche par leur nom),
 * 0 % pour comptabilité-conseil, contre 28 à 50 % pour restaurants, bars,
 * garages, pharmacies, boulangeries. Les types Google « storage »,
 * « moving_company » et « corporate_office » concentrent les pages jamais
 * explorées par Google.
 *
 * Règles (config.collecte) :
 *   categoriesExclues  rubriques de l'annuaire non collectées (et retirées des
 *                      recherches Nearby : moins d'appels payants) ;
 *   typesExclus        types Google refusés même si la rubrique est admise ;
 *   avisMinimum        nombre d'avis Google minimal (proxy faible de demande).
 * Fonctions pures, sans effet de bord.
 */

import { classer } from "./categories.mjs";

export const REGLAGES_SELECTION_PAR_DEFAUT = {
  categoriesExclues: [],
  typesExclus: [],
  avisMinimum: 0,
  noteMinimale: 0,
};

/**
 * Pourquoi un lieu n'est pas une cible, ou null s'il l'est.
 * @param {object} lieu lieu normalisé (type_principal, types, categorie_gmb, note, avis)
 * @param {object} reglages config.collecte
 * @returns {string|null} motif de rejet
 */
export function motifHorsCible(lieu, reglages = {}) {
  const r = { ...REGLAGES_SELECTION_PAR_DEFAUT, ...(reglages || {}) };
  // Type PRINCIPAL seulement : Google accroche des types secondaires
  // fantaisistes (une pharmacie « consultant », une épicerie
  // « moving_company ») qui ne disent rien de l'activité.
  const typesExclus = new Set(r.typesExclus || []);
  if (lieu.type_principal && typesExclus.has(lieu.type_principal)) return `type Google exclu (${lieu.type_principal})`;
  const categorie = classer({ typePrincipal: lieu.type_principal, types: lieu.types || [], libelle: lieu.categorie_gmb });
  if (categorie && (r.categoriesExclues || []).includes(categorie)) return `rubrique exclue (${categorie})`;
  if (r.noteMinimale && (lieu.note || 0) < r.noteMinimale) return `note ${lieu.note ?? "absente"} < ${r.noteMinimale}`;
  if (r.avisMinimum && (lieu.avis || 0) < r.avisMinimum) return `${lieu.avis || 0} avis < ${r.avisMinimum}`;
  return null;
}

/** Catégories à collecter : toutes, moins les exclues, ou la liste ciblée. */
export function categoriesACollecter(categories, reglages = {}) {
  const ciblees = reglages?.categoriesCiblees || [];
  const exclues = new Set(reglages?.categoriesExclues || []);
  return categories.filter((c) => (ciblees.length ? ciblees.includes(c.slug) : true) && !exclues.has(c.slug));
}

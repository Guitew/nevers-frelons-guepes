import fs from "node:fs";
import { CATEGORIES_JSON } from "./chemins.mjs";
import { aplatir } from "./texte.mjs";

const source = JSON.parse(fs.readFileSync(CATEGORIES_JSON, "utf8"));

/** Liste des catégories du site, dans l'ordre du fichier de configuration. */
export const categories = source.categories;

const parSlug = new Map(categories.map((c) => [c.slug, c]));
const parType = new Map();
for (const c of categories) for (const t of c.gmb) parType.set(t, c.slug);

export function categorieParSlug(slug) {
  return parSlug.get(slug) || null;
}

/**
 * Rattache une fiche Google Business Profile à une catégorie du site.
 *
 * Trois passes successives, de la plus fiable à la plus tolérante :
 *   1. le type principal renvoyé par l'API (« bakery ») ;
 *   2. l'un des types secondaires ;
 *   3. les mots-clés du libellé affiché (« Boulangerie artisanale »).
 *
 * Renvoie « null » si rien ne correspond : la fiche est alors écartée de la
 * collecte plutôt que rangée dans un fourre-tout, pour éviter les pages
 * hors sujet qui diluent la pertinence du site.
 */
export function classer({ typePrincipal, types = [], libelle = "" } = {}) {
  if (typePrincipal && parType.has(typePrincipal)) return parType.get(typePrincipal);
  for (const t of types) if (parType.has(t)) return parType.get(t);

  const texte = aplatir([libelle, ...types].join(" ").replace(/_/g, " "));
  let meilleur = null;
  let meilleureLongueur = 0;
  for (const c of categories) {
    for (const mot of c.motscles) {
      if (texte.includes(aplatir(mot)) && mot.length > meilleureLongueur) {
        meilleur = c.slug;
        meilleureLongueur = mot.length;
      }
    }
  }
  return meilleur;
}

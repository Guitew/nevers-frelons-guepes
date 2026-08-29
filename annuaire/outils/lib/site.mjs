import fs from "node:fs";
import path from "node:path";
import { DONNEES } from "./chemins.mjs";

const brut = JSON.parse(fs.readFileSync(path.join(DONNEES, "site.json"), "utf8"));

/** Préfixe de chemin, normalisé : « /vitrine-locale » ou « » à la racine. */
const chemin = (brut.chemin || "").replace(/\/+$/, "");

/**
 * Identité du site, partagée par Eleventy (src/_data/site.js) et les outils.
 *
 * Le site est publié dans un SOUS-DOSSIER du domaine, pas à sa racine. Deux
 * valeurs cohabitent donc, et les confondre casse les canoniques comme la
 * détection des backlinks :
 *
 *   url    = https://andpro.fr                  ← le domaine seul
 *   base   = https://andpro.fr/vitrine-locale   ← la racine réelle du site
 *
 * Toute URL publique se construit avec « base ». « url » ne sert qu'aux
 * ressources qui vivent obligatoirement à la racine du domaine (robots.txt).
 */
export const site = {
  ...brut,
  chemin,
  base: brut.url.replace(/\/+$/, "") + chemin,
  /** Préfixe utilisable comme pathPrefix Eleventy (toujours barres encadrantes). */
  prefixe: chemin ? `${chemin}/` : "/",
};

/** Normalise une URL pour comparaison (protocole, www et barre finale ignorés). */
export function normaliserUrl(url) {
  if (!url) return "";
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/** L'URL pointe-t-elle vers la page de cette fiche sur notre site ? */
export function estNotreUrl(url, cheminFiche) {
  const attendu = normaliserUrl(site.base + cheminFiche);
  const candidat = normaliserUrl(url);
  return candidat === attendu;
}

/**
 * L'URL appartient-elle à notre site ?
 * Le sous-dossier compte : andpro.fr/autre-chose n'est pas notre annuaire, et
 * une entreprise qui y renverrait ne nous aurait pas posé de backlink.
 */
export function estNotreDomaine(url) {
  const racine = normaliserUrl(site.base);
  const candidat = normaliserUrl(url);
  return candidat === racine || candidat.startsWith(racine + "/");
}

export default site;

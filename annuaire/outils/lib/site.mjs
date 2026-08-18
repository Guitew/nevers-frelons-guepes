import fs from "node:fs";
import path from "node:path";
import { DONNEES } from "./chemins.mjs";

/** Identité du site, partagée par Eleventy (src/_data/site.js) et les outils. */
export const site = JSON.parse(fs.readFileSync(path.join(DONNEES, "site.json"), "utf8"));

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
  const attendu = normaliserUrl(site.url + cheminFiche);
  const candidat = normaliserUrl(url);
  return candidat === attendu;
}

/** L'URL appartient-elle à notre domaine (mais peut-être à une autre page) ? */
export function estNotreDomaine(url) {
  const domaine = normaliserUrl(site.url);
  const candidat = normaliserUrl(url);
  return candidat === domaine || candidat.startsWith(domaine + "/");
}

export default site;

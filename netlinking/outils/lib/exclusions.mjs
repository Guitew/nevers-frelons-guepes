/** Domaines exclus par l'humain (donnees/exclusions.txt) : jamais explorés ni rapportés. */

import fs from "node:fs";
import { appartientA } from "./url.mjs";

export function lireExclusions(chemin) {
  if (!fs.existsSync(chemin)) return [];
  return fs
    .readFileSync(chemin, "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

export function ajouterExclusion(chemin, domaine, motif = "") {
  const d = String(domaine || "").trim().toLowerCase().replace(/^www\./, "");
  if (!d) return false;
  const existantes = lireExclusions(chemin);
  if (existantes.includes(d)) return false;
  const entete = fs.existsSync(chemin) ? "" : "# Domaines à ne jamais explorer ni proposer (un par ligne, sans www). Commentaires après « # ».\n";
  fs.appendFileSync(chemin, `${entete}${d}${motif ? `  # ${motif}` : ""}\n`, "utf8");
  return true;
}

/** L'URL tombe-t-elle sous une exclusion (humaine ou de configuration) ? */
export function estExclue(url, exclusions, config) {
  return appartientA(url, exclusions) || appartientA(url, config?.exploration?.domainesIgnores || []) || appartientA(url, config?.site?.domaines || []);
}

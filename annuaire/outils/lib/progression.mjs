import fs from "node:fs";
import path from "node:path";
import { DONNEES } from "./chemins.mjs";

const FICHIER = path.join(DONNEES, "progression.json");

/**
 * Curseurs d'exploration, une entrée par zone.
 * Versionné dans Git au même titre que les fiches : c'est ce qui garantit
 * qu'une exécution reprend là où la précédente s'est arrêtée, y compris après
 * un changement de machine ou une exécution en intégration continue.
 */
export function lireProgression() {
  if (!fs.existsSync(FICHIER)) return {};
  try {
    return JSON.parse(fs.readFileSync(FICHIER, "utf8"));
  } catch {
    return {};
  }
}

export function ecrireProgression(progression) {
  fs.writeFileSync(FICHIER, JSON.stringify(progression, null, 2) + "\n", "utf8");
}

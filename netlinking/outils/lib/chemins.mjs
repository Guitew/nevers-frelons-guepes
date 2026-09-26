import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));

/** Racine du projet « netlinking » (dossier contenant package.json). */
export const RACINE = path.resolve(ici, "..", "..");

export const CONFIG_JSON = path.join(RACINE, "config.json");

/**
 * Dossier des données. La variable NETLINKING_DONNEES permet de travailler
 * sur un autre dossier (tests, essais) sans toucher aux données versionnées.
 */
export const DONNEES = process.env.NETLINKING_DONNEES || path.join(RACINE, "donnees");

/** Chemins des fichiers de données pour un dossier donné (par défaut DONNEES). */
export function fichiers(dossier = DONNEES) {
  return {
    dossier,
    spots: path.join(dossier, "spots.json"),
    exploration: path.join(dossier, "exploration.json"),
    cibles: path.join(dossier, "cibles.json"),
    graines: path.join(dossier, "graines.txt"),
    requetes: path.join(dossier, "requetes.txt"),
    exclusions: path.join(dossier, "exclusions.txt"),
    rapportCsv: path.join(dossier, "rapport.csv"),
    rapportMd: path.join(dossier, "rapport.md"),
  };
}

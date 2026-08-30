import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));

/** Racine du projet « annuaire » (dossier contenant package.json). */
export const RACINE = path.resolve(ici, "..", "..");

export const DONNEES = path.join(RACINE, "donnees");
export const FICHES = path.join(DONNEES, "fiches");
export const CATEGORIES_JSON = path.join(DONNEES, "categories.json");
export const JOURNAL_JSON = path.join(DONNEES, "journal.json");
export const CONFIG_JSON = path.join(RACINE, "config.json");
export const SRC = path.join(RACINE, "src");

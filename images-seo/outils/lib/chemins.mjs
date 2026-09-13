import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));

/** Racine du projet images-seo (le dossier contenant package.json). */
export const RACINE = path.resolve(ICI, "..", "..");
export const CONFIG_JSON = path.join(RACINE, "config.json");
export const DONNEES = path.join(RACINE, "donnees");
export const SITE_JSON = path.join(DONNEES, "site.json");
export const PAGES_JSON = path.join(DONNEES, "pages.json");

/**
 * Bac à sable : si IMAGES_SEO_BAC_A_SABLE désigne un dossier, tout ce qui est ÉCRIT par un
 * cycle (file d'attente, journal, dépôt, travail, sortie) y est redirigé. L'inventaire, la
 * configuration et le site restent lus depuis le projet. Sert aux tests et au contrôle.
 */
const BAC = process.env.IMAGES_SEO_BAC_A_SABLE ? path.resolve(process.env.IMAGES_SEO_BAC_A_SABLE) : null;
const ecrit = (nomProjet, nomBac) => (BAC ? path.join(BAC, nomBac) : nomProjet);
export const FILE_ATTENTE_JSON = ecrit(path.join(DONNEES, "file-attente.json"), "file-attente.json");
export const JOURNAL_JSON = ecrit(path.join(DONNEES, "journal.json"), "journal.json");
export const DEPOT = ecrit(path.join(DONNEES, "depot"), "depot");
export const TRAVAIL = ecrit(path.join(RACINE, "travail"), "travail");
export const SORTIE = ecrit(path.join(RACINE, "sortie"), "sortie");
export const SITEMAP_IMAGES = path.join(SORTIE, "sitemap-images.xml");

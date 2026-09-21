import fs from "node:fs";
import { CONFIG_JSON } from "./chemins.mjs";

const brut = JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8"));

/** Configuration métier (config.json), complétée par l'environnement. */
export const config = {
  ...brut,
  secrets: {
    googlePlaces: process.env.GOOGLE_PLACES_API_KEY || "",
    indexnow: process.env.INDEXNOW_KEY || "",
    googleIndexing: process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT || "",
    // Le même compte de service peut servir aux deux API : repli sur l'autre.
    googleSearchConsole:
      process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT || process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT || "",
    // Jeton d'accès émis par Workload Identity Federation (GitHub Actions) :
    // pas de clé à stocker. Prioritaire sur les comptes de service ci-dessus.
    googleAccessToken: process.env.GOOGLE_ACCESS_TOKEN || "",
  },
};

export default config;

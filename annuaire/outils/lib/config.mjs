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
  },
};

export default config;

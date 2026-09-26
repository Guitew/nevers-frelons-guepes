import fs from "node:fs";
import { CONFIG_JSON } from "./chemins.mjs";

/** Lit config.json et le complète avec les secrets de l'environnement. */
export function chargerConfig(chemin = CONFIG_JSON) {
  const brut = JSON.parse(fs.readFileSync(chemin, "utf8"));
  return completerConfig(brut);
}

/** Ajoute les secrets (variables d'environnement) à une configuration. */
export function completerConfig(brut) {
  return {
    ...brut,
    secrets: {
      brave: process.env.BRAVE_API_KEY || "",
      serper: process.env.SERPER_API_KEY || "",
      googleCseCle: process.env.GOOGLE_CSE_KEY || "",
      googleCseCx: process.env.GOOGLE_CSE_CX || "",
    },
  };
}

export const config = chargerConfig();
export default config;

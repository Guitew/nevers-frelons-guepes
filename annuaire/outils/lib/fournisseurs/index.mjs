import * as googlePlaces from "./google-places.mjs";
import * as csv from "./csv.mjs";
import * as simulation from "./simulation.mjs";

const FOURNISSEURS = { "google-places": googlePlaces, csv, simulation };

/**
 * Renvoie le fournisseur de données demandé.
 * Ajouter un fournisseur tiers (Outscraper, SerpApi, base interne…) revient à
 * déposer un module exposant « rechercher », « detailler » et « normaliser ».
 */
export function fournisseur(nom) {
  const f = FOURNISSEURS[nom];
  if (!f) {
    throw new Error(
      `Fournisseur inconnu : « ${nom} ». Valeurs possibles : ${Object.keys(FOURNISSEURS).join(", ")}.`
    );
  }
  return f;
}

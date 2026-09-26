/**
 * Moteurs de recherche interrogeables par API. Chacun expose
 *   chercher(requete, { nombre, pays, langue }) → [{ url, titre, extrait }]
 *
 * Microsoft a fermé les API Bing Search en août 2025 : pour « voir Bing »,
 * il n'existe plus d'accès programmatique officiel bon marché. Serper (Google)
 * et Brave couvrent le besoin ; Google Programmable Search reste gratuit à
 * petite dose (100 requêtes par jour).
 */

import { brave } from "./brave.mjs";
import { serper } from "./serper.mjs";
import { googleCse } from "./google-cse.mjs";

const FABRIQUES = { brave, serper, "google-cse": googleCse };

/** Moteurs dont la clé est présente. */
export function moteursDisponibles(config) {
  const s = config.secrets || {};
  const liste = [];
  if (s.serper) liste.push("serper");
  if (s.brave) liste.push("brave");
  if (s.googleCseCle && s.googleCseCx) liste.push("google-cse");
  return liste;
}

/** Instancie le moteur demandé (« auto » = premier disponible). */
export function moteur(nom, config, fetchFn = globalThis.fetch) {
  const disponibles = moteursDisponibles(config);
  const choisi = !nom || nom === "auto" ? disponibles[0] : nom;
  if (!choisi) return null;
  const fabrique = FABRIQUES[choisi];
  if (!fabrique) throw new Error(`Moteur inconnu : ${choisi} (attendu : ${Object.keys(FABRIQUES).join(", ")})`);
  if (!disponibles.includes(choisi)) throw new Error(`Moteur ${choisi} : clé d'API absente (voir .env.exemple).`);
  return fabrique(config, fetchFn);
}

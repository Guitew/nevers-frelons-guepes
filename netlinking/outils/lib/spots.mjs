/**
 * Mémoire des spots (donnees/spots.json), versionnée dans Git : chaque
 * exécution enrichit le fichier, un humain marque ce qu'il a traité
 * (outils/marquer.mjs) et le diff raconte l'histoire.
 */

import fs from "node:fs";
import path from "node:path";
import { LIBELLES } from "./detection.mjs";

export const ETATS = Object.freeze({ A_TRAITER: "a-traiter", FAIT: "fait", REJETE: "rejete", EN_COURS: "en-cours" });

export function lireSpots(chemin) {
  if (!fs.existsSync(chemin)) return [];
  try {
    const donnees = JSON.parse(fs.readFileSync(chemin, "utf8"));
    return Array.isArray(donnees) ? donnees : donnees.spots || [];
  } catch {
    return [];
  }
}

export function ecrireSpots(chemin, spots) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  const tries = [...spots].sort((a, b) => (b.scores?.priorite || 0) - (a.scores?.priorite || 0) || a.url.localeCompare(b.url));
  fs.writeFileSync(chemin, JSON.stringify(tries, null, 2) + "\n", "utf8");
}

/** Index par URL. */
export function indexer(spots) {
  return new Map(spots.map((s) => [s.url, s]));
}

/**
 * Fusionne un spot fraîchement détecté avec sa version antérieure : l'état,
 * la note, l'origine et la date de découverte appartiennent à l'humain et au
 * passé ; tout le reste est rafraîchi.
 */
export function fusionner(ancien, nouveau) {
  if (!ancien) return { ...nouveau, etat: nouveau.etat || ETATS.A_TRAITER, note: nouveau.note || "" };
  return {
    ...nouveau,
    decouverte: ancien.decouverte || nouveau.decouverte,
    origine: ancien.origine || nouveau.origine,
    etat: ancien.etat || ETATS.A_TRAITER,
    note: ancien.note || "",
    indexee: ancien.indexee && ancien.indexee !== "inconnu" ? ancien.indexee : nouveau.indexee || "inconnu",
    indexeeDate: ancien.indexeeDate || nouveau.indexeeDate,
    indexeeMoteur: ancien.indexeeMoteur || nouveau.indexeeMoteur,
    visites: (ancien.visites || 1) + 1,
  };
}

/** Libellé lisible d'un type. */
export function libelleType(type) {
  return LIBELLES[type] || type || "";
}

/** Résumé chiffré d'une liste de spots. */
export function resumer(spots) {
  const parType = {};
  const parEtat = {};
  const domaines = new Set();
  for (const s of spots) {
    parType[s.type] = (parType[s.type] || 0) + 1;
    parEtat[s.etat || ETATS.A_TRAITER] = (parEtat[s.etat || ETATS.A_TRAITER] || 0) + 1;
    domaines.add(s.domaine);
  }
  return { total: spots.length, parType, parEtat, domaines: domaines.size };
}

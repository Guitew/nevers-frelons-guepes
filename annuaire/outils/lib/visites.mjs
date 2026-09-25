/**
 * Mesure d'audience propre (visites.php) : lecture et agrégation.
 *
 * Le fichier JSON du serveur compte, par page et par jour, les visites (t)
 * et celles venues de Google (g). Ces fonctions en tirent, sur une fenêtre
 * donnée, le total par page — c'est ce qui alimente les fiches quand la
 * Search Console n'est pas branchée.
 */

import { joursDepuis } from "./texte.mjs";

/** Le visiteur vient-il de Google (recherche, Maps, fiche d'établissement) ? */
export function estGoogle(referrer) {
  return /^https?:\/\/([a-z0-9-]+\.)*google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})(?:\/|$)/i.test(String(referrer || ""));
}

/**
 * Agrège le relevé sur les N derniers jours.
 * @returns {{ depuis: string|null, joursMesure: number|null, pages: Map<string, {total:number, google:number}> }}
 */
export function agreger(releve, fenetreJours, maintenant = new Date()) {
  const pages = new Map();
  const depuis = releve?.depuis || null;
  const joursMesure = depuis ? joursDepuis(depuis, maintenant) : null;
  const limite = new Date(maintenant);
  limite.setUTCDate(limite.getUTCDate() - (fenetreJours - 1));
  const seuil = limite.toISOString().slice(0, 10);
  for (const [chemin, jours] of Object.entries(releve?.pages || {})) {
    let total = 0;
    let google = 0;
    for (const [jour, c] of Object.entries(jours || {})) {
      if (jour < seuil) continue;
      total += Number(c?.t) || 0;
      google += Number(c?.g) || 0;
    }
    pages.set(chemin, { total, google });
  }
  return { depuis, joursMesure, pages };
}

/** Jeton partagé avec visites.php (le fichier est public, comme suggerer.php). */
export const VISITES_TOKEN = "VL-v7q2x9m4";

/** Télécharge le relevé depuis le site. Renvoie null si indisponible. */
export async function releverVisites(base, fetchImpl = fetch) {
  try {
    const reponse = await fetchImpl(`${base}/visites.php?action=liste&t=${VISITES_TOKEN}`, { cache: "no-store" });
    if (!reponse.ok) return null;
    return await reponse.json();
  } catch {
    return null;
  }
}

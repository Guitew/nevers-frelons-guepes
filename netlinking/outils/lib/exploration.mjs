/**
 * État de l'exploration (donnees/exploration.json) : URLs vues, frontière
 * (URLs à visiter, avec priorité), compteurs par hôte, requêtes déjà lancées.
 *
 * La frontière est une file de priorité : les pages qui ressemblent à des
 * spots (formulaire, forum, annuaire, livre d'or, inscription…) passent
 * devant, un hôte déjà beaucoup visité recule, et les hôtes s'alternent pour
 * ne jamais marteler un même site.
 */

import fs from "node:fs";
import path from "node:path";
import { joursDepuis } from "./texte.mjs";
import { estBinaire, hoteDe, normaliserUrl, profondeurChemin } from "./url.mjs";

export function creerExploration() {
  return { version: 1, vues: {}, frontiere: [], hotes: {}, requetes: {} };
}

export function lireExploration(chemin) {
  if (!fs.existsSync(chemin)) return creerExploration();
  try {
    const e = JSON.parse(fs.readFileSync(chemin, "utf8"));
    return { ...creerExploration(), ...e };
  } catch {
    return creerExploration();
  }
}

export function ecrireExploration(chemin, etat) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  const copie = { ...etat, frontiere: [...etat.frontiere].sort((a, b) => b.priorite - a.priorite) };
  fs.writeFileSync(chemin, JSON.stringify(copie, null, 1) + "\n", "utf8");
}

/** Motifs d'URL qui sentent le spot : bonus de priorité. */
const MOTIFS_PRIORITAIRES = [
  [/livre-?d-?or|livredor|guestbook/i, 40],
  [/\/(ajouter|proposer|soumettre|submit|add|referencer|inscription|inscrire|register|signup|sign-up)(-|_|\/|\.|$)/i, 32],
  [/annuaire|directory|repertoire|listing/i, 22],
  [/forum|viewtopic|showthread|\/topic\/|\/threads?\//i, 20],
  [/comment|commentaire|#respond|respond/i, 18],
  [/\/(liens|links|partenaires|partners|sites-amis|blogroll|ressources)(\/|\.|$)/i, 18],
  [/question|reponse|faq|avis|temoignage|review/i, 12],
  [/contact|ecrire|contribuer|article-invite|guest/i, 10],
  [/blog|actualite|actu|article|news|\/20\d\d\//i, 8],
  [/\/(tag|tags|category|categorie|page|auteur|author|feed|rss|wp-json|xmlrpc|wp-login|wp-admin|cart|panier|checkout|compte|account|mon-compte|login|logout|deconnexion|search|recherche|\?s=|print|imprimer|pdf|calendar|agenda\/\d)/i, -25],
  [/\?(replytocom|share|lang|orderby|sort|filter|page=\d{3,})/i, -20],
];

/** Priorité d'un lien à explorer. */
export function prioriteLien({ url, texte = "", origine, profondeur = 0, pertinent = false, hote, etat, config }) {
  let p = origine === "graine" ? 100 : origine === "requete" ? 90 : origine === "utile" ? 85 : origine === "relais" ? 80 : origine === "lien-externe" ? 55 : 45;
  const cible = url + " " + texte;
  for (const [re, bonus] of MOTIFS_PRIORITAIRES) if (re.test(cible)) p += bonus;
  if (pertinent) p += 12;
  p -= profondeur * 6;
  p -= Math.min(profondeurChemin(url), 6) * 1.5;
  const pagesHote = etat?.hotes?.[hote]?.pages || 0;
  p -= Math.min(pagesHote, config?.exploration?.pagesParHote || 25) * 1.2;
  return Math.round(p);
}

/** L'URL a-t-elle été vue récemment (moins de revisiteJours) ? */
export function dejaVue(etat, url, config) {
  const v = etat.vues[url];
  if (!v) return false;
  const jours = config?.exploration?.revisiteJours ?? 90;
  return joursDepuis(v.date) < jours;
}

/** Index en mémoire de la frontière (reconstruit à la demande). */
function indexFrontiere(etat) {
  if (!etat._index || etat._index.taille !== etat.frontiere.length) {
    const ensemble = new Set(etat.frontiere.map((e) => e.url));
    etat._index = { ensemble, taille: etat.frontiere.length };
    Object.defineProperty(etat, "_index", { enumerable: false, writable: true, value: etat._index });
  }
  return etat._index.ensemble;
}

/** Ajoute une URL à la frontière si elle est nouvelle et admissible. */
export function ajouterFrontiere(etat, entree, config) {
  const url = normaliserUrl(entree.url);
  if (!url || estBinaire(url)) return false;
  if (dejaVue(etat, url, config)) return false;
  const index = indexFrontiere(etat);
  if (index.has(url)) return false;
  const hote = hoteDe(url);
  const max = config?.exploration?.pagesParHote ?? 25;
  const h = etat.hotes[hote];
  if (h && (h.pages >= max || h.bloque) && entree.origine !== "graine" && entree.origine !== "utile") return false;
  const e = {
    url,
    hote,
    origine: entree.origine || "lien-interne",
    detail: entree.detail ? String(entree.detail).slice(0, 200) : "",
    profondeur: entree.profondeur || 0,
    priorite: entree.priorite ?? prioriteLien({ url, texte: entree.texte, origine: entree.origine, profondeur: entree.profondeur, pertinent: entree.pertinent, hote, etat, config }),
    ajout: new Date().toISOString().slice(0, 10),
  };
  etat.frontiere.push(e);
  index.add(url);
  etat._index.taille = etat.frontiere.length;
  return true;
}

/**
 * Retire et renvoie la prochaine entrée à visiter : la plus prioritaire dont
 * l'hôte n'est pas déjà en cours de visite, ni saturé.
 */
export function prochaine(etat, { hotesOccupes = new Set(), config } = {}) {
  const max = config?.exploration?.pagesParHote ?? 25;
  let meilleurIndice = -1;
  let meilleure = null;
  for (let i = 0; i < etat.frontiere.length; i++) {
    const e = etat.frontiere[i];
    const h = etat.hotes[e.hote];
    if (h && (hoteBloque(h, config) || (h.pages >= max && e.origine !== "graine" && e.origine !== "utile"))) {
      etat.frontiere.splice(i, 1);
      i--;
      continue;
    }
    if (hotesOccupes.has(e.hote)) continue;
    if (!meilleure || e.priorite > meilleure.priorite) {
      meilleure = e;
      meilleurIndice = i;
    }
  }
  if (meilleurIndice === -1) return null;
  etat.frontiere.splice(meilleurIndice, 1);
  if (etat._index) {
    etat._index.ensemble.delete(meilleure.url);
    etat._index.taille = etat.frontiere.length;
  }
  return meilleure;
}

/** Enregistre une visite (réussie ou non). */
export function marquerVue(etat, url, info = {}) {
  etat.vues[url] = { date: new Date().toISOString().slice(0, 10), statut: info.statut ?? 0, ...(info.type ? { type: info.type } : {}), ...(info.erreur ? { erreur: String(info.erreur).slice(0, 120) } : {}) };
  const hote = hoteDe(url);
  const h = (etat.hotes[hote] = etat.hotes[hote] || { pages: 0, spots: 0 });
  h.pages += 1;
  h.derniere = etat.vues[url].date;
  if (info.spot) h.spots = (h.spots || 0) + 1;
  if (info.bloque) {
    h.bloque = true;
    h.bloqueLe = etat.vues[url].date;
  }
}

/** Un hôte bloqué (robots.txt injoignable, hôte muet) est retenté après revisiteJours. */
export function hoteBloque(h, config) {
  if (!h?.bloque) return false;
  return joursDepuis(h.bloqueLe) < (config?.exploration?.revisiteJours ?? 90);
}

/** Élague : frontière plafonnée, visites trop anciennes oubliées. */
export function elaguer(etat, config) {
  const max = config?.exploration?.frontiereMax ?? 5000;
  if (etat.frontiere.length > max) {
    etat.frontiere.sort((a, b) => b.priorite - a.priorite);
    etat.frontiere.length = max;
    etat._index = undefined;
  }
  const limite = (config?.exploration?.revisiteJours ?? 90) * 4;
  for (const [url, v] of Object.entries(etat.vues)) if (joursDepuis(v.date) > limite) delete etat.vues[url];
  return etat;
}

/** Statistiques de l'état. */
export function statistiques(etat) {
  const hotes = Object.keys(etat.hotes).length;
  return { vues: Object.keys(etat.vues).length, frontiere: etat.frontiere.length, hotes, requetes: Object.keys(etat.requetes || {}).length };
}

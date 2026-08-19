import fs from "node:fs";
import path from "node:path";
import { FICHES } from "./chemins.mjs";
import { slugifier } from "./texte.mjs";

/**
 * États possibles d'une fiche.
 *
 * publiee  → une page est compilée pour elle.
 * retiree  → pas de page, mais une règle 301 ou 410 dans le .htaccess.
 * archivee → la règle a fait son office et a été purgée ; l'URL retombe en
 *            404 naturel. La fiche reste sur le disque pour mémoire, mais
 *            ne produit plus ni page ni règle.
 * brouillon→ collectée, non publiée.
 */
export const ETATS = {
  PUBLIEE: "publiee",
  RETIREE: "retiree",
  ARCHIVEE: "archivee",
  BROUILLON: "brouillon",
};

/** Chemin du fichier JSON d'une fiche : donnees/fiches/<ville>/<slug>.json */
export function cheminFiche(fiche) {
  return path.join(FICHES, fiche.ville_slug, `${fiche.slug}.json`);
}

/** URL publique d'une fiche : /<categorie>/<ville>/<entreprise>/ */
export function urlFiche(fiche) {
  return `/${fiche.categorie}/${fiche.ville_slug}/${fiche.slug}/`;
}

/** URL de la page catégorie (cible des redirections 301). */
export function urlCategorie(slug) {
  return `/${slug}/`;
}

/** Lit toutes les fiches présentes sur le disque. */
export function lireFiches() {
  if (!fs.existsSync(FICHES)) return [];
  const fichiers = [];
  for (const ville of fs.readdirSync(FICHES)) {
    const dossier = path.join(FICHES, ville);
    if (!fs.statSync(dossier).isDirectory()) continue;
    for (const f of fs.readdirSync(dossier)) {
      if (f.endsWith(".json")) fichiers.push(path.join(dossier, f));
    }
  }
  return fichiers
    .map((f) => JSON.parse(fs.readFileSync(f, "utf8")))
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
}

/** Écrit (ou réécrit) une fiche sur le disque. */
export function ecrireFiche(fiche) {
  const cible = cheminFiche(fiche);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, JSON.stringify(fiche, null, 2) + "\n", "utf8");
  return cible;
}

/**
 * Trouve un identifiant d'URL libre pour une entreprise donnée dans une ville.
 * En cas d'homonymie (deux « Le Bistrot » à Nevers), un suffixe numérique est
 * ajouté — jamais l'identifiant Google, illisible et instable en référencement.
 */
export function slugDisponible(nom, villeSlug, occupes) {
  const base = slugifier(nom) || "entreprise";
  if (!occupes.has(`${villeSlug}/${base}`)) return base;
  for (let i = 2; i < 100; i++) {
    if (!occupes.has(`${villeSlug}/${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/** Index des identifiants Google déjà collectés (évite les doublons). */
export function indexExistant(fiches = lireFiches()) {
  return {
    parId: new Map(fiches.map((f) => [f.id, f])),
    slugsOccupes: new Set(fiches.map((f) => `${f.ville_slug}/${f.slug}`)),
  };
}

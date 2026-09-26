/**
 * Cibles : les pages à pousser.
 *   • pages   : URLs d'allo-frelons.fr (sitemap), avec leurs mots-clés (déduits du slug
 *               et du titre) pour choisir la page la plus proche du thème d'un spot ;
 *   • relais  : pages tierces qui font DÉJÀ un lien vers allo-frelons.fr (niveau 2),
 *               découvertes par l'exploration, importées d'un export Search Console
 *               ou déclarées à la main. Les pousser renforce les liens existants.
 */

import fs from "node:fs";
import path from "node:path";
import { motsSignificatifs } from "./texte.mjs";
import { jetonsNumeros } from "./departements.mjs";
import { domaineDe, normaliserUrl } from "./url.mjs";

export function creerCibles(config) {
  return { principal: config?.site?.url || "", pages: [], relais: [] };
}

export function lireCibles(chemin, config) {
  if (!fs.existsSync(chemin)) return creerCibles(config);
  try {
    const c = JSON.parse(fs.readFileSync(chemin, "utf8"));
    return { ...creerCibles(config), ...c, pages: c.pages || [], relais: c.relais || [] };
  } catch {
    return creerCibles(config);
  }
}

export function ecrireCibles(chemin, cibles) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, JSON.stringify(cibles, null, 2) + "\n", "utf8");
}

/** Mots-clés d'une page cible à partir de son URL (slug) et de son titre. */
export function motsClesPage(url, titre = "") {
  let slug = "";
  try {
    slug = new URL(url).pathname;
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* encodage invalide : on garde le chemin brut */
    }
    slug = slug.replace(/[-_/.+%]+/g, " ");
  } catch {
    slug = "";
  }
  // Mots du slug seulement (le titre, plus bavard, diluerait la correspondance) ; les numéros de
  // département deviennent des jetons « dep59 » : c'est ce qui rapproche un spot local de la page
  // locale du site. Une page sans slug (accueil) garde les mots de son titre.
  const base = slug.trim() ? slug : titre;
  return [...new Set([...motsSignificatifs(base, 40), ...jetonsNumeros(base)])];
}

/** Ajoute ou met à jour une page cible. */
export function ajouterPage(cibles, url, { titre = "", principale = false } = {}) {
  const u = normaliserUrl(url);
  if (!u) return null;
  let p = cibles.pages.find((x) => x.url === u);
  if (!p) {
    p = { url: u, titre: "", motsCles: [] };
    cibles.pages.push(p);
  }
  if (titre) p.titre = titre;
  if (principale) p.principale = true;
  p.motsCles = motsClesPage(u, p.titre);
  return p;
}

/** Enregistre (ou rafraîchit) une page relais. */
export function enregistrerRelais(cibles, relais, { source = "exploration" } = {}) {
  const u = normaliserUrl(relais.url);
  if (!u) return null;
  let r = cibles.relais.find((x) => x.url === u);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (!r) {
    r = { url: u, domaine: domaineDe(u), decouverte: aujourdhui, source };
    cibles.relais.push(r);
  }
  if (relais.titre) r.titre = relais.titre;
  if (relais.liens) {
    r.liens = relais.liens.slice(0, 5).map((l) => ({ href: l.href, ancre: l.ancre, nofollow: Boolean(l.nofollow), ugc: Boolean(l.ugc) }));
    r.nofollow = relais.liens.every((l) => l.nofollow);
    r.etat = "present";
    r.derniereVerification = aujourdhui;
  } else if (!r.etat) {
    r.etat = "a-verifier";
  }
  r.motsCles = motsClesPage(u, r.titre || "");
  return r;
}

/** Marque un relais comme n'ayant plus de lien (ou introuvable). */
export function relaisAbsent(cibles, url, motif = "lien absent") {
  const r = cibles.relais.find((x) => x.url === normaliserUrl(url));
  if (!r) return null;
  r.etat = "absent";
  r.motif = motif;
  r.derniereVerification = new Date().toISOString().slice(0, 10);
  return r;
}

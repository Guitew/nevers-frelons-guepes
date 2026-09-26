/**
 * Requêtes d'empreinte (« footprints ») : combinaisons de thèmes, de zones et
 * de morceaux caractéristiques des spots (« laisser un commentaire »,
 * « livre d'or », annuaire « ajouter un site »…). Les résultats de ces
 * requêtes alimentent la frontière d'exploration.
 */

import fs from "node:fs";
import { joursDepuis } from "./texte.mjs";

/** Génère la liste des requêtes à partir de la configuration. */
export function genererRequetes(config, { max = 400 } = {}) {
  const e = config.empreintes || {};
  const principaux = (config.themes?.principaux || []).slice(0, 8);
  const zones = (config.zones?.liste || []).slice(0, 8);
  const requetes = [];
  const ajouter = (r) => {
    const n = r.replace(/\s+/g, " ").trim();
    if (n && !requetes.includes(n)) requetes.push(n);
  };

  // 1. Marque : mentions et liens existants (relais et mentions sans lien).
  for (const m of e.marque || []) ajouter(m);
  for (const m of (e.marque || []).slice(0, 2)) ajouter(`${m} -site:${(config.site?.domaines || [])[0] || ""}`.replace(/-site:$/, ""));

  // 2. Listes de prestataires : très ciblées, d'abord avec les zones.
  for (const l of e.listes || []) {
    ajouter(l);
    for (const z of zones.slice(0, 4)) ajouter(`${l} ${z}`);
  }

  // 3. Thème × type de spot.
  const familles = [e.commentaires, e.forums, e.livresDor, e.questions, e.avis, e.invites];
  for (const t of principaux) {
    for (const famille of familles) for (const f of famille || []) ajouter(`${t} ${f}`);
  }

  // 4. Annuaires : par thème et par zone.
  for (const a of e.annuaires || []) {
    ajouter(a);
    for (const t of principaux.slice(0, 3)) ajouter(`${a} ${t}`);
    for (const z of zones.slice(0, 6)) ajouter(`${a} ${z}`);
  }

  // 5. Zone × thème × forum / blog.
  for (const z of zones) {
    for (const t of principaux.slice(0, 3)) {
      ajouter(`${t} ${z} forum`);
      ajouter(`${t} ${z} blog`);
    }
  }
  return requetes.slice(0, max);
}

/** Requêtes du fichier (lignes non vides, sans commentaires « # »), ou celles générées. */
export function lireRequetes(chemin, config) {
  if (fs.existsSync(chemin)) {
    const lignes = fs
      .readFileSync(chemin, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    if (lignes.length) return { requetes: [...new Set(lignes)], source: "fichier" };
  }
  return { requetes: genererRequetes(config), source: "generation" };
}

/** Requêtes jamais lancées ou trop anciennes, dans l'ordre du fichier, plafonnées. */
export function requetesAFaire(etat, requetes, config, max) {
  const fraicheur = config.moteurs?.fraicheurJours ?? 30;
  const historique = etat.requetes || {};
  const candidates = requetes.filter((r) => {
    const h = historique[r];
    return !h || joursDepuis(h.date) >= fraicheur;
  });
  candidates.sort((a, b) => {
    const da = historique[a]?.date || "";
    const db = historique[b]?.date || "";
    return da.localeCompare(db); // jamais lancées (« ») d'abord, puis les plus anciennes
  });
  return candidates.slice(0, max);
}

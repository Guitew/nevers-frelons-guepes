import fs from "node:fs";
import { JOURNAL_JSON } from "./chemins.mjs";

const MAXIMUM = 5000;

/** Lit le journal des événements (publication, backlink, retrait, indexation). */
export function lireJournal() {
  if (!fs.existsSync(JOURNAL_JSON)) return [];
  try {
    return JSON.parse(fs.readFileSync(JOURNAL_JSON, "utf8"));
  } catch {
    return [];
  }
}

/** Ajoute des événements au journal (les plus récents en tête). */
export function consigner(evenements) {
  const liste = Array.isArray(evenements) ? evenements : [evenements];
  if (!liste.length) return;
  const journal = [...liste, ...lireJournal()].slice(0, MAXIMUM);
  fs.writeFileSync(JOURNAL_JSON, JSON.stringify(journal, null, 2) + "\n", "utf8");
}

/** Construit un événement daté. */
export function evenement(type, fiche, detail = {}) {
  return {
    date: new Date().toISOString(),
    type,
    id: fiche?.id || null,
    nom: fiche?.nom || null,
    url: fiche ? `/${fiche.categorie}/${fiche.ville_slug}/${fiche.slug}/` : null,
    ...detail,
  };
}

import { JOURNAL_JSON } from "./chemins.mjs";
import { lireJson, ecrireJson } from "./config.mjs";

const MAXIMUM = 5000;

export function lireJournal() {
  return lireJson(JOURNAL_JSON, []) || [];
}

/** Ajoute des événements (les plus récents en tête). */
export function consigner(evenements) {
  const liste = Array.isArray(evenements) ? evenements : [evenements];
  if (!liste.length) return;
  ecrireJson(JOURNAL_JSON, [...liste, ...lireJournal()].slice(0, MAXIMUM));
}

export function evenement(type, element, detail = {}) {
  return {
    date: new Date().toISOString(),
    type,
    id: element?.id || null,
    page: element?.page || element?.page_id || null,
    ...detail,
  };
}

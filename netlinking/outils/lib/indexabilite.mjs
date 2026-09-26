/**
 * Un spot ne vaut que si la page qui portera le lien ou la citation peut être
 * lue par les robots visés :
 *   • Google / Bing : statut 200, pas de noindex (meta ou en-tête X-Robots-Tag),
 *     canonique pointant sur la page elle-même, robots.txt ouvert à Googlebot et bingbot ;
 *   • assistants IA : robots.txt ouvert à leurs robots (GPTBot, ClaudeBot,
 *     PerplexityBot…). Un site qui les bloque ne sera jamais cité par eux.
 */

import { AGENTS_IA, AGENTS_MOTEURS, autorisations, ROBOTS_VIDE } from "./robots.mjs";
import { cheminRobots, normaliserUrl } from "./url.mjs";

/** Évalue l'indexabilité classique d'une page. */
export function evaluerIndexabilite({ url, statut, entetes = {}, page, robots = ROBOTS_VIDE }) {
  const motifs = [];
  const chemin = cheminRobots(url);
  const meta = String(page?.robotsMeta || "");
  const xRobots = String(entetes["x-robots-tag"] || "").toLowerCase();
  const noindex = /noindex|none/.test(meta) || /noindex|none/.test(xRobots);
  const nofollowPage = /nofollow/.test(meta) || /nofollow/.test(xRobots);
  const acces = autorisations(robots, chemin, AGENTS_MOTEURS);
  const canonique = page?.canonical ? normaliserUrl(page.canonical) : null;
  const canoniqueDifferente = Boolean(canonique && sansBarre(canonique) !== sansBarre(normaliserUrl(url) || url));

  if (statut !== 200) motifs.push(`statut HTTP ${statut}`);
  if (noindex) motifs.push(/noindex|none/.test(xRobots) ? "noindex (en-tête X-Robots-Tag)" : "noindex (meta robots)");
  if (!acces.Googlebot) motifs.push("Googlebot exclu par robots.txt");
  if (!acces.bingbot) motifs.push("bingbot exclu par robots.txt");
  if (canoniqueDifferente) motifs.push(`canonique vers ${canonique}`);

  return {
    indexable: motifs.length === 0,
    motifs,
    noindex,
    nofollowPage,
    googlebot: acces.Googlebot,
    bingbot: acces.bingbot,
    canonique,
    canoniqueDifferente,
  };
}

/** Évalue l'accès des robots IA au chemin. */
export function evaluerIa(robots = ROBOTS_VIDE, url, agents = AGENTS_IA) {
  const chemin = cheminRobots(url);
  const acces = autorisations(robots, chemin, agents);
  const autorises = agents.filter((a) => acces[a]);
  const bloques = agents.filter((a) => !acces[a]);
  const principaux = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"].filter((a) => agents.includes(a));
  const principauxAutorises = principaux.filter((a) => acces[a]);
  return {
    autorises,
    bloques,
    taux: agents.length ? Math.round((autorises.length / agents.length) * 100) : 100,
    principauxAutorises,
    principauxBloques: principaux.filter((a) => !acces[a]),
  };
}

function sansBarre(u) {
  return String(u || "").replace(/\/+$/, "").replace(/^http:\/\//, "https://").replace(/:\/\/www\./, "://");
}

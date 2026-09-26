/**
 * Lecture de robots.txt, au plus près de la RFC 9309 (celle que suivent
 * Google et Bing) : groupes par User-agent, règle la plus longue gagnante,
 * « Allow » prioritaire à longueur égale, jokers « * » et ancre « $ ».
 *
 * Deux usages :
 *   1. politesse : notre robot ne visite pas ce qui lui est interdit ;
 *   2. qualification : un spot ne vaut rien pour Google/Bing si leurs robots
 *      en sont exclus, et une citation n'atteint pas les IA si leurs robots
 *      (GPTBot, ClaudeBot, PerplexityBot…) sont bloqués.
 */

/** Robots des moteurs classiques (l'indexation qui compte pour le SEO). */
export const AGENTS_MOTEURS = ["Googlebot", "bingbot"];

/** Robots des assistants et moteurs IA (les citations qui comptent pour les LLM). */
export const AGENTS_IA = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
  "MistralAI-User",
  "cohere-ai",
  "YouBot",
];

/** Analyse le texte d'un robots.txt. */
export function analyserRobots(texte) {
  const groupes = [];
  const sitemaps = [];
  let courant = null;
  for (let ligne of String(texte || "").split(/\r?\n/)) {
    ligne = ligne.replace(/#.*$/, "").trim();
    if (!ligne) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(ligne);
    if (!m) continue;
    const cle = m[1].toLowerCase();
    const valeur = m[2].trim();
    if (cle === "user-agent") {
      // Des lignes User-agent consécutives partagent un même groupe.
      if (!courant || courant.regles.length || courant.delai != null) {
        courant = { agents: [], regles: [], delai: null };
        groupes.push(courant);
      }
      courant.agents.push(valeur.toLowerCase());
    } else if (cle === "disallow" || cle === "allow") {
      if (!courant) continue;
      courant.regles.push({ type: cle, motif: valeur });
    } else if (cle === "crawl-delay") {
      if (!courant) continue;
      const n = Number(valeur.replace(",", "."));
      courant.delai = Number.isFinite(n) && n >= 0 ? n : null;
    } else if (cle === "sitemap") {
      if (valeur) sitemaps.push(valeur);
    }
  }
  return { groupes, sitemaps };
}

/** Robots vide : tout est autorisé (robots.txt absent ou 4xx). */
export const ROBOTS_VIDE = Object.freeze({ groupes: [], sitemaps: [] });

/** Groupe applicable à un agent : jeton le plus spécifique, sinon « * ». */
export function groupePour(robots, agent) {
  const nom = String(agent || "").toLowerCase();
  let meilleur = null;
  let longueur = -1;
  let generique = null;
  for (const g of robots?.groupes || []) {
    for (const jeton of g.agents) {
      if (jeton === "*") {
        if (!generique) generique = g;
      } else if (nom.includes(jeton) && jeton.length > longueur) {
        meilleur = g;
        longueur = jeton.length;
      }
    }
  }
  return meilleur || generique || null;
}

const cacheMotifs = new Map();

/** Un motif de robots.txt correspond-il au chemin ? */
export function motifCorrespond(motif, chemin) {
  let re = cacheMotifs.get(motif);
  if (!re) {
    const ancre = motif.endsWith("$");
    const corps = (ancre ? motif.slice(0, -1) : motif)
      .split("*")
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    re = new RegExp("^" + corps + (ancre ? "$" : ""));
    if (cacheMotifs.size > 5000) cacheMotifs.clear();
    cacheMotifs.set(motif, re);
  }
  return re.test(chemin);
}

/** L'agent peut-il visiter ce chemin (chemin + requête) ? */
export function estAutorise(robots, agent, chemin) {
  const g = groupePour(robots, agent);
  if (!g) return true;
  const c = chemin || "/";
  let gagnante = null;
  for (const r of g.regles) {
    if (!r.motif) continue; // « Disallow: » vide = tout autoriser
    if (!motifCorrespond(r.motif, c)) continue;
    if (
      !gagnante ||
      r.motif.length > gagnante.motif.length ||
      (r.motif.length === gagnante.motif.length && r.type === "allow" && gagnante.type !== "allow")
    ) {
      gagnante = r;
    }
  }
  return !gagnante || gagnante.type === "allow";
}

/** Crawl-delay (secondes) demandé à un agent, ou null. */
export function delaiExploration(robots, agent) {
  const g = groupePour(robots, agent);
  return g && g.delai != null ? g.delai : null;
}

/** Autorisations d'une liste d'agents pour un chemin : { agent: true|false }. */
export function autorisations(robots, chemin, agents) {
  const resultat = {};
  for (const a of agents) resultat[a] = estAutorise(robots, a, chemin);
  return resultat;
}

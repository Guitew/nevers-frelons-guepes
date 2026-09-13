/**
 * Choix des images du jour.
 *
 * Déterministe pour une date donnée (rejouer le même jour redonne le même plan),
 * tourne sur toutes les pages sans en épuiser une, favorise la saison et la priorité,
 * et ne propose jamais deux fois le même visuel tant qu'il en reste d'inédits.
 */
import { slugifier, empreinte, moisDe, joursEntre } from "./texte.mjs";
import { formatSourcePour, serpsCompatibles } from "./serps.mjs";
import { construirePrompt } from "./prompts.mjs";

/** Historique par page : dernières dates de production et visuels déjà produits (depuis journal + file d'attente). */
export function historiquePages(journal = [], file = []) {
  const h = {};
  const noter = (pageId, date, visuel, serp) => {
    if (!pageId) return;
    const e = (h[pageId] = h[pageId] || { derniereDate: null, visuels: {}, serps: {} });
    if (date && (!e.derniereDate || date > e.derniereDate)) e.derniereDate = date;
    if (visuel !== undefined) e.visuels[visuel] = (e.visuels[visuel] || 0) + 1;
    if (serp) e.serps[serp] = (e.serps[serp] || 0) + 1;
  };
  for (const ev of journal) if (ev.type === "planifie" || ev.type === "genere" || ev.type === "publie") noter(ev.page, (ev.date || "").slice(0, 10), ev.visuel, ev.serp);
  for (const it of file) noter(it.page, (it.date || "").slice(0, 10), it.visuel, it.serps?.[0]);
  return h;
}

/** Score d'une page pour une date : plus haut = plus urgent. */
export function scorePage(page, date, histo, cadence) {
  const mois = moisDe(date);
  const enSaison = !page.saison?.length || page.saison.includes(mois);
  const priorite = Number(page.priorite) || 3;
  const h = histo[page.id];
  const jours = h?.derniereDate ? joursEntre(h.derniereDate, date) : 9999;
  const minimum = cadence?.joursMinimumEntreDeuxImagesMemePage ?? 7;
  if (jours < minimum) return -1; // trop tôt pour y revenir
  const produits = h ? Object.values(h.visuels).reduce((a, b) => a + b, 0) : 0;
  const inedits = (page.visuels || []).length - Object.keys(h?.visuels || {}).length;
  let score = (4 - priorite) * 100; // priorité 1 → 300, 2 → 200, 3 → 100
  score += enSaison ? 150 : 0;
  score += Math.min(jours, 120); // ancienneté de la dernière image
  score -= produits * 10; // équité : une page déjà bien couverte redescend
  score += inedits > 0 ? 25 : -50; // il reste des angles inédits ?
  score += empreinte(page.id + date) % 7; // départage stable, non arbitraire
  return score;
}

/** Choisit, pour une page, le visuel le moins produit (les inédits d'abord), en tournant. */
export function choisirVisuel(page, histo, date) {
  const visuels = page.visuels || [];
  if (!visuels.length) return null;
  const compte = histo[page.id]?.visuels || {};
  let min = Infinity;
  for (let i = 0; i < visuels.length; i++) min = Math.min(min, compte[i] || 0);
  const candidats = visuels.map((v, i) => i).filter((i) => (compte[i] || 0) === min);
  const index = candidats[empreinte(page.id + date) % candidats.length];
  return { index, visuel: visuels[index] };
}

/** Construit la file d'attente du jour. */
export function planifier({ pages, date, journal = [], file = [], config, site, essai = false }) {
  const cadence = config.cadence || {};
  const dejaPlanifies = file.filter((it) => (it.date || "").slice(0, 10) === date);
  // Idempotence : relancé le même jour, on complète la cadence, on ne l'excède jamais.
  const n = Math.max(0, (Number(cadence.imagesParJour) || 2) - dejaPlanifies.length);
  if (!n) return [];
  const histo = historiquePages(journal, file);
  const dejaCeJour = new Set(dejaPlanifies.map((it) => it.page));
  const eligibles = pages
    .filter((p) => (essai || (p.url && !p.a_completer)) && (p.visuels || []).length)
    .map((p) => ({ page: p, score: scorePage(p, date, histo, cadence) }))
    .filter((x) => x.score >= 0 && !dejaCeJour.has(x.page.id))
    .sort((a, b) => b.score - a.score);

  const plan = [];
  const utilisees = new Set();
  for (const { page } of eligibles) {
    if (plan.length >= n) break;
    if (cadence.pagesDistinctesParJour !== false && utilisees.has(page.id)) continue;
    const choix = choisirVisuel(page, histo, date);
    if (!choix) continue;
    plan.push(elementFile(page, choix, date, plan.length, config, site, dejaPlanifies.length));
    utilisees.add(page.id);
  }
  // Pas assez de pages distinctes ? On autorise une seconde image d'une même page (visuel différent).
  if (plan.length < n && cadence.pagesDistinctesParJour !== false) {
    for (const { page } of eligibles) {
      if (plan.length >= n) break;
      const deja = plan.filter((it) => it.page === page.id).map((it) => it.visuel);
      const restants = (page.visuels || []).map((v, i) => i).filter((i) => !deja.includes(i));
      if (!restants.length) continue;
      const index = restants[empreinte(page.id + date + "bis") % restants.length];
      plan.push(elementFile(page, { index, visuel: page.visuels[index] }, date, plan.length, config, site, dejaPlanifies.length));
    }
  }
  return plan;
}

function elementFile(page, { index, visuel }, date, rang, config, site, decalage = 0) {
  const formatSource = formatSourcePour(page.serps, visuel.format);
  const serps = serpsCompatibles(page.serps, formatSource);
  const requete = visuel.requete || page.mot_cle;
  const id = `${date}-${String(rang + 1 + decalage).padStart(2, "0")}-${slugifier(page.id, 40)}`;
  return {
    id,
    date,
    statut: "a_generer",
    page: page.id,
    url: page.url || "",
    titrePage: page.titre,
    mot_cle: page.mot_cle,
    requete,
    visuel: index,
    angle: visuel.angle,
    surcouche: visuel.surcouche ?? "",
    formatSource,
    serps: serps.length ? serps : ["google-images"],
    nomFichier: slugifier(requete),
    prompt: construirePrompt({
      angle: visuel.angle,
      requete,
      mot_cle: page.mot_cle,
      titrePage: page.titre,
      formatSource,
      charte: config.charte,
    }),
    tentatives: 0,
  };
}

/**
 * Qualification d'une page téléchargée : analyse HTML → détection du spot →
 * indexabilité → accès des robots IA → pertinence → scores → cible suggérée.
 * Renvoie le spot prêt à être enregistré (ou null si la page n'en est pas un),
 * le relais éventuel (page qui pointe déjà vers allo-frelons.fr) et les
 * éléments utiles à la suite de l'exploration (liens, page analysée).
 */

import { analyserHtml } from "./html.mjs";
import { detecter } from "./detection.mjs";
import { evaluerIa, evaluerIndexabilite } from "./indexabilite.mjs";
import { choisirCible, noter, pertinence } from "./score.mjs";
import { ROBOTS_VIDE } from "./robots.mjs";
import { domaineDe, hoteDe } from "./url.mjs";
import { aujourdhui, tronquer } from "./texte.mjs";

export function qualifierPage({ url, statut = 200, entetes = {}, corps, robots = ROBOTS_VIDE, config, cibles, origine = null }) {
  const page = analyserHtml(corps, url);
  const detection = detecter({ url, page, html: corps, config, cibles });
  const indexabilite = evaluerIndexabilite({ url, statut, entetes, page, robots });
  const ia = evaluerIa(robots, url);
  const p = pertinence(page, url, config);

  // Une page qui pointe déjà vers le site est un relais (à renforcer), pas un spot à conquérir.
  let spot = null;
  if (detection.type && !detection.relais) {
    const scores = noter({ detection, indexabilite, ia, pertinence: p, page, statutHttp: statut });
    spot = {
      url,
      domaine: domaineDe(url),
      hote: hoteDe(url),
      type: detection.type,
      types: detection.types,
      libelle: undefined,
      plateforme: detection.plateforme.nom,
      titre: tronquer(page.titre || page.h1, 140),
      langue: page.langue || "",
      scores,
      facilite: scores.facilite,
      indexabilite: { indexable: indexabilite.indexable, motifs: indexabilite.motifs, googlebot: indexabilite.googlebot, bingbot: indexabilite.bingbot, canonique: indexabilite.canoniqueDifferente ? indexabilite.canonique : null },
      indexee: "inconnu",
      ia: { autorises: ia.principauxAutorises, bloques: ia.principauxBloques, taux: ia.taux },
      liens: detection.details.liens,
      champSiteWeb: detection.details.champSiteWeb,
      captcha: detection.details.captcha,
      connexionRequise: detection.details.connexionRequise,
      moderation: detection.details.moderation,
      commentairesExistants: detection.details.commentairesExistants,
      widget: detection.widget || "",
      contact: detection.details.contact || null,
      lienInscription: detection.details.lienInscription || null,
      concurrentsCites: detection.details.concurrentsCites || [],
      themes: p.themes,
      zonesTrouvees: p.zones,
      nbMots: page.nbMots,
      signaux: detection.signaux,
      origine: origine || { type: "inconnue", detail: "" },
      decouverte: aujourdhui(),
      derniereVisite: new Date().toISOString(),
      statutHttp: statut,
    };
    delete spot.libelle;
    spot.cible = choisirCible({ spot, page, cibles, config });
  }
  return { page, detection, indexabilite, ia, pertinence: p, spot, relais: detection.relais };
}

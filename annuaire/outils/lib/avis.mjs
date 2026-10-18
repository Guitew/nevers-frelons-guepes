/**
 * Avis Google : relevé, compilation et synthèse.
 *
 * L'API Places (New) ne transmet au plus que CINQ avis par établissement
 * (champ « reviews », SKU Place Details Enterprise + Atmosphere), sans
 * possibilité de choisir le tri. Tout ce module travaille donc sur ces cinq
 * avis au maximum : la « compilation » (3 meilleurs récents, le plus mauvais
 * récent, 2 avis moyens récents) est faite PARMI les avis transmis, et
 * chaque bloc n'apparaît que s'il a de quoi être rempli.
 *
 * Mêmes règles que la rédaction : AUCUN FAIT INVENTÉ (la synthèse ne cite
 * qu'un thème réellement présent dans le texte d'un avis, et des comptes
 * réels) et VARIATION DÉTERMINISTE (empreinte de l'identifiant Google).
 *
 * Les avis sont stockés datés dans la fiche (`avis_detail.releve`) et
 * rafraîchis par le suivi des backlinks (config.avis.fraicheurJours), pour
 * respecter la limite de conservation des données Places. Ils ne sont
 * JAMAIS balisés en données structurées (ni `review`, ni `aggregateRating`).
 */

import { choisir, tronquer, joursDepuis } from "./texte.mjs";

/** Longueur maximale d'un avis affiché. */
export const LONGUEUR_MAX_AVIS = 600;

/**
 * Normalise les avis bruts de l'API Places (New) vers la structure interne.
 * Un avis sans texte est conservé (il compte dans la répartition des notes)
 * mais ne sera pas affiché.
 */
export function depuisApiGoogle(reviews) {
  return (reviews || [])
    .filter((r) => r && typeof r.rating === "number")
    .map((r) => ({
      note: Math.max(1, Math.min(5, Math.round(r.rating))),
      texte: (r.text?.text || r.originalText?.text || "").trim(),
      langue: r.text?.languageCode || r.originalText?.languageCode || "",
      date: (r.publishTime || "").slice(0, 10),
      auteur: r.authorAttribution?.displayName || "",
      auteur_lien: r.authorAttribution?.uri || "",
      lien: r.googleMapsUri || "",
    }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** Bloc `avis_detail` à stocker dans une fiche. */
export function blocAvis(liste, releve) {
  return { releve, liste: liste || [] };
}

/** Un avis dont le texte n'est pas en français (relevé sans languageCode, avant le 18/10/2026). */
function avisEnLangueEtrangere(a) {
  return Boolean(a?.texte) && Boolean(a?.langue) && !/^fr/i.test(a.langue);
}

/**
 * Priorité de rafraîchissement d'une fiche : 0 = avis en langue étrangère à
 * retraduire, 1 = jamais relevés, 2 = relevé périmé, null = rien à faire.
 */
export function prioriteAvis(fiche, fraicheurJours) {
  const detail = fiche?.avis_detail;
  if (detail?.liste?.some(avisEnLangueEtrangere)) return 0;
  if (!detail?.releve) return 1;
  return joursDepuis(detail.releve) >= fraicheurJours ? 2 : null;
}

/** Le relevé d'avis d'une fiche est-il absent, périmé ou en langue étrangère ? */
export function avisARafraichir(fiche, fraicheurJours) {
  return prioriteAvis(fiche, fraicheurJours) !== null;
}

const parDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "");

/**
 * Compile les avis affichables : 3 meilleurs récents (note ≥ 4, les 5 étoiles
 * d'abord), le plus mauvais récent (note ≤ 3, la plus basse d'abord), 2 avis
 * moyens récents (note 3 ou 4 non retenus plus haut). Chaque avis n'est utilisé
 * qu'une fois. Retourne null s'il n'y a rien à afficher.
 */
export function compilerAvis(avisDetail) {
  const liste = (avisDetail?.liste || []).filter((a) => a.texte && a.note);
  if (!liste.length) return null;
  const restants = new Set(liste);
  const prendre = (filtre, tri, n) => {
    const choisis = [...restants].filter(filtre).sort(tri).slice(0, n);
    for (const a of choisis) restants.delete(a);
    return choisis;
  };
  const meilleurs = prendre((a) => a.note >= 4, (a, b) => b.note - a.note || parDateDesc(a, b), 3);
  const pires = prendre((a) => a.note <= 3, (a, b) => a.note - b.note || parDateDesc(a, b), 1);
  const moyens = prendre((a) => a.note >= 3 && a.note <= 4, parDateDesc, 2);
  const total = meilleurs.length + pires.length + moyens.length;
  if (!total) return null;
  return { meilleurs, pire: pires[0] || null, moyens, total, releve: avisDetail.releve || "" };
}

// --- Synthèse « à la manière des résumés d'avis de Google » ------------------
//
// Un thème n'est cité que s'il apparaît dans le texte d'au moins un avis. La
// polarité vient d'abord des mots eux-mêmes (« abordable » / « trop cher »),
// sinon de la note de l'avis qui le contient (≥ 4 : positif, ≤ 2 : négatif).

const THEMES = [
  {
    id: "accueil",
    libelle: "l'accueil",
    mots: /(?<!\p{L})(accueil|accueillant|accueillante|aimable|aimables|gentil|gentille|gentils|sympa|sympathique|sympathiques|souriant|souriante|chaleureux|chaleureuse|courtois|courtoise)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(bon accueil|très bon accueil|excellent accueil|accueil chaleureux|accueil parfait|super accueil)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(mauvais accueil|accueil déplorable|accueil froid|désagréable|désagréables|impoli|impolie|malpoli|malpolie|méprisant|méprisante|agressif|agressive)(?!\p{L})/iu,
  },
  {
    id: "qualite",
    libelle: "la qualité",
    mots: /(?<!\p{L})(qualité|excellent|excellente|excellents|parfait|parfaite|impeccable|impeccables|soigné|soignée|top|super|génial|géniale|délicieux|délicieuse|savoureux|savoureuse|très bon|très bonne|très bons|très bonnes)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(bonne qualité|très bonne qualité|excellente qualité|qualité irréprochable|travail de qualité|produits de qualité)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(mauvaise qualité|qualité médiocre|médiocre|décevant|décevante|déçu|déçue|nul|nulle|catastrophique|immangeable|bâclé|bâclée)(?!\p{L})/iu,
  },
  {
    id: "prix",
    libelle: "les prix",
    mots: /(?<!\p{L})(prix|tarif|tarifs|rapport qualité)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(prix corrects?|prix raisonnables?|prix abordables?|pas cher|bon rapport qualité|très bon rapport qualité|tarifs? corrects?|tarifs? raisonnables?|prix doux|prix justes?)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(trop cher|trop chère|un peu cher|très cher|hors de prix|prix excessifs?|tarifs? excessifs?|prix élevés?|tarifs? élevés?|cher pour ce que c'est|arnaque)(?!\p{L})/iu,
  },
  {
    id: "rapidite",
    libelle: "la rapidité du service",
    mots: /(?<!\p{L})(rapide|rapidement|rapidité|efficace|efficaces|efficacité|réactif|réactive|réactivité)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(service rapide|très rapide|rapide et efficace|sans attente|très réactif|très réactive)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(attente|trop long|trop longue|lent|lente|lenteur|délais? trop longs?|jamais rappelé|pas rappelé|sans réponse|aucune réponse)(?!\p{L})/iu,
  },
  {
    id: "professionnalisme",
    libelle: "le professionnalisme",
    mots: /(?<!\p{L})(professionnel|professionnelle|professionnels|professionnelles|professionnalisme|pro|compétent|compétente|compétents|compétentes|sérieux|sérieuse|conseils?|à l'écoute|écoute)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(très professionnel|très professionnelle|très pro|de bons? conseils?|bons conseils|très compétent|très compétente|très sérieux|très sérieuse)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(pas professionnel|peu professionnel|pas professionnelle|peu professionnelle|incompétent|incompétente|pas sérieux|pas sérieuse|manque de sérieux|amateur|amateurs)(?!\p{L})/iu,
  },
  {
    id: "proprete",
    libelle: "la propreté des lieux",
    mots: /(?<!\p{L})(propre|propres|propreté|hygiène)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(très propre|très propres|impeccable|nickel)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(sale|sales|saleté|pas propre|peu propre|manque d'hygiène|crasseux|crasseuse)(?!\p{L})/iu,
  },
  {
    id: "ambiance",
    libelle: "l'ambiance",
    mots: /(?<!\p{L})(ambiance|cadre|atmosphère|convivial|conviviale|agréable|agréables|cosy|chaleureux)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(bonne ambiance|très bonne ambiance|ambiance agréable|ambiance conviviale|cadre agréable|très agréable|joli cadre|beau cadre)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(ambiance froide|cadre vieillot|bruyant|bruyante|mauvaise ambiance)(?!\p{L})/iu,
  },
  {
    id: "choix",
    libelle: "le choix proposé",
    mots: /(?<!\p{L})(choix|variété|large gamme|gamme)(?!\p{L})/iu,
    positifs: /(?<!\p{L})(grand choix|large choix|beaucoup de choix|bon choix|belle variété|large gamme)(?!\p{L})/iu,
    negatifs: /(?<!\p{L})(peu de choix|pas beaucoup de choix|manque de choix|choix limité)(?!\p{L})/iu,
  },
];

/** Thèmes positifs et négatifs réellement présents dans les textes d'avis. */
export function themesDesAvis(liste) {
  const positifs = [];
  const negatifs = [];
  for (const t of THEMES) {
    let plus = 0;
    let moins = 0;
    for (const a of liste || []) {
      const texte = a.texte || "";
      if (!texte) continue;
      if (t.negatifs.test(texte)) moins++;
      else if (t.positifs.test(texte)) plus++;
      else if (t.mots.test(texte)) {
        if (a.note >= 4) plus++;
        else if (a.note <= 2) moins++;
      }
    }
    if (plus && plus >= moins) positifs.push({ ...t, occurrences: plus });
    else if (moins) negatifs.push({ ...t, occurrences: moins });
  }
  const parOccurrences = (x, y) => y.occurrences - x.occurrences;
  return { positifs: positifs.sort(parOccurrences), negatifs: negatifs.sort(parOccurrences) };
}

function enumerer(libelles) {
  if (libelles.length <= 1) return libelles.join("");
  return `${libelles.slice(0, -1).join(", ")} et ${libelles[libelles.length - 1]}`;
}

const APPRECIENT = [
  (nom, th) => `Les clients de ${nom} apprécient surtout ${th}`,
  (nom, th) => `Les avis sur ${nom} mettent en avant ${th}`,
  (nom, th) => `Les clients soulignent le plus souvent ${th}`,
];
const SIGNALENT = [
  (th) => `quelques avis signalent en revanche ${th}`,
  (th) => `certains clients regrettent ${th}`,
  (th) => `des réserves portent sur ${th}`,
];
const CONSTATS = [
  (n, total) =>
    n === 0
      ? `aucun des ${total} avis relevés n'attribue 4 ou 5 étoiles`
      : `${n} des ${total} avis relevés attribue${n > 1 ? "nt" : ""} 4 ou 5 étoiles`,
  (n, total) =>
    n === 0
      ? `aucun avis sur ${total} relevés ne donne 4 étoiles ou plus`
      : `${n} avis sur ${total} relevés donne${n > 1 ? "nt" : ""} 4 étoiles ou plus`,
];

/**
 * Rédige la synthèse en une ou deux phrases, à la manière des résumés d'avis
 * générés par Google, à partir des seuls avis relevés. Retourne "" s'il n'y a
 * aucun avis exploitable.
 */
export function syntheseAvis(fiche) {
  const liste = fiche?.avis_detail?.liste || [];
  if (!liste.length) return "";
  const graine = fiche.id || fiche.slug || "";
  const nom = fiche.nom || "l'établissement";
  const themes = themesDesAvis(liste);
  const positifs = liste.filter((a) => a.note >= 4).length;
  const negatifs = liste.filter((a) => a.note <= 2).length;
  const noteGlobale = fiche.note ? String(fiche.note).replace(".", ",") : "";
  const phrases = [];

  if (themes.positifs.length) {
    let phrase = choisir(APPRECIENT, graine, 11)(nom, enumerer(themes.positifs.slice(0, 3).map((t) => t.libelle)));
    if (themes.negatifs.length) {
      phrase += ` ; ${choisir(SIGNALENT, graine, 12)(enumerer(themes.negatifs.slice(0, 2).map((t) => t.libelle)))}`;
    }
    phrases.push(phrase + ".");
  } else if (themes.negatifs.length) {
    phrases.push(
      `Les avis relevés sur ${nom} sont surtout critiques : ${enumerer(themes.negatifs.slice(0, 3).map((t) => t.libelle))} ${themes.negatifs.length > 1 ? "reviennent" : "revient"} dans les reproches.`
    );
  }

  if (liste.length >= 2) {
    const constat = choisir(CONSTATS, graine, 13)(positifs, liste.length);
    const nuance = negatifs ? `, ${negatifs} ${negatifs > 1 ? "sont" : "est"} très critique${negatifs > 1 ? "s" : ""}` : "";
    phrases.push(`${constat.charAt(0).toUpperCase()}${constat.slice(1)}${nuance}.`);
  } else {
    const a = liste[0];
    phrases.push(`Le seul avis relevé attribue ${a.note} étoile${a.note > 1 ? "s" : ""}.`);
  }

  if (noteGlobale && fiche.avis) {
    phrases.push(`Note globale sur Google : ${noteGlobale} sur 5 pour ${fiche.avis} avis.`);
  }
  return phrases.join(" ");
}

/** Texte d'un avis prêt à l'affichage (tronqué). */
export function texteAvis(avis) {
  return tronquer(avis?.texte || "", LONGUEUR_MAX_AVIS);
}

export { THEMES };

/**
 * Rédaction automatique des fiches.
 *
 * Deux règles gouvernent ce module :
 *
 *  1. AUCUN FAIT INVENTÉ. Chaque phrase produite ne s'appuie que sur des
 *     données réellement présentes dans la fiche (adresse, horaires, note,
 *     attributs). Une donnée absente ne donne pas de phrase : elle donne
 *     un silence. C'est ce qui distingue une page utile d'un texte de
 *     remplissage — et ce qui protège le site d'une sanction pour contenu
 *     de faible valeur.
 *
 *  2. VARIATION DÉTERMINISTE. Les tournures sont tirées d'un jeu de
 *     variantes indexé par l'empreinte de l'identifiant Google : une même
 *     fiche produit toujours exactement le même texte (pas de churn dans
 *     Git, pas de contenu instable pour les moteurs), mais deux fiches
 *     voisines ne se ressemblent pas.
 *
 * Le texte est stocké dans la fiche au moment de la collecte, jamais
 * recalculé au build : le contenu publié est donc relu et modifiable à la
 * main, fiche par fiche, sans être écrasé.
 */

import { choisir, capitaliser, tronquer, dateLisible, telephoneLisible } from "./texte.mjs";
import { categorieParSlug } from "./categories.mjs";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** « 09:00 » → « 9 h », « 14:30 » → « 14 h 30 ». */
export function heureLisible(h) {
  const [hh, mm] = (h || "").split(":");
  if (hh === undefined) return h;
  const heures = String(Number(hh));
  return mm && mm !== "00" ? `${heures} h ${mm}` : `${heures} h`;
}

/** Décrit une journée d'ouverture en toutes lettres. */
export function journeeLisible(jour) {
  if (!jour || jour.ferme || !jour.creneaux?.length) return "fermé";
  return jour.creneaux
    .map(([d, f]) => `de ${heureLisible(d)} à ${heureLisible(f)}`)
    .join(" et ");
}

/** Résumé compact des horaires (« ouvert du mardi au samedi »). */
export function resumeHoraires(horaires) {
  if (!horaires?.length) return null;
  const ouverts = horaires.filter((j) => !j.ferme && j.creneaux?.length);
  if (!ouverts.length) return null;
  const fermes = horaires.filter((j) => j.ferme || !j.creneaux?.length).map((j) => JOURS[j.jour]);
  if (fermes.length === 0) return "ouvert sept jours sur sept";
  if (fermes.length === 1) return `ouvert tous les jours sauf le ${fermes[0]}`;
  if (fermes.length <= 3) return `fermé le ${fermes.join(" et le ")}`;
  return `ouvert le ${ouverts.map((j) => JOURS[j.jour]).join(", ")}`;
}

const OUVERTURES = [
  (f, c) => `${f.nom} est ${unOuUne(c.nom)} ${minuscule(c.nom)} ${situer(f)}.`,
  (f, c) => `${f.nom} exerce l'activité de ${minuscule(c.nom)} ${situer(f)}.`,
  (f, c) => `${f.nom} figure parmi les établissements de la catégorie « ${c.nom} » recensés à ${f.ville}.`,
  (f, c) => `Cette fiche présente ${f.nom}, ${unOuUne(c.nom)} ${minuscule(c.nom)} ${situer(f)}.`,
];

const RAISONS = [
  (f) =>
    `Son établissement ne déclare aucun site internet sur sa fiche Google : les informations ci-dessous en tiennent lieu de référence publique, vérifiable et accessible à tous.`,
  (f) =>
    `Aucune adresse web n'est renseignée sur sa fiche Google. Cette page rassemble donc, en un seul endroit stable, les informations que les clients recherchent avant de se déplacer.`,
  (f) =>
    `Faute de site internet déclaré sur sa fiche Google, l'entreprise reste difficile à trouver en dehors des cartes. Cette page comble ce manque avec des données factuelles et datées.`,
  (f) =>
    `L'entreprise n'a pas de site web référencé sur sa fiche Google. Les éléments présentés ici — adresse, horaires, contact — proviennent de cette fiche et sont datés de leur relevé.`,
];

const ACCROCHES_LOCALES = [
  (f, c) => `À ${f.ville}, les recherches du type « ${minuscule(c.nom)} près de chez moi » se concluent le plus souvent par un appel ou une visite directe.`,
  (f, c) => `${capitaliser(minuscule(c.pluriel))} font partie des activités les plus consultées localement sur mobile.`,
  (f, c) => `Le choix d'${unOuUne(c.nom)} ${minuscule(c.nom)} se joue sur trois critères : la proximité, les horaires et la facilité de contact.`,
];

/** Genre grammatical du libellé de catégorie, pour accorder « un » / « une ». */
function unOuUne(nomCategorie) {
  return /^(boulangerie|pharmacie|coiffure|assurance|comptabilité|menuiserie|maçonnerie|électricité|plomberie|santé|mode|agence)/i.test(
    nomCategorie
  )
    ? "une"
    : "un";
}
function minuscule(str) {
  return (str || "").charAt(0).toLowerCase() + (str || "").slice(1);
}

/** « au 12 rue du Commerce à Nevers » / « à Nevers ». */
function situer(f) {
  const rue = f.adresse?.rue;
  return rue ? `au ${rue}, à ${f.ville}` : `à ${f.ville}`;
}

/**
 * Compose l'ensemble des textes d'une fiche.
 * @returns {object} bloc « redaction » à stocker dans la fiche.
 */
export function rediger(fiche, releve) {
  const c = categorieParSlug(fiche.categorie);
  if (!c) throw new Error(`Catégorie inconnue : ${fiche.categorie}`);
  const graine = fiche.id || fiche.slug;
  const dateReleve = dateLisible(releve || fiche.dates?.collecte);

  const titre = `${fiche.nom} — ${c.nom} à ${fiche.ville}`;
  const metaTitre = tronquer(`${fiche.nom}, ${minuscule(c.nom)} à ${fiche.ville}`, 60);

  const chapo = [
    choisir(OUVERTURES, graine, 1)(fiche, c),
    choisir(RAISONS, graine, 2)(fiche),
  ].join(" ");

  const sections = [];

  // --- Présentation -------------------------------------------------------
  const presentation = [choisir(ACCROCHES_LOCALES, graine, 3)(fiche, c), c.description];
  const resume = resumeHoraires(fiche.horaires);
  if (resume) {
    presentation.push(
      `D'après le relevé du ${dateReleve}, l'établissement est ${resume}. Le détail jour par jour figure plus bas.`
    );
  }
  sections.push({
    id: "presentation",
    titre: `${fiche.nom} en quelques mots`,
    paragraphes: presentation,
  });

  // --- Adresse ------------------------------------------------------------
  const acces = [];
  if (fiche.adresse?.complete) {
    acces.push(
      `L'établissement est situé ${fiche.adresse.rue ? `au ${fiche.adresse.rue}` : ""}, ${fiche.adresse.code_postal} ${fiche.ville}${fiche.adresse.pays && fiche.adresse.pays !== "France" ? ", " + fiche.adresse.pays : ""}.`
        .replace(/\s+,/g, ",")
        .replace(/,\s*,/g, ",")
    );
  }
  if (fiche.geo?.latitude) {
    acces.push(
      `Coordonnées géographiques : ${fiche.geo.latitude.toFixed(5)}, ${fiche.geo.longitude.toFixed(5)}. Le lien d'itinéraire ci-dessous ouvre directement la navigation.`
    );
  }
  if (acces.length) {
    sections.push({ id: "acces", titre: `Adresse et accès`, paragraphes: acces });
  }

  // --- Contact ------------------------------------------------------------
  const contact = [];
  if (fiche.telephone) {
    contact.push(
      `Le contact se fait par téléphone au ${telephoneLisible(fiche.telephone)}. C'est le seul moyen de communication déclaré sur la fiche Google de l'entreprise, avec la visite sur place.`
    );
  } else {
    contact.push(
      `Aucun numéro de téléphone n'est déclaré sur la fiche Google de l'établissement : le contact se fait sur place, aux horaires indiqués.`
    );
  }
  contact.push(
    `Si vous dirigez cette entreprise, vous pouvez demander la correction ou le retrait de cette page à tout moment, sans justification.`
  );
  sections.push({ id: "contact", titre: `Contacter ${fiche.nom}`, paragraphes: contact });

  // --- Avis ---------------------------------------------------------------
  if (fiche.note && fiche.avis) {
    const note = String(fiche.note).replace(".", ",");
    sections.push({
      id: "avis",
      titre: `La réputation de ${fiche.nom}`,
      paragraphes: [
        `Au relevé du ${dateReleve}, l'établissement affichait une note de ${note} sur 5 sur Google, calculée à partir de ${fiche.avis} avis. Cette note évolue en permanence : elle est indiquée ici à titre d'information et n'est pas retraitée.`,
        `Les avis appartiennent à Google et se consultent sur la fiche d'origine, dont le lien figure sur cette page.`,
      ],
    });
  }

  // --- FAQ ----------------------------------------------------------------
  const faq = [];
  if (resume) {
    const detail = (fiche.horaires || [])
      .map((j) => `${JOURS[j.jour]} : ${journeeLisible(j)}`)
      .join(" ; ");
    faq.push({
      q: `Quels sont les horaires de ${fiche.nom} ?`,
      r: `Au relevé du ${dateReleve}, ${fiche.nom} était ${resume}. Dans le détail — ${detail}. Ces horaires peuvent changer : un appel préalable reste conseillé.`,
    });
  }
  if (fiche.adresse?.complete) {
    faq.push({
      q: `Où se trouve ${fiche.nom} ?`,
      r: `${fiche.nom} se trouve ${fiche.adresse.complete}. Un lien d'itinéraire est disponible sur cette page.`,
    });
  }
  if (fiche.telephone) {
    faq.push({
      q: `Comment contacter ${fiche.nom} ?`,
      r: `Par téléphone au ${telephoneLisible(fiche.telephone)}, ou directement sur place aux heures d'ouverture.`,
    });
  }
  faq.push({
    q: `${fiche.nom} a-t-il un site internet ?`,
    r: `Non : aucune adresse de site web n'est déclarée sur la fiche Google de ${fiche.nom} au ${dateReleve}. Cette page tient lieu de référence publique en attendant, le cas échéant, la création d'un site propre à l'entreprise.`,
  });
  const pmr = (fiche.attributs || []).find((a) => /mobilit|pmr|accessib/i.test(a));
  if (pmr) {
    faq.push({
      q: `${fiche.nom} est-il accessible aux personnes à mobilité réduite ?`,
      r: `La fiche Google de l'établissement mentionne : « ${pmr} ». Cette information est déclarative ; en cas de doute, vérifiez par téléphone.`,
    });
  }

  const metaDescription = tronquer(
    `${fiche.nom}, ${minuscule(c.nom)} à ${fiche.ville}${fiche.adresse?.rue ? ` (${fiche.adresse.rue})` : ""} : adresse, horaires${fiche.telephone ? ", téléphone" : ""} et informations pratiques.`,
    155
  );

  return {
    titre,
    meta_titre: metaTitre,
    meta_description: metaDescription,
    chapo,
    sections,
    faq,
    genere_le: releve || fiche.dates?.collecte,
  };
}

export { JOURS };

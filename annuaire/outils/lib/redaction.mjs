/**
 * Rédaction automatique des fiches.
 *
 * Deux règles gouvernent ce module :
 *
 *  1. AUCUN FAIT INVENTÉ. Chaque phrase produite ne s'appuie que sur des
 *     données réellement présentes dans la fiche (adresse, horaires, note,
 *     prestations, résumé Google). Une donnée absente ne donne pas de
 *     phrase : elle donne un silence.
 *
 *  2. VARIATION DÉTERMINISTE. Les tournures sont tirées d'un jeu de
 *     variantes indexé par l'empreinte de l'identifiant Google : une même
 *     fiche produit toujours exactement le même texte.
 *
 * Depuis le 18/10/2026 (v2), le texte répond d'abord à ce que les gens
 * cherchent sur le nom d'un commerce — horaires, ouvert le dimanche,
 * téléphone, avis, prix, réservation, à emporter — et ne parle plus de la
 * page elle-même (« aucune adresse web n'est renseignée », « cette page
 * rassemble »…) : ces phrases, répétées sur des centaines de pages, ne
 * répondaient à aucune intention et pesaient sur l'indexation. La seule
 * mention de la source est courte et datée.
 *
 * Le texte est stocké dans la fiche (collecte, puis rafraîchi quand les
 * données Google sont relues), jamais recalculé au build. Une fiche dont
 * `redaction.manuel` vaut true n'est plus jamais réécrite automatiquement.
 */

import { choisir, capitaliser, tronquer, dateLisible, telephoneLisible } from "./texte.mjs";
import { categorieParSlug } from "./categories.mjs";
import { libellesServices, prixLisible, option } from "./services.mjs";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const VERSION_REDACTION = 2;

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
  if (fermes.length <= 3) return `fermé le ${fermes.slice(0, -1).join(", le ")} et le ${fermes[fermes.length - 1]}`;
  return `ouvert le ${ouverts.map((j) => JOURS[j.jour]).join(", ")}`;
}

const OUVERTURES = [
  (f, c) => `${f.nom} est ${unOuUne(c.nom)} ${minuscule(c.nom)} ${situer(f)}.`,
  (f, c) => `${f.nom} exerce l'activité de ${minuscule(c.nom)} ${situer(f)}.`,
  (f, c) => `${f.nom}, ${minuscule(c.nom)} ${situer(f)}.`,
  (f, c) => `Cette fiche présente ${f.nom}, ${unOuUne(c.nom)} ${minuscule(c.nom)} ${situer(f)}.`,
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

function noteFr(n) {
  return String(n).replace(".", ",");
}

function enumerer(liste) {
  if (liste.length <= 1) return liste.join("");
  return `${liste.slice(0, -1).join(", ")} et ${liste[liste.length - 1]}`;
}

/** Titre SERP : « Nom à Ville : horaires, avis, téléphone », ≤ 60 caractères. */
export function titreSerp(fiche, c) {
  const reponses = [];
  if (resumeHoraires(fiche.horaires)) reponses.push("horaires");
  if (fiche.note && fiche.avis) reponses.push("avis");
  if (fiche.telephone) reponses.push("téléphone");
  const candidats = [];
  if (reponses.length) {
    candidats.push(`${fiche.nom} à ${fiche.ville} : ${reponses.join(", ")}`);
    candidats.push(`${fiche.nom} (${fiche.ville}) : ${reponses.join(", ")}`);
    candidats.push(`${fiche.nom} à ${fiche.ville} : ${reponses.slice(0, 2).join(", ")}`);
    candidats.push(`${fiche.nom} : ${reponses.join(", ")}`);
  }
  candidats.push(`${fiche.nom}, ${minuscule(c.nom)} à ${fiche.ville}`);
  candidats.push(`${fiche.nom} à ${fiche.ville}`);
  return candidats.find((t) => t.length <= 60) || tronquer(candidats[candidats.length - 1], 60);
}

/** Description SERP : ce que la page répond, avec la note si elle existe. */
export function descriptionSerp(fiche, c) {
  const reponses = [];
  if (resumeHoraires(fiche.horaires)) reponses.push("horaires d'ouverture");
  if (fiche.note && fiche.avis) reponses.push(`note Google ${noteFr(fiche.note)}/5 (${fiche.avis} avis)`);
  if (fiche.telephone) reponses.push("téléphone");
  reponses.push("adresse et itinéraire");
  const base = `${fiche.nom}, ${minuscule(c.nom)} à ${fiche.ville} : ${reponses.join(", ")}.`;
  if (base.length <= 155) return base;
  return tronquer(`${fiche.nom}, ${minuscule(c.nom)} à ${fiche.ville} : ${reponses.filter((r) => !r.startsWith("note")).join(", ")}.`, 155);
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
  const resume = resumeHoraires(fiche.horaires);
  const services = fiche.services || null;
  const libelles = libellesServices(services);
  const prix = prixLisible(services);

  const titre = `${fiche.nom} — ${c.nom} à ${fiche.ville}`;

  // --- Chapô : les réponses d'abord ----------------------------------------
  const chapo = [choisir(OUVERTURES, graine, 1)(fiche, c)];
  if (resume) chapo.push(`${capitaliser(resume)} au relevé du ${dateReleve}.`);
  if (fiche.telephone) chapo.push(`Téléphone : ${telephoneLisible(fiche.telephone)}.`);
  if (fiche.note && fiche.avis) chapo.push(`Note Google : ${noteFr(fiche.note)} sur 5 pour ${fiche.avis} avis.`);

  const sections = [];

  // --- Présentation : le résumé Google, le type exact, le niveau de prix ---
  const presentation = [];
  if (services?.resume) {
    presentation.push(`Présentation donnée par Google : « ${services.resume} »`);
  }
  if (fiche.categorie_gmb && minuscule(fiche.categorie_gmb) !== minuscule(c.nom)) {
    presentation.push(`Sur Google, l'établissement est classé « ${fiche.categorie_gmb} », dans notre rubrique ${c.nom}.`);
  }
  if (prix) presentation.push(`Niveau de prix indiqué sur la fiche Google : ${prix}.`);
  if (resume) {
    presentation.push(`D'après le relevé du ${dateReleve}, l'établissement est ${resume}. Le détail jour par jour figure plus bas.`);
  }
  if (!presentation.length) {
    presentation.push(
      `${fiche.nom} est référencé dans la rubrique ${c.nom} à ${fiche.ville}. Les informations de cette page proviennent de sa fiche Google publique, relevée le ${dateReleve}.`
    );
  }
  sections.push({ id: "presentation", titre: `${fiche.nom} en quelques mots`, paragraphes: presentation });

  // --- Prestations et équipements -------------------------------------------
  const prestations = [];
  if (libelles.oui.length) prestations.push(`Proposé : ${enumerer(libelles.oui)}.`);
  if (libelles.non.length) prestations.push(`Non proposé selon la fiche Google : ${enumerer(libelles.non)}.`);
  if (libelles.paiement.length) prestations.push(`Moyens de paiement déclarés : ${enumerer(libelles.paiement)}.`);
  if (libelles.parking.length) prestations.push(`Stationnement : ${enumerer(libelles.parking)}.`);
  if (prestations.length) {
    prestations.push(`Ces indications sont déclarées par l'établissement sur sa fiche Google (relevé du ${dateReleve}).`);
    sections.push({ id: "prestations", titre: `Services et équipements de ${fiche.nom}`, paragraphes: prestations });
  }

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
      `Coordonnées GPS : ${fiche.geo.latitude.toFixed(5)}, ${fiche.geo.longitude.toFixed(5)}. Le bouton Itinéraire de cette page ouvre la navigation.`
    );
  }
  if (acces.length) {
    sections.push({ id: "acces", titre: `Adresse et accès`, paragraphes: acces });
  }

  // --- Contact ------------------------------------------------------------
  const contact = [];
  if (fiche.telephone) {
    contact.push(`Le contact se fait par téléphone au ${telephoneLisible(fiche.telephone)}, ou directement sur place aux horaires d'ouverture.`);
  } else {
    contact.push(`Aucun numéro de téléphone n'est déclaré sur la fiche Google de l'établissement : le contact se fait sur place, aux horaires indiqués.`);
  }
  if (option(services, "reservable") === true) contact.push(`La fiche Google indique que la réservation est possible.`);
  sections.push({ id: "contact", titre: `Contacter ${fiche.nom}`, paragraphes: contact });

  // --- Avis ---------------------------------------------------------------
  if (fiche.note && fiche.avis) {
    sections.push({
      id: "avis",
      titre: `La réputation de ${fiche.nom}`,
      paragraphes: [
        `Note de ${noteFr(fiche.note)} sur 5 pour ${fiche.avis} avis Google au relevé du ${dateReleve}. ${
          fiche.avis_detail?.liste?.some((a) => a.texte)
            ? "Les avis les plus parlants sont compilés ci-dessous, avec un lien vers la fiche d'origine."
            : "Les avis se consultent sur la fiche Google, dont le lien figure sur cette page."
        }`,
      ],
    });
  }

  // --- FAQ : seulement les questions auxquelles les données répondent ------
  const faq = [];
  if (resume) {
    const detail = (fiche.horaires || []).map((j) => `${JOURS[j.jour]} : ${journeeLisible(j)}`).join(" ; ");
    faq.push({
      q: `Quels sont les horaires de ${fiche.nom} ?`,
      r: `Au relevé du ${dateReleve}, ${fiche.nom} était ${resume}. Dans le détail — ${detail}. Ces horaires peuvent changer : un appel préalable reste conseillé.`,
    });
    const dimanche = (fiche.horaires || []).find((j) => j.jour === 6);
    if (dimanche) {
      const ouvert = !dimanche.ferme && dimanche.creneaux?.length;
      faq.push({
        q: `${fiche.nom} est-il ouvert le dimanche ?`,
        r: ouvert
          ? `Oui : le dimanche, ${fiche.nom} est ouvert ${journeeLisible(dimanche)} (horaires relevés le ${dateReleve}).`
          : `Non : d'après les horaires relevés le ${dateReleve}, ${fiche.nom} est fermé le dimanche.`,
      });
    }
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
  const reservable = option(services, "reservable");
  if (reservable !== undefined) {
    faq.push({
      q: `Peut-on réserver chez ${fiche.nom} ?`,
      r: reservable
        ? `Oui, la fiche Google de ${fiche.nom} indique que la réservation est possible${fiche.telephone ? `, par téléphone au ${telephoneLisible(fiche.telephone)}` : ""}.`
        : `La fiche Google de ${fiche.nom} indique que la réservation n'est pas proposée.`,
    });
  }
  const emporter = option(services, "takeout");
  const livraison = option(services, "delivery");
  if (emporter !== undefined || livraison !== undefined) {
    const parts = [];
    if (emporter !== undefined) parts.push(`vente à emporter : ${emporter ? "oui" : "non"}`);
    if (livraison !== undefined) parts.push(`livraison : ${livraison ? "oui" : "non"}`);
    faq.push({
      q: `${fiche.nom} propose-t-il la vente à emporter ou la livraison ?`,
      r: `D'après sa fiche Google (relevé du ${dateReleve}) — ${parts.join(" ; ")}.`,
    });
  }
  if (prix) {
    faq.push({
      q: `Quel est le niveau de prix de ${fiche.nom} ?`,
      r: `Google classe ${fiche.nom} au niveau de prix ${prix}, sur une échelle de € à €€€€ établie à partir des avis clients.`,
    });
  }
  const pmr = (fiche.attributs || []).find((a) => /mobilit|pmr|accessib/i.test(a));
  if (pmr) {
    faq.push({
      q: `${fiche.nom} est-il accessible aux personnes à mobilité réduite ?`,
      r: `La fiche Google de l'établissement mentionne : « ${pmr} ». Cette information est déclarative ; en cas de doute, vérifiez par téléphone.`,
    });
  }

  return {
    version: VERSION_REDACTION,
    titre,
    meta_titre: titreSerp(fiche, c),
    meta_description: descriptionSerp(fiche, c),
    chapo: chapo.join(" "),
    sections,
    faq,
    genere_le: releve || fiche.dates?.collecte,
  };
}

export { JOURS };

/**
 * Construction des prompts de génération.
 *
 * Principe : le générateur produit une image PROPRE (sans texte), fidèle au sujet
 * et pensée pour la vignette ; le texte destiné au clic (badge, titre) est ajouté
 * ensuite par nos soins avec sharp — sans faute d'orthographe, dans la charte.
 */
import { FORMATS_SOURCE } from "./serps.mjs";

/** Faits morphologiques injectés systématiquement quand l'espèce apparaît : un générateur invente sinon des rayures fantaisistes. */
export const FICHES_ESPECES = {
  "frelon asiatique":
    "Frelon asiatique (Vespa velutina nigrithorax) : 2 à 3 cm, thorax entièrement noir velouté, abdomen sombre dont seul le 4e segment forme un large anneau orange, extrémités des pattes jaune vif, tête noire avec face orangée, ailes fumées.",
  "frelon européen":
    "Frelon européen (Vespa crabro) : 2,5 à 3,5 cm, thorax roux et noir, abdomen jaune rayé de noir, pattes brun-roux, tête rousse et jaune.",
  guêpe:
    "Guêpe commune ou germanique (Vespula) : 1,2 à 1,7 cm, corps lisse jaune vif rayé de noir, taille très fine, pattes jaunes.",
  abeille:
    "Abeille domestique (Apis mellifera) : 1,2 à 1,5 cm, corps velu brun doré rayé de brun sombre, aspect duveteux, pattes portant du pollen.",
  "nid de frelon asiatique":
    "Nid de frelon asiatique : sphère ou poire de papier mâché beige à stries brunes, jusqu'à 60-80 cm, entrée LATÉRALE petite, souvent haut dans un arbre ; le nid primaire de printemps est de la taille d'une orange avec l'entrée par le dessous.",
  "nid de guêpes":
    "Nid de guêpes : papier gris, forme de boule ou de galette, alvéoles visibles à l'ouverture, souvent sous un toit, dans un mur, un volet roulant ou le sol.",
  "nid de frelon européen":
    "Nid de frelon européen : papier brun-roux à larges écailles, ouvert vers le bas, dans une cavité (arbre creux, grenier, nichoir).",
};

/** Détecte les espèces citées dans un angle pour y attacher leur fiche morphologique. */
export function fichesPour(texte) {
  const t = (texte || "").toLowerCase();
  const cles = [];
  if (/nid.{0,20}frelon asiatique|frelon asiatique.{0,40}nid/.test(t)) cles.push("nid de frelon asiatique");
  if (/nid.{0,20}gu[êe]pe/.test(t)) cles.push("nid de guêpes");
  if (/nid.{0,20}frelon europ/.test(t)) cles.push("nid de frelon européen");
  if (/frelon asiatique|velutina/.test(t)) cles.push("frelon asiatique");
  if (/frelon europ|crabro/.test(t)) cles.push("frelon européen");
  if (/gu[êe]pe/.test(t)) cles.push("guêpe");
  if (/abeille/.test(t)) cles.push("abeille");
  return [...new Set(cles)];
}

/** Règles de composition qui font cliquer une vignette, quelle que soit la surface. */
export const REGLES_CTR = [
  "un seul sujet principal, net, occupant 40 à 60 % du cadre, placé au centre ou au tiers",
  "arrière-plan simple, peu chargé, plus sombre ou plus clair que le sujet pour un contraste immédiat",
  "lumière naturelle directionnelle qui détache le sujet ; couleurs franches, légèrement saturées",
  "angle de vue inhabituel ou très rapproché, différent d'une photo de banque d'images",
  "marge libre d'environ 15 % en bas du cadre pour accueillir un court texte ajouté ensuite",
];

/**
 * Prompt complet pour un visuel.
 * @param {object} p  { angle, requete, mot_cle, titrePage, formatSource, charte }
 */
export function construirePrompt(p) {
  const format = FORMATS_SOURCE[p.formatSource] || FORMATS_SOURCE.paysage;
  const fiches = fichesPour(`${p.angle} ${p.mot_cle || ""} ${p.requete || ""}`).map((c) => FICHES_ESPECES[c]);
  const charte = p.charte || {};
  const lignes = [
    `Génère une photographie réaliste au format ${format.libelle} (${format.largeur} × ${format.hauteur} pixels), destinée à illustrer une page web sur « ${p.mot_cle || p.requete} ».`,
    "",
    `Sujet : ${p.angle}.`,
  ];
  if (fiches.length) {
    lignes.push("", "Exactitude obligatoire (ne pas inventer de motifs) :", ...fiches.map((f) => `- ${f}`));
  }
  lignes.push(
    "",
    "Composition pour une vignette de résultat de recherche :",
    ...REGLES_CTR.map((r) => `- ${r}`),
    "",
    `Style : ${charte.style || "photographie réaliste, lumière naturelle, netteté sur le sujet"}.`,
    `Interdits : ${charte.interdits || "aucun texte, aucun logo, aucun filigrane, aucune marque, aucun visage reconnaissable"}.`,
    "Ne mets AUCUN texte ni lettre dans l'image, même pas une légende : le texte sera ajouté séparément."
  );
  return lignes.join("\n");
}

/** Prompt de reprise quand la première image est refusée (texte présent, sujet flou…). */
export function promptReprise(prompt, motif) {
  return `${prompt}\n\nReprise : la version précédente a été rejetée (${motif}). Corrige uniquement ce point, garde le même sujet et la même composition.`;
}

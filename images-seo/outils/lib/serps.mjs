/**
 * Profils des surfaces de recherche « image » visées.
 *
 * Chaque profil décrit ce que la surface attend (format, dimensions, présence
 * de texte) et ce qui y fait cliquer (CTR). Une image maître générée une fois
 * est ensuite recadrée/déclinée pour chaque surface de la page.
 */
export const SERPS = {
  "google-images": {
    libelle: "Google Images / pack d'images",
    ratio: 4 / 3,
    largeur: 1200,
    hauteur: 900,
    formatSource: "paysage",
    // Dans la mosaïque Google Images, la vignette est petite : sujet unique, plein cadre, fort contraste.
    surcouche: "badge", // texte court (2-4 mots) en badge, lisible en vignette
    pourquoi:
      "Mosaïque de vignettes : ce qui ressort est un sujet unique, centré, très contrasté, avec une couleur d'accent. Nom de fichier + alt + contexte de page font le classement.",
  },
  discover: {
    libelle: "Google Discover",
    ratio: 16 / 9,
    largeur: 1536,
    hauteur: 864,
    formatSource: "paysage",
    // Discover affiche l'image en grand : pas de texte incrusté lourd, une seule signature discrète.
    surcouche: "aucune",
    pourquoi:
      "Carte pleine largeur : Google exige ≥ 1200 px de large et la balise max-image-preview:large. Une image « grande et propre » sans texte l'emporte.",
  },
  pinterest: {
    libelle: "Pinterest (+ Google Images via Pinterest)",
    ratio: 2 / 3,
    largeur: 1000,
    hauteur: 1500,
    formatSource: "portrait",
    // Sur Pinterest le texte incrusté fait le clic : titre lisible en gros + signature.
    surcouche: "titre",
    pourquoi:
      "Flux vertical : le format 2:3 occupe le plus d'écran ; un titre incrusté lisible et une signature de marque augmentent les enregistrements et les clics.",
  },
};

export const SERPS_CONNUES = Object.keys(SERPS);

/** Dimensions demandées au générateur selon l'orientation de l'image maître. */
export const FORMATS_SOURCE = {
  paysage: { largeur: 1536, hauteur: 1024, libelle: "paysage 3:2" },
  portrait: { largeur: 1024, hauteur: 1536, libelle: "portrait 2:3" },
  carre: { largeur: 1024, hauteur: 1024, libelle: "carré 1:1" },
};

/** Orientation de l'image maître pour couvrir un ensemble de surfaces avec UNE génération. */
export function formatSourcePour(serps, formatImpose) {
  if (formatImpose && FORMATS_SOURCE[formatImpose]) return formatImpose;
  const liste = (serps || []).filter((s) => SERPS[s]);
  if (!liste.length) return "paysage";
  // Si toutes les surfaces sont verticales → portrait, sinon paysage (un paysage 3:2 se recadre en 4:3 et 16:9 sans perte notable).
  return liste.every((s) => SERPS[s].formatSource === "portrait") ? "portrait" : "paysage";
}

/** Surfaces compatibles avec l'orientation maître (on ne recadre pas un paysage en 2:3 : la perte serait trop forte). */
export function serpsCompatibles(serps, formatSource) {
  return (serps || []).filter((s) => SERPS[s] && (formatSource === "carre" || SERPS[s].formatSource === formatSource));
}

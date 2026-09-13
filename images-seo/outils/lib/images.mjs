/**
 * Traitement d'image avec sharp : recadrage par surface, surcouche texte (badge / titre)
 * et signature dans la charte, export WebP + JPEG, métadonnées XMP embarquées.
 */
import sharp from "sharp";
import { SERPS } from "./serps.mjs";
import { echapperXml } from "./texte.mjs";

/** Découpe un titre en lignes de longueur bornée. */
export function couperLignes(texte, maxParLigne = 18, maxLignes = 3) {
  const mots = (texte || "").trim().split(/\s+/).filter(Boolean);
  const lignes = [];
  let courante = "";
  for (const mot of mots) {
    if ((courante + " " + mot).trim().length > maxParLigne && courante) {
      lignes.push(courante);
      courante = mot;
    } else courante = (courante + " " + mot).trim();
  }
  if (courante) lignes.push(courante);
  if (lignes.length > maxLignes) {
    const garde = lignes.slice(0, maxLignes);
    garde[maxLignes - 1] = garde[maxLignes - 1].replace(/\s+\S*$/, "") + "…";
    return garde;
  }
  return lignes;
}

/** SVG de surcouche : « badge » (texte court en bas à gauche), « titre » (grand titre en bas) ou « aucune » (signature seule). */
export function svgSurcouche({ largeur, hauteur, mode, texte, charte }) {
  const c = charte.couleurs || {};
  const accent = c.accent || "#F5B700";
  const sombre = c.sombre || "#1C1C1C";
  const clair = c.clair || "#FFFFFF";
  const police = charte.police || "DejaVu Sans, Arial, sans-serif";
  const signature = charte.signature || charte.marque || "";
  const marge = Math.round(largeur * 0.04);
  const elems = [];

  // Signature discrète (toujours) : bas droite, petite pastille sombre translucide.
  if (signature) {
    const taille = Math.round(hauteur * 0.028);
    const largeurTexte = Math.round(signature.length * taille * 0.62) + taille;
    elems.push(
      `<rect x="${largeur - marge - largeurTexte}" y="${hauteur - marge - taille * 1.7}" width="${largeurTexte}" height="${taille * 1.7}" rx="${taille * 0.4}" fill="${sombre}" fill-opacity="0.72"/>`,
      `<text x="${largeur - marge - largeurTexte / 2}" y="${hauteur - marge - taille * 0.5}" font-family="${police}" font-size="${taille}" font-weight="bold" fill="${clair}" text-anchor="middle">${echapperXml(signature)}</text>`
    );
  }

  if (mode === "badge" && texte) {
    const taille = Math.round(hauteur * 0.06);
    const largeurTexte = Math.round(texte.length * taille * 0.6) + taille * 1.2;
    const y = hauteur - marge - taille * 1.8;
    elems.push(
      `<rect x="${marge}" y="${y}" width="${largeurTexte}" height="${taille * 1.8}" rx="${taille * 0.3}" fill="${accent}"/>`,
      `<text x="${marge + taille * 0.6}" y="${y + taille * 1.28}" font-family="${police}" font-size="${taille}" font-weight="bold" fill="${sombre}">${echapperXml(texte)}</text>`
    );
  }

  if (mode === "titre" && texte) {
    const lignes = couperLignes(texte, 16, 3);
    const taille = Math.round(largeur * 0.085);
    const interligne = taille * 1.15;
    const hauteurBloc = lignes.length * interligne + taille * 1.2;
    const y0 = hauteur - hauteurBloc - marge * 1.5;
    elems.push(
      `<rect x="0" y="${y0 - taille}" width="${largeur}" height="${hauteurBloc + taille + marge * 2}" fill="url(#degrade)"/>`,
      `<rect x="${marge}" y="${y0 - taille * 0.2}" width="${taille * 1.2}" height="${taille * 0.28}" fill="${accent}"/>`
    );
    lignes.forEach((l, i) => {
      elems.push(
        `<text x="${marge}" y="${y0 + taille + i * interligne}" font-family="${police}" font-size="${taille}" font-weight="bold" fill="${clair}" stroke="${sombre}" stroke-width="${Math.max(2, taille * 0.05)}" paint-order="stroke">${echapperXml(l)}</text>`
      );
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}">
  <defs><linearGradient id="degrade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sombre}" stop-opacity="0"/><stop offset="1" stop-color="${sombre}" stop-opacity="0.85"/></linearGradient></defs>
  ${elems.join("\n  ")}
</svg>`;
}

/**
 * Produit les déclinaisons d'une image maître pour chaque surface.
 * @returns {Promise<Array<{serp, webp, jpeg, largeur, hauteur}>>} chemins écrits
 */
export async function decliner({ source, dossier, element, charte, xmp, nommer }) {
  const resultats = [];
  const meta = await sharp(source).metadata();
  for (const serp of element.serps) {
    const profil = SERPS[serp];
    if (!profil) continue;
    const { largeur, hauteur } = profil;
    const texte = profil.surcouche === "aucune" ? "" : element.surcouche || "";
    const mode = texte ? profil.surcouche : "aucune";

    let image = sharp(source)
      .rotate()
      .resize(largeur, hauteur, {
        fit: "cover",
        position: sharp.strategy.attention, // recadre sur la zone la plus « saillante » : le sujet
        withoutEnlargement: false,
        kernel: "lanczos3",
      });
    const surcouche = Buffer.from(svgSurcouche({ largeur, hauteur, mode, texte, charte }));
    image = image.composite([{ input: surcouche, top: 0, left: 0 }]).sharpen({ sigma: 0.6 });

    const base = await image.toBuffer();
    const cheminWebp = `${dossier}/${nommer(serp, "webp")}`;
    const cheminJpeg = `${dossier}/${nommer(serp, "jpg")}`;
    let pipeWebp = sharp(base).webp({ quality: 80, effort: 5 });
    let pipeJpeg = sharp(base).jpeg({ quality: 82, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" });
    if (xmp) {
      pipeWebp = pipeWebp.withXmp(xmp);
      pipeJpeg = pipeJpeg.withXmp(xmp);
    }
    await Promise.all([pipeWebp.toFile(cheminWebp), pipeJpeg.toFile(cheminJpeg)]);
    resultats.push({ serp, webp: cheminWebp, jpeg: cheminJpeg, largeur, hauteur, sourceLargeur: meta.width, sourceHauteur: meta.height });
  }
  return resultats;
}

/** Contrôle minimal de l'image maître : dimensions et orientation attendues. */
export async function controlerSource(fichier, formatSource) {
  const meta = await sharp(fichier).metadata();
  const anomalies = [];
  if (!meta.width || !meta.height) anomalies.push("image illisible");
  else {
    if (Math.min(meta.width, meta.height) < 900) anomalies.push(`définition insuffisante (${meta.width}×${meta.height}, minimum 900 px sur le petit côté)`);
    const paysage = meta.width >= meta.height;
    if (formatSource === "portrait" && paysage) anomalies.push("orientation paysage alors qu'un portrait était attendu");
    if (formatSource === "paysage" && !paysage) anomalies.push("orientation portrait alors qu'un paysage était attendu");
  }
  return { ...meta, anomalies };
}

/** Image de substitution (SVG rendu par sharp) : éprouve toute la chaîne sans aucun appel externe. */
import sharp from "sharp";
import { FORMATS_SOURCE } from "../serps.mjs";
import { echapperXml } from "../texte.mjs";

export async function generer({ element, destination }) {
  const f = FORMATS_SOURCE[element.formatSource] || FORMATS_SOURCE.paysage;
  const teinte = 30 + (element.visuel * 47) % 300;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f.largeur}" height="${f.hauteur}">
    <rect width="100%" height="100%" fill="hsl(${teinte},35%,78%)"/>
    <circle cx="${f.largeur / 2}" cy="${f.hauteur / 2}" r="${Math.min(f.largeur, f.hauteur) * 0.28}" fill="hsl(${teinte},60%,40%)"/>
    <text x="50%" y="52%" font-family="DejaVu Sans, sans-serif" font-size="${Math.round(f.hauteur * 0.05)}" fill="#fff" text-anchor="middle">${echapperXml("SIMULATION – " + element.requete)}</text>
  </svg>`;
  const fichier = `${destination}.png`;
  await sharp(Buffer.from(svg)).png().toFile(fichier);
  return { fichier, fournisseur: "simulation", detail: "image de substitution" };
}

/**
 * Publication « export » : range les déclinaisons et tout ce qui les accompagne dans
 * sortie/<date>/<nomFichier>/, écrit le manifeste et régénère le sitemap images cumulé.
 * Le dossier sortie/images/ reflète l'arborescence à téléverser (cheminImages de site.json).
 */
import fs from "node:fs";
import path from "node:path";
import { SORTIE, SITEMAP_IMAGES } from "../chemins.mjs";
import { manifeste, figureHtml, balisesHead, sitemapImages, nomFichier } from "../metadonnees.mjs";
import { ecrireJson } from "../config.mjs";

export function dossierElement(element) {
  return path.join(SORTIE, element.date, element.nomFichier);
}

export async function publier({ element, declinaisons, site, config }) {
  const dossier = dossierElement(element);
  const miroir = path.join(SORTIE, "images");
  fs.mkdirSync(dossier, { recursive: true });
  fs.mkdirSync(miroir, { recursive: true });
  const fichiers = {};
  for (const d of declinaisons) {
    const cibles = {};
    for (const [format, source] of [["webp", d.webp], ["jpeg", d.jpeg]]) {
      const nom = nomFichier(element, d.serp, format === "jpeg" ? "jpg" : format);
      fs.copyFileSync(source, path.join(dossier, nom));
      fs.copyFileSync(source, path.join(miroir, nom));
      cibles[format] = nom;
    }
    fichiers[d.serp] = cibles;
  }
  const m = manifeste(element, site, fichiers);
  ecrireJson(path.join(dossier, "manifeste.json"), m);
  const integration = [
    `<!-- ${element.titrePage} — ${element.url || "URL à compléter"} -->`,
    `<!-- 1) À placer dans <head> -->`,
    balisesHead(element, site),
    ``,
    `<!-- 2) À placer dans le contenu, près du H1 ou du H2 qui parle de « ${element.requete} » -->`,
    ...element.serps.filter((s) => s !== "discover").map((s, i) => figureHtml(element, site, s, { principale: i === 0 })),
    ...(element.serps.includes("discover")
      ? [`<!-- Discover : la déclinaison 16:9 (${nomFichier(element, "discover", "jpg")}) sert d'image mise en avant / og:image (voir 1), pas besoin de l'insérer dans le texte -->`]
      : []),
    ``,
    `<!-- 3) Pinterest -->`,
    m.pinterest ? JSON.stringify(m.pinterest, null, 2) : "(pas de déclinaison Pinterest pour cette page)",
    ``,
  ].join("\n");
  fs.writeFileSync(path.join(dossier, "integration.html"), integration, "utf8");
  if (config.publication?.sitemapImages !== false) regenererSitemap(site);
  return { mode: "export", dossier, fichiers };
}

/** Relit tous les manifestes de sortie/ et recompose le sitemap images. */
export function lireManifestes() {
  if (!fs.existsSync(SORTIE)) return [];
  const liste = [];
  for (const date of fs.readdirSync(SORTIE)) {
    const d = path.join(SORTIE, date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !fs.statSync(d).isDirectory()) continue;
    for (const nom of fs.readdirSync(d)) {
      const f = path.join(d, nom, "manifeste.json");
      if (fs.existsSync(f)) liste.push(JSON.parse(fs.readFileSync(f, "utf8")));
    }
  }
  return liste.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function regenererSitemap(site) {
  const elements = lireManifestes();
  fs.mkdirSync(SORTIE, { recursive: true });
  fs.writeFileSync(SITEMAP_IMAGES, sitemapImages(elements, site), "utf8");
  return SITEMAP_IMAGES;
}

/**
 * Rapproche l'inventaire donnees/pages.json du sitemap réel d'allo-frelons.fr :
 *  - renseigne l'URL des pages seed dont le slug correspond (a_completer → retiré) ;
 *  - ajoute en fin d'inventaire, désactivées (priorite 3, sans visuels), les URLs inconnues
 *    pour qu'elles soient qualifiées à la main (mot-clé, surfaces, angles).
 *   node outils/importer-sitemap.mjs [--sitemap=https://allo-frelons.fr/sitemap.xml] [--essai]
 */
import { chargerEnv, lireSite, lirePages, ecrirePages, arguments_ } from "./lib/config.mjs";
import { slugifier, aplatir } from "./lib/texte.mjs";

export function extraireLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].trim());
}

async function chargerSitemap(url, vus = new Set()) {
  if (vus.has(url)) return [];
  vus.add(url);
  const rep = await fetch(url, { headers: { "User-Agent": "allo-frelons-images-seo" } });
  if (!rep.ok) throw new Error(`${url} → HTTP ${rep.status}`);
  const xml = await rep.text();
  const locs = extraireLocs(xml);
  if (/<sitemapindex/i.test(xml)) {
    const tout = [];
    for (const l of locs) tout.push(...(await chargerSitemap(l, vus)));
    return tout;
  }
  return locs;
}

/** Score de correspondance entre une page seed et une URL : mots du slug/mot-clé présents dans l'URL. */
export function correspondance(page, url) {
  const chemin = aplatir(decodeURIComponent(new URL(url).pathname));
  if (chemin === "/" || /\.(jpg|png|webp|pdf|xml)$/.test(chemin)) return 0;
  const mots = new Set([...slugifier(page.id).split("-"), ...slugifier(page.mot_cle).split("-")].filter((m) => m.length > 2 && !["les", "des", "une", "nid", "dans"].includes(m)));
  let score = 0;
  for (const m of mots) if (chemin.includes(m)) score += m.length;
  if (chemin.includes(slugifier(page.id))) score += 50;
  return score;
}

export function rapprocher(pages, urls) {
  const prises = new Set(pages.map((p) => p.url).filter(Boolean));
  const resultat = pages.map((p) => ({ ...p }));
  for (const p of resultat) {
    if (p.url) continue;
    let meilleur = null;
    for (const u of urls) {
      if (prises.has(u)) continue;
      const s = correspondance(p, u);
      if (s >= 8 && (!meilleur || s > meilleur.s)) meilleur = { u, s };
    }
    if (meilleur) {
      p.url = meilleur.u;
      delete p.a_completer;
      prises.add(meilleur.u);
    }
  }
  const ajoutees = [];
  for (const u of urls) {
    if (prises.has(u)) continue;
    const chemin = new URL(u).pathname;
    if (chemin === "/" || /\.(jpg|png|webp|pdf|xml)$/.test(chemin) || /\/(tag|category|author|page)\//.test(chemin)) continue;
    const id = slugifier(chemin.replace(/\/+$/, "").split("/").pop() || "");
    if (!id || resultat.some((p) => p.id === id)) continue;
    ajoutees.push({ id, url: u, a_qualifier: true, titre: id.replace(/-/g, " "), type: "page", mot_cle: id.replace(/-/g, " "), mots_cles_secondaires: [], serps: ["google-images"], priorite: 3, saison: [], visuels: [] });
  }
  return { pages: [...resultat, ...ajoutees], ajoutees };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  chargerEnv();
  const options = arguments_();
  const site = lireSite();
  const url = options.sitemap || `${site.url}/sitemap.xml`;
  chargerSitemap(url)
    .then((urls) => {
      const { pages, ajoutees } = rapprocher(lirePages(), urls);
      const completees = pages.filter((p) => p.url && !p.a_qualifier).length;
      console.log(`${urls.length} URLs lues ; ${completees} pages avec URL ; ${ajoutees.length} URLs ajoutées à qualifier.`);
      if (!options.essai) ecrirePages(pages);
      else console.log(JSON.stringify(pages.filter((p) => p.url), null, 2));
    })
    .catch((e) => {
      console.error(`Sitemap inaccessible : ${e.message}`);
      process.exit(1);
    });
}

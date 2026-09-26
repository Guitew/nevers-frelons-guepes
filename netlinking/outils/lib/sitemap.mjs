/** Lecture de sitemaps XML (index et sitemaps simples, .gz accepté). */

import { normaliserUrl } from "./url.mjs";

/** URLs <loc> d'un sitemap, et sous-sitemaps s'il s'agit d'un index. */
export function extraireLocs(xml) {
  const texte = String(xml || "");
  const estIndex = /<sitemapindex/i.test(texte);
  const locs = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(texte))) {
    const u = normaliserUrl(m[1].replace(/&amp;/g, "&"));
    if (u) locs.push(u);
  }
  return { estIndex, locs };
}

/** Lit un sitemap (récursivement pour les index), avec un plafond de fichiers. */
export async function lireSitemap(url, telechargeur, { maxFichiers = 30, maxUrls = 5000 } = {}) {
  const urls = [];
  const aLire = [url];
  const lus = new Set();
  while (aLire.length && lus.size < maxFichiers && urls.length < maxUrls) {
    const u = aLire.shift();
    if (lus.has(u)) continue;
    lus.add(u);
    const rep = await telechargeur.recuperer(u, { accepterTout: true });
    if (rep.statut !== 200 || !rep.corps) continue;
    const { estIndex, locs } = extraireLocs(rep.corps);
    if (estIndex) aLire.push(...locs);
    else urls.push(...locs);
  }
  return [...new Set(urls)].slice(0, maxUrls);
}

import test from "node:test";
import assert from "node:assert/strict";
import { extraireLocs, lireSitemap } from "../lib/sitemap.mjs";
import { motsClesPage, ajouterPage, creerCibles, enregistrerRelais, relaisAbsent } from "../lib/cibles.mjs";

test("extraction des <loc>, index de sitemaps, lecture récursive", async () => {
  const index = `<?xml version="1.0"?><sitemapindex xmlns="x"><sitemap><loc>https://site.fr/sitemap-pages.xml</loc></sitemap><sitemap><loc>https://site.fr/sitemap-posts.xml</loc></sitemap></sitemapindex>`;
  const pages = `<urlset><url><loc><![CDATA[https://site.fr/]]></loc></url><url><loc>https://site.fr/frelon-asiatique?utm_source=x</loc></url></urlset>`;
  const posts = `<urlset><url><loc>https://site.fr/blog/a&amp;b</loc></url><url><loc>https://site.fr/</loc></url></urlset>`;
  assert.equal(extraireLocs(index).estIndex, true);
  assert.deepEqual(extraireLocs(pages).locs, ["https://site.fr/", "https://site.fr/frelon-asiatique"]);
  const telechargeur = { async recuperer(url) { const corps = url.endsWith("sitemap.xml") ? index : url.includes("pages") ? pages : posts; return { statut: 200, corps }; } };
  const urls = await lireSitemap("https://site.fr/sitemap.xml", telechargeur);
  assert.deepEqual(urls, ["https://site.fr/", "https://site.fr/frelon-asiatique", "https://site.fr/blog/a&b"]);
});

test("cibles : mots-clés de page, relais présents / absents", () => {
  assert.deepEqual(motsClesPage("https://allo-frelons.fr/nids-de-guepes-et-frelons-dans-le-pas-de-calais-62", "Nids de guêpes"), ["nids", "guepes", "frelons", "calais"]);
  const c = creerCibles({ site: { url: "https://allo-frelons.fr/" } });
  ajouterPage(c, "https://allo-frelons.fr/frelon-asiatique", { titre: "Frelon asiatique" });
  ajouterPage(c, "https://allo-frelons.fr/frelon-asiatique#x", { titre: "Frelon asiatique (bis)" });
  assert.equal(c.pages.length, 1);
  assert.equal(c.pages[0].titre, "Frelon asiatique (bis)");
  const r = enregistrerRelais(c, { url: "https://blog.fr/article/", titre: "Article", liens: [{ href: "https://allo-frelons.fr/", ancre: "Allo Frelons", nofollow: true }] });
  assert.equal(r.etat, "present");
  assert.equal(r.nofollow, true);
  relaisAbsent(c, "https://blog.fr/article/");
  assert.equal(c.relais[0].etat, "absent");
  assert.equal(enregistrerRelais(c, { url: "mailto:x" }), null);
});

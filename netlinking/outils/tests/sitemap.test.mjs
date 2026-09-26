import test from "node:test";
import assert from "node:assert/strict";
import { extraireLocs, lireSitemap } from "../lib/sitemap.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { motsClesPage, ajouterPage, creerCibles, enregistrerRelais, relaisAbsent, lireCibles } from "../lib/cibles.mjs";
import { fichiers } from "../lib/chemins.mjs";
import { mettreAJourPages } from "../cibles.mjs";

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

test("mettreAJourPages : sitemap lu, titres lus une seule fois (sauf --titres=tout)", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "netlinking-cibles-"));
  const config = { site: { nom: "ALLO FRELONS", url: "https://allo-frelons.fr/", domaines: ["allo-frelons.fr"] } };
  const demandes = [];
  const telechargeur = {
    async recuperer(url) {
      demandes.push(url);
      if (url.endsWith("/sitemap.xml")) return { statut: 200, corps: "<urlset><url><loc>https://allo-frelons.fr/frelon-asiatique</loc></url><url><loc>https://allo-frelons.fr/guepes</loc></url><url><loc>https://ailleurs.fr/x</loc></url></urlset>" };
      if (url.includes("allo-frelons.fr/")) return { statut: 200, corps: `<html><head><title>Titre de ${url.split("/").pop()}</title></head></html>` };
      return { statut: 404, corps: null };
    },
  };
  await mettreAJourPages({ config, dossier, telechargeur, titres: true, journal: () => {} });
  let cibles = lireCibles(fichiers(dossier).cibles, config);
  assert.deepEqual(cibles.pages.map((p) => p.url), ["https://allo-frelons.fr/", "https://allo-frelons.fr/frelon-asiatique", "https://allo-frelons.fr/guepes"]);
  assert.equal(cibles.pages[1].titre, "Titre de frelon-asiatique");
  assert.ok(cibles.pages[1].motsCles.includes("asiatique"));
  const avant = demandes.length;
  await mettreAJourPages({ config, dossier, telechargeur, titres: true, journal: () => {} });
  assert.equal(demandes.length - avant, 1, "seul le sitemap est relu : les titres connus ne sont pas redemandés");
  await mettreAJourPages({ config, dossier, telechargeur, titres: "tout", journal: () => {} });
  assert.equal(demandes.length - avant, 1 + 1 + 2, "--titres=tout relit les deux pages");
  cibles = lireCibles(fichiers(dossier).cibles, config);
  assert.equal(cibles.pages.length, 3);
  // Plafond par exécution : les titres manquants se complètent au fil des passages.
  for (const p of cibles.pages.slice(1)) p.titre = "";
  fs.writeFileSync(fichiers(dossier).cibles, JSON.stringify(cibles));
  const avant2 = demandes.length;
  await mettreAJourPages({ config, dossier, telechargeur, titres: true, maxTitres: 1, journal: () => {} });
  assert.equal(demandes.length - avant2, 2, "sitemap + un seul titre");
  assert.equal(lireCibles(fichiers(dossier).cibles, config).pages.filter((p) => p.titre).length, 2);
  fs.rmSync(dossier, { recursive: true, force: true });
});

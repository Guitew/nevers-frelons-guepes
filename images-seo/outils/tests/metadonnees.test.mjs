import { test } from "node:test";
import assert from "node:assert/strict";
import { alt, titre, legende, nomFichier, imageObject, entreeSitemap, sitemapImages, figureHtml, balisesHead, xmp, epinglePinterest } from "../lib/metadonnees.mjs";

const site = { nom: "ALLO FRELONS", url: "https://allo-frelons.fr", baseImages: "https://allo-frelons.fr/img/", zone: "Nord", auteur: "ALLO FRELONS", licenceUrl: "https://allo-frelons.fr/ml/", signature: "allo-frelons.fr" };
const element = {
  id: "2026-07-01-01-nid",
  date: "2026-07-01",
  page: "nid-frelon-asiatique",
  url: "https://allo-frelons.fr/nid-frelon-asiatique/",
  titrePage: "Nid de frelon asiatique",
  mot_cle: "nid de frelon asiatique",
  requete: "nid frelon asiatique",
  angle: "gros nid sphérique de frelon asiatique, beige, suspendu dans un arbre",
  surcouche: "Nid de frelon asiatique",
  serps: ["google-images", "discover", "pinterest"],
  nomFichier: "nid-frelon-asiatique",
};

test("alt : décrit l'image, ≤ 125 caractères, sans préfixe redondant", () => {
  const a = alt(element);
  assert.equal(a, "Gros nid sphérique de frelon asiatique");
  assert.ok(a.length <= 125);
  const b = alt({ ...element, angle: "deux insectes côte à côte" });
  assert.equal(b, "Nid frelon asiatique : deux insectes côte à côte");
});

test("titre / légende / nom de fichier", () => {
  assert.equal(titre(element, site), "Nid frelon asiatique – ALLO FRELONS");
  assert.match(legende(element, site), /^Gros nid sphérique de frelon asiatique\. Photo d'illustration ALLO FRELONS/);
  assert.equal(nomFichier(element, "google-images", "jpg"), "nid-frelon-asiatique.jpg");
  assert.equal(nomFichier(element, "discover", "webp"), "nid-frelon-asiatique-discover.webp");
  assert.equal(nomFichier(element, "pinterest", "jpg"), "nid-frelon-asiatique-pinterest.jpg");
});

test("imageObject : champs de licence et de crédit présents, dimensions par surface", () => {
  const o = imageObject(element, site, "discover");
  assert.equal(o["@type"], "ImageObject");
  assert.equal(o.contentUrl, "https://allo-frelons.fr/img/nid-frelon-asiatique-discover.jpg");
  assert.equal(o.width.value, 1536);
  assert.equal(o.height.value, 864);
  assert.equal(o.creditText, "ALLO FRELONS");
  assert.equal(o.license, "https://allo-frelons.fr/ml/");
  assert.equal(o.creator.name, "ALLO FRELONS");
  assert.equal(o.mainEntityOfPage, element.url);
});

test("sitemap images : une entrée par déclinaison, XML échappé, pages sans URL ignorées", () => {
  const e = entreeSitemap({ ...element, angle: "nid & guêpes <test>" }, site);
  assert.equal((e.match(/<image:image>/g) || []).length, 3);
  assert.match(e, /&amp; gu/);
  assert.doesNotMatch(e, /<test>/);
  assert.equal(entreeSitemap({ ...element, url: "" }, site), "");
  const xml = sitemapImages([element], site);
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /xmlns:image="http:\/\/www.google.com\/schemas\/sitemap-image\/1.1"/);
});

test("figure et head : picture WebP+JPEG, dimensions, max-image-preview, og:image sur la déclinaison Discover", () => {
  const f = figureHtml(element, site, "google-images", { principale: true });
  assert.match(f, /<source srcset="[^"]+\.webp" type="image\/webp">/);
  assert.match(f, /width="1200" height="900" fetchpriority="high"/);
  assert.match(f, /alt="Gros nid sphérique de frelon asiatique"/);
  const p = figureHtml(element, site, "pinterest");
  assert.match(p, /data-pin-description=/);
  const h = balisesHead(element, site);
  assert.match(h, /max-image-preview:large/);
  assert.match(h, /og:image" content="https:\/\/allo-frelons.fr\/img\/nid-frelon-asiatique-discover.jpg"/);
  assert.match(h, /application\/ld\+json/);
});

test("xmp : crédit, droits, licence et mots-clés embarqués", () => {
  const x = xmp(element, site);
  assert.match(x, /<photoshop:Credit>ALLO FRELONS<\/photoshop:Credit>/);
  assert.match(x, /<xmpRights:WebStatement>https:\/\/allo-frelons.fr\/ml\/<\/xmpRights:WebStatement>/);
  assert.match(x, /<rdf:li>nid de frelon asiatique<\/rdf:li>/);
  assert.match(x, /© 2026 ALLO FRELONS/);
});

test("épingle Pinterest : titre court, description ≤ 500, lien vers la page", () => {
  const e = epinglePinterest(element, site);
  assert.equal(e.titre, "Nid de frelon asiatique");
  assert.ok(e.description.length <= 500);
  assert.equal(e.lien, element.url);
});

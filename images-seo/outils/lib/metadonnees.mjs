/**
 * Tout ce qui entoure l'image et que les moteurs lisent : alt, titre, légende,
 * nom de fichier, JSON-LD ImageObject, entrée de sitemap images, extrait HTML,
 * description Pinterest, métadonnées IPTC/XMP embarquées.
 */
import { tronquer, capitaliser, echapperHtml, echapperXml, slugifier, aplatir } from "./texte.mjs";
import { SERPS } from "./serps.mjs";

/** Résume l'angle en une phrase descriptive courte (l'alt décrit l'image, il ne liste pas des mots-clés). */
const MOTS_VIDES = new Set(["de", "des", "du", "la", "le", "les", "et", "ou", "un", "une", "en", "sur", "a", "au", "aux"]);
function motsSignificatifs(texte) {
  return aplatir(texte).split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
}

export function alt(element) {
  const angle = (element.angle || "").split(/[,;:]/)[0].trim();
  const a = aplatir(angle);
  // Si tous les mots porteurs du mot-clé (ou de la requête) figurent déjà dans la description, pas de préfixe.
  const contientSujet = [element.mot_cle, element.requete].some((m) => {
    const mots = motsSignificatifs(m);
    return mots.length && mots.every((mot) => a.includes(mot));
  });
  const base = contientSujet ? angle : `${capitaliser(element.requete)} : ${angle}`;
  return tronquer(capitaliser(base), 125);
}

export function titre(element, site) {
  return tronquer(`${capitaliser(element.requete)} – ${site.nom}`, 70);
}

export function legende(element, site) {
  const a = (element.angle || "").split(/[,;]/)[0].trim();
  return tronquer(`${capitaliser(a)}. Photo d'illustration ${site.nom}, ${site.zone}.`, 200);
}

/** Description longue (Pinterest, champ description WordPress) : contexte + mot-clé + appel à l'action doux. */
export function description(element, site) {
  return tronquer(
    `${capitaliser(element.mot_cle)} : ${element.angle}. En savoir plus sur ${element.titrePage.toLowerCase()} et l'intervention d'un professionnel en ${site.zone} sur ${site.signature || site.url.replace(/^https?:\/\//, "")}.`,
    480
  );
}

/** Nom de fichier par surface : mot-clé en slug + suffixe de surface, jamais d'accents ni d'espaces. */
export function nomFichier(element, serp, extension) {
  const suffixe = { "google-images": "", discover: "-discover", pinterest: "-pinterest" }[serp] ?? `-${slugifier(serp)}`;
  return `${element.nomFichier}${suffixe}.${extension}`;
}

/** URLs publiques des déclinaisons (là où l'export sera téléversé). */
export function urlsPubliques(element, site) {
  const urls = {};
  for (const serp of element.serps) {
    urls[serp] = {
      webp: site.baseImages + nomFichier(element, serp, "webp"),
      jpeg: site.baseImages + nomFichier(element, serp, "jpg"),
    };
  }
  return urls;
}

/** JSON-LD ImageObject : creator / creditText / copyrightNotice / license sont les champs que Google affiche (badge « Licence ») et cite dans AI Overviews. */
export function imageObject(element, site, serp = element.serps[0]) {
  const urls = urlsPubliques(element, site)[serp];
  const dim = SERPS[serp] || SERPS["google-images"];
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    contentUrl: urls.jpeg,
    url: urls.jpeg,
    thumbnailUrl: urls.webp,
    name: titre(element, site),
    caption: legende(element, site),
    description: description(element, site),
    width: { "@type": "QuantitativeValue", value: dim.largeur, unitCode: "E37" },
    height: { "@type": "QuantitativeValue", value: dim.hauteur, unitCode: "E37" },
    encodingFormat: "image/jpeg",
    inLanguage: "fr",
    keywords: [element.mot_cle, element.requete].filter((v, i, a) => v && a.indexOf(v) === i).join(", "),
    creator: { "@type": "Organization", name: site.auteur || site.nom, url: site.url },
    creditText: site.nom,
    copyrightNotice: `© ${new Date(element.date).getFullYear()} ${site.nom}`,
    license: site.licenceUrl || site.url,
    acquireLicensePage: site.licenceUrl || site.url,
    representativeOfPage: serp === "google-images",
    ...(element.url ? { mainEntityOfPage: element.url } : {}),
  };
}

/** Bloc <figure> prêt à coller dans la page (WebP + JPEG, dimensions, lazy sauf image principale). */
export function figureHtml(element, site, serp = element.serps[0], { principale = false } = {}) {
  const urls = urlsPubliques(element, site)[serp];
  const dim = SERPS[serp];
  const chargement = principale ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  const pin = serp === "pinterest" ? ` data-pin-description="${echapperHtml(description(element, site))}" data-pin-url="${echapperHtml(element.url || site.url)}"` : "";
  return [
    `<figure class="image-seo">`,
    `  <picture>`,
    `    <source srcset="${urls.webp}" type="image/webp">`,
    `    <img src="${urls.jpeg}" alt="${echapperHtml(alt(element))}" title="${echapperHtml(titre(element, site))}" width="${dim.largeur}" height="${dim.hauteur}" ${chargement}${pin}>`,
    `  </picture>`,
    `  <figcaption>${echapperHtml(legende(element, site))}</figcaption>`,
    `</figure>`,
  ].join("\n");
}

/** Balises à placer dans <head> de la page hôte. */
export function balisesHead(element, site) {
  const principale = element.serps.includes("discover") ? "discover" : element.serps[0];
  const urls = urlsPubliques(element, site)[principale];
  const dim = SERPS[principale];
  return [
    `<meta name="robots" content="max-image-preview:large">`,
    `<meta property="og:image" content="${urls.jpeg}">`,
    `<meta property="og:image:width" content="${dim.largeur}">`,
    `<meta property="og:image:height" content="${dim.hauteur}">`,
    `<meta property="og:image:alt" content="${echapperHtml(alt(element))}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json">${JSON.stringify(imageObject(element, site, principale))}</script>`,
  ].join("\n");
}

/** Entrée <url> pour le sitemap images (une <image:image> par déclinaison). */
export function entreeSitemap(element, site) {
  if (!element.url) return "";
  const images = element.serps
    .map((serp) => {
      const urls = urlsPubliques(element, site)[serp];
      return [
        `    <image:image>`,
        `      <image:loc>${echapperXml(urls.jpeg)}</image:loc>`,
        `      <image:title>${echapperXml(titre(element, site))}</image:title>`,
        `      <image:caption>${echapperXml(legende(element, site))}</image:caption>`,
        `      <image:license>${echapperXml(site.licenceUrl || site.url)}</image:license>`,
        `    </image:image>`,
      ].join("\n");
    })
    .join("\n");
  return [`  <url>`, `    <loc>${echapperXml(element.url)}</loc>`, images, `  </url>`].join("\n");
}

export function sitemapImages(elements, site) {
  const corps = elements.map((e) => entreeSitemap(e, site)).filter(Boolean).join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
    corps,
    `</urlset>`,
    ``,
  ].join("\n");
}

/** Texte prêt pour une épingle Pinterest (titre ≤ 100, description ≤ 500, lien retour). */
export function epinglePinterest(element, site) {
  return {
    titre: tronquer(capitaliser(element.surcouche || element.requete), 100),
    description: description(element, site),
    lien: element.url || site.url,
    tableau: capitaliser(element.mot_cle.split(" ").slice(0, 3).join(" ")),
  };
}

/** Métadonnées embarquées dans le fichier (IPTC via XMP) : Google lit creator/credit/copyright/licence pour le badge « Licence » de Google Images. */
export function xmp(element, site) {
  const e = (s) => echapperXml(s);
  const annee = new Date(element.date).getFullYear();
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
    xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"
    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${e(titre(element, site))}</rdf:li></rdf:Alt></dc:title>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${e(alt(element))}</rdf:li></rdf:Alt></dc:description>
   <dc:creator><rdf:Seq><rdf:li>${e(site.auteur || site.nom)}</rdf:li></rdf:Seq></dc:creator>
   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© ${annee} ${e(site.nom)}</rdf:li></rdf:Alt></dc:rights>
   <dc:subject><rdf:Bag>${[element.mot_cle, element.requete].filter((v, i, a) => v && a.indexOf(v) === i).map((k) => `<rdf:li>${e(k)}</rdf:li>`).join("")}</rdf:Bag></dc:subject>
   <photoshop:Credit>${e(site.nom)}</photoshop:Credit>
   <photoshop:Source>${e(site.nom)}</photoshop:Source>
   <photoshop:Headline>${e(titre(element, site))}</photoshop:Headline>
   <xmpRights:WebStatement>${e(site.licenceUrl || site.url)}</xmpRights:WebStatement>
   <xmpRights:Marked>True</xmpRights:Marked>
   <plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource"><plus:LicensorName>${e(site.nom)}</plus:LicensorName><plus:LicensorURL>${e(site.url)}</plus:LicensorURL></rdf:li></rdf:Seq></plus:Licensor>
   <Iptc4xmpCore:CreatorContactInfo rdf:parseType="Resource"><Iptc4xmpCore:CiUrlWork>${e(site.url)}</Iptc4xmpCore:CiUrlWork></Iptc4xmpCore:CreatorContactInfo>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** Manifeste complet d'un élément publié (source de vérité pour le sitemap cumulé et l'intégration). */
export function manifeste(element, site, fichiers) {
  return {
    id: element.id,
    date: element.date,
    page: element.page,
    url: element.url,
    titrePage: element.titrePage,
    mot_cle: element.mot_cle,
    requete: element.requete,
    angle: element.angle,
    surcouche: element.surcouche || "",
    nomFichier: element.nomFichier,
    serps: element.serps,
    alt: alt(element),
    titre: titre(element, site),
    legende: legende(element, site),
    description: description(element, site),
    urls: urlsPubliques(element, site),
    fichiers,
    pinterest: element.serps.includes("pinterest") ? epinglePinterest(element, site) : null,
    jsonLd: element.serps.map((s) => imageObject(element, site, s)),
    prompt: element.prompt,
  };
}

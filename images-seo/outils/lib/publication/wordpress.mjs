/**
 * Publication WordPress par l'API REST : téléverse chaque déclinaison dans la
 * médiathèque avec alt / titre / légende / description, la rattache à l'article
 * et la définit comme image mise en avant si l'article n'en a pas.
 *
 * Authentification : identifiant + « mot de passe d'application » (WP ≥ 5.6),
 * variables WP_UTILISATEUR et WP_MOT_DE_PASSE_APPLICATION.
 */
import fs from "node:fs";
import path from "node:path";
import { alt, titre, legende, description, nomFichier } from "../metadonnees.mjs";

function entete() {
  const u = process.env.WP_UTILISATEUR;
  const p = process.env.WP_MOT_DE_PASSE_APPLICATION;
  if (!u || !p) throw new Error("WP_UTILISATEUR / WP_MOT_DE_PASSE_APPLICATION absents");
  return { Authorization: "Basic " + Buffer.from(`${u}:${p}`).toString("base64") };
}

/** Retrouve l'article/page WordPress par son URL (slug) dans les types configurés. */
export async function trouverContenu(site, url, types = ["posts", "pages"]) {
  if (!url) return null;
  const slug = url.replace(/\/+$/, "").split("/").pop();
  for (const type of types) {
    const rep = await fetch(`${site.url}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}&_fields=id,featured_media,link`, { headers: entete() });
    if (!rep.ok) continue;
    const liste = await rep.json();
    if (liste.length) return { type, ...liste[0] };
  }
  return null;
}

export async function televerser(site, fichier, { element, serp, format, postId }) {
  const octets = fs.readFileSync(fichier);
  const nom = nomFichier(element, serp, format === "jpeg" ? "jpg" : format);
  const rep = await fetch(`${site.url}/wp-json/wp/v2/media${postId ? `?post=${postId}` : ""}`, {
    method: "POST",
    headers: {
      ...entete(),
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Content-Type": format === "jpeg" ? "image/jpeg" : "image/webp",
    },
    body: octets,
  });
  if (!rep.ok) throw new Error(`WordPress media ${rep.status} : ${(await rep.text()).slice(0, 200)}`);
  const media = await rep.json();
  const maj = await fetch(`${site.url}/wp-json/wp/v2/media/${media.id}`, {
    method: "POST",
    headers: { ...entete(), "Content-Type": "application/json" },
    body: JSON.stringify({
      alt_text: alt(element),
      title: titre(element, site),
      caption: legende(element, site),
      description: description(element, site),
    }),
  });
  if (!maj.ok) throw new Error(`WordPress media (métadonnées) ${maj.status}`);
  return await maj.json();
}

export async function publier({ element, declinaisons, site, config }) {
  const reglages = config.publication?.wordpress || {};
  const contenu = await trouverContenu(site, element.url, reglages.typesContenu);
  const medias = {};
  for (const d of declinaisons) {
    medias[d.serp] = {
      jpeg: await televerser(site, d.jpeg, { element, serp: d.serp, format: "jpeg", postId: contenu?.id }),
      webp: await televerser(site, d.webp, { element, serp: d.serp, format: "webp", postId: contenu?.id }),
    };
  }
  let miseEnAvant = null;
  if (contenu && reglages.definirImageMiseEnAvant && (reglages.definirImageMiseEnAvant === "toujours" || !contenu.featured_media)) {
    const principale = medias[element.serps.includes("discover") ? "discover" : element.serps[0]]?.jpeg;
    if (principale) {
      const rep = await fetch(`${site.url}/wp-json/wp/v2/${contenu.type}/${contenu.id}`, {
        method: "POST",
        headers: { ...entete(), "Content-Type": "application/json" },
        body: JSON.stringify({ featured_media: principale.id }),
      });
      if (rep.ok) miseEnAvant = principale.id;
    }
  }
  return {
    mode: "wordpress",
    contenu: contenu ? { id: contenu.id, type: contenu.type } : null,
    medias: Object.fromEntries(Object.entries(medias).map(([s, m]) => [s, { jpeg: m.jpeg.source_url, webp: m.webp.source_url }])),
    miseEnAvant,
    avertissement: contenu ? null : `article introuvable pour ${element.url || "(URL vide)"} : médias téléversés sans rattachement`,
  };
}

export { path };

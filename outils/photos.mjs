#!/usr/bin/env node
/**
 * Téléchargement des photos d'espèces depuis Wikimedia Commons.
 *
 * Pour chaque fiche de `src/especes/*.md`, le script :
 *   1. recherche l'article correspondant (par nom scientifique) sur Wikipédia,
 *   2. récupère l'image principale (illustration de tête / taxobox),
 *   3. lit sa licence et son auteur sur Wikimedia Commons,
 *   4. télécharge l'image dans `src/assets/img/especes/<slug>.jpg`,
 *   5. renseigne dans la fiche les champs `image`, `image_alt`, `credit`,
 *      `credit_url` (attribution obligatoire des licences Creative Commons).
 *
 * Les images sous licence non libre sont ignorées (Wikimedia Commons n'héberge
 * en principe que des médias libres, mais le contrôle est conservé par sécurité).
 *
 * Utilisation :
 *   node outils/photos.mjs            # toutes les fiches sans image
 *   node outils/photos.mjs --force    # re-télécharge même si une image existe
 *   node outils/photos.mjs oyat vipere-peliade   # seulement ces fiches
 *
 * Nécessite un accès Internet (Node 18+, fetch natif). Aucune clé d'API requise.
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_ESPECES = path.join(RACINE, "src", "especes");
const DOSSIER_IMAGES = path.join(RACINE, "src", "assets", "img", "especes");
const LARGEUR = 1200; // largeur cible des images téléchargées
const UA = "ObservatoireBiodiversiteNPDC/1.0 (site encyclopedique; contact@observatoire-biodiversite-npdc.fr)";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const cibles = args.filter((a) => !a.startsWith("--"));

// Licences acceptées (motifs, insensibles à la casse)
const LICENCES_OK = /(^cc0)|(^cc[ -]?by)|(public domain)|(pdm)|(domaine public)/i;

async function api(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url}`);
  return r.json();
}

/** Recherche l'image de tête d'un article et son nom de fichier Commons. */
async function trouverFichier(nomScientifique) {
  for (const lang of ["fr", "en"]) {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(nomScientifique)}&gsrlimit=1` +
      `&prop=pageimages&piprop=name&pilicense=any`;
    try {
      const data = await api(url);
      const pages = data?.query?.pages || {};
      for (const k of Object.keys(pages)) {
        const nom = pages[k]?.pageimage;
        if (nom) return nom;
      }
    } catch (e) {
      /* on tente la langue suivante */
    }
  }
  return null;
}

/** Récupère l'URL téléchargeable et les métadonnées de licence d'un fichier Commons. */
async function infosFichier(nomFichier) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&titles=${encodeURIComponent("File:" + nomFichier)}` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${LARGEUR}`;
  const data = await api(url);
  const pages = data?.query?.pages || {};
  const page = pages[Object.keys(pages)[0]];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  return {
    url: info.thumburl || info.url,
    descriptionUrl: info.descriptionurl,
    auteur: nettoyerHtml(meta.Artist?.value) || "Auteur inconnu",
    licence: (meta.LicenseShortName?.value || meta.License?.value || "").trim(),
    licenceUrl: meta.LicenseUrl?.value || info.descriptionurl || "",
  };
}

function nettoyerHtml(s) {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function telecharger(url, destination) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Téléchargement échoué : HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeFile(destination, buf);
  return buf.length;
}

/** Insère ou remplace un champ dans le front matter YAML d'un fichier .md. */
function definirChamp(contenu, cle, valeur) {
  const ligne = `${cle}: ${JSON.stringify(valeur)}`;
  const fm = contenu.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return contenu;
  let bloc = fm[1];
  const re = new RegExp(`^${cle}:.*$`, "m");
  if (re.test(bloc)) {
    bloc = bloc.replace(re, ligne);
  } else {
    // insérer juste après la ligne nom_scientifique (ou en fin de bloc)
    if (/^nom_scientifique:.*$/m.test(bloc)) {
      bloc = bloc.replace(/^(nom_scientifique:.*)$/m, `$1\n${ligne}`);
    } else {
      bloc = `${bloc}\n${ligne}`;
    }
  }
  return contenu.replace(fm[0], `---\n${bloc}\n---`);
}

function lireChamp(contenu, cle) {
  const m = contenu.match(new RegExp(`^${cle}:\\s*["']?(.*?)["']?\\s*$`, "m"));
  return m ? m[1] : null;
}

async function main() {
  if (!existsSync(DOSSIER_IMAGES)) await mkdir(DOSSIER_IMAGES, { recursive: true });

  let fichiers = (await readdir(DOSSIER_ESPECES)).filter((f) => f.endsWith(".md"));
  if (cibles.length) {
    fichiers = fichiers.filter((f) => cibles.includes(f.replace(/\.md$/, "")));
  }

  let ok = 0;
  let ignores = 0;
  const echecs = [];

  for (const fichier of fichiers) {
    const slug = fichier.replace(/\.md$/, "");
    const chemin = path.join(DOSSIER_ESPECES, fichier);
    let contenu = await readFile(chemin, "utf8");

    const sci = lireChamp(contenu, "nom_scientifique");
    const nomCommun = lireChamp(contenu, "nom_commun") || slug;
    if (!sci) {
      console.warn(`⚠︎  ${slug} : nom_scientifique introuvable, ignoré.`);
      continue;
    }

    const dejaImage = lireChamp(contenu, "image");
    if (dejaImage && !FORCE) {
      console.log(`•  ${slug} : image déjà présente, ignorée (utilisez --force).`);
      continue;
    }

    try {
      process.stdout.write(`→  ${slug} (${sci}) … `);
      const nomFichier = await trouverFichier(sci);
      if (!nomFichier) {
        console.log("aucune image trouvée");
        echecs.push(slug);
        continue;
      }
      const infos = await infosFichier(nomFichier);
      if (!infos?.url) {
        console.log("métadonnées indisponibles");
        echecs.push(slug);
        continue;
      }
      if (infos.licence && !LICENCES_OK.test(infos.licence)) {
        console.log(`licence non libre ignorée (${infos.licence})`);
        ignores++;
        continue;
      }

      const ext = (infos.url.split(".").pop() || "jpg").split("?")[0].toLowerCase();
      const nomImage = `${slug}.${ext === "jpeg" ? "jpg" : ext}`;
      const dest = path.join(DOSSIER_IMAGES, nomImage);
      const taille = await telecharger(infos.url, dest);

      const credit = `${infos.auteur} / Wikimedia Commons${infos.licence ? " — " + infos.licence : ""}`;
      contenu = definirChamp(contenu, "image", `/assets/img/especes/${nomImage}`);
      contenu = definirChamp(contenu, "image_alt", `${nomCommun} (${sci})`);
      contenu = definirChamp(contenu, "credit", credit);
      contenu = definirChamp(contenu, "credit_url", infos.licenceUrl || infos.descriptionUrl || "");
      await writeFile(chemin, contenu);

      console.log(`OK (${Math.round(taille / 1024)} Ko) — ${credit}`);
      ok++;
    } catch (e) {
      console.log(`échec : ${e.message}`);
      echecs.push(slug);
    }

    // Courtoisie envers l'API Wikimedia
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\nTerminé : ${ok} image(s) téléchargée(s), ${ignores} ignorée(s) (licence), ${echecs.length} échec(s).`);
  if (echecs.length) console.log("À vérifier manuellement : " + echecs.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Contrôle du site compilé, avant mise en ligne.
 *
 * Écrit après avoir laissé passer un bug de fil d'Ariane identique sur toutes
 * les fiches : sur un site généré, une erreur de gabarit se duplique sur des
 * milliers de pages sans qu'aucun test unitaire ne la voie. Ce contrôle
 * regarde le résultat, pas le code.
 *
 * Vérifie :
 *   • les liens internes qui ne mènent nulle part ;
 *   • les balises <title> et méta-descriptions dupliquées ;
 *   • les canoniques manquantes ou incohérentes ;
 *   • les fils d'Ariane identiques d'une fiche à l'autre ;
 *   • la présence des fichiers indispensables (.htaccess, sitemap, robots…) ;
 *   • la cohérence entre les fiches retirées et les règles du .htaccess ;
 *   • la cohérence de l'index de sitemaps (fichiers listés présents, URLs
 *     déclarées réellement compilées et indexables).
 *
 * Usage : npm run verifier   (code de sortie non nul si anomalie bloquante)
 */

import fs from "node:fs";
import path from "node:path";
import site from "./lib/site.mjs";
import { lireFiches, urlFiche, ETATS } from "./lib/fiches.mjs";
import { RACINE } from "./lib/chemins.mjs";

const SORTIE = path.join(RACINE, "_site");
const anomalies = [];
const avertissements = [];

if (!fs.existsSync(SORTIE)) {
  console.error("Le dossier _site est absent : lancez « npm run build » d'abord.");
  process.exit(1);
}

function parcourir(dossier, extension) {
  const trouves = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) trouves.push(...parcourir(p, extension));
    else if (p.endsWith(extension)) trouves.push(p);
  }
  return trouves;
}

/** Ajoute une valeur à une Map de listes. */
function ajouter(map, cle, valeur) {
  if (!map.has(cle)) map.set(cle, []);
  map.get(cle).push(valeur);
}

const pages = parcourir(SORTIE, ".html");
const urlDe = (p) => "/" + path.relative(SORTIE, p).replace(/index\.html$/, "");

// --- Fichiers indispensables
for (const attendu of [".htaccess", "sitemap.xml", "sitemaps/pages.xml", "robots.txt", "llms.txt", "404.html", "410.html", "flux.xml"]) {
  if (!fs.existsSync(path.join(SORTIE, attendu))) anomalies.push(`Fichier manquant : /${attendu}`);
}

const titres = new Map();
const descriptions = new Map();
const fils = new Map();
const liensCasses = new Map();
// Les fiches qui ne sont plus publiées (retirées ou archivées) n'ont pas de
// page : les liens qui les visent depuis le tableau de bord sont volontaires.
const horsLigne = new Set(lireFiches().filter((f) => f.statut !== ETATS.PUBLIEE).map(urlFiche));

for (const p of pages) {
  const html = fs.readFileSync(p, "utf8");
  const url = urlDe(p);
  const indexable = !/name="robots" content="noindex/.test(html);

  const titre = html.match(/<title>(.*?)<\/title>/s)?.[1];
  const desc = html.match(/name="description" content="(.*?)"/s)?.[1];
  const canonique = html.match(/rel="canonical" href="(.*?)"/)?.[1];

  if (!titre) anomalies.push(`Titre absent : ${url}`);
  if (!desc) anomalies.push(`Méta-description absente : ${url}`);
  if (indexable) {
    if (titre) ajouter(titres, titre, url);
    if (desc) ajouter(descriptions, desc, url);
    if (canonique !== site.url + url) {
      anomalies.push(`Canonique incohérente : ${url} → ${canonique || "absente"}`);
    }
  }

  // Fil d'Ariane : un même fil sur plusieurs pages profondes trahit une
  // variable figée par la pagination (cf. eleventyComputed et les tableaux).
  const fil = html.match(/<nav class="ariane"[\s\S]*?<\/nav>/)?.[0];
  if (fil) {
    const etapes = [...fil.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean).join(" › ");
    ajouter(fils, etapes, url);
  }

  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const cible = m[1];
    if (cible.startsWith("/assets/") || horsLigne.has(cible)) continue;
    const existe = [
      path.join(SORTIE, cible),
      path.join(SORTIE, cible, "index.html"),
      path.join(SORTIE, cible.replace(/\/$/, "") + ".html"),
    ].some((c) => fs.existsSync(c));
    if (!existe) {
      if (!liensCasses.has(cible)) liensCasses.set(cible, new Set());
      liensCasses.get(cible).add(url);
    }
  }
}

for (const [t, urls] of titres) if (urls.length > 1) anomalies.push(`Titre dupliqué « ${t} » : ${urls.join(", ")}`);
for (const [, urls] of descriptions) if (urls.length > 1) avertissements.push(`Méta-description dupliquée : ${urls.join(", ")}`);
for (const [fil, urls] of fils) {
  if (urls.length > 1 && urls.some((u) => u.split("/").filter(Boolean).length >= 3)) {
    anomalies.push(`Fil d'Ariane identique sur ${urls.length} pages (« ${fil} ») : ${urls.slice(0, 3).join(", ")}…`);
  }
}
for (const [cible, sources] of liensCasses) {
  anomalies.push(`Lien interne cassé : ${cible} ← ${[...sources].slice(0, 3).join(", ")}`);
}

// --- Cohérence de l'index de sitemaps
//     Une URL déclarée dans un sitemap mais absente du site, ou déclarée alors
//     qu'elle porte un noindex, est un signal contradictoire envoyé à Google.
const sitemapIndex = fs.readFileSync(path.join(SORTIE, "sitemap.xml"), "utf8");
const declares = [...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!declares.length) anomalies.push("L'index de sitemaps ne référence aucun sitemap.");

let urlsDeclarees = 0;
for (const url of declares) {
  const relatif = url.replace(site.url, "");
  const fichier = path.join(SORTIE, relatif);
  if (!fs.existsSync(fichier)) {
    anomalies.push(`Sitemap déclaré mais absent : ${relatif}`);
    continue;
  }
  const contenu = fs.readFileSync(fichier, "utf8");
  for (const m of contenu.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    urlsDeclarees++;
    const chemin = m[1].replace(site.url, "");
    const page = path.join(SORTIE, chemin, "index.html");
    if (!fs.existsSync(page)) {
      anomalies.push(`URL au sitemap sans page compilée : ${chemin} (${relatif})`);
    } else if (/name="robots" content="noindex/.test(fs.readFileSync(page, "utf8"))) {
      anomalies.push(`URL au sitemap marquée noindex : ${chemin} (${relatif})`);
    }
  }
}

// --- Cohérence des retraits avec le .htaccess
const htaccess = fs.readFileSync(path.join(SORTIE, ".htaccess"), "utf8");
for (const fiche of lireFiches().filter((f) => f.statut === ETATS.RETIREE)) {
  const url = urlFiche(fiche);
  const attendu = `RedirectMatch ${fiche.retrait.mode} ^${url}`;
  if (!htaccess.includes(attendu)) anomalies.push(`Règle ${fiche.retrait.mode} absente du .htaccess : ${url}`);
  if (fs.existsSync(path.join(SORTIE, url, "index.html"))) {
    anomalies.push(`Fiche retirée encore compilée : ${url}`);
  }
  if (fiche.retrait.mode === "301" && !fs.existsSync(path.join(SORTIE, fiche.retrait.cible, "index.html"))) {
    anomalies.push(`Cible de redirection inexistante : ${url} → ${fiche.retrait.cible}`);
  }
}

console.log(
  `\n  CONTRÔLE DU SITE COMPILÉ — ${pages.length} pages HTML, ` +
    `${urlsDeclarees} URLs au sitemap\n  ${"─".repeat(50)}`
);
if (avertissements.length) {
  console.log(`\n  ${avertissements.length} avertissement(s) :`);
  for (const a of avertissements) console.log(`  ~ ${a}`);
}
if (anomalies.length) {
  console.log(`\n  ${anomalies.length} anomalie(s) bloquante(s) :`);
  for (const a of anomalies) console.log(`  ✗ ${a}`);
  console.log("");
  process.exit(1);
}
console.log("\n  ✓ Aucune anomalie bloquante.\n");

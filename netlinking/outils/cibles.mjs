#!/usr/bin/env node
/**
 * Cibles — entretient donnees/cibles.json :
 *   • les pages d'allo-frelons.fr (lecture du sitemap), avec leurs mots-clés, pour
 *     proposer à chaque spot la page la plus proche de son thème ;
 *   • les pages relais (qui pointent déjà vers allo-frelons.fr), à pousser depuis
 *     les spots de masse (niveau 2).
 *
 * Usage :
 *   node outils/cibles.mjs                              lit le sitemap du site et met à jour les pages
 *   node outils/cibles.mjs --titres                     idem, en lisant aussi le <title> de chaque page
 *   node outils/cibles.mjs --relais=https://…           déclare une page relais (répétable, virgules acceptées)
 *   node outils/cibles.mjs --csv=export.csv             importe des URLs ou domaines (1re colonne) d'un export
 *                                                       Search Console « Sites les plus liés » : les domaines
 *                                                       sont mis en frontière pour retrouver la page exacte
 *   node outils/cibles.mjs --verifier                   revisite les relais et vérifie que le lien est encore là
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { lireArgs } from "./lib/args.mjs";
import { fichiers } from "./lib/chemins.mjs";
import { ajouterPage, ecrireCibles, enregistrerRelais, lireCibles, relaisAbsent } from "./lib/cibles.mjs";
import { premiereColonne } from "./lib/csv.mjs";
import { ajouterFrontiere, ecrireExploration, lireExploration } from "./lib/exploration.mjs";
import { analyserHtml } from "./lib/html.mjs";
import { lireSitemap } from "./lib/sitemap.mjs";
import { creerTelechargeur } from "./lib/telechargeur.mjs";
import { appartientA, normaliserUrl } from "./lib/url.mjs";

export async function mettreAJourPages({ config, dossier, telechargeur, titres = false, journal = console.log }) {
  const chemins = fichiers(dossier);
  const cibles = lireCibles(chemins.cibles, config);
  const base = new URL(config.site.url);
  const candidats = [`${base.origin}/sitemap.xml`, `${base.origin}/sitemap_index.xml`, `${base.origin}/sitemap-index.xml`, `${base.origin}/wp-sitemap.xml`];
  let urls = [];
  for (const s of candidats) {
    urls = await lireSitemap(s, telechargeur);
    if (urls.length) {
      journal(`Sitemap ${s} : ${urls.length} URL(s).`);
      break;
    }
  }
  if (!urls.length) journal("Aucun sitemap lisible : la page d'accueil reste la seule cible connue.");
  ajouterPage(cibles, config.site.url, { titre: config.site.nom, principale: true });
  for (const u of urls) {
    if (!appartientA(u, config.site.domaines)) continue;
    const page = ajouterPage(cibles, u);
    if (titres && page) {
      const rep = await telechargeur.recuperer(u);
      if (rep.statut === 200 && rep.corps) ajouterPage(cibles, u, { titre: analyserHtml(rep.corps, u).titre });
    }
  }
  ecrireCibles(chemins.cibles, cibles);
  journal(`${cibles.pages.length} page(s) cible(s) enregistrée(s).`);
  return cibles;
}

export async function verifierRelais({ config, dossier, telechargeur, journal = console.log }) {
  const chemins = fichiers(dossier);
  const cibles = lireCibles(chemins.cibles, config);
  const compteurs = { present: 0, absent: 0, erreur: 0 };
  for (const r of cibles.relais) {
    const rep = await telechargeur.recuperer(r.url);
    if (rep.statut !== 200 || !rep.corps) {
      if (rep.statut === 404 || rep.statut === 410) {
        relaisAbsent(cibles, r.url, `page ${rep.statut}`);
        compteurs.absent++;
      } else compteurs.erreur++;
      journal(`  · ${r.url} → ${rep.statut || rep.erreur}`);
      continue;
    }
    const page = analyserHtml(rep.corps, rep.url || r.url);
    const liens = page.liens.filter((l) => appartientA(l.href, config.site.domaines));
    if (liens.length) {
      enregistrerRelais(cibles, { url: r.url, titre: page.titre, liens: liens.map((l) => ({ href: l.href, ancre: l.texte, nofollow: l.nofollow, ugc: l.ugc })) }, { source: r.source });
      compteurs.present++;
      journal(`  ✓ ${r.url} (${liens.length} lien(s)${liens.every((l) => l.nofollow) ? ", nofollow" : ""})`);
    } else {
      relaisAbsent(cibles, r.url);
      compteurs.absent++;
      journal(`  ✗ ${r.url} : plus de lien vers ${config.site.domaines[0]}`);
    }
  }
  ecrireCibles(chemins.cibles, cibles);
  return compteurs;
}

async function principal() {
  const { chargerConfig } = await import("./lib/config.mjs");
  const config = chargerConfig();
  const args = lireArgs();
  const chemins = fichiers();
  const exp = config.exploration;
  const telechargeur = creerTelechargeur({ userAgent: exp.userAgent, agentRobots: exp.agentRobots, timeoutMs: exp.timeoutMs, tailleMax: exp.tailleMaxOctets, delaiParHoteMs: 1000 });

  if (args.has("relais")) {
    const cibles = lireCibles(chemins.cibles, config);
    for (const u of args.liste("relais")) {
      const r = enregistrerRelais(cibles, { url: u }, { source: "manuel" });
      console.log(r ? `Relais déclaré : ${r.url} (à vérifier avec --verifier)` : `URL ignorée : ${u}`);
    }
    ecrireCibles(chemins.cibles, cibles);
  }

  if (args.has("csv")) {
    const cibles = lireCibles(chemins.cibles, config);
    const etat = lireExploration(chemins.exploration);
    let relais = 0;
    let domaines = 0;
    for (const valeur of premiereColonne(fs.readFileSync(args.get("csv"), "utf8"))) {
      const v = valeur.trim();
      if (!v || /^(site|page|url|domaine|domain|sites|pages)$/i.test(v)) continue;
      const u = normaliserUrl(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      if (!u || appartientA(u, config.site.domaines)) continue;
      if (/^https?:\/\/[^/]+\/?$/.test(u)) {
        // Domaine seul : on l'explore pour retrouver la page qui fait le lien.
        if (ajouterFrontiere(etat, { url: u, origine: "relais", detail: "import Search Console", priorite: 95 }, config)) domaines++;
      } else {
        enregistrerRelais(cibles, { url: u }, { source: "csv" });
        relais++;
      }
    }
    ecrireCibles(chemins.cibles, cibles);
    ecrireExploration(chemins.exploration, etat);
    console.log(`Import : ${relais} page(s) relais déclarée(s), ${domaines} domaine(s) mis en frontière (lancer « npm run explorer » pour retrouver les pages exactes).`);
  }

  if (args.has("verifier")) {
    const c = await verifierRelais({ config, telechargeur });
    console.log(`Relais présents : ${c.present} · absents : ${c.absent} · erreurs : ${c.erreur}.`);
  }

  if (!args.has("relais") && !args.has("csv") && !args.has("verifier")) {
    await mettreAJourPages({ config, telechargeur, titres: args.has("titres") });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

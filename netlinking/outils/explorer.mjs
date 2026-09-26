#!/usr/bin/env node
/**
 * Exploration — visite les pages de la frontière, qualifie chaque page
 * (spot ou non), enregistre les pages qui pointent déjà vers allo-frelons.fr
 * (relais) et alimente la frontière avec les liens découverts.
 *
 * Sources de la frontière :
 *   • donnees/graines.txt              URLs de départ (une par ligne) ;
 *   • node outils/chercher.mjs         résultats des requêtes d'empreinte ;
 *   • les liens trouvés en chemin      internes (même site) et externes (autres
 *                                      sites, si « suivreExternes »), les pages
 *                                      qui ressemblent à des spots en priorité.
 *
 * Politesse : robots.txt respecté, un accès à la fois par hôte, 2,5 s entre
 * deux accès au même hôte (ou le Crawl-delay), au plus pagesParHote pages
 * par site, taille et délai bornés. Rien n'est jamais publié sur les sites.
 *
 * Usage :
 *   node outils/explorer.mjs                       budget du jour (config.exploration.pagesParExecution)
 *   node outils/explorer.mjs --max=50              limite le nombre de pages
 *   node outils/explorer.mjs --url=https://…       ajoute une URL (répétable) en tête de frontière
 *   node outils/explorer.mjs --graines=fichier.txt ajoute les URLs d'un fichier
 *   node outils/explorer.mjs --sans-externes       reste sur les sites déjà connus
 *   node outils/explorer.mjs --duree=20            s'arrête après 20 minutes
 *   node outils/explorer.mjs --silencieux
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { lireArgs } from "./lib/args.mjs";
import { fichiers } from "./lib/chemins.mjs";
import { lireCibles, ecrireCibles, enregistrerRelais } from "./lib/cibles.mjs";
import { lireExclusions, estExclue } from "./lib/exclusions.mjs";
import { ajouterFrontiere, ecrireExploration, elaguer, lireExploration, marquerVue, prochaine, statistiques } from "./lib/exploration.mjs";
import { qualifierPage } from "./lib/qualification.mjs";
import { ecrireSpots, fusionner, indexer, lireSpots, libelleType } from "./lib/spots.mjs";
import { creerTelechargeur } from "./lib/telechargeur.mjs";
import { estBinaire, hoteDe, memeSite, normaliserUrl } from "./lib/url.mjs";
import { expressionsPresentes } from "./lib/texte.mjs";

/** Lit un fichier de graines (URLs, une par ligne, « # » pour commenter). */
export function lireGraines(chemin) {
  if (!chemin || typeof chemin !== "string" || !fs.existsSync(chemin)) return [];
  return fs
    .readFileSync(chemin, "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .map((l) => (/^https?:\/\//i.test(l) ? l : `https://${l}`))
    .map((l) => normaliserUrl(l))
    .filter(Boolean);
}

/**
 * Lance une exploration.
 * @param {object} options { config, dossier, max, urls, graines, suivreExternes, dureeMin, telechargeur, journal }
 */
export async function explorer(options) {
  const { config, dossier, journal = console.log } = options;
  const chemins = fichiers(dossier);
  const exp = config.exploration;
  const max = options.max ?? exp.pagesParExecution;
  const suivreExternes = options.suivreExternes ?? exp.suivreExternes;
  const echeance = options.dureeMin ? Date.now() + options.dureeMin * 60_000 : Infinity;

  const etat = lireExploration(chemins.exploration);
  const spots = lireSpots(chemins.spots);
  const index = indexer(spots);
  const cibles = lireCibles(chemins.cibles, config);
  const exclusions = lireExclusions(chemins.exclusions);
  const telechargeur =
    options.telechargeur ||
    creerTelechargeur({
      userAgent: exp.userAgent,
      agentRobots: exp.agentRobots,
      timeoutMs: exp.timeoutMs,
      tailleMax: exp.tailleMaxOctets,
      delaiParHoteMs: exp.delaiParHoteMs,
      delaiMaxS: exp.delaiMaxRobotsS,
    });

  // Graines : fichier du projet, fichier passé en option, URLs explicites.
  const graines = [...lireGraines(chemins.graines), ...lireGraines(options.graines), ...(options.urls || []).map((u) => normaliserUrl(/^https?:\/\//i.test(u) ? u : `https://${u}`)).filter(Boolean)];
  let ajoutees = 0;
  for (const g of graines) {
    if (estExclue(g, exclusions, config)) continue;
    if (ajouterFrontiere(etat, { url: g, origine: "graine", priorite: 100 }, config)) ajoutees++;
  }
  if (ajoutees) journal(`${ajoutees} graine(s) ajoutée(s) à la frontière.`);
  const stats = statistiques(etat);
  journal(`Frontière : ${stats.frontiere} URL(s) · déjà vues : ${stats.vues} · hôtes : ${stats.hotes} · budget : ${max} page(s).`);

  const compteurs = { visitees: 0, spots: 0, nouveaux: 0, relais: 0, erreurs: 0, interdites: 0 };
  const hotesOccupes = new Set();
  const themes = [...(config.themes?.principaux || []), ...(config.themes?.connexes || [])];
  let reserve = 0;
  let sauvegardeDepuis = 0;

  const sauvegarder = () => {
    elaguer(etat, config);
    ecrireExploration(chemins.exploration, etat);
    ecrireSpots(chemins.spots, [...index.values()]);
    ecrireCibles(chemins.cibles, cibles);
    sauvegardeDepuis = 0;
  };

  async function traiter(entree) {
    const url = entree.url;
    const rep = await telechargeur.recuperer(url);
    const urlFinale = rep.url && rep.url !== url ? normaliserUrl(rep.url) || url : url;

    if (rep.interdit || rep.bloque) {
      compteurs.interdites++;
      marquerVue(etat, url, { statut: 0, erreur: rep.erreur, bloque: rep.bloque });
      if (rep.bloque) journal(`  ⛔ ${url} : ${rep.erreur}`);
      return;
    }
    if (rep.statut !== 200 || !rep.corps) {
      compteurs.erreurs += rep.statut === 0 ? 1 : 0;
      marquerVue(etat, url, { statut: rep.statut, erreur: rep.erreur });
      if (urlFinale !== url) marquerVue(etat, urlFinale, { statut: rep.statut, erreur: rep.erreur });
      if (!options.silencieux) journal(`  · ${url} → ${rep.statut || rep.erreur}`);
      return;
    }
    if (urlFinale !== url) {
      marquerVue(etat, url, { statut: 301, type: "redirection" });
      if (estExclue(urlFinale, exclusions, config)) return;
      if (etat.vues[urlFinale] && !options.revisiter) return;
    }
    const robots = (await telechargeur.robots(urlFinale)).robots;
    const { page, spot, relais, detection } = qualifierPage({
      url: urlFinale,
      statut: rep.statut,
      entetes: rep.entetes,
      corps: rep.corps,
      robots,
      config,
      cibles,
      origine: { type: entree.origine, detail: entree.detail || "" },
    });
    marquerVue(etat, urlFinale, { statut: rep.statut, type: spot ? spot.type : "page", spot: Boolean(spot) });
    compteurs.visitees++;

    if (relais) {
      enregistrerRelais(cibles, relais);
      compteurs.relais++;
      journal(`  🔗 relais : ${urlFinale} pointe vers ${config.site.domaines[0]}${relais.liens.every((l) => l.nofollow) ? " (nofollow)" : ""}`);
    }
    if (spot) {
      const ancien = index.get(spot.url);
      index.set(spot.url, fusionner(ancien, spot));
      compteurs.spots++;
      if (!ancien) compteurs.nouveaux++;
      journal(`  ★ ${spot.scores.priorite.toString().padStart(3)} ${libelleType(spot.type).padEnd(28)} ${urlFinale}`);
    } else if (!options.silencieux) {
      journal(`  · ${urlFinale} (${page.nbMots} mots, ${page.liens.length} liens)`);
    }

    // Enrichissement de la frontière.
    const profondeur = entree.profondeur || 0;
    const pagePertinente = expressionsPresentes(page.titre + " " + page.h1, themes).length > 0;
    let externesAjoutes = 0;
    for (const u of detection.details.liensUtiles) {
      if (!estExclue(u.href, exclusions, config)) ajouterFrontiere(etat, { url: u.href, origine: "utile", detail: u.motif, profondeur: profondeur + 1, pertinent: true }, config);
    }
    if (profondeur >= exp.profondeurMax) return;
    for (const l of page.liens) {
      if (!l.href || estBinaire(l.href) || estExclue(l.href, exclusions, config)) continue;
      if (memeSite(l.href, urlFinale)) {
        ajouterFrontiere(etat, { url: l.href, texte: l.texte, origine: "lien-interne", detail: hoteDe(urlFinale), profondeur: profondeur + 1, pertinent: pagePertinente }, config);
      } else if (suivreExternes && externesAjoutes < exp.externesParPage && !l.contexte.includes("navigation") && !l.contexte.includes("pied")) {
        const lienPertinent = expressionsPresentes(l.texte + " " + l.href.replace(/[-_/.]+/g, " "), themes).length > 0;
        if (pagePertinente || lienPertinent || l.contexte.includes("lateral") || l.contexte.includes("commentaire")) {
          if (ajouterFrontiere(etat, { url: l.href, texte: l.texte, origine: "lien-externe", detail: `depuis ${hoteDe(urlFinale)}`, profondeur: profondeur + 1, pertinent: lienPertinent }, config)) externesAjoutes++;
        }
      }
    }
  }

  // Boucle de travail : « concurrence » visites en parallèle, jamais deux sur le même hôte.
  let enCours = 0;
  let arret = false;
  await new Promise((resoudre) => {
    const lancer = () => {
      if (arret) {
        if (enCours === 0) resoudre();
        return;
      }
      while (enCours < exp.concurrence && reserve < max && Date.now() < echeance) {
        const entree = prochaine(etat, { hotesOccupes, config });
        if (!entree) break;
        reserve++;
        enCours++;
        hotesOccupes.add(entree.hote);
        traiter(entree)
          .catch((e) => {
            compteurs.erreurs++;
            journal(`  ⚠︎ ${entree.url} : ${e.message}`);
            marquerVue(etat, entree.url, { statut: 0, erreur: e.message });
          })
          .finally(() => {
            enCours--;
            hotesOccupes.delete(entree.hote);
            sauvegardeDepuis++;
            if (sauvegardeDepuis >= 25) sauvegarder();
            lancer();
          });
      }
      if (enCours === 0) {
        arret = true;
        resoudre();
      }
    };
    lancer();
  });

  sauvegarder();
  const fin = statistiques(etat);
  journal(
    `\nVisitées : ${compteurs.visitees} · spots : ${compteurs.spots} (dont ${compteurs.nouveaux} nouveaux) · relais : ${compteurs.relais} · ` +
      `erreurs : ${compteurs.erreurs} · interdites : ${compteurs.interdites} · frontière restante : ${fin.frontiere} · requêtes HTTP : ${telechargeur.compteurs?.requetes ?? "?"}`
  );
  return { compteurs, spots: [...index.values()], cibles, etat };
}

async function principal() {
  const { chargerConfig } = await import("./lib/config.mjs");
  const config = chargerConfig();
  const args = lireArgs();
  const journal = args.has("silencieux") ? () => {} : console.log;
  const resultat = await explorer({
    config,
    max: args.nombre("max", undefined),
    urls: args.liste("url"),
    graines: args.get("graines"),
    suivreExternes: args.has("sans-externes") ? false : undefined,
    dureeMin: args.nombre("duree", undefined),
    silencieux: args.has("silencieux"),
    journal,
  });
  if (args.has("silencieux")) console.log(`Visitées : ${resultat.compteurs.visitees}, spots : ${resultat.compteurs.spots}, nouveaux : ${resultat.compteurs.nouveaux}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Recherche — lance les requêtes d'empreinte sur un moteur (Brave, Serper ou
 * Google Programmable Search) et verse les résultats dans la frontière
 * d'exploration. Sans clé d'API, l'outil s'arrête proprement (ou silencieusement
 * avec --si-possible, pour les enchaînements automatiques).
 *
 * Usage :
 *   node outils/chercher.mjs                     lance les requêtes dues (jamais faites ou périmées)
 *   node outils/chercher.mjs --max=10            au plus 10 requêtes
 *   node outils/chercher.mjs --moteur=serper     force un moteur
 *   node outils/chercher.mjs --requete="frelon asiatique forum"   une requête ponctuelle
 *   node outils/chercher.mjs --generer           affiche les requêtes générées (sans les lancer)
 *   node outils/chercher.mjs --generer --ecrire  les écrit dans donnees/requetes.txt pour édition
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { lireArgs } from "./lib/args.mjs";
import { fichiers } from "./lib/chemins.mjs";
import { lireExclusions, estExclue } from "./lib/exclusions.mjs";
import { ajouterFrontiere, ecrireExploration, lireExploration } from "./lib/exploration.mjs";
import { moteur as creerMoteur, moteursDisponibles } from "./lib/moteurs/index.mjs";
import { genererRequetes, lireRequetes, requetesAFaire } from "./lib/requetes.mjs";
import { appartientA } from "./lib/url.mjs";

/** Verse les résultats d'une liste de requêtes dans la frontière. */
export async function chercher({ config, dossier, moteur, requetes, max, journal = console.log }) {
  const chemins = fichiers(dossier);
  const etat = lireExploration(chemins.exploration);
  const exclusions = lireExclusions(chemins.exclusions);
  const aFaire = requetes ?? requetesAFaire(etat, lireRequetes(chemins.requetes, config).requetes, config, max ?? config.moteurs.requetesParExecution);
  const compteurs = { requetes: 0, resultats: 0, ajoutes: 0, relais: 0, erreurs: 0 };
  const domainesCibles = config.site?.domaines || [];
  const marque = (config.empreintes?.marque || []).map((m) => m.replace(/"/g, "").toLowerCase());

  for (const requete of aFaire) {
    let resultats;
    try {
      resultats = await moteur.chercher(requete, { nombre: config.moteurs.resultatsParRequete, pays: config.moteurs.pays, langue: config.moteurs.langue });
    } catch (e) {
      compteurs.erreurs++;
      journal(`  ⚠︎ « ${requete} » : ${e.message}`);
      if (/HTTP (401|403|429)/.test(e.message)) break; // clé invalide ou quota : inutile d'insister
      continue;
    }
    compteurs.requetes++;
    compteurs.resultats += resultats.length;
    let ajoutes = 0;
    const requeteMarque = marque.some((m) => requete.toLowerCase().includes(m));
    for (const r of resultats) {
      if (appartientA(r.url, domainesCibles)) continue; // nos propres pages
      if (estExclue(r.url, exclusions, config)) continue;
      const origine = requeteMarque ? "relais" : "requete";
      if (ajouterFrontiere(etat, { url: r.url, texte: r.titre, origine, detail: requete, profondeur: 0, pertinent: true }, config)) {
        ajoutes++;
        if (requeteMarque) compteurs.relais++;
      }
    }
    compteurs.ajoutes += ajoutes;
    etat.requetes[requete] = { date: new Date().toISOString().slice(0, 10), moteur: moteur.nom, resultats: resultats.length, ajoutes };
    journal(`  ${resultats.length.toString().padStart(2)} résultat(s), ${ajoutes} nouveau(x) · ${requete}`);
  }
  ecrireExploration(chemins.exploration, etat);
  return compteurs;
}

async function principal() {
  const { chargerConfig } = await import("./lib/config.mjs");
  const config = chargerConfig();
  const args = lireArgs();
  const chemins = fichiers();

  if (args.has("generer")) {
    const requetes = genererRequetes(config);
    if (args.has("ecrire")) {
      const entete = "# Requêtes d'empreinte lancées par « npm run chercher ». Une par ligne, « # » pour commenter.\n# Fichier vide ou absent = requêtes générées automatiquement depuis config.json.\n";
      fs.writeFileSync(chemins.requetes, entete + requetes.join("\n") + "\n", "utf8");
      console.log(`${requetes.length} requêtes écrites dans ${chemins.requetes}.`);
    } else {
      console.log(requetes.join("\n"));
      console.log(`\n${requetes.length} requêtes générées (--ecrire pour les enregistrer dans donnees/requetes.txt).`);
    }
    return;
  }

  const disponibles = moteursDisponibles(config);
  const nom = args.get("moteur") || config.moteurs.prefere || "auto";
  if (!disponibles.length) {
    const message = "Aucun moteur de recherche configuré (BRAVE_API_KEY, SERPER_API_KEY ou GOOGLE_CSE_KEY + GOOGLE_CSE_CX) : étape ignorée.";
    if (args.has("si-possible")) {
      console.log(message);
      return;
    }
    throw new Error(message);
  }
  const moteur = creerMoteur(nom, config);
  const requetes = args.has("requete") ? args.liste("requete") : undefined;
  const { requetes: toutes, source } = lireRequetes(chemins.requetes, config);
  console.log(`Moteur : ${moteur.nom} · ${toutes.length} requêtes (${source === "fichier" ? "donnees/requetes.txt" : "générées"}) · budget : ${args.nombre("max", config.moteurs.requetesParExecution)} par exécution.`);
  const compteurs = await chercher({ config, moteur, requetes, max: args.nombre("max", undefined) });
  console.log(`\nRequêtes lancées : ${compteurs.requetes} · résultats : ${compteurs.resultats} · URLs ajoutées à la frontière : ${compteurs.ajoutes} (dont ${compteurs.relais} relais potentiels) · erreurs : ${compteurs.erreurs}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

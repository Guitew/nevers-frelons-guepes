#!/usr/bin/env node
/**
 * Collecte quotidienne — sélectionne N entreprises SANS site web déclaré sur
 * leur fiche Google Business Profile, rédige leur page et les publie.
 *
 * Deux modes :
 *   • national (défaut) : 1 fiche par département, en commençant par les
 *     départements les moins couverts. 20 départements différents par jour.
 *   • local : exploration fine par cellules (maillage 800 m) autour de zones
 *     définies dans config.json. Utile pour saturer un territoire ciblé.
 *
 * Usage :
 *   node outils/collecte.mjs                 collecte du jour (mode config)
 *   node outils/collecte.mjs --mode=local    forcer le mode local
 *   node outils/collecte.mjs --max=5         limite le nombre de fiches
 *   node outils/collecte.mjs --fournisseur=csv
 *   node outils/collecte.mjs --essai         n'écrit rien, affiche le résultat
 *
 * L'exploration locale suit un maillage : chaque zone est découpée en cellules
 * de quelques centaines de mètres, parcourues du centre vers la périphérie, et
 * un curseur persistant retient où la collecte précédente s'est arrêtée. Sans
 * cela, « searchNearby » — plafonné à 20 résultats par appel et sans
 * pagination — renverrait chaque jour les mêmes établissements, et la collecte
 * se tarirait au bout de quelques jours (voir outils/lib/maillage.mjs).
 *
 * La consommation d'API est bornée par « appelsMaxParJour » : la collecte
 * s'arrête dès qu'elle a son quota de fiches ou son budget d'appels.
 */

import fs from "node:fs";
import config from "./lib/config.mjs";
import { categories, classer } from "./lib/categories.mjs";
import { cellules, lotsDeTypes, planifier } from "./lib/maillage.mjs";
import { lireProgression, ecrireProgression } from "./lib/progression.mjs";
import { fournisseur } from "./lib/fournisseurs/index.mjs";
import { ecrireFiche, indexExistant, lireFiches, slugDisponible, urlFiche, ETATS } from "./lib/fiches.mjs";
import { rediger } from "./lib/redaction.mjs";
import { slugifier, aujourdhui } from "./lib/texte.mjs";
import { consigner, evenement } from "./lib/journal.mjs";
import { DEPARTEMENTS_JSON } from "./lib/chemins.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);

const essai = args.has("essai") || args.has("dry-run");
const quota = Number(args.get("max") || config.collecte.fichesParJour);
const nomFournisseur = args.get("fournisseur") || config.collecte.fournisseur;
const mode = args.get("mode") || config.collecte.mode || "national";

/** Catégories retenues pour la collecte (toutes, sauf restriction explicite). */
function categoriesRetenues() {
  const ciblees = config.collecte.categoriesCiblees;
  return ciblees?.length ? categories.filter((c) => ciblees.includes(c.slug)) : categories;
}

const TYPES_INFRASTRUCTURE = new Set([
  "parking", "parking_lot", "parking_garage", "park_and_ride",
  "bus_stop", "bus_station", "transit_stop", "transit_station", "transit_depot",
  "train_station", "light_rail_station", "subway_station", "tram_stop",
  "airport", "international_airport", "airstrip", "heliport",
  "ferry_terminal", "ferry_service", "toll_station", "truck_stop",
  "bike_sharing_station", "taxi_stand",
  "atm", "post_office", "fire_station", "police",
  "city_hall", "courthouse", "government_office", "local_government_office",
]);

function estRecevable(lieu, existant) {
  if (!lieu.nom || !lieu.ville) return false;
  if (lieu.site_web_gmb) return false;
  if (existant.parId.has(lieu.id)) return false;
  if (TYPES_INFRASTRUCTURE.has(lieu.type_principal)) return false;
  if (config.collecte.exclureFermes && lieu.statut_google !== "OPERATIONAL") return false;
  if (config.collecte.noteMinimale && (lieu.note || 0) < config.collecte.noteMinimale) return false;
  if (config.collecte.avisMinimum && (lieu.avis || 0) < config.collecte.avisMinimum) return false;
  return true;
}

// ---------------------------------------------------------------------------
//  Mode national : 1 fiche par département, rotation par couverture
// ---------------------------------------------------------------------------

function compterParDepartement(fiches) {
  const compteur = {};
  for (const f of fiches) {
    if (f.statut !== ETATS.PUBLIEE) continue;
    const dept = f.adresse?.departement || "";
    if (dept) compteur[dept] = (compteur[dept] || 0) + 1;
  }
  return compteur;
}

async function collecteNationale(source, existant, date) {
  const departements = JSON.parse(fs.readFileSync(DEPARTEMENTS_JSON, "utf8"));
  const fiches = lireFiches();
  const compteur = compterParDepartement(fiches);

  // Trier par nombre de fiches croissant (départements les moins couverts d'abord)
  departements.sort((a, b) => (compteur[a.code] || 0) - (compteur[b.code] || 0));

  const lots = lotsDeTypes(categoriesRetenues());
  if (!lots.length) {
    console.log("Aucun lot de types disponible.");
    return [];
  }

  // Indice de lot basé sur le jour (rotation automatique des types)
  const jourIndex = Math.floor(Date.now() / 86400000);

  const retenus = [];
  const vus = new Set();
  const departementsVus = new Set();
  let appels = 0;
  const budget = config.collecte.appelsMaxParJour;
  const rayonRecherche = config.collecte.rayonNational || 15000;

  // Candidats : plus de départements que le quota (certains peuvent ne rien donner)
  const candidats = departements.slice(0, Math.min(quota * 3, departements.length));

  for (const dept of candidats) {
    if (retenus.length >= quota || appels >= budget) break;
    if (departementsVus.has(dept.code)) continue;

    const lotIndex = (jourIndex + departementsVus.size) % lots.length;
    const types = lots[lotIndex];

    appels++;
    let lieux = [];
    try {
      lieux = await source.rechercher({
        types,
        latitude: dept.lat,
        longitude: dept.lng,
        rayonMetres: rayonRecherche,
      });
    } catch (erreur) {
      console.warn(`  ⚠ ${dept.nom} (${dept.code}) : ${erreur.message}`);
      continue;
    }

    departementsVus.add(dept.code);

    for (const brut of lieux) {
      const lieu = source.normaliser(brut);
      if (vus.has(lieu.id) || !estRecevable(lieu, existant)) continue;

      // Vérifier que le résultat est bien dans le bon département
      const deptLieu = (lieu.adresse?.departement || "").replace(/^0/, "");
      const deptCible = dept.code.replace(/^0/, "");
      if (deptLieu !== deptCible) continue;

      vus.add(lieu.id);
      retenus.push(lieu);
      console.log(`  + ${dept.nom} (${dept.code}) : ${lieu.nom} — ${lieu.ville}`);
      break;
    }
  }

  console.log(
    `  ${appels} appel(s) API sur ${budget} autorisés — ` +
      `${retenus.length} fiche(s) retenue(s) sur ${departementsVus.size} département(s) exploré(s).`
  );
  return retenus;
}

// ---------------------------------------------------------------------------
//  Mode local : exploration fine par maillage (existant)
// ---------------------------------------------------------------------------

async function collecteLocale(source, existant) {
  const progression = lireProgression();
  const lots = lotsDeTypes(categoriesRetenues());
  const retenus = [];
  const vus = new Set();
  let appels = 0;
  const budget = config.collecte.appelsMaxParJour;

  boucle: for (const zone of config.collecte.zones) {
    if (retenus.length >= quota || appels >= budget) break;

    const grille = cellules(zone, config.collecte.mailleMetres);
    const depart = progression[zone.libelle] || { cellule: 0, lot: 0, tour: 0 };
    const { etapes } = planifier(grille, lots, depart, budget - appels);

    for (const etape of etapes) {
      if (retenus.length >= quota) break boucle;
      appels++;
      let lieux = [];
      try {
        lieux = await source.rechercher({
          types: etape.types,
          latitude: etape.cellule.latitude,
          longitude: etape.cellule.longitude,
          rayonMetres: etape.cellule.rayonMetres,
        });
      } catch (erreur) {
        console.warn(`  ⚠︎ ${zone.libelle} cellule ${etape.indexCellule} : ${erreur.message}`);
        progression[zone.libelle] = etape.suivant;
        continue;
      }
      progression[zone.libelle] = etape.suivant;

      for (const brut of lieux) {
        if (retenus.length >= quota) break;
        const lieu = source.normaliser(brut);
        if (vus.has(lieu.id) || !estRecevable(lieu, existant)) continue;
        vus.add(lieu.id);
        retenus.push(lieu);
      }
    }
  }

  if (!essai) ecrireProgression(progression);
  console.log(
    `  ${appels} appel(s) API sur ${budget} autorisés — ` +
      Object.entries(progression)
        .map(([z, c]) => `${z} : cellule ${c.cellule} (tour ${c.tour})`)
        .join(", ")
  );
  return retenus;
}

// ---------------------------------------------------------------------------
//  Point d'entrée
// ---------------------------------------------------------------------------

async function principal() {
  const source = fournisseur(nomFournisseur);
  if (nomFournisseur === "google-places" && !config.secrets.googlePlaces) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY absente. Renseignez la variable d'environnement " +
        "(voir .env.exemple), ou lancez « node outils/collecte.mjs --fournisseur=csv »."
    );
  }
  const fiches = lireFiches();
  const existant = indexExistant(fiches);
  const date = aujourdhui();
  let retenus;

  console.log(`Collecte du ${date} — fournisseur « ${nomFournisseur} », mode « ${mode} », quota ${quota}.`);

  if (nomFournisseur === "csv") {
    retenus = [];
    for (const ligne of await source.rechercher()) {
      if (retenus.length >= quota) break;
      const lieu = source.normaliser(ligne);
      if (new Set(retenus.map((r) => r.id)).has(lieu.id) || !estRecevable(lieu, existant)) continue;
      retenus.push(lieu);
    }
  } else if (mode === "national") {
    retenus = await collecteNationale(source, existant, date);
  } else {
    retenus = await collecteLocale(source, existant);
  }

  if (!retenus.length) {
    console.log("Aucune nouvelle entreprise sans site web trouvée aujourd'hui.");
    return;
  }

  const evenements = [];
  for (const lieu of retenus) {
    const categorie = classer({
      typePrincipal: lieu.type_principal,
      types: lieu.types,
      libelle: lieu.categorie_gmb,
    });
    if (!categorie) {
      console.log(`  – ignoré (catégorie non rattachable) : ${lieu.nom} [${lieu.categorie_gmb}]`);
      continue;
    }
    const villeSlug = slugifier(lieu.ville);
    const slug = slugDisponible(lieu.nom, villeSlug, existant.slugsOccupes);
    existant.slugsOccupes.add(`${villeSlug}/${slug}`);

    const fiche = {
      id: lieu.id,
      slug,
      nom: lieu.nom,
      categorie,
      categorie_gmb: lieu.categorie_gmb,
      type_principal: lieu.type_principal,
      types: lieu.types,
      ville: lieu.ville,
      ville_slug: villeSlug,
      adresse: lieu.adresse,
      telephone: lieu.telephone,
      geo: lieu.geo,
      note: lieu.note,
      avis: lieu.avis,
      horaires: lieu.horaires,
      attributs: lieu.attributs,
      lien_google: lieu.lien_google,
      site_web_gmb: null,
      ...(lieu.exemple ? { exemple: true } : {}),
      statut: ETATS.PUBLIEE,
      backlink: {
        etat: "en-attente",
        premiere_detection: null,
        derniere_detection: null,
        derniere_verification: null,
        echecs: 0,
        url_detectee: null,
      },
      suggestion: {
        etat: "en-attente",
        date_soumission: null,
        tentatives: 0,
      },
      retrait: null,
      dates: { collecte: date, publication: date, maj: date },
      source: nomFournisseur,
    };
    fiche.redaction = rediger(fiche, date);

    if (essai) {
      console.log(`  · ${urlFiche(fiche)} — ${fiche.nom}`);
    } else {
      ecrireFiche(fiche);
      evenements.push(evenement("publication", fiche, { categorie, source: nomFournisseur }));
      console.log(`  + ${urlFiche(fiche)}`);
    }
  }

  if (!essai) {
    consigner(evenements);
    console.log(`\n${evenements.length} fiche(s) publiée(s). Total : ${fiches.length + evenements.length}.`);
    console.log("Étape suivante : npm run build puis npm run indexation.");
  } else {
    console.log("\nMode essai : aucune fiche écrite.");
  }
}

principal().catch((erreur) => {
  console.error("Échec de la collecte :", erreur.message);
  process.exitCode = 1;
});

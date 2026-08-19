#!/usr/bin/env node
/**
 * Collecte quotidienne — sélectionne N entreprises SANS site web déclaré sur
 * leur fiche Google Business Profile, rédige leur page et les publie.
 *
 * Usage :
 *   node outils/collecte.mjs                 collecte du jour (quota du config)
 *   node outils/collecte.mjs --max=5         limite le nombre de fiches
 *   node outils/collecte.mjs --fournisseur=csv
 *   node outils/collecte.mjs --essai         n'écrit rien, affiche le résultat
 *
 * L'exploration suit un maillage : chaque zone est découpée en cellules de
 * quelques centaines de mètres, parcourues du centre vers la périphérie, et un
 * curseur persistant retient où la collecte précédente s'est arrêtée. Sans
 * cela, « searchNearby » — plafonné à 20 résultats par appel et sans
 * pagination — renverrait chaque jour les mêmes établissements, et la collecte
 * se tarirait au bout de quelques jours (voir outils/lib/maillage.mjs).
 *
 * La consommation d'API est bornée par « appelsMaxParJour » : la collecte
 * s'arrête dès qu'elle a son quota de fiches ou son budget d'appels.
 */

import config from "./lib/config.mjs";
import { categories, classer } from "./lib/categories.mjs";
import { cellules, lotsDeTypes, planifier } from "./lib/maillage.mjs";
import { lireProgression, ecrireProgression } from "./lib/progression.mjs";
import { fournisseur } from "./lib/fournisseurs/index.mjs";
import { ecrireFiche, indexExistant, lireFiches, slugDisponible, urlFiche, ETATS } from "./lib/fiches.mjs";
import { rediger } from "./lib/redaction.mjs";
import { slugifier, aujourdhui } from "./lib/texte.mjs";
import { consigner, evenement } from "./lib/journal.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);

const essai = args.has("essai") || args.has("dry-run");
const quota = Number(args.get("max") || config.collecte.fichesParJour);
const nomFournisseur = args.get("fournisseur") || config.collecte.fournisseur;

/** Catégories retenues pour la collecte (toutes, sauf restriction explicite). */
function categoriesRetenues() {
  const ciblees = config.collecte.categoriesCiblees;
  return ciblees?.length ? categories.filter((c) => ciblees.includes(c.slug)) : categories;
}

function estRecevable(lieu, existant) {
  if (!lieu.nom || !lieu.ville) return false;
  if (lieu.site_web_gmb) return false; // ← le cœur du filtre : pas de site déclaré
  if (existant.parId.has(lieu.id)) return false;
  if (config.collecte.exclureFermes && lieu.statut_google !== "OPERATIONAL") return false;
  if (config.collecte.noteMinimale && (lieu.note || 0) < config.collecte.noteMinimale) return false;
  if (config.collecte.avisMinimum && (lieu.avis || 0) < config.collecte.avisMinimum) return false;
  return true;
}

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
  const retenus = [];
  const vus = new Set();

  console.log(`Collecte du ${date} — fournisseur « ${nomFournisseur} », quota ${quota}.`);

  if (nomFournisseur === "csv") {
    for (const ligne of await source.rechercher()) {
      if (retenus.length >= quota) break;
      const lieu = source.normaliser(ligne);
      if (vus.has(lieu.id) || !estRecevable(lieu, existant)) continue;
      vus.add(lieu.id);
      retenus.push(lieu);
    }
  } else {
    const progression = lireProgression();
    const lots = lotsDeTypes(categoriesRetenues());
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
          // Le curseur avance quand même : une cellule en échec ne doit pas
          // bloquer indéfiniment la progression sur la zone.
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

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
 * La rotation des catégories dépend du jour de l'année : deux exécutions
 * successives n'attaquent pas le même segment du territoire, ce qui évite
 * d'épuiser une catégorie avant les autres et lisse la consommation d'API.
 */

import config from "./lib/config.mjs";
import { categories, classer } from "./lib/categories.mjs";
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

/** Décalage de rotation basé sur le quantième du jour. */
function rotation() {
  const debut = new Date(new Date().getFullYear(), 0, 0);
  return Math.floor((Date.now() - debut) / 86400000);
}

/** Catégories à interroger aujourd'hui, dans l'ordre de rotation. */
function categoriesDuJour() {
  const ciblees = config.collecte.categoriesCiblees;
  const liste = ciblees?.length ? categories.filter((c) => ciblees.includes(c.slug)) : categories;
  const d = rotation() % liste.length;
  return [...liste.slice(d), ...liste.slice(0, d)];
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
    boucle: for (const zone of config.collecte.zones) {
      for (const categorie of categoriesDuJour()) {
        if (retenus.length >= quota) break boucle;
        let lieux = [];
        try {
          lieux = await source.rechercher({
            types: categorie.gmb.slice(0, 50),
            latitude: zone.latitude,
            longitude: zone.longitude,
            rayonMetres: zone.rayonMetres,
          });
        } catch (erreur) {
          console.warn(`  ⚠︎ ${zone.libelle} / ${categorie.slug} : ${erreur.message}`);
          continue;
        }
        for (const brut of lieux) {
          if (retenus.length >= quota) break;
          const lieu = source.normaliser(brut);
          if (vus.has(lieu.id) || !estRecevable(lieu, existant)) continue;
          vus.add(lieu.id);
          retenus.push(lieu);
        }
      }
    }
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

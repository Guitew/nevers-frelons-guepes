#!/usr/bin/env node
/**
 * Gestion des suggestions de site web sur Google Maps.
 *
 * Après la collecte, chaque fiche sans site web déclaré est candidate à une
 * suggestion : on propose l'URL de sa page annuaire comme « site web » sur
 * Google Maps via le formulaire « Ajouter un site Web ». Cette suggestion
 * est examinée par Google et, si acceptée, crée le backlink GMB attendu.
 *
 * Le formulaire Google Maps n'a pas d'API : la soumission passe par une
 * automatisation navigateur (Chrome MCP). Ce script gère la file d'attente
 * et le suivi ; l'automatisation elle-même est pilotée par Claude Code.
 *
 * Usage :
 *   node outils/suggestions.mjs                  liste les suggestions en attente
 *   node outils/suggestions.mjs --marquer=<id>   marque une fiche comme soumise
 *   node outils/suggestions.mjs --lot            exporte un lot JSON pour traitement
 *   node outils/suggestions.mjs --sync           récupère les marquages depuis le serveur
 *   node outils/suggestions.mjs --init           ajoute le champ suggestion aux fiches existantes
 */

import { lireFiches, ecrireFiche, urlFiche, ETATS } from "./lib/fiches.mjs";
import { site } from "./lib/site.mjs";
import { aujourdhui } from "./lib/texte.mjs";
import { consigner, evenement } from "./lib/journal.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);

function urlMaps(fiche) {
  return `https://www.google.com/maps/place/?q=place_id:${fiche.id}`;
}

function urlPublique(fiche) {
  return site.base + urlFiche(fiche);
}

function enAttente(fiche) {
  return (
    fiche.statut === ETATS.PUBLIEE &&
    !fiche.site_web_gmb &&
    fiche.suggestion?.etat === "en-attente" &&
    !fiche.suggestion?.date_email &&
    !fiche.exemple
  );
}

function soumise(fiche) {
  return fiche.suggestion?.etat === "soumise";
}

function mailEnvoye(fiche) {
  return (
    fiche.statut === ETATS.PUBLIEE &&
    !fiche.site_web_gmb &&
    fiche.suggestion?.etat === "en-attente" &&
    !!fiche.suggestion?.date_email &&
    !fiche.exemple
  );
}

async function lister() {
  const fiches = lireFiches();
  const attente = fiches.filter(enAttente);
  const mailees = fiches.filter(mailEnvoye);
  const soumises = fiches.filter(soumise);

  console.log(`\n  SUGGESTIONS GMB — ${fiches.length} fiche(s)\n  ${"─".repeat(46)}`);
  console.log(`  En attente (pas encore mailées) .. ${attente.length}`);
  console.log(`  Mail envoyé (à suggérer) ......... ${mailees.length}`);
  console.log(`  Soumises ......................... ${soumises.length}`);

  if (attente.length) {
    console.log(`\n  EN ATTENTE DE SOUMISSION :`);
    for (const f of attente) {
      console.log(`  · ${f.nom} — ${urlPublique(f)}`);
    }
  }

  if (soumises.length) {
    console.log(`\n  DÉJÀ SOUMISES :`);
    for (const f of soumises) {
      console.log(`  ✓ ${f.nom} (${f.suggestion.date_soumission})`);
    }
  }
  console.log("");
}

async function marquer(placeId) {
  const fiches = lireFiches();
  const fiche = fiches.find((f) => f.id === placeId);
  if (!fiche) {
    console.error(`Fiche introuvable : ${placeId}`);
    process.exitCode = 1;
    return;
  }

  const date = aujourdhui();
  fiche.suggestion = fiche.suggestion || {};
  fiche.suggestion.etat = "soumise";
  fiche.suggestion.date_soumission = date;
  fiche.suggestion.tentatives = (fiche.suggestion.tentatives || 0) + 1;
  fiche.dates.maj = date;

  ecrireFiche(fiche);
  consigner(evenement("suggestion-soumise", fiche));
  console.log(`  ✓ ${fiche.nom} marquée comme soumise.`);
}

async function lot() {
  const fiches = lireFiches().filter(enAttente);
  const batch = fiches.map((f) => ({
    id: f.id,
    nom: f.nom,
    url_maps: urlMaps(f),
    url_page: urlPublique(f),
  }));
  console.log(JSON.stringify(batch, null, 2));
}

async function init() {
  const fiches = lireFiches();
  let modifiees = 0;
  for (const fiche of fiches) {
    if (fiche.suggestion) continue;
    fiche.suggestion = {
      etat: "en-attente",
      date_soumission: null,
      tentatives: 0,
    };
    ecrireFiche(fiche);
    modifiees++;
  }
  console.log(`${modifiees} fiche(s) mise(s) à jour avec le champ suggestion.`);
}

const SUGGERER_BASE = "https://andpro.fr/vitrine-locale/suggerer.php";
const SUGGERER_TOKEN = "VL-s8k3m2p7";

async function sync() {
  const res = await fetch(`${SUGGERER_BASE}?action=liste&t=${SUGGERER_TOKEN}`);
  if (!res.ok) throw new Error(`Serveur ${res.status}`);
  const liste = await res.json();

  if (!liste.length) {
    console.log("Aucun marquage à synchroniser.");
    return;
  }

  console.log(`${liste.length} marquage(s) à synchroniser.`);
  for (const entry of liste) {
    await marquer(entry.id);
  }

  const clear = await fetch(`${SUGGERER_BASE}?action=vider&t=${SUGGERER_TOKEN}`);
  if (!clear.ok) console.warn("  ⚠ Impossible de vider le fichier serveur.");
  console.log("Synchronisation terminée.");
}

async function principal() {
  if (args.has("init")) return init();
  if (args.has("lot")) return lot();
  if (args.has("sync")) return sync();
  if (args.has("marquer")) return marquer(args.get("marquer"));
  return lister();
}

principal().catch((erreur) => {
  console.error("Erreur suggestions :", erreur.message);
  process.exitCode = 1;
});

#!/usr/bin/env node
/**
 * Rapport — trie les spots par priorité et produit :
 *   • donnees/rapport.csv  (Excel / Google Sheets, séparateur « ; ») ;
 *   • donnees/rapport.md   (lisible sur GitHub) ;
 *   • un résumé en console.
 *
 * Usage :
 *   node outils/rapport.mjs                 spots à traiter, priorité ≥ config.score.minimumRapport
 *   node outils/rapport.mjs --min=50        priorité minimale
 *   node outils/rapport.mjs --type=forum    un seul type (commentaire, forum, annuaire, livre-dor, wiki,
 *                                           question-reponse, avis, article-invite, page-liens,
 *                                           liste-prestataires, mention-non-liee, profil)
 *   node outils/rapport.mjs --etat=fait     filtre sur l'état (a-traiter, en-cours, fait, rejete, tous)
 *   node outils/rapport.mjs --limite=50     nombre de lignes du rapport Markdown
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { lireArgs } from "./lib/args.mjs";
import { fichiers } from "./lib/chemins.mjs";
import { lireCibles } from "./lib/cibles.mjs";
import { versCsv } from "./lib/csv.mjs";
import { lireExclusions } from "./lib/exclusions.mjs";
import { lireExploration, statistiques } from "./lib/exploration.mjs";
import { ecrireSpots, ETATS, libelleType, lireSpots, resumer } from "./lib/spots.mjs";
import { choisirCible, ORDRE_FACILITE } from "./lib/score.mjs";
import { appartientA } from "./lib/url.mjs";

const FACILITES = { immediate: "Immédiat (formulaire)", inscription: "Inscription requise", contact: "Contact à prendre" };

export const COLONNES = [
  { cle: "priorite", libelle: "Priorité", valeur: (s) => s.scores.priorite },
  { cle: "seo", libelle: "Score SEO", valeur: (s) => s.scores.seo },
  { cle: "ia", libelle: "Score IA", valeur: (s) => s.scores.ia },
  { cle: "facilite", libelle: "Facilité", valeur: (s) => FACILITES[s.facilite] || s.facilite },
  { cle: "type", libelle: "Type", valeur: (s) => libelleType(s.type) },
  { cle: "url", libelle: "URL du spot" },
  { cle: "domaine", libelle: "Domaine" },
  { cle: "titre", libelle: "Titre" },
  { cle: "plateforme", libelle: "Plateforme" },
  { cle: "indexable", libelle: "Indexable Google/Bing", valeur: (s) => (s.indexabilite?.indexable ? "oui" : `non (${(s.indexabilite?.motifs || []).join(", ")})`) },
  { cle: "indexee", libelle: "Indexée (vérif. moteur)", valeur: (s) => s.indexee || "inconnu" },
  { cle: "liens", libelle: "Suivi des liens", valeur: (s) => (s.type === "commentaire" ? s.liens?.commentaires : s.liens?.contenu) || "inconnu" },
  { cle: "champSiteWeb", libelle: "Champ site web", valeur: (s) => (s.champSiteWeb ? "oui" : "non") },
  { cle: "captcha", libelle: "Captcha", valeur: (s) => (s.captcha ? "oui" : "non") },
  { cle: "moderation", libelle: "Modération", valeur: (s) => (s.moderation ? "oui" : "?") },
  { cle: "iaAutorisees", libelle: "Robots IA autorisés", valeur: (s) => `${s.ia?.taux ?? "?"} % (${(s.ia?.autorises || []).join(", ") || "aucun"})` },
  { cle: "themes", libelle: "Thèmes", valeur: (s) => (s.themes || []).join(", ") },
  { cle: "zones", libelle: "Zones citées", valeur: (s) => (s.zonesTrouvees || []).join(", ") },
  { cle: "cible", libelle: "Cible suggérée", valeur: (s) => s.cible?.url || "" },
  { cle: "niveau", libelle: "Niveau", valeur: (s) => (s.cible?.niveau === 2 ? "2 (relais)" : "1 (site)") },
  { cle: "ancres", libelle: "Ancres suggérées", valeur: (s) => (s.cible?.ancres || []).join(" | ") },
  { cle: "motifCible", libelle: "Pourquoi cette cible", valeur: (s) => s.cible?.motif || "" },
  { cle: "signaux", libelle: "Signaux", valeur: (s) => (s.signaux || []).join(" | ") },
  { cle: "contact", libelle: "Formulaire de contact", valeur: (s) => s.contact || "" },
  { cle: "inscription", libelle: "Page d'inscription", valeur: (s) => s.lienInscription || "" },
  { cle: "origine", libelle: "Trouvé via", valeur: (s) => `${s.origine?.type || ""}${s.origine?.detail ? " : " + s.origine.detail : ""}` },
  { cle: "decouverte", libelle: "Découvert le" },
  { cle: "derniereVisite", libelle: "Dernière visite", valeur: (s) => String(s.derniereVisite || "").slice(0, 10) },
  { cle: "etat", libelle: "État" },
  { cle: "note", libelle: "Note" },
];

/** Sélection et tri des spots à rapporter. */
export function selectionner(spots, { min = 0, type, etat = ETATS.A_TRAITER, exclusions = [], config } = {}) {
  return spots
    .filter((s) => (etat === "tous" ? true : (s.etat || ETATS.A_TRAITER) === etat))
    .filter((s) => !type || s.type === type || (s.types || []).includes(type))
    .filter((s) => (s.scores?.priorite || 0) >= min)
    .filter((s) => !appartientA(s.url, exclusions) && !appartientA(s.url, config?.exploration?.domainesIgnores || []))
    .sort((a, b) => b.scores.priorite - a.scores.priorite || ORDRE_FACILITE[b.facilite] - ORDRE_FACILITE[a.facilite] || a.url.localeCompare(b.url));
}

/** Rapport Markdown. */
export function versMarkdown(spots, { limite = 100, resume, cibles, exploration } = {}) {
  const lignes = [];
  lignes.push(`# Spots de netlinking — ${new Date().toISOString().slice(0, 10)}`, "");
  if (resume) {
    lignes.push(`**${resume.total} spot(s)** sur ${resume.domaines} domaine(s) · à traiter : ${resume.parEtat[ETATS.A_TRAITER] || 0} · faits : ${resume.parEtat[ETATS.FAIT] || 0} · rejetés : ${resume.parEtat[ETATS.REJETE] || 0}`, "");
    lignes.push("| Type | Spots |", "|---|---:|");
    for (const [t, n] of Object.entries(resume.parType).sort((a, b) => b[1] - a[1])) lignes.push(`| ${libelleType(t)} | ${n} |`);
    lignes.push("");
  }
  if (exploration) lignes.push(`Exploration : ${exploration.vues} page(s) vue(s), ${exploration.hotes} hôte(s), ${exploration.frontiere} URL(s) en attente, ${exploration.requetes} requête(s) lancée(s).`, "");
  if (cibles) lignes.push(`Cibles : ${cibles.pages.length} page(s) du site, ${cibles.relais.filter((r) => r.etat !== "absent").length} page(s) relais (niveau 2).`, "");
  lignes.push(`## ${Math.min(limite, spots.length)} premiers spots à traiter`, "");
  lignes.push("| # | Prio. | SEO | IA | Facilité | Type | Spot | Cible suggérée | Signaux |", "|---:|---:|---:|---:|---|---|---|---|---|");
  spots.slice(0, limite).forEach((s, i) => {
    const titre = (s.titre || s.url).replace(/\|/g, "／").slice(0, 70);
    const cible = s.cible ? `[${s.cible.niveau === 2 ? "relais" : "site"}](${s.cible.url})` : "";
    const signaux = (s.signaux || []).slice(0, 3).join(" · ").replace(/\|/g, "／");
    lignes.push(`| ${i + 1} | ${s.scores.priorite} | ${s.scores.seo} | ${s.scores.ia} | ${FACILITES[s.facilite] || s.facilite} | ${libelleType(s.type)} | [${titre}](${s.url}) | ${cible} | ${signaux} |`);
  });
  lignes.push("", "Le fichier `rapport.csv` contient toutes les colonnes (indexabilité, robots IA, ancres, contact, origine…).", "");
  lignes.push("Marquer un spot traité : `node outils/marquer.mjs --url=… --etat=fait` · rejeter un domaine : `node outils/marquer.mjs --domaine=… --etat=rejete`.", "");
  return lignes.join("\n");
}

async function principal() {
  const { chargerConfig } = await import("./lib/config.mjs");
  const config = chargerConfig();
  const args = lireArgs();
  const chemins = fichiers();
  const tous = lireSpots(chemins.spots);
  const exclusions = lireExclusions(chemins.exclusions);
  const cibles = lireCibles(chemins.cibles, config);
  // Les cibles suggérées sont recalculées à chaque rapport : les pages du site et les relais
  // évoluent d'une semaine à l'autre, et un spot n'est revisité qu'après revisiteJours.
  for (const s of tous) {
    if ((s.etat || ETATS.A_TRAITER) === ETATS.A_TRAITER) s.cible = choisirCible({ spot: s, page: { titre: s.titre || "", h1: "" }, cibles, config });
  }
  ecrireSpots(chemins.spots, tous);
  const selection = selectionner(tous, { min: args.nombre("min", config.score.minimumRapport), type: args.get("type"), etat: args.get("etat", ETATS.A_TRAITER), exclusions, config });
  const resume = resumer(tous);
  const exploration = statistiques(lireExploration(chemins.exploration));

  fs.writeFileSync(chemins.rapportCsv, versCsv(selection, COLONNES), "utf8");
  fs.writeFileSync(chemins.rapportMd, versMarkdown(selection, { limite: args.nombre("limite", 100), resume, cibles, exploration }), "utf8");

  console.log(`${resume.total} spot(s) connus · ${selection.length} dans le rapport (${args.get("etat", ETATS.A_TRAITER)}, priorité ≥ ${args.nombre("min", config.score.minimumRapport)}).`);
  console.log(`Exploration : ${exploration.vues} page(s) vue(s), ${exploration.hotes} hôte(s), ${exploration.frontiere} en attente · relais connus : ${cibles.relais.length}.`);
  if (Object.keys(resume.parType).length) {
    console.log("\nPar type :");
    for (const [t, n] of Object.entries(resume.parType).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${libelleType(t)}`);
  }
  console.log("\nTop 15 :");
  for (const s of selection.slice(0, 15)) console.log(`  ${String(s.scores.priorite).padStart(3)}  ${libelleType(s.type).padEnd(28)} ${s.url}`);
  console.log(`\nÉcrit : ${chemins.rapportCsv}\n       ${chemins.rapportMd}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

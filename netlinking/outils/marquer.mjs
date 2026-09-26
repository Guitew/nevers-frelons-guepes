#!/usr/bin/env node
/**
 * Marquer — consigne le travail humain sur les spots.
 *
 * Usage :
 *   node outils/marquer.mjs --url=https://… --etat=fait [--note="commentaire posté le 26/09"]
 *   node outils/marquer.mjs --url=https://… --etat=rejete --note="spam"
 *   node outils/marquer.mjs --url=https://… --etat=en-cours
 *   node outils/marquer.mjs --url=https://… --etat=a-traiter
 *   node outils/marquer.mjs --domaine=exemple.fr --etat=rejete     rejette tous les spots du domaine
 *                                                                 ET l'ajoute à donnees/exclusions.txt
 */

import { fileURLToPath } from "node:url";
import { lireArgs } from "./lib/args.mjs";
import { fichiers } from "./lib/chemins.mjs";
import { ajouterExclusion } from "./lib/exclusions.mjs";
import { ecrireSpots, ETATS, lireSpots } from "./lib/spots.mjs";
import { appartientA, normaliserUrl } from "./lib/url.mjs";

export function marquer({ dossier, url, domaine, etat, note }) {
  const chemins = fichiers(dossier);
  const spots = lireSpots(chemins.spots);
  const valides = Object.values(ETATS);
  if (!valides.includes(etat)) throw new Error(`État inconnu : ${etat} (attendu : ${valides.join(", ")})`);
  let touches = 0;
  const date = new Date().toISOString().slice(0, 10);
  for (const s of spots) {
    const correspond = url ? s.url === normaliserUrl(url) : domaine ? appartientA(s.url, [domaine]) : false;
    if (!correspond) continue;
    s.etat = etat;
    if (note !== undefined) s.note = note;
    s.marqueLe = date;
    touches++;
  }
  ecrireSpots(chemins.spots, spots);
  let exclu = false;
  if (domaine && etat === ETATS.REJETE) exclu = ajouterExclusion(chemins.exclusions, domaine, note || "rejeté");
  return { touches, exclu };
}

async function principal() {
  const args = lireArgs();
  const url = args.get("url");
  const domaine = args.get("domaine");
  const etat = args.get("etat");
  if ((!url && !domaine) || !etat || url === true || domaine === true || etat === true) {
    console.error("Usage : node outils/marquer.mjs (--url=… | --domaine=…) --etat=a-traiter|en-cours|fait|rejete [--note=…]");
    process.exit(2);
  }
  const { touches, exclu } = marquer({ url, domaine, etat, note: args.has("note") ? String(args.get("note")) : undefined });
  console.log(`${touches} spot(s) marqué(s) « ${etat} ».${exclu ? ` Domaine ${domaine} ajouté aux exclusions.` : ""}`);
  if (!touches && url) console.log("Aucun spot ne porte cette URL exacte (voir donnees/spots.json).");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

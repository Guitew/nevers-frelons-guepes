#!/usr/bin/env node
/**
 * Indexation — demande à un moteur (Serper = Google, Brave, Google CSE) si la
 * page d'un spot est bien indexée (« site:url »). Un spot non indexé n'apporte
 * rien à Google/Bing, quel que soit son formulaire.
 *
 * La réponse d'un moteur n'est pas une preuve absolue (un « site: » peut
 * manquer une page fraîchement indexée) : le résultat est noté « oui » /
 * « non » / « inconnu » avec la date et le moteur, et re-vérifié après
 * fraicheurJours.
 *
 * Usage :
 *   node outils/indexation.mjs               vérifie les spots à traiter, par priorité (budget requetesParExecution)
 *   node outils/indexation.mjs --max=20
 *   node outils/indexation.mjs --moteur=serper
 */

import { fileURLToPath } from "node:url";
import { lireArgs } from "./lib/args.mjs";
import { fichiers } from "./lib/chemins.mjs";
import { moteur as creerMoteur, moteursDisponibles } from "./lib/moteurs/index.mjs";
import { ecrireSpots, ETATS, lireSpots } from "./lib/spots.mjs";
import { joursDepuis } from "./lib/texte.mjs";
import { normaliserUrl } from "./lib/url.mjs";

function memePage(a, b) {
  const n = (u) => String(normaliserUrl(u) || u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();
  return n(a) === n(b);
}

export async function verifierIndexation({ config, dossier, moteur, max, journal = console.log }) {
  const chemins = fichiers(dossier);
  const spots = lireSpots(chemins.spots);
  const fraicheur = config.moteurs?.fraicheurJours ?? 30;
  const candidats = spots
    .filter((s) => (s.etat || ETATS.A_TRAITER) === ETATS.A_TRAITER)
    .filter((s) => !s.indexeeDate || joursDepuis(s.indexeeDate) >= fraicheur)
    .sort((a, b) => b.scores.priorite - a.scores.priorite)
    .slice(0, max);
  const compteurs = { verifies: 0, oui: 0, non: 0, erreurs: 0 };
  for (const s of candidats) {
    const sansProtocole = s.url.replace(/^https?:\/\//, "");
    let resultats;
    try {
      resultats = await moteur.chercher(`site:${sansProtocole}`, { nombre: 10, pays: config.moteurs.pays, langue: config.moteurs.langue });
    } catch (e) {
      compteurs.erreurs++;
      journal(`  ⚠︎ ${s.url} : ${e.message}`);
      if (/HTTP (401|403|429)/.test(e.message)) break;
      continue;
    }
    compteurs.verifies++;
    const trouvee = resultats.some((r) => memePage(r.url, s.url));
    s.indexee = trouvee ? "oui" : "non";
    s.indexeeDate = new Date().toISOString().slice(0, 10);
    s.indexeeMoteur = moteur.nom;
    if (trouvee) compteurs.oui++;
    else compteurs.non++;
    journal(`  ${trouvee ? "✓" : "✗"} ${s.url}`);
  }
  ecrireSpots(chemins.spots, spots);
  return compteurs;
}

async function principal() {
  const { chargerConfig } = await import("./lib/config.mjs");
  const config = chargerConfig();
  const args = lireArgs();
  if (!moteursDisponibles(config).length) {
    console.log("Aucun moteur configuré : vérification d'indexation impossible (voir .env.exemple).");
    return;
  }
  const moteur = creerMoteur(args.get("moteur") || config.moteurs.prefere || "auto", config);
  const c = await verifierIndexation({ config, moteur, max: args.nombre("max", config.moteurs.requetesParExecution) });
  console.log(`\nVérifiés : ${c.verifies} · indexés : ${c.oui} · non indexés : ${c.non} · erreurs : ${c.erreurs}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Mise en place automatique de l'accès Search Console (voir lib/search-console.mjs).
 *
 * À exécuter chaque jour avant le relevé d'audience. Sans secret, ne fait
 * rien. Avec un compte de service :
 *   1er passage  → obtient le jeton de vérification, l'inscrit dans site.json
 *                  (committé puis déployé par le cycle : balise meta en ligne) ;
 *   2e passage   → vérifie le site, ajoute les copropriétaires humains
 *                  (config.audience.proprietaires), déclare la propriété ;
 *   ensuite      → constate simplement que tout est en place.
 *
 * Usage : node outils/search-console.mjs [--essai]
 */

import fs from "node:fs";
import path from "node:path";
import config from "./lib/config.mjs";
import site from "./lib/site.mjs";
import { DONNEES } from "./lib/chemins.mjs";
import { compteDeService, jetonGoogle } from "./lib/google-auth.mjs";
import { PORTEES, clientGoogle, proprieteDe, assurerAcces } from "./lib/search-console.mjs";

const essai = process.argv.includes("--essai") || process.argv.includes("--dry-run");
const SITE_JSON = path.join(DONNEES, "site.json");

function ecrireJeton(valeur) {
  if (essai) return;
  const brut = JSON.parse(fs.readFileSync(SITE_JSON, "utf8"));
  brut.verifGoogle = valeur;
  fs.writeFileSync(SITE_JSON, JSON.stringify(brut, null, 2) + "\n", "utf8");
}

async function principal() {
  const brut = config.secrets.googleSearchConsole;
  if (!brut) {
    console.log("GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT absent : mise en place Search Console ignorée.");
    return;
  }
  const compte = compteDeService(brut);
  const jeton = await jetonGoogle(compte, PORTEES);
  const appeler = clientGoogle(jeton);
  const resultat = await assurerAcces({
    appeler,
    propriete: proprieteDe(site),
    jetonActuel: site.verifGoogle,
    ecrireJeton,
    proprietaires: config.audience?.proprietaires || [],
    journal: (m) => console.log(`  ${m}`),
  });
  console.log(`Search Console : ${resultat}${essai ? " (essai)" : ""}.`);
}

principal().catch((erreur) => {
  const conseil =
    /accessNotConfigured|has not been used|is disabled/i.test(erreur.message)
      ? "\n  → Activez les API « Google Search Console API » et « Site Verification API » dans le projet Google Cloud du compte de service."
      : "";
  console.error("Échec de la mise en place Search Console :", erreur.message + conseil);
  process.exitCode = 1;
});

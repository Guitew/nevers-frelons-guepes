#!/usr/bin/env node
/**
 * Inspection d'indexation — Google Search Console (URL Inspection API).
 *
 * Pour chaque page publiée assez âgée : les pages avec impressions récentes
 * sont marquées indexées sans appel ; les autres sont inspectées, dans la
 * limite du quota quotidien, et reçoivent le verdict de Google.
 *
 * Le résultat alimente la politique de retrait : une page non indexée
 * 45 jours après sa mise en ligne est retirée (lib/politique.mjs).
 *
 * Usage :
 *   node outils/couverture.mjs            inspecte et écrit les fiches
 *   node outils/couverture.mjs --essai    inspecte et affiche, sans écrire
 *   node outils/couverture.mjs --max=20   limite le nombre d'inspections
 *
 * Authentification : GOOGLE_ACCESS_TOKEN (Workload Identity, GitHub Actions)
 * ou compte de service ; sans rien, l'étape est ignorée sans erreur.
 */

import config from "./lib/config.mjs";
import site from "./lib/site.mjs";
import { lireFiches, ecrireFiche, urlFiche } from "./lib/fiches.mjs";
import { aujourdhui } from "./lib/texte.mjs";
import { choisirJeton } from "./lib/google-auth.mjs";
import { clientGoogle, proprieteDe } from "./lib/search-console.mjs";
import { selectionner, interpreter, reglagesCouverture } from "./lib/couverture.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai") || args.has("dry-run");
const PORTEE = "https://www.googleapis.com/auth/webmasters.readonly";
const INSPECTION = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function principal() {
  const acces = await choisirJeton(
    { accessToken: config.secrets.googleAccessToken, compteBase64: config.secrets.googleSearchConsole },
    PORTEE
  );
  if (!acces) {
    console.log("Aucune authentification Google (GOOGLE_ACCESS_TOKEN ou compte de service) : inspection d'indexation ignorée.");
    return;
  }
  const reglages = reglagesCouverture(config.couverture);
  if (args.has("max")) reglages.inspectionsParJour = Number(args.get("max"));
  const date = aujourdhui();
  const propriete = proprieteDe(site);
  const appeler = clientGoogle(acces.jeton);
  const fiches = lireFiches();
  const { parImpressions, aInspecter } = selectionner(fiches, reglages);

  for (const fiche of parImpressions) {
    fiche.indexation = {
      etat: "indexee",
      verdict: null,
      couverture: "impressions dans la Search Console",
      derniere_exploration: null,
      canonique_google: null,
      source: "impressions",
      date,
    };
    if (!essai) ecrireFiche(fiche);
  }

  const compteurs = { indexee: 0, "non-indexee": 0, erreur: 0 };
  const nonIndexees = [];
  for (const fiche of aInspecter) {
    const url = site.base + urlFiche(fiche);
    try {
      const reponse = await appeler("POST", INSPECTION, { inspectionUrl: url, siteUrl: propriete, languageCode: "fr-FR" });
      fiche.indexation = { ...interpreter(reponse), date };
      compteurs[fiche.indexation.etat]++;
      if (fiche.indexation.etat === "non-indexee") nonIndexees.push(fiche);
      if (!essai) ecrireFiche(fiche);
    } catch (erreur) {
      compteurs.erreur++;
      console.warn(`  ⚠ ${urlFiche(fiche)} : ${erreur.message}`);
      if (erreur.status === 429) {
        console.warn("  Quota d'inspection atteint : arrêt pour aujourd'hui.");
        break;
      }
    }
    await pause(150); // sous les 600 requêtes/minute du quota
  }

  console.log(
    `Couverture : ${parImpressions.length} page(s) indexée(s) par leurs impressions, ` +
      `${aInspecter.length} inspectée(s) → ${compteurs.indexee} indexée(s), ` +
      `${compteurs["non-indexee"]} non indexée(s), ${compteurs.erreur} erreur(s)${essai ? " (essai, rien d'écrit)" : ""}.`
  );
  for (const f of nonIndexees.slice(0, 30)) {
    console.log(`  ✗ ${urlFiche(f)} — ${f.indexation.couverture || f.indexation.verdict}`);
  }
}

principal().catch((erreur) => {
  console.error("Échec de l'inspection d'indexation :", erreur.message);
  process.exitCode = 1;
});

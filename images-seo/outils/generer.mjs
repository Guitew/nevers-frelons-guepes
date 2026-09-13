/**
 * Étape 2 — génère l'image maître de chaque élément « a_generer » de la file d'attente.
 *   node outils/generer.mjs [--fournisseur=chatgpt-navigateur|openai-api|depot|simulation] [--connexion]
 */
import fs from "node:fs";
import path from "node:path";
import { chargerEnv, lireConfig, lireFileAttente, ecrireFileAttente, arguments_ } from "./lib/config.mjs";
import { consigner, evenement } from "./lib/journal.mjs";
import { chargerFournisseur } from "./lib/fournisseurs/index.mjs";
import { controlerSource } from "./lib/images.mjs";
import { TRAVAIL } from "./lib/chemins.mjs";

export async function executerGeneration(options = {}) {
  chargerEnv();
  const config = lireConfig();
  const nom = options.fournisseur || process.env.FOURNISSEUR_IMAGES || config.generation?.fournisseur || "depot";
  const fournisseur = await chargerFournisseur(nom);
  if (options.connexion) {
    if (!fournisseur.connexion) throw new Error(`le fournisseur ${nom} n'a pas d'étape de connexion`);
    await fournisseur.connexion(config);
    return [];
  }
  fs.mkdirSync(TRAVAIL, { recursive: true });
  const file = lireFileAttente();
  const aFaire = file.filter((it) => it.statut === "a_generer" || it.statut === "a_reprendre");
  if (!aFaire.length) {
    console.log("Rien à générer.");
    return [];
  }
  const maxTentatives = Number(config.generation?.tentativesParImage) || 2;
  const faits = [];
  for (const element of aFaire) {
    const destination = path.join(TRAVAIL, element.id);
    console.log(`Génération ${element.id} (${nom}) : « ${element.requete} »`);
    try {
      const resultat = await fournisseur.generer({ element, destination, config, enAttente: aFaire });
      const controle = await controlerSource(resultat.fichier, element.formatSource);
      element.tentatives = (element.tentatives || 0) + 1;
      if (controle.anomalies.length && element.tentatives < maxTentatives && nom !== "depot") {
        element.statut = "a_reprendre";
        element.anomalies = controle.anomalies;
        console.warn(`  anomalies : ${controle.anomalies.join(" ; ")} → nouvelle tentative au prochain passage`);
        continue;
      }
      element.statut = "a_optimiser";
      element.source = resultat.fichier;
      element.fournisseur = resultat.fournisseur;
      element.anomalies = controle.anomalies;
      element.dimensionsSource = `${controle.width}×${controle.height}`;
      faits.push(element);
      consigner(evenement("genere", element, { visuel: element.visuel, serp: element.serps[0], fournisseur: resultat.fournisseur, detail: resultat.detail, anomalies: controle.anomalies }));
      console.log(`  ok (${resultat.detail}, ${element.dimensionsSource})`);
    } catch (e) {
      if (e.enAttenteDepot) {
        console.log(`  en attente de dépôt manuel : ${e.message}`);
        break;
      }
      element.tentatives = (element.tentatives || 0) + 1;
      element.erreur = e.message;
      if (e.quotaEpuise) {
        console.warn(`  quota épuisé : ${e.message} — la série reprendra au prochain passage`);
        consigner(evenement("quota", element, { fournisseur: nom, detail: e.message }));
        break;
      }
      if (element.tentatives >= maxTentatives) element.statut = "echec";
      console.error(`  échec (${element.tentatives}/${maxTentatives}) : ${e.message}`);
      consigner(evenement("erreur", element, { fournisseur: nom, detail: e.message }));
    }
  }
  ecrireFileAttente(file);
  return faits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executerGeneration(arguments_()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

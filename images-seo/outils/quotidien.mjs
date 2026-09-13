/**
 * Cycle complet du jour : planifier → générer → optimiser → publier → nettoyer.
 *   node outils/quotidien.mjs [--fournisseur=…] [--publication=…] [--date=…] [--essai] [--n=2]
 *
 * Idempotent : relancé plusieurs fois le même jour, il ne replanifie pas et reprend
 * simplement les éléments restés en attente (dépôt manuel, quota, erreur).
 */
import { arguments_, lireFileAttente, ecrireFileAttente } from "./lib/config.mjs";
import { executerPlanification } from "./planifier.mjs";
import { executerGeneration } from "./generer.mjs";
import { executerOptimisation } from "./optimiser.mjs";
import { executerPublication } from "./publier.mjs";
import { joursEntre, dateDuJour } from "./lib/texte.mjs";

/** Retire de la file ce qui est terminé depuis plus de 30 jours (le journal et sortie/ gardent la trace). */
export function nettoyerFile(file, aujourdhui = dateDuJour()) {
  return file.filter((it) => !(["publie", "echec"].includes(it.statut) && joursEntre(it.date, aujourdhui) > 30));
}

export async function executerCycle(options = {}) {
  console.log("— Planification");
  executerPlanification(options);
  console.log("— Génération");
  await executerGeneration(options);
  console.log("— Optimisation");
  await executerOptimisation(options);
  console.log("— Publication");
  await executerPublication(options);
  ecrireFileAttente(nettoyerFile(lireFileAttente(), options.date || dateDuJour()));
  const file = lireFileAttente();
  const parStatut = {};
  for (const it of file) parStatut[it.statut] = (parStatut[it.statut] || 0) + 1;
  console.log("— File d'attente :", JSON.stringify(parStatut));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executerCycle(arguments_()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

/**
 * Étape 3 — décline chaque image maître par surface (recadrage, surcouche, WebP + JPEG, XMP).
 *   node outils/optimiser.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chargerEnv, lireConfig, lireSite, lireFileAttente, ecrireFileAttente, arguments_ } from "./lib/config.mjs";
import { consigner, evenement } from "./lib/journal.mjs";
import { decliner } from "./lib/images.mjs";
import { xmp, nomFichier } from "./lib/metadonnees.mjs";
import { TRAVAIL } from "./lib/chemins.mjs";

export async function executerOptimisation() {
  chargerEnv();
  const config = lireConfig();
  const site = lireSite();
  const file = lireFileAttente();
  const aFaire = file.filter((it) => it.statut === "a_optimiser" && it.source && fs.existsSync(it.source));
  if (!aFaire.length) {
    console.log("Rien à optimiser.");
    return [];
  }
  for (const element of aFaire) {
    const dossier = path.join(TRAVAIL, element.id + "-declinaisons");
    fs.mkdirSync(dossier, { recursive: true });
    const declinaisons = await decliner({
      source: element.source,
      dossier,
      element,
      charte: config.charte || {},
      xmp: xmp(element, site),
      nommer: (serp, ext) => nomFichier(element, serp, ext),
    });
    element.declinaisons = declinaisons;
    element.statut = "a_publier";
    consigner(evenement("optimise", element, { serps: declinaisons.map((d) => d.serp) }));
    console.log(`Optimisé ${element.id} : ${declinaisons.map((d) => `${d.serp} ${d.largeur}×${d.hauteur}`).join(", ")}`);
  }
  ecrireFileAttente(file);
  return aFaire;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executerOptimisation(arguments_()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

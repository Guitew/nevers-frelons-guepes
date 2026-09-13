/**
 * Étape 4 — publie les déclinaisons : export (dossier sortie/ + sitemap images) et/ou WordPress.
 *   node outils/publier.mjs [--publication=export,wordpress]
 */
import { chargerEnv, lireConfig, lireSite, lireFileAttente, ecrireFileAttente, arguments_ } from "./lib/config.mjs";
import { consigner, evenement } from "./lib/journal.mjs";

const MODES = {
  export: () => import("./lib/publication/export.mjs"),
  wordpress: () => import("./lib/publication/wordpress.mjs"),
};

export async function executerPublication(options = {}) {
  chargerEnv();
  const config = lireConfig();
  const site = lireSite();
  const modes = String(options.publication || process.env.PUBLICATION_IMAGES || (config.publication?.modes || ["export"]).join(","))
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  for (const m of modes) if (!MODES[m]) throw new Error(`mode de publication inconnu : ${m}`);
  const file = lireFileAttente();
  const aFaire = file.filter((it) => it.statut === "a_publier" && it.declinaisons?.length);
  if (!aFaire.length) {
    console.log("Rien à publier.");
    return [];
  }
  for (const element of aFaire) {
    element.publications = element.publications || {};
    let echec = false;
    for (const m of modes) {
      try {
        const { publier } = await MODES[m]();
        const resultat = await publier({ element, declinaisons: element.declinaisons, site, config });
        element.publications[m] = resultat;
        if (resultat.avertissement) console.warn(`  ${m} : ${resultat.avertissement}`);
        console.log(`Publié ${element.id} (${m})${resultat.dossier ? " → " + resultat.dossier : ""}`);
      } catch (e) {
        echec = true;
        element.publications[m] = { erreur: e.message };
        console.error(`  ${m} : ${e.message}`);
        consigner(evenement("erreur", element, { mode: m, detail: e.message }));
      }
    }
    element.statut = echec ? "publication_partielle" : "publie";
    consigner(evenement("publie", element, { visuel: element.visuel, serp: element.serps[0], modes, statut: element.statut }));
  }
  ecrireFileAttente(file);
  return aFaire;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executerPublication(arguments_()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

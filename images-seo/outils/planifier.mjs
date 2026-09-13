/**
 * Étape 1 — choisit les images du jour et écrit leurs prompts dans donnees/file-attente.json.
 *   node outils/planifier.mjs [--date=AAAA-MM-JJ] [--essai] [--n=2]
 */
import { chargerEnv, lireConfig, lireSite, lirePages, lireFileAttente, ecrireFileAttente, arguments_ } from "./lib/config.mjs";
import { lireJournal, consigner, evenement } from "./lib/journal.mjs";
import { planifier } from "./lib/planification.mjs";
import { dateDuJour } from "./lib/texte.mjs";

export function executerPlanification(options = {}) {
  chargerEnv();
  const config = lireConfig();
  if (options.n) config.cadence.imagesParJour = Number(options.n);
  const site = lireSite();
  const date = options.date || dateDuJour(new Date(), config.cadence?.fuseau);
  const file = lireFileAttente();
  const plan = planifier({ pages: lirePages(), date, journal: lireJournal(), file, config, site, essai: !!options.essai });
  if (!plan.length) {
    console.log(`Rien à planifier pour le ${date} : aucune page éligible (URL manquante, délai minimum, ou déjà planifiée).`);
    return [];
  }
  ecrireFileAttente([...file, ...plan]);
  consigner(plan.map((it) => evenement("planifie", it, { visuel: it.visuel, serp: it.serps[0], requete: it.requete, date_plan: date })));
  for (const it of plan) console.log(`Planifié ${it.id} → ${it.titrePage} · « ${it.requete} » · ${it.serps.join(", ")} · ${it.formatSource}`);
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`) executerPlanification(arguments_());

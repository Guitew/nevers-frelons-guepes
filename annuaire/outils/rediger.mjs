#!/usr/bin/env node
/**
 * Réécrit le texte des fiches avec la version courante de la rédaction
 * (outils/lib/redaction.mjs), à lancer après un changement de gabarit de
 * texte. Les fiches marquées `redaction.manuel: true` (texte retouché à la
 * main) ne sont jamais touchées.
 *
 * Usage :
 *   node outils/rediger.mjs --tout            réécrit toutes les fiches
 *   node outils/rediger.mjs --anciennes       seulement celles d'une version antérieure
 *   node outils/rediger.mjs --fiche=/cat/ville/slug/
 *   node outils/rediger.mjs --tout --essai    compte sans écrire
 */

import { lireFiches, ecrireFiche, urlFiche } from "./lib/fiches.mjs";
import { rediger, VERSION_REDACTION } from "./lib/redaction.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai");

const fiches = lireFiches();
let cibles;
if (args.has("fiche")) cibles = fiches.filter((f) => urlFiche(f) === String(args.get("fiche")));
else if (args.has("anciennes")) cibles = fiches.filter((f) => (f.redaction?.version || 1) < VERSION_REDACTION);
else if (args.has("tout")) cibles = fiches;
else {
  console.log("Précisez --tout, --anciennes ou --fiche=/cat/ville/slug/ (ajoutez --essai pour simuler).");
  process.exit(1);
}

let reecrites = 0;
let manuelles = 0;
for (const fiche of cibles) {
  if (fiche.redaction?.manuel) {
    manuelles++;
    continue;
  }
  fiche.redaction = { ...rediger(fiche, fiche.dates?.maj || fiche.dates?.collecte), ...(fiche.redaction?.manuel ? { manuel: true } : {}) };
  if (!essai) ecrireFiche(fiche);
  reecrites++;
}
console.log(`${essai ? "[essai] " : ""}${reecrites} fiche(s) réécrite(s) en version ${VERSION_REDACTION}, ${manuelles} manuelle(s) laissée(s) telle(s) quelle(s).`);

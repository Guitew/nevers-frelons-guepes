#!/usr/bin/env node
/**
 * Retraits et republications.
 *
 * Applique la règle du contrat : quand le backlink GMB disparaît, la page
 * disparaît. Deux modes de sortie, choisis dans config.json :
 *
 *   301 — redirection permanente vers la page catégorie. À privilégier :
 *         l'autorité acquise par l'URL est transmise, l'internaute atterrit
 *         sur une liste utile, et le maillage du site reste intact.
 *   410 — « Gone ». À réserver aux pages qui n'ont plus lieu d'exister :
 *         entreprise fermée, fiche Google supprimée, demande du dirigeant.
 *         Google désindexe plus vite un 410 qu'un 404, sans transmettre
 *         d'autorité — c'est exactement l'effet recherché dans ces cas.
 *
 * Un délai de grâce protège les fiches fraîchement publiées : tant que
 * l'entreprise n'a jamais posé le lien, on ne retire rien avant N jours
 * (config.backlinks.delaiDeGraceJours), le temps que la demande soit traitée.
 *
 * Si le lien réapparaît, la page est republiée automatiquement — la
 * redirection est retirée du .htaccess au build suivant.
 *
 * Usage :
 *   node outils/retraits.mjs                          applique la politique
 *   node outils/retraits.mjs --essai                   simulation
 *   node outils/retraits.mjs --fiche=/cat/ville/slug/ --mode=410 --motif="demande du dirigeant"
 */

import config from "./lib/config.mjs";
import { lireFiches, ecrireFiche, urlFiche, urlCategorie, ETATS } from "./lib/fiches.mjs";
import { aujourdhui, joursDepuis } from "./lib/texte.mjs";
import { consigner, evenement } from "./lib/journal.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai") || args.has("dry-run");
const date = aujourdhui();

function retirer(fiche, mode, motif) {
  fiche.statut = ETATS.RETIREE;
  fiche.retrait = {
    mode,
    cible: mode === "301" ? urlCategorie(fiche.categorie) : null,
    date,
    motif,
  };
  fiche.dates.maj = date;
  return evenement(`retrait-${mode}`, fiche, { motif, cible: fiche.retrait.cible });
}

function republier(fiche) {
  fiche.statut = ETATS.PUBLIEE;
  fiche.retrait = null;
  fiche.dates.maj = date;
  fiche.dates.publication = fiche.dates.publication || date;
  return evenement("republication", fiche, { motif: "backlink GMB retrouvé" });
}

/** Décide du sort d'une fiche publiée. @returns {[mode, motif]|null} */
function decider(fiche) {
  const bl = fiche.backlink || {};
  const seuil = config.backlinks.echecsAvantRetrait;

  if (bl.etat === "introuvable" && (bl.echecs || 0) >= seuil) {
    return ["410", "fiche Google introuvable (établissement fermé ou supprimé)"];
  }
  if (!["absent", "externe"].includes(bl.etat)) return null;
  if ((bl.echecs || 0) < seuil) return null;

  if (bl.premiere_detection) {
    const motif =
      bl.etat === "externe"
        ? `backlink remplacé par un site propre (${bl.url_detectee})`
        : "backlink GMB retiré";
    return [config.backlinks.modeRetraitParDefaut, motif];
  }

  const age = joursDepuis(fiche.dates?.publication);
  if (age !== null && age >= config.backlinks.delaiDeGraceJours) {
    return [
      config.backlinks.modeRetraitSiJamaisLie,
      `backlink jamais posé après ${age} jours de délai de grâce`,
    ];
  }
  return null;
}

function manuel(fiches) {
  const cible = String(args.get("fiche"));
  const mode = String(args.get("mode") || "410");
  const motif = String(args.get("motif") || "retrait manuel");
  const fiche = fiches.find((f) => urlFiche(f) === cible || f.slug === cible || f.id === cible);
  if (!fiche) throw new Error(`Fiche introuvable : ${cible}`);
  if (!["301", "410"].includes(mode)) throw new Error("Le mode doit valoir 301 ou 410.");
  const ev = retirer(fiche, mode, motif);
  if (!essai) {
    ecrireFiche(fiche);
    consigner([ev]);
  }
  console.log(`${essai ? "[essai] " : ""}${urlFiche(fiche)} → ${mode} (${motif}).`);
}

function principal() {
  const fiches = lireFiches();
  if (args.has("fiche")) return manuel(fiches);

  const evenements = [];
  for (const fiche of fiches) {
    if (fiche.statut === ETATS.RETIREE) {
      if (fiche.backlink?.etat === "present" && fiche.retrait?.motif !== "retrait manuel") {
        evenements.push(republier(fiche));
        if (!essai) ecrireFiche(fiche);
        console.log(`  ↻ republication : ${urlFiche(fiche)}`);
      }
      continue;
    }
    if (fiche.statut !== ETATS.PUBLIEE) continue;

    const decision = decider(fiche);
    if (!decision) continue;
    const [mode, motif] = decision;
    evenements.push(retirer(fiche, mode, motif));
    if (!essai) ecrireFiche(fiche);
    console.log(
      `  ${mode === "410" ? "⊘" : "→"} ${urlFiche(fiche)} : ${mode}` +
        (mode === "301" ? ` vers ${urlCategorie(fiche.categorie)}` : "") +
        ` (${motif})`
    );
  }

  if (!essai) consigner(evenements);
  console.log(
    evenements.length
      ? `\n${evenements.length} changement(s)${essai ? " (simulés)" : ""}. Relancez « npm run build » pour régénérer le .htaccess.`
      : "Aucun retrait ni republication à effectuer."
  );
}

try {
  principal();
} catch (erreur) {
  console.error("Échec :", erreur.message);
  process.exitCode = 1;
}

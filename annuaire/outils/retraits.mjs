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
 * COUVERTURE. Une page que Google n'a toujours pas indexée 45 jours après sa
 * mise en ligne (outils/couverture.mjs) est retirée, lien GMB ou non : 410 si
 * aucun lien n'a jamais existé, 301 vers la catégorie sinon, pour que les
 * visiteurs venus de la fiche Google atterrissent sur une liste utile. Elle
 * n'est pas republiée si le lien revient : Google la refuserait à nouveau.
 *
 * AUDIENCE. Le relevé Search Console (outils/audience.mjs) tempère la règle :
 * une page qui reçoit des clics depuis Google n'est jamais retirée
 * automatiquement (sauf fiche Google disparue), et une page que Google montre
 * déjà (impressions) obtient un délai de grâce prolongé. Voir config.audience.
 *
 * Si le lien réapparaît, la page est republiée automatiquement — la
 * redirection est retirée du .htaccess au build suivant.
 *
 * PURGE. Une règle de redirection n'a pas vocation à vivre éternellement :
 * Apache évalue chaque RedirectMatch à chaque requête, et sur un annuaire qui
 * publie 20 fiches par jour, les règles s'accumuleraient par milliers. Passé
 * le délai de conservation (180 jours pour un 410, un an pour un 301 — la
 * durée après laquelle Google considère une redirection comme définitivement
 * assimilée), la fiche passe en « archivee » : la règle disparaît, l'URL
 * retombe en 404 naturel, et la fiche reste sur le disque pour mémoire.
 *
 * Usage :
 *   node outils/retraits.mjs                          applique la politique
 *   node outils/retraits.mjs --essai                   simulation
 *   node outils/retraits.mjs --fiche=/cat/ville/slug/ --mode=410 --motif="demande du dirigeant"
 */

import config from "./lib/config.mjs";
import { lireFiches, ecrireFiche, urlFiche, urlCategorie, ETATS } from "./lib/fiches.mjs";
import { aujourdhui } from "./lib/texte.mjs";
import { deciderRetrait, deciderArchivage, deciderRepublication, estProtegee } from "./lib/politique.mjs";
import { consigner, evenement } from "./lib/journal.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai") || args.has("dry-run");
const date = aujourdhui();
/** Règles de retrait, complétées par les seuils d'audience Search Console. */
const REGLAGES = { ...config.backlinks, audience: config.audience, couverture: config.couverture };

function retirer(fiche, mode, motif, cause = null) {
  fiche.statut = ETATS.RETIREE;
  fiche.retrait = {
    mode,
    cible: mode === "301" ? urlCategorie(fiche.categorie) : null,
    date,
    motif,
    ...(cause ? { cause } : {}),
  };
  fiche.dates.maj = date;
  return evenement(`retrait-${mode}`, fiche, { motif, cible: fiche.retrait.cible, ...(cause ? { cause } : {}) });
}

function archiver(fiche, age) {
  fiche.statut = ETATS.ARCHIVEE;
  fiche.dates.maj = date;
  fiche.retrait = { ...fiche.retrait, archive_le: date };
  return evenement("archivage", fiche, {
    motif: `règle ${fiche.retrait.mode} conservée ${age} jours, purgée`,
  });
}

function republier(fiche) {
  fiche.statut = ETATS.PUBLIEE;
  fiche.retrait = null;
  fiche.dates.maj = date;
  fiche.dates.publication = fiche.dates.publication || date;
  return evenement("republication", fiche, { motif: "backlink GMB retrouvé" });
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
  const protegees = [];
  for (const fiche of fiches) {
    if (fiche.statut === ETATS.ARCHIVEE) continue;

    if (fiche.statut === ETATS.RETIREE) {
      // Purge des règles arrivées à expiration.
      const expiration = deciderArchivage(fiche, REGLAGES);
      if (expiration) {
        evenements.push(archiver(fiche, expiration.age));
        if (!essai) ecrireFiche(fiche);
        console.log(
          `  ⌫ archivage : ${urlFiche(fiche)} (règle ${fiche.retrait.mode} de ${expiration.age} jours)`
        );
        continue;
      }

      if (deciderRepublication(fiche)) {
        evenements.push(republier(fiche));
        if (!essai) ecrireFiche(fiche);
        console.log(`  ↻ republication : ${urlFiche(fiche)}`);
      }
      continue;
    }
    if (fiche.statut !== ETATS.PUBLIEE) continue;

    const decision = deciderRetrait(fiche, REGLAGES);
    if (!decision) {
      const protection = estProtegee(fiche, REGLAGES.audience);
      if (protection && ["absent", "externe"].includes(fiche.backlink?.etat)) {
        protegees.push(`${urlFiche(fiche)} (${protection.clics} clic(s))`);
      }
      continue;
    }
    const { mode, motif, cause } = decision;
    evenements.push(retirer(fiche, mode, motif, cause));
    if (!essai) ecrireFiche(fiche);
    console.log(
      `  ${mode === "410" ? "⊘" : "→"} ${urlFiche(fiche)} : ${mode}` +
        (mode === "301" ? ` vers ${urlCategorie(fiche.categorie)}` : "") +
        ` (${motif})`
    );
  }

  if (protegees.length) {
    console.log(`  ${protegees.length} fiche(s) sans lien mais gardée(s) pour leurs clics Google :`);
    for (const p of protegees) console.log(`    ◇ ${p}`);
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

#!/usr/bin/env node
/**
 * Suivi des backlinks Google Business Profile.
 *
 * Le modèle économique du site repose sur un échange simple : l'annuaire offre
 * à l'entreprise une page publique et indexable, et cette page est déclarée
 * comme site web sur sa fiche Google. Ce lien — le « backlink GMB » — est donc
 * la contrepartie de la publication.
 *
 * Cet outil relit chaque fiche Google et compare le champ « site web » à
 * l'URL de notre page :
 *
 *   présent   → le lien est en place, la page reste publiée ;
 *   absent    → aucun site déclaré : le lien a été retiré (ou jamais posé) ;
 *   externe   → l'entreprise a déclaré un autre site : elle n'a plus besoin
 *               de notre page, et le lien est perdu ;
 *   introuvable → la fiche Google a disparu (fermeture, fusion, suppression).
 *
 * Aucune suppression n'est décidée ici : cet outil ne fait qu'observer et
 * compter. La décision revient à « npm run retraits », ce qui permet de
 * relire le diff Git avant d'agir sur les URLs.
 *
 * Usage :
 *   node outils/backlinks.mjs                vérifie le quota du jour
 *   node outils/backlinks.mjs --tout         vérifie toutes les fiches
 *   node outils/backlinks.mjs --max=50
 */

import config from "./lib/config.mjs";
import { fournisseur } from "./lib/fournisseurs/index.mjs";
import { lireFiches, ecrireFiche, urlFiche, ETATS } from "./lib/fiches.mjs";
import { estNotreUrl } from "./lib/site.mjs";
import { aujourdhui } from "./lib/texte.mjs";
import { consigner, evenement } from "./lib/journal.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);

const nomFournisseur = args.get("fournisseur") || config.collecte.fournisseur;
const quota = args.has("tout")
  ? Infinity
  : Number(args.get("max") || config.backlinks.verificationsParJour);

/** Fiches à vérifier en priorité : les moins récemment contrôlées d'abord. */
function ordonner(fiches) {
  return [...fiches]
    .filter((f) => f.statut === ETATS.PUBLIEE || f.statut === ETATS.RETIREE)
    .sort((a, b) =>
      (a.backlink?.derniere_verification || "").localeCompare(b.backlink?.derniere_verification || "")
    );
}

/** Rafraîchit les champs volatils (note, avis, horaires) sans toucher au texte. */
function rafraichir(fiche, detail) {
  if (typeof detail.rating === "number") fiche.note = Math.round(detail.rating * 10) / 10;
  if (typeof detail.userRatingCount === "number") fiche.avis = detail.userRatingCount;
  if (detail.nationalPhoneNumber) fiche.telephone = detail.nationalPhoneNumber;
  if (detail.businessStatus) fiche.statut_google = detail.businessStatus;
}

async function principal() {
  const source = fournisseur(nomFournisseur);
  if (nomFournisseur === "google-places" && !config.secrets.googlePlaces) {
    throw new Error("GOOGLE_PLACES_API_KEY absente : impossible de vérifier les backlinks.");
  }

  const fiches = lireFiches();
  const aVerifier = ordonner(fiches).slice(0, quota === Infinity ? undefined : quota);
  const date = aujourdhui();
  const horodatage = new Date().toISOString();
  const evenements = [];
  const compteurs = { present: 0, absent: 0, externe: 0, introuvable: 0, erreur: 0 };

  console.log(`Vérification de ${aVerifier.length} fiche(s) sur ${fiches.length}.`);

  for (const fiche of aVerifier) {
    let detail;
    try {
      detail = await source.detailler(fiche.id);
    } catch (erreur) {
      compteurs.erreur++;
      console.warn(`  ⚠︎ ${fiche.nom} : ${erreur.message}`);
      continue;
    }

    const avant = fiche.backlink?.etat || "en-attente";
    const bl = (fiche.backlink = fiche.backlink || { echecs: 0 });
    bl.derniere_verification = horodatage;

    if (detail === null) {
      // Le fournisseur ne sait pas relire cette fiche (mode CSV) ou elle a disparu.
      if (nomFournisseur === "csv") {
        console.log(`  · ${fiche.nom} : vérification impossible en mode CSV.`);
        continue;
      }
      bl.etat = "introuvable";
      bl.echecs = (bl.echecs || 0) + 1;
      compteurs.introuvable++;
    } else {
      rafraichir(fiche, detail);
      const url = detail.websiteUri || "";
      fiche.site_web_gmb = url || null;
      if (estNotreUrl(url, urlFiche(fiche))) {
        bl.etat = "present";
        bl.url_detectee = url;
        bl.derniere_detection = horodatage;
        if (!bl.premiere_detection) bl.premiere_detection = horodatage;
        bl.echecs = 0;
        compteurs.present++;
      } else if (url) {
        bl.etat = "externe";
        bl.url_detectee = url;
        bl.echecs = (bl.echecs || 0) + 1;
        compteurs.externe++;
      } else {
        bl.etat = "absent";
        bl.url_detectee = null;
        bl.echecs = (bl.echecs || 0) + 1;
        compteurs.absent++;
      }
    }

    fiche.dates.maj = date;
    ecrireFiche(fiche);

    if (bl.etat !== avant) {
      evenements.push(
        evenement(`backlink-${bl.etat}`, fiche, { precedent: avant, url: bl.url_detectee || null })
      );
      console.log(`  ${bl.etat === "present" ? "✓" : "×"} ${fiche.nom} : ${avant} → ${bl.etat}`);
    }
  }

  consigner(evenements);
  console.log(
    `\nRésultat : ${compteurs.present} présent(s), ${compteurs.absent} absent(s), ` +
      `${compteurs.externe} externe(s), ${compteurs.introuvable} introuvable(s), ${compteurs.erreur} erreur(s).`
  );
  if (evenements.length) console.log("Étape suivante : npm run retraits.");
}

principal().catch((erreur) => {
  console.error("Échec de la vérification :", erreur.message);
  process.exitCode = 1;
});

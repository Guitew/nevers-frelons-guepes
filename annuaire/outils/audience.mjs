#!/usr/bin/env node
/**
 * Relevé d'audience — Google Search Console.
 *
 * Interroge l'API Search Analytics pour la propriété du site (préfixe d'URL
 * https://andpro.fr/vitrine-locale/) et inscrit sur chaque fiche ses clics,
 * impressions et position moyenne des N derniers jours :
 *
 *   "audience": { "clics": 3, "impressions": 120, "position": 8.4,
 *                 "fenetreJours": 90, "date": "2026-09-21" }
 *
 * Ces chiffres alimentent la politique de retrait (lib/politique.mjs) :
 * une page qui reçoit des clics n'est pas retirée automatiquement, et une
 * page qui reçoit des impressions obtient un délai de grâce prolongé.
 *
 * Sans authentification Google (jeton Workload Identity GOOGLE_ACCESS_TOKEN,
 * ou compte de service GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT), l'étape est
 * ignorée sans erreur : la politique se rabat alors sur les seules règles de
 * backlink. Les données Search Console ont deux à trois jours de retard : la
 * fenêtre s'arrête donc à J-3.
 *
 * Usage :
 *   node outils/audience.mjs            relève et écrit les fiches
 *   node outils/audience.mjs --essai    relève et affiche, sans écrire
 *
 * Pré-requis (voir DEPLOIEMENT.md) : propriété Search Console de type
 * « préfixe d'URL » sur la base du site, et le compte de service ajouté comme
 * utilisateur de cette propriété.
 */

import config from "./lib/config.mjs";
import site from "./lib/site.mjs";
import { lireFiches, ecrireFiche, urlFiche } from "./lib/fiches.mjs";
import { aujourdhui } from "./lib/texte.mjs";
import { choisirJeton } from "./lib/google-auth.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai") || args.has("dry-run");

const PORTEE = "https://www.googleapis.com/auth/webmasters.readonly";
const RETARD_JOURS = 3;

function dateMoins(jours) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - jours);
  return aujourdhui(d);
}

/** Toutes les lignes « page » de la fenêtre, par pages de 25 000. */
async function relever(jeton, debut, fin) {
  const propriete = encodeURIComponent(site.base + "/");
  const lignes = [];
  for (let startRow = 0; ; startRow += 25000) {
    const reponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${propriete}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: debut,
          endDate: fin,
          dimensions: ["page"],
          rowLimit: 25000,
          startRow,
        }),
      }
    );
    if (!reponse.ok) throw new Error(`Search Console ${reponse.status} : ${await reponse.text()}`);
    const { rows = [] } = await reponse.json();
    lignes.push(...rows);
    if (rows.length < 25000) break;
  }
  return lignes;
}

/** Normalise une URL de la Search Console pour la comparer à la nôtre. */
function cle(url) {
  return String(url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();
}

async function principal() {
  const acces = await choisirJeton(
    { accessToken: config.secrets.googleAccessToken, compteBase64: config.secrets.googleSearchConsole },
    PORTEE
  );
  if (!acces) {
    console.log("Aucune authentification Google (GOOGLE_ACCESS_TOKEN ou compte de service) : relevé d'audience ignoré.");
    return;
  }
  const reglages = config.audience || {};
  const fenetre = Number(reglages.fenetreJours) || 90;
  const fin = dateMoins(RETARD_JOURS);
  const debut = dateMoins(RETARD_JOURS + fenetre - 1);

  const lignes = await relever(acces.jeton, debut, fin);
  console.log(`Search Console du ${debut} au ${fin} : ${lignes.length} page(s) avec au moins une impression.`);

  const parPage = new Map(lignes.map((l) => [cle(l.keys[0]), l]));
  const date = aujourdhui();
  const fiches = lireFiches();
  let avecClics = 0;
  let avecImpressions = 0;
  const top = [];

  for (const fiche of fiches) {
    const ligne = parPage.get(cle(site.base + urlFiche(fiche)));
    const audience = {
      clics: ligne ? Math.round(ligne.clicks) : 0,
      impressions: ligne ? Math.round(ligne.impressions) : 0,
      position: ligne ? Math.round(ligne.position * 10) / 10 : null,
      fenetreJours: fenetre,
      date,
    };
    if (audience.clics) avecClics++;
    if (audience.impressions) avecImpressions++;
    if (audience.impressions) top.push({ fiche, audience });
    fiche.audience = audience;
    if (!essai) ecrireFiche(fiche);
  }

  top.sort((a, b) => b.audience.clics - a.audience.clics || b.audience.impressions - a.audience.impressions);
  for (const { fiche, audience } of top.slice(0, 15)) {
    console.log(
      `  ${String(audience.clics).padStart(4)} clic(s)  ${String(audience.impressions).padStart(6)} impr.` +
        `  pos. ${audience.position ?? "—"}  ${urlFiche(fiche)}`
    );
  }
  console.log(
    `\n${fiches.length} fiche(s) : ${avecClics} avec des clics, ${avecImpressions} avec des impressions` +
      `${essai ? " (essai, rien d'écrit)" : ""}.`
  );
}

principal().catch((erreur) => {
  console.error("Échec du relevé d'audience :", erreur.message);
  process.exitCode = 1;
});

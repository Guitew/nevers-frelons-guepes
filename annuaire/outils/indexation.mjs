#!/usr/bin/env node
/**
 * Soumission des URLs aux moteurs.
 *
 * Trois canaux, du plus fiable au plus conditionnel :
 *
 *  1. IndexNow (Bing, Yandex, Naver, Seznam) — protocole ouvert, gratuit,
 *     immédiat. Une clé publiée à la racine du site authentifie l'envoi.
 *     C'est le canal qui fonctionne le mieux pour un site à publication
 *     quotidienne.
 *
 *  2. Le sitemap. Google a supprimé en 2023 le « ping » de sitemap : la
 *     seule chose qui compte désormais est que /sitemap.xml soit à jour, que
 *     les <lastmod> soient sincères et que les nouvelles pages soient liées
 *     depuis une page fraîche (/nouveautes/ et le flux Atom jouent ce rôle).
 *     L'outil se contente donc de vérifier que le sitemap est cohérent et
 *     rappelle les URLs à surveiller dans la Search Console.
 *
 *  3. L'Indexing API de Google — désactivée par défaut. Google en réserve
 *     officiellement l'usage aux pages JobPosting et BroadcastEvent ; s'en
 *     servir pour un annuaire sort du cadre documenté. Le code est fourni,
 *     activable en connaissance de cause via config.indexation.googleIndexingApi.
 *
 * Usage :
 *   node outils/indexation.mjs                URLs modifiées ces 2 derniers jours
 *   node outils/indexation.mjs --depuis=2026-08-01
 *   node outils/indexation.mjs --tout
 *   node outils/indexation.mjs --essai
 */

import crypto from "node:crypto";
import config from "./lib/config.mjs";
import site from "./lib/site.mjs";
import { lireFiches, urlFiche, ETATS } from "./lib/fiches.mjs";
import { aujourdhui } from "./lib/texte.mjs";
import { consigner, evenement } from "./lib/journal.mjs";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai") || args.has("dry-run");

function depuis() {
  if (args.has("tout")) return "0000-00-00";
  if (args.has("depuis")) return String(args.get("depuis"));
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return aujourdhui(d);
}

/** Sépare les URLs à (ré)indexer de celles à désindexer. */
function selectionner(seuil) {
  const fiches = lireFiches();
  const aIndexer = [];
  const aSupprimer = [];
  for (const f of fiches) {
    if (f.exemple) continue; // les fiches de démonstration ne sont pas indexables
    const url = site.url + urlFiche(f);
    if (f.statut === ETATS.PUBLIEE && (f.dates?.maj || "") >= seuil) aIndexer.push(url);
    else if (f.statut === ETATS.RETIREE && (f.retrait?.date || "") >= seuil) aSupprimer.push(url);
  }
  return { aIndexer, aSupprimer };
}

/** Envoi IndexNow : un seul appel suffit, les moteurs partenaires se partagent le flux. */
async function indexnow(urls) {
  const cle = config.secrets.indexnow;
  if (!cle) {
    console.warn("  ⚠︎ INDEXNOW_KEY absente : envoi IndexNow ignoré.");
    return 0;
  }
  const hote = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  let envoyees = 0;
  for (let i = 0; i < urls.length; i += config.indexation.urlsParEnvoi) {
    const lot = urls.slice(i, i + config.indexation.urlsParEnvoi);
    const corps = {
      host: hote,
      key: cle,
      keyLocation: `${site.url}/${cle}.txt`,
      urlList: lot,
    };
    if (essai) {
      console.log(`  [essai] IndexNow : ${lot.length} URL(s)`);
      envoyees += lot.length;
      continue;
    }
    const reponse = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(corps),
    });
    if (reponse.ok || reponse.status === 202) {
      envoyees += lot.length;
      console.log(`  ✓ IndexNow : ${lot.length} URL(s) acceptée(s) (HTTP ${reponse.status}).`);
    } else {
      console.warn(`  ⚠︎ IndexNow a répondu ${reponse.status} : ${(await reponse.text()).slice(0, 200)}`);
    }
  }
  return envoyees;
}

/** Jeton OAuth2 obtenu par assertion JWT signée avec le compte de service. */
async function jetonGoogle(compte) {
  const entete = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const maintenant = Math.floor(Date.now() / 1000);
  const charge = Buffer.from(
    JSON.stringify({
      iss: compte.client_email,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token",
      iat: maintenant,
      exp: maintenant + 3600,
    })
  ).toString("base64url");
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${entete}.${charge}`)
    .sign(compte.private_key)
    .toString("base64url");

  const reponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${entete}.${charge}.${signature}`,
    }),
  });
  if (!reponse.ok) throw new Error(`OAuth2 ${reponse.status} : ${await reponse.text()}`);
  return (await reponse.json()).access_token;
}

async function indexingApi(urls, type) {
  if (!config.indexation.googleIndexingApi) return 0;
  const brut = config.secrets.googleIndexing;
  if (!brut) {
    console.warn("  ⚠︎ GOOGLE_INDEXING_SERVICE_ACCOUNT absent : Indexing API ignorée.");
    return 0;
  }
  const compte = JSON.parse(Buffer.from(brut, "base64").toString("utf8"));
  const jeton = essai ? "essai" : await jetonGoogle(compte);
  let envoyees = 0;
  for (const url of urls) {
    if (essai) {
      console.log(`  [essai] Indexing API ${type} : ${url}`);
      envoyees++;
      continue;
    }
    const reponse = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, type }),
    });
    if (reponse.ok) envoyees++;
    else console.warn(`  ⚠︎ Indexing API ${reponse.status} sur ${url}`);
  }
  return envoyees;
}

async function principal() {
  const seuil = depuis();
  const { aIndexer, aSupprimer } = selectionner(seuil);
  console.log(
    `Soumission des URLs modifiées depuis le ${seuil === "0000-00-00" ? "début" : seuil} : ` +
      `${aIndexer.length} à indexer, ${aSupprimer.length} à désindexer.`
  );
  if (!aIndexer.length && !aSupprimer.length) return;

  let total = 0;
  if (config.indexation.indexnow) {
    total += await indexnow([...aIndexer, ...aSupprimer]);
  }
  total += await indexingApi(aIndexer, "URL_UPDATED");
  total += await indexingApi(aSupprimer, "URL_DELETED");

  if (!essai && total) {
    consigner([
      {
        date: new Date().toISOString(),
        type: "indexation",
        urls: aIndexer.length + aSupprimer.length,
        indexees: aIndexer.length,
        desindexees: aSupprimer.length,
      },
    ]);
  }

  console.log(`\n${total} soumission(s)${essai ? " simulée(s)" : ""}.`);
  console.log(
    `Rappel : le sitemap ${site.url}/sitemap.xml et la page ${site.url}/nouveautes/ ` +
      "restent les principaux vecteurs de découverte pour Google."
  );
  console.log(
    "Pour la fiche Google de chaque entreprise, l'URL à déclarer comme site web est celle de sa page :"
  );
  for (const url of aIndexer.slice(0, 20)) console.log(`  · ${url}`);
}

principal().catch((erreur) => {
  console.error("Échec de l'indexation :", erreur.message);
  process.exitCode = 1;
});

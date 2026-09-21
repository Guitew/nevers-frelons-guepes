/**
 * Authentification Google (sans dépendance).
 *
 * Deux sources, par ordre de préférence :
 *   1. un jeton d'accès déjà émis (GOOGLE_ACCESS_TOKEN) — c'est ce que fournit
 *      GitHub Actions via Workload Identity Federation, sans aucune clé à
 *      stocker ; les organisations Google Cloud interdisent d'ailleurs souvent
 *      la création de clés de compte de service (iam.disableServiceAccountKeyCreation) ;
 *   2. un compte de service en JSON encodé en base64 : un jeton OAuth2 est
 *      obtenu par assertion JWT signée avec sa clé privée.
 */

import crypto from "node:crypto";

/** Décode le JSON base64 d'un compte de service. */
export function compteDeService(brut) {
  return JSON.parse(Buffer.from(brut, "base64").toString("utf8"));
}

/** Jeton OAuth2 (1 h) pour la portée demandée. */
export async function jetonGoogle(compte, scope) {
  const entete = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const maintenant = Math.floor(Date.now() / 1000);
  const charge = Buffer.from(
    JSON.stringify({
      iss: compte.client_email,
      scope,
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

/**
 * Choisit la source d'authentification. Renvoie null si aucune n'est
 * disponible : l'appelant ignore alors l'étape sans erreur.
 *
 * @param {{accessToken?: string, compteBase64?: string}} sources
 * @param {string} scope       portée(s) OAuth2 demandée(s)
 * @param {Function} viaCompte fonction (compte, scope) → jeton, injectable pour les tests
 */
export async function choisirJeton(sources, scope, viaCompte = jetonGoogle) {
  if (sources.accessToken) return { jeton: sources.accessToken, source: "workload-identity" };
  if (sources.compteBase64) {
    return { jeton: await viaCompte(compteDeService(sources.compteBase64), scope), source: "compte-de-service" };
  }
  return null;
}

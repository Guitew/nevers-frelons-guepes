/**
 * Authentification Google par compte de service (sans dépendance).
 *
 * Le compte de service est fourni en variable d'environnement sous forme de
 * JSON encodé en base64. Un jeton OAuth2 est obtenu par assertion JWT signée
 * avec sa clé privée, pour la portée demandée (Indexing API, Search Console…).
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

/**
 * Mise en place automatique de la Search Console : séquence idempotente,
 * jouée hors ligne avec un faux client.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { assurerAcces, contenuMeta, proprieteDe, clientGoogle } from "../lib/search-console.mjs";

const PROPRIETE = "https://andpro.fr/vitrine-locale/";

/** Faux client : répond selon un scénario et note les appels. */
function fauxClient(scenario) {
  const appels = [];
  const appeler = async (methode, url, corps) => {
    appels.push({ methode, url, corps });
    for (const [motif, reponse] of scenario) {
      if (url.includes(motif) && (!reponse.methode || reponse.methode === methode)) {
        if (reponse.erreur) {
          const e = new Error(reponse.erreur);
          e.status = reponse.status;
          throw e;
        }
        return typeof reponse.corps === "function" ? reponse.corps(corps) : reponse.corps;
      }
    }
    throw new Error(`appel inattendu : ${methode} ${url}`);
  };
  return { appeler, appels };
}

test("la propriété est la base du site avec sa barre finale", () => {
  assert.equal(proprieteDe({ base: "https://andpro.fr/vitrine-locale" }), PROPRIETE);
});

test("le jeton META est réduit à sa valeur content", () => {
  assert.equal(contenuMeta('<meta name="google-site-verification" content="abc123" />'), "abc123");
  assert.equal(contenuMeta("abc123"), "abc123");
});

test("1er passage : sans jeton, on le demande et on l'écrit sans rien vérifier", async () => {
  const { appeler, appels } = fauxClient([
    ["/sites", { corps: { siteEntry: [] } }],
    ["/token", { corps: { token: '<meta name="google-site-verification" content="jeton-1" />' } }],
  ]);
  let ecrit = null;
  const r = await assurerAcces({ appeler, propriete: PROPRIETE, jetonActuel: "", ecrireJeton: (v) => (ecrit = v) });
  assert.equal(r, "jeton-ecrit");
  assert.equal(ecrit, "jeton-1");
  assert.ok(!appels.some((a) => a.url.includes("/webResource")), "aucune vérification tentée");
});

test("2e passage : avec jeton en ligne, on vérifie, on ajoute les copropriétaires et on déclare", async () => {
  const { appeler, appels } = fauxClient([
    ["/sites/", { methode: "PUT", corps: null }],
    ["/sites", { methode: "GET", corps: { siteEntry: [{ siteUrl: PROPRIETE, permissionLevel: "siteUnverifiedUser" }] } }],
    ["/webResource?verificationMethod=META", { corps: { id: "id-1", site: { identifier: PROPRIETE, type: "SITE" }, owners: ["sa@projet.iam.gserviceaccount.com"] } }],
    ["/webResource/id-1", { methode: "PUT", corps: (c) => c }],
  ]);
  const r = await assurerAcces({
    appeler,
    propriete: PROPRIETE,
    jetonActuel: "jeton-1",
    ecrireJeton: () => assert.fail("pas de nouveau jeton"),
    proprietaires: ["moi@gmail.com"],
  });
  assert.equal(r, "verifiee");
  const maj = appels.find((a) => a.url.endsWith("/webResource/id-1"));
  assert.deepEqual(maj.corps.owners, ["sa@projet.iam.gserviceaccount.com", "moi@gmail.com"]);
  assert.ok(appels.some((a) => a.methode === "PUT" && a.url.endsWith(encodeURIComponent(PROPRIETE))), "propriété déclarée");
});

test("la vérification refusée (balise pas encore en ligne) se retente au cycle suivant", async () => {
  const { appeler } = fauxClient([
    ["/sites", { corps: { siteEntry: [] } }],
    ["/webResource?verificationMethod=META", { erreur: "The necessary verification token could not be found", status: 400 }],
  ]);
  const r = await assurerAcces({ appeler, propriete: PROPRIETE, jetonActuel: "jeton-1", ecrireJeton: () => assert.fail() });
  assert.equal(r, "en-attente-deploiement");
});

test("une propriété déjà vérifiée ne déclenche plus rien", async () => {
  const { appeler, appels } = fauxClient([
    ["/sites", { corps: { siteEntry: [{ siteUrl: PROPRIETE, permissionLevel: "siteOwner" }] } }],
  ]);
  const r = await assurerAcces({ appeler, propriete: PROPRIETE, jetonActuel: "jeton-1", ecrireJeton: () => assert.fail() });
  assert.equal(r, "deja-accessible");
  assert.equal(appels.length, 1);
});

test("le client remonte le message d'erreur de Google avec son code", async () => {
  const faussefetch = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: { message: "Search Console API has not been used in project" } }) });
  const appeler = clientGoogle("jeton", faussefetch);
  await assert.rejects(appeler("GET", "https://www.googleapis.com/webmasters/v3/sites"), (e) => e.status === 403 && /has not been used/.test(e.message));
});

// ---------------------------------------------------------------------------
//  Choix de la source d'authentification Google
// ---------------------------------------------------------------------------
import { choisirJeton } from "../lib/google-auth.mjs";

test("un jeton Workload Identity prime sur le compte de service", async () => {
  const r = await choisirJeton({ accessToken: "ya29.abc", compteBase64: "xxx" }, "scope", () => assert.fail("JWT inutile"));
  assert.deepEqual(r, { jeton: "ya29.abc", source: "workload-identity" });
});

test("à défaut, le compte de service produit un jeton ; sans rien, null", async () => {
  const compte = Buffer.from(JSON.stringify({ client_email: "sa@x", private_key: "k" })).toString("base64");
  const r = await choisirJeton({ accessToken: "", compteBase64: compte }, "scope", async (c, s) => `jwt:${c.client_email}:${s}`);
  assert.deepEqual(r, { jeton: "jwt:sa@x:scope", source: "compte-de-service" });
  assert.equal(await choisirJeton({ accessToken: "", compteBase64: "" }, "scope"), null);
});

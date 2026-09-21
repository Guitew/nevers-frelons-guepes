/**
 * Accès Search Console par compte de service — mise en place automatique.
 *
 * Plutôt que de demander à un humain de créer la propriété dans l'interface
 * de la Search Console puis d'y inviter le compte de service, on fait
 * l'inverse : le compte de service se rend lui-même propriétaire vérifié du
 * préfixe d'URL du site (Site Verification API), déclare la propriété dans
 * la Search Console (Webmasters API) et ajoute les adresses humaines comme
 * copropriétaires, afin que la propriété apparaisse dans leur interface.
 *
 * Tout passe par les API ; seule condition humaine : un compte de service
 * dont le JSON est fourni en secret, avec les API « Search Console » et
 * « Site Verification » activées dans son projet Google Cloud.
 *
 * Les fonctions sont pures côté réseau : elles reçoivent un « appeler » afin
 * d'être testables hors ligne.
 */

export const PORTEES = [
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
].join(" ");

const VERIF = "https://www.googleapis.com/siteVerification/v1";
const WEBMASTERS = "https://www.googleapis.com/webmasters/v3";

/** Propriété Search Console de type « préfixe d'URL » : la base du site, barre finale comprise. */
export function proprieteDe(site) {
  return site.base.replace(/\/+$/, "") + "/";
}

/** Extrait la valeur « content » d'une balise meta de vérification. */
export function contenuMeta(jeton) {
  const m = String(jeton || "").match(/content=["']([^"']+)["']/);
  return m ? m[1] : String(jeton || "").trim();
}

/** Client HTTP JSON minimal, authentifié. */
export function clientGoogle(jeton, fetchImpl = fetch) {
  return async (methode, url, corps) => {
    const reponse = await fetchImpl(url, {
      method: methode,
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const texte = await reponse.text();
    let donnees = null;
    try {
      donnees = texte ? JSON.parse(texte) : null;
    } catch {
      donnees = { brut: texte };
    }
    if (!reponse.ok) {
      const message = donnees?.error?.message || texte.slice(0, 300);
      const erreur = new Error(`${methode} ${url} → ${reponse.status} : ${message}`);
      erreur.status = reponse.status;
      erreur.donnees = donnees;
      throw erreur;
    }
    return donnees;
  };
}

/** La propriété est-elle déjà accessible (et vérifiée) pour ce compte ? */
export async function etatPropriete(appeler, propriete) {
  const { siteEntry = [] } = (await appeler("GET", `${WEBMASTERS}/sites`)) || {};
  const entree = siteEntry.find((s) => s.siteUrl === propriete);
  if (!entree) return { presente: false, verifiee: false };
  return { presente: true, verifiee: entree.permissionLevel !== "siteUnverifiedUser", niveau: entree.permissionLevel };
}

/** Demande un jeton de vérification META pour le préfixe d'URL. */
export async function demanderJeton(appeler, propriete) {
  const r = await appeler("POST", `${VERIF}/token`, {
    site: { identifier: propriete, type: "SITE" },
    verificationMethod: "META",
  });
  return contenuMeta(r?.token);
}

/** Tente la vérification : Google va lire la balise meta sur la page d'accueil du préfixe. */
export async function verifier(appeler, propriete) {
  return appeler("POST", `${VERIF}/webResource?verificationMethod=META`, {
    site: { identifier: propriete, type: "SITE" },
  });
}

/** Ajoute des adresses humaines comme propriétaires vérifiés (visibles dans leur Search Console). */
export async function ajouterProprietaires(appeler, ressource, adresses) {
  const actuels = new Set(ressource.owners || []);
  const manquants = adresses.filter((a) => a && !actuels.has(a));
  if (!manquants.length) return ressource;
  const id = ressource.id || encodeURIComponent(ressource.site.identifier);
  return appeler("PUT", `${VERIF}/webResource/${id}`, {
    site: ressource.site,
    owners: [...actuels, ...manquants],
  });
}

/** Déclare la propriété dans la Search Console du compte de service. */
export async function declarerPropriete(appeler, propriete) {
  await appeler("PUT", `${WEBMASTERS}/sites/${encodeURIComponent(propriete)}`);
}

/**
 * Séquence complète, idempotente. Renvoie l'action menée :
 *   "deja-accessible" | "jeton-ecrit" | "verifiee" | "en-attente-deploiement"
 *
 * @param {object} p
 * @param {Function} p.appeler          client authentifié
 * @param {string}   p.propriete        préfixe d'URL
 * @param {string}   p.jetonActuel      valeur verifGoogle de site.json
 * @param {Function} p.ecrireJeton      persiste une nouvelle valeur verifGoogle
 * @param {string[]} p.proprietaires    adresses humaines à rendre copropriétaires
 * @param {Function} p.journal          console.log ou équivalent
 */
export async function assurerAcces({ appeler, propriete, jetonActuel, ecrireJeton, proprietaires = [], journal = () => {} }) {
  const etat = await etatPropriete(appeler, propriete);
  if (etat.presente && etat.verifiee) {
    journal(`Propriété ${propriete} accessible (${etat.niveau}).`);
    return "deja-accessible";
  }

  if (!jetonActuel) {
    const jeton = await demanderJeton(appeler, propriete);
    ecrireJeton(jeton);
    journal(
      `Jeton de vérification obtenu et inscrit dans site.json (verifGoogle). ` +
        `Il sera publié au prochain déploiement ; la vérification aura lieu au cycle suivant.`
    );
    return "jeton-ecrit";
  }

  let ressource;
  try {
    ressource = await verifier(appeler, propriete);
  } catch (erreur) {
    if (erreur.status === 400 || erreur.status === 403) {
      journal(
        `Vérification refusée pour l'instant (${erreur.message}). ` +
          `La balise meta est-elle déjà en ligne ? Nouvelle tentative au prochain cycle.`
      );
      return "en-attente-deploiement";
    }
    throw erreur;
  }
  journal(`Site vérifié : ${propriete}`);

  if (proprietaires.length) {
    try {
      ressource = await ajouterProprietaires(appeler, ressource, proprietaires);
      journal(`Copropriétaires : ${(ressource.owners || []).join(", ")}`);
    } catch (erreur) {
      journal(`⚠ Impossible d'ajouter les copropriétaires : ${erreur.message}`);
    }
  }

  await declarerPropriete(appeler, propriete);
  journal(`Propriété déclarée dans la Search Console du compte de service.`);
  return "verifiee";
}

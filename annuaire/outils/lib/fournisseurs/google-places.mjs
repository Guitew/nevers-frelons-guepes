/**
 * Fournisseur « google-places » — API Google Places (New).
 *
 * C'est la voie officielle pour interroger les fiches Google Business Profile :
 * elle est stable, contractuelle, et évite le grattage de pages Maps (fragile
 * techniquement et contraire aux conditions d'utilisation de Google).
 *
 * Deux appels sont utilisés :
 *   • places:searchNearby — pour découvrir les établissements d'une catégorie
 *     dans un rayon donné ; le masque de champs demande explicitement
 *     « websiteUri », ce qui permet de ne retenir que les fiches SANS site ;
 *   • places/{id} — pour re-vérifier une fiche existante (suivi du backlink).
 *
 * Point de vigilance contractuel : les conditions de l'API limitent la mise en
 * cache des données Places (30 jours, hors identifiant de lieu qui peut être
 * conservé). Les champs volatils — note, nombre d'avis, horaires — sont donc
 * systématiquement datés dans la fiche et rafraîchis par « npm run backlinks ».
 */

const RACINE_API = "https://places.googleapis.com/v1";

// Types rejetés par searchNearby (Table B uniquement) — cache auto-alimenté.
const typesNonSupportes = new Set();

const CHAMPS_RECHERCHE = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.businessStatus",
  "places.accessibilityOptions",
  "places.googleMapsUri",
].join(",");

const CHAMPS_DETAIL = [
  "id",
  "displayName",
  "websiteUri",
  "businessStatus",
  "rating",
  "userRatingCount",
  "nationalPhoneNumber",
  "regularOpeningHours",
  "formattedAddress",
].join(",");

function cle() {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY absente. Renseignez la variable d'environnement " +
        "(voir .env.exemple) ou basculez sur le fournisseur « csv » dans config.json."
    );
  }
  return k;
}

async function appeler(url, options = {}) {
  const reponse = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": cle(),
      "X-Goog-FieldMask": options.champs,
      ...(options.headers || {}),
    },
  });
  if (!reponse.ok) {
    const detail = await reponse.text();
    const erreur = new Error(`API Places ${reponse.status} : ${detail.slice(0, 400)}`);
    erreur.status = reponse.status;
    erreur.detail = detail;
    throw erreur;
  }
  return reponse.json();
}

function filtrerTypes(types) {
  return types.filter((t) => !typesNonSupportes.has(t));
}

function extraireTypesRejetes(detail) {
  const m = detail.match(/Unsupported types?:\s*([^."]+)/i);
  if (!m) return [];
  return m[1].split(",").map((t) => t.trim()).filter(Boolean);
}

/**
 * Recherche les établissements d'un type donné autour d'un point.
 * Filtre automatiquement les types non supportés par searchNearby (Table B).
 * @returns {Promise<object[]>} lieux bruts renvoyés par l'API.
 */
export async function rechercher({ types, latitude, longitude, rayonMetres, maximum = 20 }) {
  let typesFiltres = filtrerTypes(types);
  if (!typesFiltres.length) return [];

  const construireCorps = (t) => ({
    includedTypes: t,
    maxResultCount: Math.min(maximum, 20),
    languageCode: "fr",
    regionCode: "FR",
    rankPreference: "POPULARITY",
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius: Math.min(rayonMetres, 50000),
      },
    },
  });

  try {
    const data = await appeler(`${RACINE_API}/places:searchNearby`, {
      method: "POST",
      body: JSON.stringify(construireCorps(typesFiltres)),
      champs: CHAMPS_RECHERCHE,
    });
    return data.places || [];
  } catch (erreur) {
    if (erreur.status !== 400 || !erreur.detail) throw erreur;
    const rejetes = extraireTypesRejetes(erreur.detail);
    if (!rejetes.length) throw erreur;
    for (const t of rejetes) typesNonSupportes.add(t);
    typesFiltres = filtrerTypes(typesFiltres);
    if (!typesFiltres.length) return [];
    const data = await appeler(`${RACINE_API}/places:searchNearby`, {
      method: "POST",
      body: JSON.stringify(construireCorps(typesFiltres)),
      champs: CHAMPS_RECHERCHE,
    });
    return data.places || [];
  }
}

/** Relit une fiche Google par son identifiant (suivi du backlink). */
export async function detailler(placeId) {
  try {
    return await appeler(`${RACINE_API}/places/${encodeURIComponent(placeId)}`, {
      method: "GET",
      champs: CHAMPS_DETAIL,
    });
  } catch (erreur) {
    if (/ 404 /.test(` ${erreur.message} `) || erreur.message.includes("404")) return null;
    throw erreur;
  }
}

const JOUR_GOOGLE_VERS_LUNDI = [6, 0, 1, 2, 3, 4, 5]; // Google : 0 = dimanche

function convertirHoraires(horaires) {
  if (!horaires?.periods?.length) return null;
  const semaine = Array.from({ length: 7 }, (_, jour) => ({ jour, ferme: true, creneaux: [] }));
  for (const p of horaires.periods) {
    if (!p.open) continue;
    // Une période sans fermeture signifie « ouvert 24 h / 24 ».
    const jour = JOUR_GOOGLE_VERS_LUNDI[p.open.day];
    const debut = `${String(p.open.hour ?? 0).padStart(2, "0")}:${String(p.open.minute ?? 0).padStart(2, "0")}`;
    const fin = p.close
      ? `${String(p.close.hour ?? 0).padStart(2, "0")}:${String(p.close.minute ?? 0).padStart(2, "0")}`
      : "23:59";
    semaine[jour].ferme = false;
    semaine[jour].creneaux.push([debut, fin]);
  }
  for (const j of semaine) j.creneaux.sort((a, b) => a[0].localeCompare(b[0]));
  return semaine;
}

const ATTRIBUTS_ACCESSIBILITE = {
  wheelchairAccessibleEntrance: "Entrée accessible en fauteuil roulant",
  wheelchairAccessibleParking: "Parking accessible en fauteuil roulant",
  wheelchairAccessibleRestroom: "Toilettes accessibles en fauteuil roulant",
  wheelchairAccessibleSeating: "Places assises accessibles en fauteuil roulant",
};

function composant(lieu, type) {
  return (lieu.addressComponents || []).find((c) => (c.types || []).includes(type));
}

/** Normalise un lieu de l'API vers la structure interne de l'annuaire. */
export function normaliser(lieu) {
  const ville =
    composant(lieu, "locality")?.longText ||
    composant(lieu, "postal_town")?.longText ||
    composant(lieu, "administrative_area_level_2")?.longText ||
    "";
  const numero = composant(lieu, "street_number")?.longText || "";
  const voie = composant(lieu, "route")?.longText || "";

  const attributs = [];
  for (const [k, libelle] of Object.entries(ATTRIBUTS_ACCESSIBILITE)) {
    if (lieu.accessibilityOptions?.[k]) attributs.push(libelle);
  }

  return {
    id: lieu.id,
    nom: lieu.displayName?.text || "",
    site_web_gmb: lieu.websiteUri || null,
    statut_google: lieu.businessStatus || "OPERATIONAL",
    categorie_gmb: lieu.primaryTypeDisplayName?.text || lieu.primaryType || "",
    type_principal: lieu.primaryType || "",
    types: lieu.types || [],
    ville,
    adresse: {
      rue: [numero, voie].filter(Boolean).join(" "),
      code_postal: composant(lieu, "postal_code")?.longText || "",
      departement: (composant(lieu, "postal_code")?.longText || "").slice(0, 2),
      region: composant(lieu, "administrative_area_level_1")?.longText || "",
      pays: composant(lieu, "country")?.longText || "France",
      complete: lieu.formattedAddress || "",
    },
    telephone: lieu.internationalPhoneNumber || lieu.nationalPhoneNumber || "",
    geo: lieu.location
      ? { latitude: lieu.location.latitude, longitude: lieu.location.longitude }
      : null,
    note: typeof lieu.rating === "number" ? Math.round(lieu.rating * 10) / 10 : null,
    avis: lieu.userRatingCount || 0,
    horaires: convertirHoraires(lieu.regularOpeningHours),
    attributs,
    lien_google: lieu.googleMapsUri || "",
  };
}

export const nom = "google-places";

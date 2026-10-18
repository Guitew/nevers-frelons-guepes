/**
 * Prestations et équipements déclarés sur la fiche Google (Places API New) :
 * sur place / à emporter / livraison, réservation, terrasse, niveau de prix,
 * moyens de paiement, parking, résumé éditorial… Ces champs arrivent avec le
 * même appel que les avis (SKU Enterprise + Atmosphere) : ils ne coûtent rien
 * de plus et répondent aux questions que les clients posent à Google
 * (« peut-on réserver », « à emporter », « terrasse », « prix »).
 *
 * Règle : une donnée absente n'est pas affichée. `true` = proposé, `false` =
 * déclaré non proposé (information utile aussi), `undefined` = inconnu.
 */

const PRIX = {
  PRICE_LEVEL_FREE: { symbole: "gratuit", libelle: "gratuit" },
  PRICE_LEVEL_INEXPENSIVE: { symbole: "€", libelle: "bon marché" },
  PRICE_LEVEL_MODERATE: { symbole: "€€", libelle: "modéré" },
  PRICE_LEVEL_EXPENSIVE: { symbole: "€€€", libelle: "élevé" },
  PRICE_LEVEL_VERY_EXPENSIVE: { symbole: "€€€€", libelle: "très élevé" },
};

/** Options booléennes de l'API → libellés français (ordre d'affichage). */
export const OPTIONS = [
  ["dineIn", "sur place"],
  ["takeout", "à emporter"],
  ["delivery", "livraison"],
  ["curbsidePickup", "retrait en voiture"],
  ["reservable", "réservation possible"],
  ["outdoorSeating", "terrasse"],
  ["servesBreakfast", "petit-déjeuner"],
  ["servesBrunch", "brunch"],
  ["servesLunch", "déjeuner"],
  ["servesDinner", "dîner"],
  ["servesVegetarianFood", "plats végétariens"],
  ["servesCoffee", "café"],
  ["servesBeer", "bière"],
  ["servesWine", "vin"],
  ["servesCocktails", "cocktails"],
  ["menuForChildren", "menu enfant"],
  ["goodForChildren", "adapté aux enfants"],
  ["goodForGroups", "adapté aux groupes"],
  ["goodForWatchingSports", "retransmissions sportives"],
  ["liveMusic", "musique live"],
  ["allowsDogs", "chiens acceptés"],
  ["restroom", "toilettes"],
];

const PAIEMENT = [
  ["acceptsCreditCards", "carte bancaire"],
  ["acceptsDebitCards", "carte de débit"],
  ["acceptsNfc", "paiement sans contact"],
  ["acceptsCashOnly", "espèces uniquement"],
];

const PARKING = [
  ["freeParkingLot", "parking gratuit"],
  ["paidParkingLot", "parking payant"],
  ["freeStreetParking", "stationnement gratuit dans la rue"],
  ["paidStreetParking", "stationnement payant dans la rue"],
  ["freeGarageParking", "garage gratuit"],
  ["paidGarageParking", "garage payant"],
  ["valetParking", "voiturier"],
];

/** Champs à demander à l'API en plus des avis (même SKU, aucun surcoût). */
export const CHAMPS_SERVICES = [
  "priceLevel",
  "editorialSummary",
  "primaryTypeDisplayName",
  ...OPTIONS.map(([c]) => c),
  "paymentOptions",
  "parkingOptions",
];

/**
 * Extrait les prestations d'une réponse Place Details. Retourne null si la
 * fiche n'en déclare aucune.
 * @param {object} detail réponse brute de l'API
 * @param {string} releve date ISO du relevé
 */
export function extraireServices(detail, releve) {
  if (!detail || typeof detail !== "object") return null;
  const options = {};
  for (const [cle] of OPTIONS) {
    if (typeof detail[cle] === "boolean") options[cle] = detail[cle];
  }
  const paiement = PAIEMENT.filter(([c]) => detail.paymentOptions?.[c] === true).map(([, l]) => l);
  const parking = PARKING.filter(([c]) => detail.parkingOptions?.[c] === true).map(([, l]) => l);
  const prix = PRIX[detail.priceLevel] ? detail.priceLevel : null;
  const resume = (detail.editorialSummary?.text || "").trim();
  const resumeLangue = detail.editorialSummary?.languageCode || "";
  const vide = !Object.keys(options).length && !paiement.length && !parking.length && !prix && !resume;
  if (vide) return null;
  return {
    releve,
    ...(prix ? { prix } : {}),
    ...(resume ? { resume, resume_langue: resumeLangue } : {}),
    options,
    paiement,
    parking,
  };
}

/** « €€ (modéré) » ou "" si inconnu. */
export function prixLisible(services) {
  const p = PRIX[services?.prix];
  return p ? `${p.symbole} (${p.libelle})` : "";
}

/** Libellés des prestations déclarées proposées et non proposées. */
export function libellesServices(services) {
  const oui = [];
  const non = [];
  for (const [cle, libelle] of OPTIONS) {
    const v = services?.options?.[cle];
    if (v === true) oui.push(libelle);
    else if (v === false) non.push(libelle);
  }
  return { oui, non, paiement: services?.paiement || [], parking: services?.parking || [] };
}

/** Valeur d'une option (true / false / undefined). */
export function option(services, cle) {
  return services?.options?.[cle];
}

/**
 * Maillage d'exploration.
 *
 * L'API Places plafonne « searchNearby » à 20 résultats par appel, classés par
 * popularité, sans pagination. Interroger chaque jour la même zone de 12 km
 * renverrait donc éternellement les mêmes 20 établissements : passé la première
 * semaine, la collecte se tarirait alors que la zone est loin d'être épuisée.
 *
 * La parade est le maillage : la zone est découpée en petites cellules
 * (800 m de rayon par défaut), chacune interrogée séparément — 20 résultats
 * par cellule, ce qui suffit à couvrir une rue ou un quartier. Un curseur
 * persistant (donnees/progression.json) mémorise où la collecte s'est arrêtée,
 * de sorte que chaque exécution reprend là où la précédente s'est interrompue
 * au lieu de repartir du centre.
 *
 * Deuxième contrainte : « includedTypes » n'accepte pas plus de 50 types, or la
 * taxonomie en compte davantage. Les types sont donc répartis en lots, eux
 * aussi parcourus par le curseur. Une cellule est entièrement couverte quand
 * tous ses lots ont été interrogés.
 */

const METRES_PAR_DEGRE_LATITUDE = 111320;

/** Limite de l'API Places sur le nombre de types par requête. */
export const TYPES_PAR_LOT = 50;

/**
 * Découpe une zone circulaire en cellules d'exploration.
 *
 * Les centres sont espacés de 1,4 rayon : les disques se recouvrent, ce qui
 * évite les angles morts entre cellules. Elles sont rendues du centre vers la
 * périphérie, parce que la densité d'établissements décroît avec l'éloignement
 * du centre-ville : la collecte donne ainsi ses meilleurs résultats en premier.
 *
 * @returns {{latitude:number, longitude:number, rayonMetres:number}[]}
 */
export function cellules(zone, mailleMetres = 800) {
  const maille = Math.max(100, mailleMetres);
  const pas = maille * 1.4;
  const rayon = Math.max(zone.rayonMetres, maille);

  const degreLat = pas / METRES_PAR_DEGRE_LATITUDE;
  const cosLat = Math.cos((zone.latitude * Math.PI) / 180);
  const degreLon = pas / (METRES_PAR_DEGRE_LATITUDE * Math.max(cosLat, 0.01));

  const portee = Math.ceil(rayon / pas);
  const liste = [];
  for (let y = -portee; y <= portee; y++) {
    for (let x = -portee; x <= portee; x++) {
      // Décalage d'une demi-colonne une ligne sur deux : maillage en quinconce,
      // qui couvre la même surface avec moins de cellules qu'une grille droite.
      const decalage = y % 2 === 0 ? 0 : 0.5;
      const dx = (x + decalage) * pas;
      const dy = y * pas;
      const distance = Math.hypot(dx, dy);
      if (distance > rayon) continue;
      liste.push({
        latitude: zone.latitude + y * degreLat,
        longitude: zone.longitude + (x + decalage) * degreLon,
        rayonMetres: maille,
        distance,
      });
    }
  }
  return liste.sort((a, b) => a.distance - b.distance);
}

/**
 * Répartit les types Google des catégories retenues en lots interrogeables.
 * Les types sont dédoublonnés : plusieurs catégories peuvent partager un type.
 */
export function lotsDeTypes(categories, taille = TYPES_PAR_LOT) {
  const types = [...new Set(categories.flatMap((c) => c.gmb))];
  const lots = [];
  for (let i = 0; i < types.length; i += taille) lots.push(types.slice(i, i + taille));
  return lots;
}

/**
 * Suite des interrogations à mener, à partir d'un curseur et dans la limite
 * d'un budget d'appels. Chaque étape est un couple (cellule, lot de types).
 *
 * @param {object} curseur   {cellule, lot, tour}
 * @returns {{etapes: Array, curseur: object}} les étapes et le curseur d'après
 */
export function planifier(cellules, lots, curseur, budget) {
  const etapes = [];
  let { cellule = 0, lot = 0, tour = 0 } = curseur || {};
  if (!cellules.length || !lots.length) return { etapes, curseur: { cellule, lot, tour } };

  for (let i = 0; i < budget; i++) {
    if (cellule >= cellules.length) {
      // Zone entièrement parcourue : on repart du centre pour un nouveau tour,
      // qui ramassera les établissements ouverts depuis le passage précédent.
      cellule = 0;
      lot = 0;
      tour += 1;
    }
    const etape = {
      cellule: cellules[cellule],
      types: lots[lot],
      indexCellule: cellule,
      indexLot: lot,
      tour,
    };
    lot += 1;
    if (lot >= lots.length) {
      lot = 0;
      cellule += 1;
    }
    // Chaque étape porte le curseur qui la suit : la collecte s'arrête dès que
    // son quota de fiches est atteint, et enregistre alors la position exacte
    // où reprendre — sans compter comme parcourues les étapes non exécutées.
    etape.suivant = { cellule, lot, tour };
    etapes.push(etape);
  }
  return { etapes, curseur: { cellule, lot, tour } };
}

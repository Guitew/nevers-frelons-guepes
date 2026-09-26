/**
 * Départements français : ALLO FRELONS intervient partout, et allo-frelons.fr a une page
 * par département ou par ville. Reconnaître le département cité par un spot permet de
 * lui proposer la page locale correspondante.
 */

import { normaliser } from "./texte.mjs";

export const DEPARTEMENTS = [
  ["01", "Ain"], ["02", "Aisne"], ["03", "Allier"], ["04", "Alpes-de-Haute-Provence"], ["05", "Hautes-Alpes"],
  ["06", "Alpes-Maritimes"], ["07", "Ardèche"], ["08", "Ardennes"], ["09", "Ariège"], ["10", "Aube"],
  ["11", "Aude"], ["12", "Aveyron"], ["13", "Bouches-du-Rhône"], ["14", "Calvados"], ["15", "Cantal"],
  ["16", "Charente"], ["17", "Charente-Maritime"], ["18", "Cher"], ["19", "Corrèze"], ["2A", "Corse-du-Sud"],
  ["2B", "Haute-Corse"], ["21", "Côte-d'Or"], ["22", "Côtes-d'Armor"], ["23", "Creuse"], ["24", "Dordogne"],
  ["25", "Doubs"], ["26", "Drôme"], ["27", "Eure"], ["28", "Eure-et-Loir"], ["29", "Finistère"],
  ["30", "Gard"], ["31", "Haute-Garonne"], ["32", "Gers"], ["33", "Gironde"], ["34", "Hérault"],
  ["35", "Ille-et-Vilaine"], ["36", "Indre"], ["37", "Indre-et-Loire"], ["38", "Isère"], ["39", "Jura"],
  ["40", "Landes"], ["41", "Loir-et-Cher"], ["42", "Loire"], ["43", "Haute-Loire"], ["44", "Loire-Atlantique"],
  ["45", "Loiret"], ["46", "Lot"], ["47", "Lot-et-Garonne"], ["48", "Lozère"], ["49", "Maine-et-Loire"],
  ["50", "Manche"], ["51", "Marne"], ["52", "Haute-Marne"], ["53", "Mayenne"], ["54", "Meurthe-et-Moselle"],
  ["55", "Meuse"], ["56", "Morbihan"], ["57", "Moselle"], ["58", "Nièvre"], ["59", "Nord"],
  ["60", "Oise"], ["61", "Orne"], ["62", "Pas-de-Calais"], ["63", "Puy-de-Dôme"], ["64", "Pyrénées-Atlantiques"],
  ["65", "Hautes-Pyrénées"], ["66", "Pyrénées-Orientales"], ["67", "Bas-Rhin"], ["68", "Haut-Rhin"], ["69", "Rhône"],
  ["70", "Haute-Saône"], ["71", "Saône-et-Loire"], ["72", "Sarthe"], ["73", "Savoie"], ["74", "Haute-Savoie"],
  ["75", "Paris"], ["76", "Seine-Maritime"], ["77", "Seine-et-Marne"], ["78", "Yvelines"], ["79", "Deux-Sèvres"],
  ["80", "Somme"], ["81", "Tarn"], ["82", "Tarn-et-Garonne"], ["83", "Var"], ["84", "Vaucluse"],
  ["85", "Vendée"], ["86", "Vienne"], ["87", "Haute-Vienne"], ["88", "Vosges"], ["89", "Yonne"],
  ["90", "Territoire de Belfort"], ["91", "Essonne"], ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"], ["94", "Val-de-Marne"],
  ["95", "Val-d'Oise"], ["971", "Guadeloupe"], ["972", "Martinique"], ["973", "Guyane"], ["974", "La Réunion"], ["976", "Mayotte"],
];

/** Noms trop courts ou ambigus pour être reconnus sans leur numéro. */
const AMBIGUS = new Set(["cher", "lot", "loire", "nord", "var", "indre", "vienne", "marne", "manche", "orne", "eure", "gard", "aude", "aube", "ain", "somme", "meuse", "paris", "jura", "tarn", "landes", "gers", "isere"]);

const INDEX = DEPARTEMENTS.map(([numero, nom]) => ({ numero, nom, cle: normaliser(nom), jeton: "dep" + numero.toLowerCase() }));

/**
 * Départements cités dans un texte : par leur nom (composé ou non ambigu), par « nom NN »,
 * « NN nom », « (NN) », ou après « département de … » (qui lève l'ambiguïté de « Nord », « Var »…).
 */
export function departementsCites(texte) {
  const t = " " + normaliser(texte).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  const trouves = [];
  for (const d of INDEX) {
    const nom = d.cle.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    const numero = d.numero.toLowerCase();
    const parNom = t.includes(" " + nom + " ");
    const parNumero = t.includes(" " + nom + " " + numero + " ") || t.includes(" " + numero + " " + nom + " ") || t.includes(" " + numero + " ");
    const parDepartement = new RegExp(" departement (de la |du |de l |des |de |d )" + nom + " ").test(t);
    if ((parNom && (parNumero || parDepartement || !AMBIGUS.has(nom))) || t.includes(" " + nom + " " + numero + " ") || t.includes(" " + numero + " " + nom + " ")) {
      if (!trouves.includes(d)) trouves.push(d);
    }
  }
  // « (83) » seul dans un titre : accepté entre parenthèses.
  for (const m of String(texte || "").matchAll(/\((\d{2}|2A|2B|97\d)\)/gi)) {
    const d = INDEX.find((x) => x.numero.toLowerCase() === m[1].toLowerCase());
    if (d && !trouves.includes(d)) trouves.push(d);
  }
  return trouves;
}

/** Jetons de mots-clés d'un département (« pyrenees », « atlantiques », « dep64 »). */
export function jetonsDepartement(d) {
  return [...d.cle.split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !["les", "des", "sur", "sud", "haut", "haute", "hautes", "bas", "val", "terr"].includes(m)), d.jeton];
}

/** Jetons « depNN » d'un slug ou d'un titre (nombres à deux chiffres isolés). */
export function jetonsNumeros(texte) {
  const jetons = new Set();
  for (const m of String(texte || "").matchAll(/(?:^|[^0-9])(\d{2}|2A|2B)(?![0-9])/gi)) jetons.add("dep" + m[1].toLowerCase());
  for (const m of String(texte || "").matchAll(/(?:^|[^0-9])(97\d)(?![0-9])/g)) jetons.add("dep" + m[1]);
  return [...jetons];
}

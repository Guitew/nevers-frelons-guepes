/**
 * Fournisseur « simulation » — hors ligne, déterministe, gratuit.
 *
 * Fabrique des établissements plausibles à partir des coordonnées de la
 * cellule interrogée. Sert à éprouver la chaîne complète — maillage, curseur,
 * budget d'appels, classification, rédaction, publication — avant d'engager le
 * moindre appel facturé à l'API Places, et à reproduire un comportement de
 * collecte en test sans réseau.
 *
 * Trois propriétés le rendent utile :
 *   • déterministe : une même cellule rend toujours les mêmes établissements,
 *     donc deux exécutions successives se dédoublonnent comme en production ;
 *   • réaliste : environ un tiers des fiches déclarent un site web et sont donc
 *     écartées par le filtre, comme sur le terrain ;
 *   • borné : 20 résultats par appel, exactement comme l'API réelle.
 */

import { empreinte } from "../texte.mjs";

const ENSEIGNES = ["Maison", "Atelier", "Comptoir", "Le Relais", "Espace", "La Halte", "Aux Deux", "Chez"];
const PATRONYMES = ["Berthier", "Duval", "Charnay", "Loiseau", "Mercier", "Fabre", "Guillot", "Renard", "Perrin", "Vasseur"];
const VOIES = ["rue de la République", "avenue du Général de Gaulle", "route de Nevers", "place du Marché", "rue des Écoles", "boulevard Victor Hugo"];

/** Communes de repli, choisies d'après la latitude de la cellule. */
const COMMUNES = [
  { nom: "Nevers", code: "58000" },
  { nom: "Varennes-Vauzelles", code: "58640" },
  { nom: "Fourchambault", code: "58600" },
  { nom: "Marzy", code: "58180" },
];

export async function rechercher({ types, latitude, longitude, rayonMetres }) {
  const graine = empreinte(`${latitude.toFixed(4)}|${longitude.toFixed(4)}|${types[0]}`);
  const combien = graine % 21; // 0 à 20, comme le plafond de l'API
  const lieux = [];
  for (let i = 0; i < combien; i++) {
    const g = empreinte(`${graine}-${i}`);
    const commune = COMMUNES[g % COMMUNES.length];
    const type = types[g % types.length];
    lieux.push({
      id: `sim-${graine.toString(36)}-${i}`,
      nom: `${ENSEIGNES[g % ENSEIGNES.length]} ${PATRONYMES[(g >>> 3) % PATRONYMES.length]}`,
      type_principal: type,
      types: [type],
      categorie_gmb: type.replace(/_/g, " "),
      // Un tiers des établissements déclarent déjà un site : ils seront écartés.
      site_web: g % 3 === 0 ? `https://exemple-${g % 900}.fr` : null,
      commune,
      latitude: latitude + ((g % 100) - 50) / 100000,
      longitude: longitude + (((g >>> 5) % 100) - 50) / 100000,
      note: Math.round((3 + (g % 20) / 10) * 10) / 10,
      avis: g % 350,
      rue: `${(g % 90) + 1} ${VOIES[g % VOIES.length]}`,
      rayon: rayonMetres,
    });
  }
  return lieux;
}

/** Relit un établissement simulé : le lien n'est jamais posé, par construction. */
export async function detailler() {
  return null;
}

export function normaliser(lieu) {
  return {
    id: lieu.id,
    nom: lieu.nom,
    site_web_gmb: lieu.site_web,
    statut_google: "OPERATIONAL",
    categorie_gmb: lieu.categorie_gmb,
    type_principal: lieu.type_principal,
    types: lieu.types,
    ville: lieu.commune.nom,
    adresse: {
      rue: lieu.rue,
      code_postal: lieu.commune.code,
      departement: lieu.commune.code.slice(0, 2),
      region: "Bourgogne-Franche-Comté",
      pays: "France",
      complete: `${lieu.rue}, ${lieu.commune.code} ${lieu.commune.nom}`,
    },
    telephone: `+33386${String(100000 + (empreinte(lieu.id) % 899999))}`,
    geo: { latitude: lieu.latitude, longitude: lieu.longitude },
    note: lieu.note,
    avis: lieu.avis,
    horaires: Array.from({ length: 7 }, (_, j) => ({
      jour: j,
      ferme: j === 6,
      creneaux: j === 6 ? [] : [["09:00", "12:30"], ["14:00", "18:30"]],
    })),
    attributs: empreinte(lieu.id) % 2 ? ["Entrée accessible en fauteuil roulant"] : [],
    lien_google: "",
    simule: true,
  };
}

export const nom = "simulation";

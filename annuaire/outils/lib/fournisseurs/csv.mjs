/**
 * Fournisseur « csv » — import manuel, sans clé d'API.
 *
 * Permet de faire tourner l'annuaire sans budget Google : on dépose un export
 * (tableur, prestataire de données, relevé terrain) dans donnees/import.csv et
 * la collecte quotidienne y puise ses 20 fiches. C'est aussi le mode utilisé
 * pour les tests et pour la reprise manuelle d'une fiche mal classée.
 *
 * Colonnes attendues (séparateur « ; » ou « , », première ligne = en-têtes) :
 *   id ; nom ; categorie_gmb ; type_principal ; rue ; code_postal ; ville ;
 *   telephone ; latitude ; longitude ; note ; avis ; site_web ; lien_google ;
 *   attributs ; horaires ; exemple
 *
 * Les colonnes « attributs » et « types » acceptent plusieurs valeurs séparées
 * par une barre verticale. La colonne « horaires » suit la forme :
 *   lun:07:00-13:00,15:30-19:00|mar:ferme|mer:09:00-19:00
 * La colonne « exemple » à 1 marque une fiche de démonstration : elle est
 * signalée comme telle sur le site et exclue de l'indexation.
 */

import fs from "node:fs";
import path from "node:path";
import { DONNEES } from "../chemins.mjs";
import { empreinte } from "../texte.mjs";

const FICHIER = path.join(DONNEES, "import.csv");

/** Analyse un CSV en respectant les guillemets doubles. */
export function analyser(texte) {
  const separateur = (texte.split("\n")[0].match(/;/g) || []).length >= 1 ? ";" : ",";
  const lignes = [];
  let champ = "";
  let ligne = [];
  let dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') dansGuillemets = false;
      else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === separateur) { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else if (c !== "\r") champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  if (!lignes.length) return [];
  const entetes = lignes[0].map((e) => e.trim().toLowerCase());
  return lignes
    .slice(1)
    .filter((l) => l.some((v) => v.trim() !== ""))
    .map((l) => Object.fromEntries(entetes.map((e, i) => [e, (l[i] || "").trim()])));
}

const JOURS_CSV = { lun: 0, mar: 1, mer: 2, jeu: 3, ven: 4, sam: 5, dim: 6 };

/** « lun:07:00-13:00,15:30-19:00|mar:ferme » → structure horaires interne. */
export function analyserHoraires(valeur) {
  if (!valeur) return null;
  const semaine = Array.from({ length: 7 }, (_, jour) => ({ jour, ferme: true, creneaux: [] }));
  for (const bloc of valeur.split("|")) {
    const [cle, ...reste] = bloc.split(":");
    const jour = JOURS_CSV[(cle || "").trim().slice(0, 3).toLowerCase()];
    if (jour === undefined) continue;
    const detail = reste.join(":").trim();
    if (!detail || /ferm/i.test(detail)) continue;
    for (const creneau of detail.split(",")) {
      const [debut, fin] = creneau.split("-").map((x) => x.trim());
      if (debut && fin) {
        semaine[jour].ferme = false;
        semaine[jour].creneaux.push([debut, fin]);
      }
    }
  }
  return semaine;
}

export async function rechercher() {
  if (!fs.existsSync(FICHIER)) return [];
  return analyser(fs.readFileSync(FICHIER, "utf8"));
}

/** Aucun rafraîchissement possible hors API : la ligne CSV fait foi. */
export async function detailler() {
  return null;
}

export function normaliser(ligne) {
  const nombre = (v) => (v === "" || v === undefined ? null : Number(String(v).replace(",", ".")));
  const rue = ligne.rue || ligne.adresse || "";
  const codePostal = ligne.code_postal || ligne.cp || "";
  return {
    id: ligne.id || `csv-${empreinte(`${ligne.nom}|${rue}|${ligne.ville}`).toString(16)}`,
    nom: ligne.nom || "",
    site_web_gmb: ligne.site_web || null,
    statut_google: "OPERATIONAL",
    categorie_gmb: ligne.categorie_gmb || ligne.categorie || "",
    type_principal: ligne.type_principal || "",
    types: (ligne.types || "").split("|").filter(Boolean),
    ville: ligne.ville || "",
    adresse: {
      rue,
      code_postal: codePostal,
      departement: codePostal.slice(0, 2),
      region: ligne.region || "",
      pays: ligne.pays || "France",
      complete: [rue, `${codePostal} ${ligne.ville || ""}`.trim()].filter(Boolean).join(", "),
    },
    telephone: ligne.telephone || "",
    geo:
      nombre(ligne.latitude) !== null
        ? { latitude: nombre(ligne.latitude), longitude: nombre(ligne.longitude) }
        : null,
    note: nombre(ligne.note),
    avis: Number(ligne.avis || 0),
    horaires: analyserHoraires(ligne.horaires),
    attributs: (ligne.attributs || "").split("|").filter(Boolean),
    lien_google: ligne.lien_google || "",
    exemple: /^(1|oui|true)$/i.test(ligne.exemple || ""),
  };
}

export const nom = "csv";

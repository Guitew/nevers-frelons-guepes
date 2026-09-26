/** Export CSV « façon Excel français » : séparateur « ; », guillemets doublés, BOM UTF-8. */

export function echapperCsv(valeur, separateur = ";") {
  if (valeur == null) return "";
  let s = Array.isArray(valeur) ? valeur.join(" | ") : String(valeur);
  s = s.replace(/\r?\n/g, " ");
  if (s.includes('"') || s.includes(separateur) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Produit le texte CSV d'une liste d'objets, dans l'ordre des colonnes fournies. */
export function versCsv(lignes, colonnes, { separateur = ";", bom = true } = {}) {
  const entete = colonnes.map((c) => echapperCsv(c.libelle ?? c.cle, separateur)).join(separateur);
  const corps = lignes.map((l) => colonnes.map((c) => echapperCsv(typeof c.valeur === "function" ? c.valeur(l) : l[c.cle], separateur)).join(separateur));
  return (bom ? "﻿" : "") + [entete, ...corps].join("\r\n") + "\r\n";
}

/** Lit un CSV simple (première colonne = valeur), tolérant aux exports Search Console. */
export function premiereColonne(texte) {
  const valeurs = [];
  for (const brut of String(texte || "").split(/\r?\n/)) {
    const ligne = brut.trim();
    if (!ligne) continue;
    const sep = ligne.includes(";") && !ligne.includes(",") ? ";" : ligne.includes("\t") ? "\t" : ",";
    let premiere = ligne.split(sep)[0].trim();
    if (premiere.startsWith('"') && premiere.endsWith('"')) premiere = premiere.slice(1, -1).replace(/""/g, '"');
    valeurs.push(premiere.replace(/^﻿/, ""));
  }
  return valeurs;
}

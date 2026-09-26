/**
 * Normalisation de texte, sans dépendance. Tout ce qui compare des mots
 * (thèmes, mentions, phrases-signatures) passe par « normaliser » afin
 * d'ignorer casse, accents et espaces multiples.
 */

/** Retire les accents. */
export function sansAccents(str) {
  return (str || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Minuscules, sans accents, espaces réduits, apostrophes typographiques unifiées. */
export function normaliser(str) {
  return sansAccents(str)
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[ \s]+/g, " ")
    .trim();
}

/**
 * Cherche des expressions dans un texte (déjà normalisé ou non) et renvoie
 * celles qui s'y trouvent, en respectant les limites de mots.
 */
export function expressionsPresentes(texte, expressions) {
  const t = " " + normaliser(texte).replace(/[^a-z0-9' ]+/g, " ") + " ";
  const trouvees = [];
  for (const e of expressions) {
    const n = normaliser(e).replace(/[^a-z0-9' ]+/g, " ").trim();
    if (!n) continue;
    if (t.includes(" " + n + " ")) trouvees.push(e);
  }
  return trouvees;
}

/** Compte les occurrences d'une expression (limites de mots respectées). */
export function compterOccurrences(texte, expression) {
  const t = " " + normaliser(texte).replace(/[^a-z0-9' ]+/g, " ") + " ";
  const n = " " + normaliser(expression).replace(/[^a-z0-9' ]+/g, " ").trim() + " ";
  if (n.trim() === "") return 0;
  let compte = 0;
  let i = t.indexOf(n);
  while (i !== -1) {
    compte++;
    i = t.indexOf(n, i + n.length - 1);
  }
  return compte;
}

const MOTS_VIDES = new Set(
  "le la les un une des du de d l et ou en au aux a à pour par sur dans avec sans sous ce cet cette ces son sa ses mon ma mes ton ta tes leur leurs nos vos notre votre qui que quoi dont où est sont être avoir il elle ils elles on nous vous je tu y ne pas plus moins très tout tous toute toutes comme mais donc or ni car si the of and to in for on with".split(
    " "
  )
);

/** Mots significatifs d'un texte (≥ 3 lettres, sans mots vides), dédoublonnés. */
export function motsSignificatifs(texte, max = 200) {
  const vus = new Set();
  const mots = [];
  for (const m of normaliser(texte).split(/[^a-z0-9]+/)) {
    if (m.length < 3 || MOTS_VIDES.has(m) || vus.has(m) || /^\d+$/.test(m)) continue;
    vus.add(m);
    mots.push(m);
    if (mots.length >= max) break;
  }
  return mots;
}

/** Transforme une chaîne en identifiant (« Chez Léon » → « chez-leon »). */
export function slugifier(str) {
  return normaliser(str)
    .replace(/'/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/** Date du jour au format AAAA-MM-JJ (UTC). */
export function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

/** Nombre de jours écoulés depuis une date ISO (calendaire, ancré à midi UTC). */
export function joursDepuis(iso, maintenant = new Date()) {
  if (!iso) return Infinity;
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return Infinity;
  const m = new Date(maintenant.toISOString().slice(0, 10) + "T12:00:00Z");
  return Math.round((m - d) / 86400000);
}

/** Tronque proprement une chaîne sur une limite de mot. */
export function tronquer(str, max = 120) {
  const s = (str || "").toString().replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const coupe = s.slice(0, max - 1);
  const espace = coupe.lastIndexOf(" ");
  return (espace > max / 2 ? coupe.slice(0, espace) : coupe).trim() + "…";
}

/** Empreinte déterministe d'une chaîne (FNV-1a 32 bits) : répartition stable. */
export function empreinte(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < (str || "").length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

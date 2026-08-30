/**
 * Fonctions de normalisation de texte partagées par les outils et par Eleventy.
 * Aucune dépendance externe : le projet doit rester installable en une commande.
 */

/** Retire les accents et passe en minuscules. */
export function aplatir(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Transforme une chaîne en identifiant d'URL (« Chez Léon » → « chez-leon »). */
export function slugifier(str) {
  return aplatir(str)
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/**
 * Empreinte déterministe d'une chaîne (FNV-1a 32 bits).
 * Sert à varier les tournures rédactionnelles sans jamais changer d'un build
 * à l'autre : une même fiche produit toujours le même texte.
 */
export function empreinte(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < (str || "").length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Choisit un élément d'une liste de façon déterministe, à partir d'une graine. */
export function choisir(liste, graine, decalage = 0) {
  if (!liste || liste.length === 0) return "";
  return liste[(empreinte(String(graine)) + decalage * 2654435761) % liste.length];
}

/** Met la première lettre en majuscule. */
export function capitaliser(str) {
  const s = (str || "").toString();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Formate un numéro français en groupes de deux chiffres. */
export function telephoneLisible(numero) {
  if (!numero) return "";
  const brut = numero.replace(/[^\d+]/g, "");
  const national = brut.startsWith("+33") ? "0" + brut.slice(3) : brut;
  if (!/^0\d{9}$/.test(national)) return numero;
  return national.match(/.{1,2}/g).join(" ");
}

/** Version « tel: » d'un numéro. */
export function telephoneLien(numero) {
  if (!numero) return "";
  const brut = numero.replace(/[^\d+]/g, "");
  if (brut.startsWith("+")) return brut;
  if (brut.startsWith("0")) return "+33" + brut.slice(1);
  return brut;
}

/** Tronque proprement une chaîne sur une limite de mot. */
export function tronquer(str, max = 155) {
  const s = (str || "").toString().trim();
  if (s.length <= max) return s;
  const coupe = s.slice(0, max - 1);
  return coupe.slice(0, coupe.lastIndexOf(" ")).trim() + "…";
}

/** Échappe le texte destiné à du HTML. */
export function echapperHtml(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Les formateurs Intl sont coûteux à construire : sur une compilation de
// plusieurs milliers de fiches, les recréer à chaque appel représentait 10 %
// du temps de build. Ils sont donc instanciés une fois pour toutes.
const FORMAT_ISO = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const FORMAT_LISIBLE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Date du jour au format ISO court (AAAA-MM-JJ), fuseau Europe/Paris. */
export function aujourdhui(date = new Date()) {
  return FORMAT_ISO.format(date);
}

const cacheDates = new Map();

/** « 2026-08-18 » → « 18 août 2026 ». Mémoïsé : les mêmes dates reviennent
 *  des milliers de fois dans un annuaire à publication quotidienne. */
export function dateLisible(iso) {
  if (!iso) return "";
  const cache = cacheDates.get(iso);
  if (cache !== undefined) return cache;
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  const valeur = Number.isNaN(d.getTime()) ? "" : FORMAT_LISIBLE.format(d);
  cacheDates.set(iso, valeur);
  return valeur;
}

/**
 * Nombre de jours CALENDAIRES écoulés depuis une date ISO.
 *
 * Les deux bornes sont ramenées à midi UTC du jour concerné (fuseau
 * Europe/Paris pour « maintenant »). Sans cette normalisation, le résultat
 * dépendait de l'heure d'exécution : la même fiche comptait 44 ou 45 jours
 * selon que la tâche planifiée tournait le matin ou le soir — un délai de
 * grâce qui décide de la suppression d'une URL ne peut pas dépendre de ça.
 * Ancrer à midi met aussi à l'abri des changements d'heure.
 */
export function joursDepuis(iso, maintenant = new Date()) {
  if (!iso) return null;
  const debut = Date.parse(String(iso).slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(debut)) return null;
  const fin = Date.parse(aujourdhui(maintenant) + "T12:00:00Z");
  return Math.round((fin - debut) / 86400000);
}

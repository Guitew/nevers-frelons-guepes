/** Fonctions de normalisation de texte. Aucune dépendance externe. */

export function aplatir(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** « Nid de guêpes : toiture » → « nid-de-guepes-toiture ». Le nom de fichier EST un signal image. */
export function slugifier(str, max = 80) {
  return aplatir(str)
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, max)
    .replace(/-$/, "");
}

/** Empreinte déterministe (FNV-1a 32 bits) : même entrée → même choix, quel que soit le jour d'exécution. */
export function empreinte(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < (str || "").length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function choisir(liste, graine, decalage = 0) {
  if (!liste || liste.length === 0) return undefined;
  return liste[(empreinte(String(graine)) + decalage * 2654435761) % liste.length];
}

export function capitaliser(str) {
  const s = (str || "").toString();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Tronque sur une limite de mot (alt ≤ 125 caractères, description ≤ 500…). */
export function tronquer(str, max = 125) {
  const s = (str || "").toString().trim().replace(/\s+/g, " ");
  if (s.length <= max) return s;
  const coupe = s.slice(0, max - 1);
  return coupe.slice(0, coupe.lastIndexOf(" ")).trim() + "…";
}

export function echapperHtml(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const echapperXml = echapperHtml;

/** Date du jour au format AAAA-MM-JJ dans le fuseau demandé. */
export function dateDuJour(date = new Date(), fuseau = "Europe/Paris") {
  const f = new Intl.DateTimeFormat("fr-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(date); // fr-CA donne AAAA-MM-JJ
}

/** Mois (1-12) d'une date AAAA-MM-JJ. */
export function moisDe(dateIso) {
  return Number((dateIso || "").slice(5, 7));
}

/** Nombre de jours calendaires entre deux dates AAAA-MM-JJ (ancré à midi UTC : indépendant de l'heure du cron). */
export function joursEntre(dateA, dateB) {
  if (!dateA || !dateB) return Infinity;
  const a = Date.parse(dateA.slice(0, 10) + "T12:00:00Z");
  const b = Date.parse(dateB.slice(0, 10) + "T12:00:00Z");
  return Math.round((b - a) / 86400000);
}

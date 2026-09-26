/**
 * Manipulation d'URL : normalisation (pour dédoublonner la frontière),
 * domaine enregistrable (pour compter « un site »), filtres de fichiers.
 */

/** Paramètres de suivi retirés des URLs : ils dupliquent des pages identiques. */
const PARAMETRES_SUIVI = /^(utm_[a-z]+|fbclid|gclid|msclkid|dclid|mc_cid|mc_eid|yclid|igshid|ref|replytocom|share|sid|phpsessid|jsessionid|zenid|osCsid|_ga|amp|output)$/i;

const EXTENSIONS_BINAIRES =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|bmp|tiff?|zip|rar|7z|gz|tgz|bz2|mp3|mp4|m4a|avi|mov|wmv|flv|mkv|ogg|ogv|webm|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf|csv|exe|dmg|apk|iso|css|js|json|xml|rss|atom|woff2?|ttf|eot|otf|swf|txt)$/i;

/** Suffixes publics à deux niveaux les plus courants (approximation suffisante). */
const SUFFIXES_DOUBLES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.jp", "com.br",
  "com.mx", "com.ar", "asso.fr", "gouv.fr", "com.fr", "nom.fr", "presse.fr", "tm.fr", "co.za", "com.tr",
  "org.es", "com.es", "co.il", "com.sg", "com.hk", "blogspot.com", "blogspot.fr", "over-blog.com",
  "canalblog.com", "eklablog.com", "wordpress.com", "forumactif.com", "forumactif.org", "forumotion.com",
  "forumgratuit.org", "xooit.fr", "xooit.com", "free.fr", "e-monsite.com", "wixsite.com", "jimdo.com",
  "jimdofree.com", "sitew.fr", "sitew.com", "webnode.fr", "webnode.com", "github.io", "netlify.app",
  "vercel.app", "pagesperso-orange.fr", "monsite-orange.fr", "unblog.fr", "skyrock.com", "centerblog.net",
  "blog4ever.com", "blogspirit.com", "hautetfort.com", "20minutes-blogs.fr", "lalibreblogs.be",
]);

/**
 * Résout et normalise une URL. Renvoie null si elle n'est pas exploitable
 * (mailto:, javascript:, tel:, data:, fragment seul…).
 */
export function normaliserUrl(brut, base) {
  if (brut == null) return null;
  const texte = String(brut).trim().replace(/[\s\u0000-\u001f]+/g, " ");
  if (!texte || /^(mailto|javascript|tel|sms|data|ftp|file|whatsapp|viber|skype|fax|callto):/i.test(texte)) return null;
  let u;
  try {
    u = base ? new URL(texte, base) : new URL(texte);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname || !u.hostname.includes(".")) {
    // « localhost » et les hôtes sans point ne sont acceptés que pour les tests locaux.
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) return null;
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  // Retire les paramètres de suivi ; conserve l'ordre des autres.
  const params = [...u.searchParams.entries()].filter(([cle]) => !PARAMETRES_SUIVI.test(cle));
  u.search = "";
  if (params.length) {
    const sp = new URLSearchParams();
    for (const [cle, valeur] of params) sp.append(cle, valeur);
    u.search = "?" + sp.toString();
  }
  // Pages d'index explicites → répertoire.
  u.pathname = u.pathname.replace(/\/(index|default)\.(php|html?|aspx?)$/i, "/");
  // Espaces encodés doublement, doubles barres.
  u.pathname = u.pathname.replace(/\/{2,}/g, "/");
  return u.href;
}

/** Hôte (sans « www. ») d'une URL. */
export function hoteDe(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Domaine enregistrable (eTLD+1 approché) d'un hôte ou d'une URL. */
export function domaineDe(hoteOuUrl) {
  const hote = /^[a-z]+:\/\//i.test(hoteOuUrl) ? hoteDe(hoteOuUrl) : String(hoteOuUrl || "").toLowerCase().replace(/^www\./, "");
  if (!hote || /^\d+\.\d+\.\d+\.\d+$/.test(hote) || hote === "localhost") return hote;
  const parties = hote.split(".");
  if (parties.length <= 2) return hote;
  const deuxDerniers = parties.slice(-2).join(".");
  if (SUFFIXES_DOUBLES.has(deuxDerniers) && parties.length >= 3) return parties.slice(-3).join(".");
  return deuxDerniers;
}

/** Deux URLs appartiennent-elles au même site (même domaine enregistrable) ? */
export function memeSite(a, b) {
  const da = domaineDe(a);
  const db = domaineDe(b);
  return Boolean(da) && da === db;
}

/** L'hôte appartient-il à l'un des domaines listés (ou à un sous-domaine) ? */
export function appartientA(url, domaines) {
  const hote = hoteDe(url);
  if (!hote) return false;
  return (domaines || []).some((d) => {
    const dom = String(d).toLowerCase().replace(/^www\./, "");
    return hote === dom || hote.endsWith("." + dom);
  });
}

/** L'URL désigne-t-elle vraisemblablement un fichier non HTML ? */
export function estBinaire(url) {
  try {
    return EXTENSIONS_BINAIRES.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Profondeur du chemin (nombre de segments). */
export function profondeurChemin(url) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length;
  } catch {
    return 0;
  }
}

/** Chemin + requête, tel qu'on le compare aux règles de robots.txt. */
export function cheminRobots(url) {
  try {
    const u = new URL(url);
    return (u.pathname || "/") + (u.search || "");
  } catch {
    return "/";
  }
}

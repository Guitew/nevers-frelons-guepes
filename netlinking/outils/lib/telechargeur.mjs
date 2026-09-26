/**
 * Téléchargement poli : un seul accès à la fois par hôte, délai minimal entre
 * deux accès au même hôte (au moins delaiParHoteMs, ou le Crawl-delay du
 * robots.txt, plafonné), respect des interdictions de robots.txt, délai
 * d'attente borné, taille maximale, décodage du jeu de caractères annoncé
 * (beaucoup de forums et livres d'or français sont encore en ISO-8859-1).
 *
 * Aucune tentative de contournement : si robots.txt nous exclut, la page
 * n'est pas lue et l'hôte est marqué « bloqué » dans l'état d'exploration.
 */

import zlib from "node:zlib";
import { analyserRobots, delaiExploration, estAutorise, ROBOTS_VIDE } from "./robots.mjs";
import { cheminRobots } from "./url.mjs";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export function creerTelechargeur(options = {}) {
  const {
    userAgent = "Mozilla/5.0 (compatible; AlloFrelonsBot/1.0) prospection-netlinking",
    agentRobots = "AlloFrelonsBot",
    timeoutMs = 15000,
    tailleMax = 2_000_000,
    delaiParHoteMs = 2500,
    delaiMaxS = 15,
    respecterRobots = true,
    fetchFn = globalThis.fetch,
    journal = () => {},
  } = options;

  const robotsParHote = new Map(); // cle "protocole//hote" → { robots, indisponible }
  const dernierAcces = new Map();
  const files = new Map();
  const compteurs = { requetes: 0, octets: 0, erreurs: 0, interdits: 0 };

  function delaiPour(cle) {
    const r = robotsParHote.get(cle);
    const demande = r && !r.indisponible ? delaiExploration(r.robots, agentRobots) : null;
    const ms = demande != null ? Math.min(demande, delaiMaxS) * 1000 : 0;
    return Math.max(delaiParHoteMs, ms);
  }

  /** Sérialise les accès à un même hôte et espace-les. */
  function enFile(cle, tache) {
    const precedente = files.get(cle) || Promise.resolve();
    const courante = precedente
      .catch(() => {})
      .then(async () => {
        const ecart = Date.now() - (dernierAcces.get(cle) || 0);
        const delai = delaiPour(cle);
        if (ecart < delai) await pause(delai - ecart);
        dernierAcces.set(cle, Date.now());
        return tache();
      });
    files.set(cle, courante);
    return courante;
  }

  async function requete(url, { accepterTout = false } = {}) {
    const ctrl = new AbortController();
    const minuterie = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      compteurs.requetes++;
      const rep = await fetchFn(url, {
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
          "accept-language": "fr-FR,fr;q=0.9,en;q=0.5",
        },
        redirect: "follow",
        signal: ctrl.signal,
      });
      const type = (rep.headers.get("content-type") || "").toLowerCase();
      const entetes = {
        "content-type": type,
        "x-robots-tag": rep.headers.get("x-robots-tag") || "",
        "last-modified": rep.headers.get("last-modified") || "",
        "content-language": rep.headers.get("content-language") || "",
        server: rep.headers.get("server") || "",
        "x-powered-by": rep.headers.get("x-powered-by") || "",
      };
      const html = /text\/html|application\/xhtml/.test(type) || (!type && !accepterTout);
      if (!html && !accepterTout) {
        try {
          await rep.body?.cancel();
        } catch {
          /* ignoré */
        }
        return { url: rep.url || url, urlDemandee: url, statut: rep.status, entetes, corps: null, erreur: `contenu non HTML (${type.split(";")[0] || "type inconnu"})` };
      }
      let octets = await lireLimite(rep, tailleMax);
      compteurs.octets += octets.length;
      if (accepterTout && /\.gz($|\?)/.test(url) && octets.length > 2 && octets[0] === 0x1f && octets[1] === 0x8b) {
        octets = new Uint8Array(zlib.gunzipSync(octets));
      }
      const charset = detecterCharset(type, octets);
      return { url: rep.url || url, urlDemandee: url, statut: rep.status, entetes, corps: decoder(octets, charset), charset, redirige: Boolean(rep.url) && rep.url !== url };
    } catch (e) {
      compteurs.erreurs++;
      const message = e?.name === "AbortError" ? `délai dépassé (${timeoutMs} ms)` : e?.cause?.code || e?.message || String(e);
      return { url, urlDemandee: url, statut: 0, entetes: {}, corps: null, erreur: message };
    } finally {
      clearTimeout(minuterie);
    }
  }

  /** robots.txt d'un hôte (mis en cache). */
  async function robots(url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return { robots: ROBOTS_VIDE, indisponible: false };
    }
    const cle = `${u.protocol}//${u.host}`;
    if (robotsParHote.has(cle)) return robotsParHote.get(cle);
    const promesse = enFile(cle, () => requete(`${cle}/robots.txt`, { accepterTout: true })).then((rep) => {
      let resultat;
      if (rep.statut === 200 && rep.corps != null) resultat = { robots: analyserRobots(rep.corps), indisponible: false, statut: 200 };
      else if (rep.statut >= 400 && rep.statut < 500) resultat = { robots: ROBOTS_VIDE, indisponible: false, statut: rep.statut };
      else resultat = { robots: ROBOTS_VIDE, indisponible: true, statut: rep.statut, erreur: rep.erreur };
      robotsParHote.set(cle, resultat);
      journal(`robots ${cle} → ${resultat.indisponible ? "indisponible" : resultat.statut}`);
      return resultat;
    });
    robotsParHote.set(cle, promesse);
    return promesse;
  }

  /** Télécharge une page HTML en respectant robots.txt et la politesse. */
  async function recuperer(url, { accepterTout = false } = {}) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return { url, statut: 0, entetes: {}, corps: null, erreur: "URL invalide" };
    }
    const cle = `${u.protocol}//${u.host}`;
    if (respecterRobots) {
      const r = await robots(url);
      if (r.indisponible) {
        compteurs.interdits++;
        return { url, statut: 0, entetes: {}, corps: null, erreur: `robots.txt indisponible (${r.statut || r.erreur || "?"}) : hôte ignoré`, bloque: true };
      }
      if (!estAutorise(r.robots, agentRobots, cheminRobots(url))) {
        compteurs.interdits++;
        return { url, statut: 0, entetes: {}, corps: null, erreur: "interdit par robots.txt", interdit: true };
      }
    }
    return enFile(cle, () => requete(url, { accepterTout }));
  }

  /** Robots déjà chargé d'un hôte (sans requête), pour la qualification. */
  function robotsConnu(url) {
    try {
      const u = new URL(url);
      const r = robotsParHote.get(`${u.protocol}//${u.host}`);
      return r && !(r instanceof Promise) ? r.robots : ROBOTS_VIDE;
    } catch {
      return ROBOTS_VIDE;
    }
  }

  return { recuperer, robots, robotsConnu, compteurs };
}

/** Lit le corps jusqu'à « max » octets, puis interrompt le flux. */
async function lireLimite(rep, max) {
  if (!rep.body || typeof rep.body.getReader !== "function") {
    const tampon = new Uint8Array(await rep.arrayBuffer());
    return tampon.length > max ? tampon.slice(0, max) : tampon;
  }
  const lecteur = rep.body.getReader();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
    total += value.length;
    if (total >= max) {
      try {
        await lecteur.cancel();
      } catch {
        /* ignoré */
      }
      break;
    }
  }
  const resultat = new Uint8Array(Math.min(total, max));
  let position = 0;
  for (const m of morceaux) {
    const reste = resultat.length - position;
    if (reste <= 0) break;
    resultat.set(m.length > reste ? m.subarray(0, reste) : m, position);
    position += Math.min(m.length, reste);
  }
  return resultat;
}

/** Jeu de caractères : en-tête HTTP, sinon <meta charset>, sinon UTF-8. */
export function detecterCharset(typeContenu, octets) {
  let charset = (/charset\s*=\s*"?([\w-]+)/i.exec(typeContenu || "") || [])[1];
  if (!charset && octets) {
    const debut = String.fromCharCode(...octets.subarray(0, Math.min(octets.length, 4096)));
    charset = (/<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(debut) || [])[1];
  }
  charset = (charset || "utf-8").toLowerCase();
  if (/^(iso-?8859-?1|latin-?1|windows-?1252|cp1252|ansi)$/.test(charset)) return "windows-1252";
  if (/^(iso-?8859-?15|latin-?9)$/.test(charset)) return "iso-8859-15";
  if (/^utf-?8$/.test(charset)) return "utf-8";
  return charset;
}

export function decoder(octets, charset) {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(octets);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(octets);
  }
}

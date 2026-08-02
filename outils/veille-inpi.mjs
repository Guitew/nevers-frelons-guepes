#!/usr/bin/env node
/**
 * Veille INPI — alerte par courriel dès qu'une marque « Allo Frelons » est déposée.
 *
 * Le script interroge la base Marques de l'INPI (https://data.inpi.fr), retient
 * les dépôts dont la dénomination contient « allo frelon » (quelle que soit la
 * casse, les accents, les tirets ou le pluriel), compare le résultat à l'état
 * enregistré lors du passage précédent (`outils/etat-veille-inpi.json`) et
 * envoie un courriel pour chaque **nouveau** dépôt.
 *
 * Deux sources sont possibles, essayées dans cet ordre :
 *   1. l'API PI officielle (api-gateway.inpi.fr) si INPI_API_USERNAME /
 *      INPI_API_PASSWORD sont renseignés — c'est la source recommandée ;
 *   2. la recherche publique de data.inpi.fr, sans compte, en repli.
 *
 * Utilisation :
 *   node outils/veille-inpi.mjs                # vérification + alerte
 *   node outils/veille-inpi.mjs --init         # enregistre l'existant sans alerter
 *   node outils/veille-inpi.mjs --stdout       # affiche l'alerte au lieu de l'envoyer
 *   node outils/veille-inpi.mjs --test-courriel  # vérifie la configuration SMTP
 *   node outils/veille-inpi.mjs --debug        # écrit les réponses brutes de l'INPI
 *   node outils/veille-inpi.mjs --terme "Allo Guêpes"   # surveiller un autre nom
 *
 * Variables d'environnement : voir `outils/README.md`.
 * Nécessite Node 18+ (fetch natif). Aucune dépendance externe.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync } from "node:fs";

import { envoyerCourriel } from "./smtp.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER_ETAT = path.join(RACINE, "outils", "etat-veille-inpi.json");
const FICHIER_DEBUG = path.join(RACINE, "outils", ".veille-inpi-debug.json");

const UA =
  "AlloFrelonsVeilleINPI/1.0 (surveillance de marque; contact@allo-frelons.fr) Node/" + process.versions.node;

const args = process.argv.slice(2);
const aOption = (nom) => args.includes(nom);
const valeurOption = (nom, defaut = null) => {
  const i = args.findIndex((a) => a === nom || a.startsWith(nom + "="));
  if (i === -1) return defaut;
  if (args[i].includes("=")) return args[i].slice(args[i].indexOf("=") + 1);
  return args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : defaut;
};

const INIT = aOption("--init");
const STDOUT = aOption("--stdout");
const DEBUG = aOption("--debug");
const TEST_COURRIEL = aOption("--test-courriel");
const SOURCE_DEMANDEE = valeurOption("--source", process.env.INPI_SOURCE || "auto");

/** Termes surveillés (par défaut « Allo Frelons »). */
const TERMES = (valeurOption("--terme") || process.env.VEILLE_TERMES || "Allo Frelons")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

/* ------------------------------------------------------------------ */
/* Correspondance des noms                                             */
/* ------------------------------------------------------------------ */

/** « Allo-Frelons 59 » → « allofrelons59 » : casse, accents et ponctuation neutralisés. */
export function normaliser(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Motif de recherche tiré d'un terme surveillé : le « s » final est retiré pour
 * attraper aussi bien « Allo Frelon » que « ALLO FRELONS » ou « Allo Frelons 59 ».
 */
export function motif(terme) {
  return normaliser(terme).replace(/s$/, "");
}

/** Vrai si la dénomination correspond à l'un des termes surveillés. */
export function correspond(denomination, termes = TERMES) {
  const cible = normaliser(denomination);
  if (!cible) return false;
  return termes.some((t) => {
    const m = motif(t);
    return m.length > 0 && cible.includes(m);
  });
}

/* ------------------------------------------------------------------ */
/* Lecture des réponses de l'INPI                                      */
/* ------------------------------------------------------------------ */

// Les deux sources INPI ne renvoient pas exactement la même structure JSON et
// celle-ci évolue. Plutôt que de coder en dur un chemin d'accès fragile, on
// parcourt la réponse et on reconnaît les fiches à leurs champs.

const CHAMPS_NOM = [
  "markverbalelementtext",
  "marqueverbale",
  "denomination",
  "denominationmarque",
  "brandname",
  "wordmark",
  "marque",
  "libellemarque",
  "nommarque",
];
const CHAMPS_ID = [
  "applicationnumber",
  "numeronational",
  "numerodepot",
  "numeroenregistrement",
  "registrationnumber",
  "numeropublication",
  "numero",
  "id",
  "_id",
];
const CHAMPS_DATE = ["applicationdate", "datedepot", "filingdate", "registrationdate", "dateenregistrement", "date"];
const CHAMPS_STATUT = ["markcurrentstatuscode", "statutmarque", "statut", "status", "etat", "markfeature"];
const CHAMPS_DEPOSANT = ["applicant", "applicants", "deposant", "titulaire", "owner", "fullnames", "applicantname"];
const CHAMPS_CLASSES = ["classdescriptiondetails", "classes", "classification", "niceclasses", "classnumber"];

const cle = (nom) => normaliser(nom);

/** Rend une valeur JSON quelconque sous forme de texte lisible (ou null). */
export function valeurTexte(valeur, profondeur = 0) {
  if (valeur == null || profondeur > 4) return null;
  if (typeof valeur === "string") return valeur.trim() || null;
  if (typeof valeur === "number") return String(valeur);
  if (Array.isArray(valeur)) {
    const morceaux = valeur.map((v) => valeurTexte(v, profondeur + 1)).filter(Boolean);
    return morceaux.length ? [...new Set(morceaux)].join(", ") : null;
  }
  if (typeof valeur === "object") {
    for (const champ of ["name", "nom", "fullName", "fullNames", "text", "value", "libelle", "label", "$t", "code"]) {
      const trouve = valeurTexte(valeur[champ], profondeur + 1);
      if (trouve) return trouve;
    }
  }
  return null;
}

/** Première valeur non vide parmi une liste de noms de champs (comparés normalisés). */
function premierChamp(objet, noms) {
  for (const nom of noms) {
    for (const [k, v] of Object.entries(objet)) {
      if (cle(k) === nom) {
        const texte = valeurTexte(v);
        if (texte) return texte;
      }
    }
  }
  return null;
}

/** Parcourt une réponse JSON et en extrait toutes les fiches marque reconnaissables. */
export function extraireMarques(donnees, source = "inpi") {
  const trouvees = [];
  const vus = new Set();

  const visiter = (noeud, profondeur) => {
    if (!noeud || typeof noeud !== "object" || profondeur > 12) return;
    if (Array.isArray(noeud)) {
      for (const enfant of noeud) visiter(enfant, profondeur + 1);
      return;
    }
    // data.inpi.fr encapsule les fiches dans `_source` (moteur Elasticsearch).
    const plat = { ...noeud, ...(noeud._source && typeof noeud._source === "object" ? noeud._source : {}) };
    const nom = premierChamp(plat, CHAMPS_NOM);
    if (nom) {
      const numero = premierChamp(plat, CHAMPS_ID);
      const identifiant = `${numero || ""}|${normaliser(nom)}`;
      if (!vus.has(identifiant)) {
        vus.add(identifiant);
        trouvees.push({
          nom,
          numero,
          date: premierChamp(plat, CHAMPS_DATE),
          statut: premierChamp(plat, CHAMPS_STATUT),
          deposant: premierChamp(plat, CHAMPS_DEPOSANT),
          classes: premierChamp(plat, CHAMPS_CLASSES),
          source,
          url: numero ? `https://data.inpi.fr/marques/${encodeURIComponent(numero)}` : null,
        });
      }
    }
    for (const valeur of Object.values(noeud)) {
      if (valeur && typeof valeur === "object") visiter(valeur, profondeur + 1);
    }
  };

  visiter(donnees, 0);
  return trouvees;
}

/** Clé de suivi d'une marque dans le fichier d'état. */
export function cleMarque(marque) {
  return marque.numero ? `n:${normaliser(marque.numero)}` : `d:${normaliser(marque.nom)}|${normaliser(marque.date)}`;
}

/* ------------------------------------------------------------------ */
/* Sources INPI                                                        */
/* ------------------------------------------------------------------ */

const traces = [];
const tracer = (etiquette, donnees) => {
  if (DEBUG) traces.push({ etiquette, donnees });
};

/** Recherche publique (data.inpi.fr), sans compte. */
async function rechercherPublique(terme) {
  const corps = {
    query: {
      type: "brands",
      selectedIds: [],
      sort: "dateDepot",
      order: "desc",
      nbResultsPerPage: "50",
      page: "1",
      filter: {},
      q: terme,
    },
    aggregations: [],
  };

  const reponse = await fetch(`https://data.inpi.fr/search?q=${encodeURIComponent(terme)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": "fr-FR,fr;q=0.9",
      "User-Agent": UA,
      Origin: "https://data.inpi.fr",
      Referer: "https://data.inpi.fr/recherche_avancee/marques",
    },
    body: JSON.stringify(corps),
  });

  if (!reponse.ok) throw new Error(`recherche publique : HTTP ${reponse.status}`);
  const donnees = await reponse.json();
  tracer(`publique:${terme}`, donnees);
  return extraireMarques(donnees, "data.inpi.fr");
}

/** Bocal à cookies minimal (l'API PI s'authentifie par cookies + jeton XSRF). */
function bocalCookies() {
  const cookies = new Map();
  return {
    absorber(reponse) {
      const entetes = reponse.headers.getSetCookie?.() ?? [];
      for (const brut of entetes) {
        const [paire] = brut.split(";");
        const i = paire.indexOf("=");
        if (i > 0) cookies.set(paire.slice(0, i).trim(), paire.slice(i + 1).trim());
      }
    },
    entete() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    get(nom) {
      return cookies.get(nom);
    },
  };
}

/**
 * API PI officielle (compte technique créé depuis data.inpi.fr →
 * « Mes accès API / SFTP » → « Accès APIs PI »).
 */
async function rechercherApi(terme) {
  const base = (process.env.INPI_API_BASE || "https://api-gateway.inpi.fr").replace(/\/$/, "");
  const utilisateur = process.env.INPI_API_USERNAME;
  const motDePasse = process.env.INPI_API_PASSWORD;
  if (!utilisateur || !motDePasse) throw new Error("identifiants API PI absents (INPI_API_USERNAME / INPI_API_PASSWORD)");

  const bocal = bocalCookies();
  const entetes = () => {
    const e = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": UA,
    };
    const cookie = bocal.entete();
    if (cookie) e.Cookie = cookie;
    const xsrf = bocal.get("XSRF-TOKEN");
    if (xsrf) e["X-XSRF-TOKEN"] = decodeURIComponent(xsrf);
    return e;
  };

  // 1. Obtenir le jeton XSRF.
  const prealable = await fetch(`${base}/services/uaa/api/authenticate`, {
    method: "GET",
    headers: entetes(),
  });
  bocal.absorber(prealable);

  // 2. S'authentifier (le cookie de session est renvoyé par le serveur).
  const connexion = await fetch(`${base}/services/uaa/api/authenticate`, {
    method: "POST",
    headers: entetes(),
    body: JSON.stringify({ username: utilisateur, password: motDePasse, rememberMe: false }),
  });
  bocal.absorber(connexion);
  if (!connexion.ok) throw new Error(`authentification API PI : HTTP ${connexion.status}`);

  // 3. Rechercher dans la base Marques.
  const collections = (process.env.INPI_API_COLLECTIONS || "FR").split(",").map((c) => c.trim()).filter(Boolean);
  const recherche = await fetch(`${base}/services/apidiffusion/api/marques/search`, {
    method: "POST",
    headers: entetes(),
    body: JSON.stringify({ collections, query: `MARQ = (${terme})` }),
  });
  if (!recherche.ok) throw new Error(`recherche API PI : HTTP ${recherche.status}`);
  const donnees = await recherche.json();
  tracer(`api:${terme}`, donnees);
  return extraireMarques(donnees, "api-gateway.inpi.fr");
}

/**
 * Interroge l'INPI pour tous les termes surveillés, en essayant l'API officielle
 * puis la recherche publique. Renvoie les marques correspondantes, dédoublonnées.
 */
async function interrogerInpi() {
  const sources = [];
  if (SOURCE_DEMANDEE !== "publique" && process.env.INPI_API_USERNAME && process.env.INPI_API_PASSWORD) {
    sources.push({ nom: "API PI (api-gateway.inpi.fr)", chercher: rechercherApi });
  }
  if (SOURCE_DEMANDEE !== "api") {
    sources.push({ nom: "recherche publique (data.inpi.fr)", chercher: rechercherPublique });
  }
  if (!sources.length) throw new Error(`source « ${SOURCE_DEMANDEE} » indisponible : identifiants API PI manquants.`);

  // Le pluriel n'est pas toujours indexé comme le singulier : on interroge les deux.
  const requetes = new Set();
  for (const terme of TERMES) {
    requetes.add(terme);
    const singulier = terme.replace(/s\b/gi, "").replace(/\s+/g, " ").trim();
    if (singulier && singulier.toLowerCase() !== terme.toLowerCase()) requetes.add(singulier);
  }

  const erreurs = [];
  for (const source of sources) {
    try {
      const parCle = new Map();
      for (const requete of requetes) {
        const resultats = await source.chercher(requete);
        for (const marque of resultats) {
          if (!correspond(marque.nom)) continue;
          const k = cleMarque(marque);
          // On garde la fiche la plus complète en cas de doublon.
          const existante = parCle.get(k);
          if (!existante || Object.values(marque).filter(Boolean).length > Object.values(existante).filter(Boolean).length) {
            parCle.set(k, marque);
          }
        }
        await new Promise((r) => setTimeout(r, 500)); // courtoisie envers l'INPI
      }
      return { source: source.nom, marques: [...parCle.values()] };
    } catch (e) {
      erreurs.push(`${source.nom} : ${e.message}`);
      console.error(`⚠  ${source.nom} indisponible — ${e.message}`);
    }
  }

  throw new Error(`aucune source INPI n'a répondu.\n  - ${erreurs.join("\n  - ")}`);
}

/* ------------------------------------------------------------------ */
/* État                                                                */
/* ------------------------------------------------------------------ */

async function lireEtat() {
  if (!existsSync(FICHIER_ETAT)) return null;
  try {
    return JSON.parse(await readFile(FICHIER_ETAT, "utf8"));
  } catch (e) {
    throw new Error(`fichier d'état illisible (${FICHIER_ETAT}) : ${e.message}`);
  }
}

async function ecrireEtat(etat) {
  await writeFile(FICHIER_ETAT, JSON.stringify(etat, null, 2) + "\n", "utf8");
}

/* ------------------------------------------------------------------ */
/* Courriel                                                            */
/* ------------------------------------------------------------------ */

const echapper = (texte) =>
  String(texte ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function composerAlerte(marques, termes = TERMES) {
  const pluriel = marques.length > 1;
  const sujet = `🚨 ${marques.length} nouveau${pluriel ? "x" : ""} dépôt${pluriel ? "s" : ""} de marque « ${termes[0]} » à l'INPI`;

  const ligneTexte = (m) =>
    [
      `• ${m.nom}`,
      m.numero ? `  Numéro : ${m.numero}` : null,
      m.date ? `  Date : ${m.date}` : null,
      m.statut ? `  Statut : ${m.statut}` : null,
      m.deposant ? `  Déposant : ${m.deposant}` : null,
      m.classes ? `  Classes : ${m.classes}` : null,
      m.url ? `  Fiche : ${m.url}` : null,
    ]
      .filter(Boolean)
      .join("\n");

  const texte = [
    `Un nouveau dépôt correspondant à « ${termes.join(" », « ")} » vient d'apparaître dans la base Marques de l'INPI.`,
    "",
    marques.map(ligneTexte).join("\n\n"),
    "",
    "Recherche avancée : https://data.inpi.fr/recherche_avancee/marques",
    "",
    "Rappel : une opposition à l'enregistrement d'une marque se dépose dans les 2 mois",
    "suivant la publication au BOPI (https://www.inpi.fr/proteger-vos-creations/proteger-votre-marque).",
    "",
    "— Veille automatique du dépôt nevers-frelons-guepes (outils/veille-inpi.mjs)",
  ].join("\n");

  const carte = (m) => `
    <li style="margin:0 0 18px;padding:14px 16px;border:1px solid #e2e2e2;border-radius:8px;background:#fff">
      <strong style="font-size:17px">${echapper(m.nom)}</strong>
      <table style="margin-top:8px;font-size:14px;color:#333;border-collapse:collapse">
        ${[
          ["Numéro", m.numero],
          ["Date", m.date],
          ["Statut", m.statut],
          ["Déposant", m.deposant],
          ["Classes", m.classes],
        ]
          .filter(([, v]) => v)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:2px 12px 2px 0;color:#666">${k}</td><td style="padding:2px 0">${echapper(v)}</td></tr>`,
          )
          .join("")}
      </table>
      ${m.url ? `<p style="margin:10px 0 0"><a href="${echapper(m.url)}">Voir la fiche sur data.inpi.fr</a></p>` : ""}
    </li>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f7f7f5;padding:24px">
    <div style="max-width:620px;margin:auto">
      <h1 style="font-size:20px;margin:0 0 6px">🚨 Nouveau dépôt de marque « ${echapper(termes[0])} »</h1>
      <p style="margin:0 0 18px;color:#444">
        ${marques.length} dépôt${pluriel ? "s" : ""} correspondant à votre veille ${pluriel ? "sont apparus" : "est apparu"}
        dans la base Marques de l'INPI.
      </p>
      <ul style="list-style:none;margin:0;padding:0">${marques.map(carte).join("")}</ul>
      <p style="margin:18px 0 0;font-size:14px">
        <a href="https://data.inpi.fr/recherche_avancee/marques">Recherche avancée INPI</a>
      </p>
      <p style="margin:14px 0 0;font-size:13px;color:#666">
        Une opposition à l'enregistrement se dépose dans les 2 mois suivant la publication au BOPI.
      </p>
      <p style="margin:22px 0 0;font-size:12px;color:#888">
        Veille automatique — dépôt <code>nevers-frelons-guepes</code>, script <code>outils/veille-inpi.mjs</code>.
      </p>
    </div>
  </div>`;

  return { sujet, texte, html };
}

function configurationSmtp() {
  const hote = process.env.SMTP_HOST;
  const utilisateur = process.env.SMTP_USER;
  const motDePasse = process.env.SMTP_PASSWORD;
  const destinataire = process.env.MAIL_TO || "allofrelons@gmail.com";
  const expediteur = process.env.MAIL_FROM || (utilisateur ? `Veille INPI <${utilisateur}>` : null);

  if (!hote || !utilisateur || !motDePasse || !expediteur) {
    throw new Error(
      "configuration SMTP incomplète : renseignez SMTP_HOST, SMTP_USER, SMTP_PASSWORD (et éventuellement MAIL_FROM / MAIL_TO).",
    );
  }
  return {
    smtp: {
      hote,
      port: Number(process.env.SMTP_PORT || 465),
      utilisateur,
      motDePasse,
      chiffrement: process.env.SMTP_SECURITY || "auto",
    },
    expediteur,
    destinataires: destinataire.split(",").map((d) => d.trim()).filter(Boolean),
  };
}

async function alerter({ sujet, texte, html }) {
  const { smtp, expediteur, destinataires } = configurationSmtp();
  await envoyerCourriel(smtp, { de: expediteur, a: destinataires, sujet, texte, html });
  console.log(`✉  Courriel envoyé à ${destinataires.join(", ")}.`);
}

/** Résumé visible dans l'onglet « Actions » de GitHub. */
function resumeGithub(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
  } catch {
    /* sans conséquence */
  }
}

/* ------------------------------------------------------------------ */
/* Programme principal                                                 */
/* ------------------------------------------------------------------ */

const AIDE = `Veille INPI — alerte courriel sur les dépôts de marque « Allo Frelons ».

  node outils/veille-inpi.mjs                 vérification + alerte s'il y a du nouveau
  node outils/veille-inpi.mjs --init          1er passage : enregistre l'existant sans alerter
  node outils/veille-inpi.mjs --stdout        affiche l'alerte au lieu de l'envoyer
  node outils/veille-inpi.mjs --test-courriel envoie un courriel de test (config SMTP)
  node outils/veille-inpi.mjs --debug         écrit les réponses brutes de l'INPI
  node outils/veille-inpi.mjs --terme "Allo Guêpes,Allo Nuisibles"
  node outils/veille-inpi.mjs --source=api|publique|auto

Configuration (variables d'environnement) : voir outils/README.md.`;

async function main() {
  if (aOption("--help") || aOption("--aide") || aOption("-h")) {
    console.log(AIDE);
    return;
  }

  if (TEST_COURRIEL) {
    const essai = composerAlerte(
      [
        {
          nom: TERMES[0],
          numero: "0000000",
          date: new Date().toISOString().slice(0, 10),
          statut: "Exemple — message de test",
          deposant: "Test de configuration",
          url: "https://data.inpi.fr/recherche_avancee/marques",
        },
      ],
      TERMES,
    );
    await alerter({ ...essai, sujet: "[Test] " + essai.sujet });
    console.log("Test terminé : si le message est bien arrivé, la veille pourra vous alerter.");
    return;
  }

  console.log(`Veille INPI — termes surveillés : ${TERMES.join(", ")}`);
  const { source, marques } = await interrogerInpi();
  console.log(`Source utilisée : ${source} — ${marques.length} marque(s) correspondante(s).`);

  if (DEBUG) {
    await writeFile(FICHIER_DEBUG, JSON.stringify(traces, null, 2), "utf8");
    console.log(`(--debug) Réponses brutes écrites dans ${path.relative(RACINE, FICHIER_DEBUG)}`);
  }

  const etatPrecedent = await lireEtat();
  const connues = etatPrecedent?.marques || {};
  const premierPassage = etatPrecedent === null || INIT;

  const nouvelles = marques.filter((m) => !connues[cleMarque(m)]);

  const etat = {
    derniereVerification: new Date().toISOString(),
    derniereSource: source,
    termes: TERMES,
    marques: Object.fromEntries(
      marques.map((m) => [cleMarque(m), { ...m, vuePour1ereFoisLe: connues[cleMarque(m)]?.vuePour1ereFoisLe || new Date().toISOString() }]),
    ),
  };
  // Les marques disparues de la recherche restent mémorisées : elles ne doivent
  // pas déclencher une fausse alerte si l'INPI les ré-indexe plus tard.
  for (const [k, v] of Object.entries(connues)) if (!etat.marques[k]) etat.marques[k] = v;

  for (const m of marques) {
    const etiquette = premierPassage ? "enregistré" : nouvelles.includes(m) ? "NOUVEAU   " : "connu     ";
    console.log(`  ${etiquette} — ${m.nom}${m.numero ? ` (${m.numero})` : ""}${m.date ? ` — ${m.date}` : ""}`);
  }

  if (premierPassage) {
    await ecrireEtat(etat);
    console.log(
      `Initialisation : ${marques.length} marque(s) enregistrée(s) sans alerte. Les prochains dépôts déclencheront un courriel.`,
    );
    resumeGithub(`### Veille INPI — initialisation\n\n${marques.length} marque(s) enregistrée(s), aucune alerte envoyée.`);
    return;
  }

  if (!nouvelles.length) {
    await ecrireEtat(etat);
    console.log("Aucun nouveau dépôt. Rien à signaler.");
    resumeGithub(`### Veille INPI\n\nAucun nouveau dépôt (${marques.length} marque(s) suivie(s)).`);
    return;
  }

  const alerte = composerAlerte(nouvelles, TERMES);
  if (STDOUT) {
    console.log("\n----- Courriel (non envoyé, --stdout) -----");
    console.log(`Sujet : ${alerte.sujet}\n`);
    console.log(alerte.texte);
  } else {
    await alerter(alerte);
  }

  await ecrireEtat(etat);
  resumeGithub(
    `### 🚨 Veille INPI — ${nouvelles.length} nouveau(x) dépôt(s)\n\n` +
      nouvelles
        .map((m) => `- **${m.nom}**${m.numero ? ` — n° ${m.numero}` : ""}${m.date ? ` — ${m.date}` : ""}${m.url ? ` — [fiche](${m.url})` : ""}`)
        .join("\n"),
  );
}

// Le script est aussi importé par ses tests : on ne lance le traitement que
// lorsqu'il est exécuté directement.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`Échec de la veille INPI : ${e.message}`);
    resumeGithub(`### ❌ Veille INPI en échec\n\n\`\`\`\n${e.message}\n\`\`\``);
    process.exit(1);
  });
}

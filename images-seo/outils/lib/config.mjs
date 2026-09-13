import fs from "node:fs";
import path from "node:path";
import { CONFIG_JSON, SITE_JSON, PAGES_JSON, FILE_ATTENTE_JSON, RACINE } from "./chemins.mjs";

/** Charge un .env local (jamais committé) sans dépendance externe. */
export function chargerEnv(fichier = path.join(RACINE, ".env")) {
  if (!fs.existsSync(fichier)) return;
  for (const ligne of fs.readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || ligne.trim().startsWith("#")) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function lireJson(fichier, defaut = null) {
  if (!fs.existsSync(fichier)) return defaut;
  try {
    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    throw new Error(`JSON illisible : ${fichier} (${e.message})`);
  }
}

export function ecrireJson(fichier, donnees) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, JSON.stringify(donnees, null, 2) + "\n", "utf8");
}

export function lireConfig() {
  return lireJson(CONFIG_JSON);
}

/** Site + racine calculée des images publiques. */
export function lireSite() {
  const site = lireJson(SITE_JSON);
  const url = (site.url || "").replace(/\/+$/, "");
  const chemin = "/" + (site.cheminImages || "/").replace(/^\/+|\/+$/g, "");
  return { ...site, url, baseImages: url + (chemin === "/" ? "/" : chemin + "/") };
}

export function lirePages() {
  return lireJson(PAGES_JSON, []);
}

export function ecrirePages(pages) {
  ecrireJson(PAGES_JSON, pages);
}

export function lireFileAttente() {
  return lireJson(FILE_ATTENTE_JSON, []);
}

export function ecrireFileAttente(file) {
  ecrireJson(FILE_ATTENTE_JSON, file);
}

/** Analyse les arguments « --cle=valeur » et « --drapeau ». */
export function arguments_(argv = process.argv.slice(2)) {
  const options = { _: [] };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) options[m[1]] = m[2] === undefined ? true : m[2];
    else options._.push(a);
  }
  return options;
}

#!/usr/bin/env node
/**
 * Suggère l'URL de la page annuaire comme site web sur chaque fiche Google Maps.
 *
 * Se connecte au Chrome de l'utilisateur (session Google active) via le
 * protocole de débogage distant, puis pour chaque fiche en attente :
 *   1. ouvre la page Google Maps,
 *   2. clique sur « Ajouter un site Web »,
 *   3. remplit l'URL et envoie la suggestion.
 *
 * Prérequis : lancer Chrome avec --remote-debugging-port=9222
 *   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 *
 * Usage :
 *   node outils/suggerer-gmb.mjs                tout le lot en attente
 *   node outils/suggerer-gmb.mjs --max=5        limiter à 5 fiches
 *   node outils/suggerer-gmb.mjs --essai        navigation seule, sans soumettre
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = join(__dirname, "..");
const DEBUG_DIR = join(RACINE, "debug");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai") || args.has("dry-run");
const maxFiches = Number(args.get("max") || 999);

function pause(min, max) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page, nom) {
  try {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const chemin = join(DEBUG_DIR, `${nom}.png`);
    await page.screenshot({ path: chemin, fullPage: false });
    console.log(`    capture → ${chemin}`);
  } catch { /* best effort */ }
}

function marquer(placeId) {
  try {
    execSync(`node outils/suggestions.mjs --marquer=${placeId}`, { cwd: RACINE, stdio: "pipe" });
  } catch (e) {
    console.error(`    ✗ marquage échoué : ${e.message}`);
  }
}

async function trouverEtCliquer(page, texte, timeout = 12000) {
  const debut = Date.now();
  while (Date.now() - debut < timeout) {
    const el = await page.evaluateHandle((t) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.textContent.trim() === t) {
          const cible = walker.currentNode.parentElement.closest("[jsaction]") || walker.currentNode.parentElement;
          if (cible.offsetWidth > 0 && cible.offsetHeight > 0) return cible;
        }
      }
      return null;
    }, texte);

    const estNull = await page.evaluate((el) => el === null, el);
    if (!estNull) {
      await el.asElement().scrollIntoView();
      await pause(300, 600);
      await el.asElement().click();
      return true;
    }
    await pause(500, 1000);
  }
  return false;
}

async function attendreFormulaire(page, timeout = 10000) {
  const debut = Date.now();
  while (Date.now() - debut < timeout) {
    const input = await page.evaluateHandle(() => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])');
      for (const inp of inputs) {
        const label = inp.getAttribute("aria-label") || inp.placeholder || "";
        if (/site|web|url|http/i.test(label)) return inp;
      }
      const labels = document.querySelectorAll("label");
      for (const lbl of labels) {
        if (/site\s*web/i.test(lbl.textContent)) {
          const inp = lbl.querySelector("input") || document.getElementById(lbl.htmlFor);
          if (inp) return inp;
        }
      }
      return null;
    });

    const estNull = await page.evaluate((el) => el === null, input);
    if (!estNull) return input.asElement();
    await pause(500, 1000);
  }
  return null;
}

async function soumettreFormulaire(page, timeout = 10000) {
  const debut = Date.now();
  while (Date.now() - debut < timeout) {
    const btn = await page.evaluateHandle(() => {
      const boutons = document.querySelectorAll("button");
      for (const b of boutons) {
        if (/envoyer|soumettre|submit/i.test(b.textContent.trim())) {
          if (b.offsetWidth > 0 && b.offsetHeight > 0 && !b.disabled) return b;
        }
      }
      return null;
    });

    const estNull = await page.evaluate((el) => el === null, btn);
    if (!estNull) {
      await btn.asElement().click();
      return true;
    }
    await pause(500, 1000);
  }
  return false;
}

async function verifierConfirmation(page, timeout = 8000) {
  const debut = Date.now();
  while (Date.now() - debut < timeout) {
    const ok = await page.evaluate(() => {
      const body = document.body.innerText;
      return /merci|thank|modification.*envoy|suggestion.*envoy|successfully/i.test(body);
    });
    if (ok) return true;
    await pause(500, 1000);
  }
  return false;
}

async function traiterFiche(page, fiche, index) {
  const { id, nom, url_maps, url_page } = fiche;
  console.log(`\n[${index}] ${nom}`);
  console.log(`    Maps : ${url_maps}`);
  console.log(`    Page : ${url_page}`);

  await page.goto(url_maps, { waitUntil: "networkidle2", timeout: 30000 });
  await pause(2000, 4000);

  const clique = await trouverEtCliquer(page, "Ajouter un site Web");
  if (!clique) {
    console.log("    ✗ Bouton « Ajouter un site Web » introuvable, essai via « Suggérer une modification »…");
    const alt = await trouverEtCliquer(page, "Suggérer une modification");
    if (!alt) {
      console.log("    ✗ Aucun bouton trouvé — skip");
      await screenshot(page, `echec-${index}-no-button`);
      return false;
    }
    await pause(2000, 3000);
  }

  await pause(1500, 3000);

  if (essai) {
    console.log("    → mode essai, pas de soumission");
    await screenshot(page, `essai-${index}`);
    return true;
  }

  const input = await attendreFormulaire(page);
  if (!input) {
    console.log("    ✗ Champ URL introuvable dans le formulaire");
    await screenshot(page, `echec-${index}-no-input`);
    return false;
  }

  await input.click({ clickCount: 3 });
  await pause(200, 400);
  await input.type(url_page, { delay: 30 + Math.random() * 50 });
  await pause(800, 1500);

  const envoye = await soumettreFormulaire(page);
  if (!envoye) {
    console.log("    ✗ Bouton Envoyer introuvable");
    await screenshot(page, `echec-${index}-no-submit`);
    return false;
  }

  await pause(2000, 4000);

  const confirme = await verifierConfirmation(page);
  if (confirme) {
    console.log("    ✓ Suggestion envoyée !");
    marquer(id);
    return true;
  }

  console.log("    ? Pas de confirmation détectée, marquage quand même");
  await screenshot(page, `warn-${index}-no-confirm`);
  marquer(id);
  return true;
}

async function principal() {
  console.log("Connexion à Chrome (port 9222)…");

  let navigateur;
  try {
    navigateur = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
  } catch (e) {
    console.error(
      "Impossible de se connecter à Chrome.\n" +
      "Lance Chrome avec le débogage distant :\n\n" +
      '  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222\n\n' +
      `Erreur : ${e.message}`
    );
    process.exitCode = 1;
    return;
  }

  console.log("Connecté. Chargement du lot…");

  let lot;
  try {
    const json = execSync("node outils/suggestions.mjs --lot", { cwd: RACINE, encoding: "utf-8" });
    lot = JSON.parse(json);
  } catch (e) {
    console.error(`Erreur chargement lot : ${e.message}`);
    process.exitCode = 1;
    navigateur.disconnect();
    return;
  }

  if (!lot.length) {
    console.log("Aucune fiche en attente.");
    navigateur.disconnect();
    return;
  }

  const aTraiter = lot.slice(0, maxFiches);
  console.log(`${aTraiter.length} fiche(s) à traiter (sur ${lot.length} en attente).`);
  if (essai) console.log("Mode essai — aucune soumission ne sera faite.\n");

  const page = await navigateur.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let succes = 0;
  let echecsConsecutifs = 0;

  for (let i = 0; i < aTraiter.length; i++) {
    if (echecsConsecutifs >= 3) {
      console.log("\n⚠ 3 échecs consécutifs — arrêt (probable blocage Google).");
      break;
    }

    const ok = await traiterFiche(page, aTraiter[i], i + 1).catch((e) => {
      console.log(`    ✗ Erreur : ${e.message}`);
      screenshot(page, `crash-${i + 1}`);
      return false;
    });

    if (ok) {
      succes++;
      echecsConsecutifs = 0;
    } else {
      echecsConsecutifs++;
    }

    if (i < aTraiter.length - 1) {
      const delai = 8000 + Math.random() * 12000;
      console.log(`    pause ${Math.round(delai / 1000)}s…`);
      await new Promise((r) => setTimeout(r, delai));
    }
  }

  await page.close();
  navigateur.disconnect();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Terminé : ${succes}/${aTraiter.length} suggestion(s) soumise(s).`);
  if (!essai && succes > 0) console.log("Vérifie avec : node outils/suggestions.mjs");
}

principal().catch((e) => {
  console.error("Erreur fatale :", e.message);
  process.exitCode = 1;
});

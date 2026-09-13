/**
 * ChatGPT gratuit piloté par navigateur (Playwright, profil persistant).
 *
 * Fonctionnement : un profil Chromium dédié (dossier `profil-chatgpt/`) garde la
 * session ouverte après une connexion manuelle unique (`npm run generer -- --connexion`).
 * À chaque image : nouvelle conversation → prompt → attente de la fin de génération →
 * téléchargement de l'image en pleine définition.
 *
 * Limites à connaître :
 *  - l'offre gratuite plafonne le nombre d'images par jour (d'où la cadence de 2/jour) ;
 *    au-delà, ChatGPT répond par un message de limite → la série s'arrête proprement ;
 *  - ce pilotage repose sur l'interface web, qui peut changer : les sélecteurs sont
 *    dans config.json (generation.chatgpt.selecteurs) pour être ajustés sans toucher au code ;
 *  - un runner GitHub (adresse de centre de données, sans session) ne convient pas :
 *    ce fournisseur tourne sur un poste ou un petit serveur qui garde le profil ;
 *  - l'automatisation d'un compte ChatGPT relève des conditions d'utilisation d'OpenAI :
 *    à utiliser avec son propre compte, à cadence humaine, en connaissance de cause.
 */
import fs from "node:fs";
import path from "node:path";
import { RACINE } from "../chemins.mjs";
import { ErreurQuota } from "./index.mjs";

async function chargerPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright n'est pas installé : `npm install playwright && npx playwright install chromium`");
  }
}

function reglages(config) {
  const c = config.generation?.chatgpt || {};
  return {
    url: c.url || "https://chatgpt.com/",
    profil: path.resolve(RACINE, c.profil || "./profil-chatgpt"),
    headless: c.headless !== false,
    delaiGenerationMs: c.delaiGenerationMs || 300000,
    pauseEntreImagesMs: c.pauseEntreImagesMs || 20000,
    s: {
      composeur: "#prompt-textarea",
      envoyer: 'button[data-testid="send-button"]',
      stop: 'button[data-testid="stop-button"]',
      messagesAssistant: '[data-message-author-role="assistant"]',
      image: '[data-message-author-role="assistant"] img',
      telecharger: 'button[aria-label*="élécharger"], button[aria-label*="ownload"]',
      ...(c.selecteurs || {}),
    },
    motifsQuota: c.motifsQuotaEpuise || ["limite", "limit", "réessayez", "try again", "plus tard", "later"],
  };
}

async function ouvrir(config, { visible = false } = {}) {
  const { chromium } = await chargerPlaywright();
  const r = reglages(config);
  fs.mkdirSync(r.profil, { recursive: true });
  const options = {
    headless: visible ? false : r.headless,
    viewport: { width: 1400, height: 1000 },
    locale: "fr-FR",
    args: ["--disable-blink-features=AutomationControlled"],
  };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) options.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const contexte = await chromium.launchPersistentContext(r.profil, options);
  const page = contexte.pages()[0] || (await contexte.newPage());
  return { contexte, page, r };
}

/** Ouvre le navigateur en mode visible pour se connecter une fois ; attend l'apparition du composeur. */
export async function connexion(config) {
  const { contexte, page, r } = await ouvrir(config, { visible: true });
  await page.goto(r.url, { waitUntil: "domcontentloaded" });
  console.log("Connectez-vous à ChatGPT dans la fenêtre ouverte. La session sera conservée dans", r.profil);
  await page.waitForSelector(r.s.composeur, { timeout: 15 * 60 * 1000 });
  console.log("Session détectée : vous pouvez fermer la fenêtre.");
  await page.waitForTimeout(3000);
  await contexte.close();
}

async function texteDernierMessage(page, r) {
  const messages = page.locator(r.s.messagesAssistant);
  const n = await messages.count();
  if (!n) return "";
  return (await messages.nth(n - 1).innerText().catch(() => "")) || "";
}

/** Récupère l'image générée en pleine définition : bouton « Télécharger », sinon requête directe sur l'URL, sinon capture. */
async function recupererImage(page, contexte, r, destination) {
  const images = page.locator(r.s.image);
  const n = await images.count();
  if (!n) throw new Error("aucune image dans la réponse");
  const image = images.nth(n - 1);
  const src = await image.getAttribute("src");

  // 1) bouton de téléchargement (pleine définition, format d'origine)
  try {
    await image.hover();
    const bouton = page.locator(r.s.telecharger).last();
    if (await bouton.count()) {
      const [telechargement] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), bouton.click()]);
      const ext = (path.extname(telechargement.suggestedFilename()) || ".png").toLowerCase();
      const fichier = `${destination}${ext}`;
      await telechargement.saveAs(fichier);
      return { fichier, detail: "bouton de téléchargement" };
    }
  } catch (e) {
    console.warn("  téléchargement par bouton impossible :", e.message.split("\n")[0]);
  }

  // 2) requête directe sur l'URL de l'image avec les cookies du contexte
  if (src && /^https?:/.test(src)) {
    try {
      const rep = await contexte.request.get(src);
      if (rep.ok()) {
        const type = rep.headers()["content-type"] || "";
        const ext = type.includes("webp") ? ".webp" : type.includes("jpeg") ? ".jpg" : ".png";
        const fichier = `${destination}${ext}`;
        fs.writeFileSync(fichier, await rep.body());
        return { fichier, detail: "URL de l'image" };
      }
    } catch (e) {
      console.warn("  requête directe impossible :", e.message.split("\n")[0]);
    }
  }

  // 3) capture de l'élément (dernier recours : définition limitée à l'affichage)
  const fichier = `${destination}.png`;
  await image.screenshot({ path: fichier });
  return { fichier, detail: "capture d'écran (définition réduite)" };
}

export async function generer({ element, destination, config }) {
  const { contexte, page, r } = await ouvrir(config);
  try {
    await page.goto(r.url, { waitUntil: "domcontentloaded" });
    const composeur = page.locator(r.s.composeur);
    try {
      await composeur.waitFor({ timeout: 45000 });
    } catch {
      await page.screenshot({ path: path.join(RACINE, "travail", "diagnostic-chatgpt.png") }).catch(() => {});
      throw new Error("composeur ChatGPT introuvable : session expirée ? Lancez `npm run generer -- --connexion` (capture : travail/diagnostic-chatgpt.png)");
    }
    const avant = await page.locator(r.s.image).count();
    await composeur.click();
    await composeur.fill(element.prompt);
    await page.waitForTimeout(800);
    const envoyer = page.locator(r.s.envoyer);
    if (await envoyer.count()) await envoyer.first().click();
    else await page.keyboard.press("Enter");

    // Attente de la fin : une nouvelle image apparaît ET le bouton « stop » a disparu.
    const debut = Date.now();
    let pret = false;
    while (Date.now() - debut < r.delaiGenerationMs) {
      await page.waitForTimeout(4000);
      const texte = (await texteDernierMessage(page, r)).toLowerCase();
      if (r.motifsQuota.some((m) => texte.includes(m.toLowerCase())) && !(await page.locator(r.s.image).count() > avant)) {
        throw new ErreurQuota(`ChatGPT signale une limite : « ${texte.slice(0, 160)} »`);
      }
      const nbImages = await page.locator(r.s.image).count();
      const enCours = await page.locator(r.s.stop).count();
      if (nbImages > avant && !enCours) {
        const derniere = page.locator(r.s.image).nth(nbImages - 1);
        const src = (await derniere.getAttribute("src")) || "";
        const largeur = await derniere.evaluate((img) => img.naturalWidth).catch(() => 0);
        if (src && !src.startsWith("data:") && largeur >= 256) {
          pret = true;
          break;
        }
      }
    }
    if (!pret) {
      await page.screenshot({ path: path.join(RACINE, "travail", `diagnostic-${element.id}.png`) }).catch(() => {});
      throw new Error(`génération non terminée après ${Math.round(r.delaiGenerationMs / 1000)} s (capture dans travail/)`);
    }
    await page.waitForTimeout(2000);
    const { fichier, detail } = await recupererImage(page, contexte, r, destination);
    await page.waitForTimeout(r.pauseEntreImagesMs);
    return { fichier, fournisseur: "chatgpt-navigateur", detail };
  } finally {
    await contexte.close().catch(() => {});
  }
}

#!/usr/bin/env node
/**
 * Envoie un email par fiche GMB en attente de suggestion.
 * Chaque email contient un lien vers la page d'aide (suggerer.php)
 * qui permet de copier l'URL, ouvrir Maps, et marquer la fiche.
 *
 * Usage :
 *   node outils/email-suggestions.mjs               envoie les emails
 *   node outils/email-suggestions.mjs --essai        affiche sans envoyer
 *   node outils/email-suggestions.mjs --max=5        limite le nombre
 *
 * Variable d'environnement requise : BREVO_API_KEY
 */

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = join(__dirname, "..");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, "").split("=");
    return [c, v ?? true];
  })
);
const essai = args.has("essai") || args.has("dry-run");
const maxFiches = Number(args.get("max") || 999);

const BREVO_KEY = process.env.BREVO_API_KEY;
const DEST = "allofrelons@gmail.com";
const EXPEDITEUR = { email: "allofrelons@gmail.com", name: "Vitrine Locale" };
const SUGGERER_BASE = "https://andpro.fr/vitrine-locale/suggerer.php";
const SUGGERER_TOKEN = "VL-s8k3m2p7";

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function urlSuggerer(fiche) {
  const params = new URLSearchParams({
    id: fiche.id,
    t: SUGGERER_TOKEN,
    nom: fiche.nom,
    url: fiche.url_page,
  });
  return `${SUGGERER_BASE}?${params}`;
}

function emailHtml(fiche) {
  const lien = urlSuggerer(fiche);
  return `<!doctype html>
<html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f5f5;">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="background:#fff;border-radius:12px;padding:28px 24px;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <h2 style="color:#1a73e8;margin:0 0 20px;font-size:20px;">${fiche.nom}</h2>
    <p style="text-align:center;margin:0;">
      <a href="${lien}"
         style="display:inline-block;background:#1a73e8;color:#fff;padding:16px 40px;
                border-radius:10px;text-decoration:none;font-size:16px;font-weight:bold;">
        Sugg&eacute;rer le site web &rarr;
      </a>
    </p>
  </div>
</div>
</body></html>`;
}

async function envoyerEmail(fiche) {
  const body = {
    sender: EXPEDITEUR,
    to: [{ email: DEST }],
    subject: `🌐 ${fiche.nom}`,
    htmlContent: emailHtml(fiche),
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Brevo ${res.status}: ${txt}`);
  }
  return res.json();
}

async function principal() {
  if (!essai && !BREVO_KEY) {
    console.error("Variable BREVO_API_KEY manquante.");
    process.exitCode = 1;
    return;
  }

  let lot;
  try {
    const json = execSync("node outils/suggestions.mjs --lot", { cwd: RACINE, encoding: "utf-8" });
    lot = JSON.parse(json);
  } catch (e) {
    console.error(`Erreur chargement lot : ${e.message}`);
    process.exitCode = 1;
    return;
  }

  if (!lot.length) {
    console.log("Aucune fiche en attente.");
    return;
  }

  const aTraiter = lot.slice(0, maxFiches);
  console.log(`${aTraiter.length} fiche(s) à traiter.`);
  if (essai) console.log("Mode essai — aucun email ne sera envoyé.\n");

  let envoyes = 0;
  for (let i = 0; i < aTraiter.length; i++) {
    const fiche = aTraiter[i];
    console.log(`  ${essai ? "·" : "→"} ${fiche.nom}`);

    if (essai) {
      console.log(`    ${urlSuggerer(fiche)}`);
      continue;
    }

    try {
      await envoyerEmail(fiche);
      envoyes++;
      console.log(`    ✓ email envoyé`);
    } catch (e) {
      console.error(`    ✗ ${e.message}`);
    }

    if (i < aTraiter.length - 1) await pause(800);
  }

  if (!essai) {
    console.log(`\n${envoyes}/${aTraiter.length} email(s) envoyé(s) à ${DEST}.`);
  }
}

principal().catch((e) => {
  console.error("Erreur fatale :", e.message);
  process.exitCode = 1;
});

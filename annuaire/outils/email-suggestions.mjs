#!/usr/bin/env node
/**
 * Envoie un email par fiche GMB jamais encore mailée.
 * Chaque email contient un lien vers la page d'aide (suggerer.php)
 * qui permet de copier l'URL, ouvrir Maps, et marquer la fiche — et, quand
 * le numéro de l'entreprise est un mobile, un SMS prêt à envoyer d'un tap
 * (lien sms: pré-rempli) pour que le dirigeant ajoute lui-même sa page
 * comme site web sur sa fiche Google — seul lui peut le faire sans examen.
 *
 * Après envoi, la fiche est marquée (suggestion.date_email) pour ne
 * pas être renvoyée les jours suivants ni par le cron de rattrapage.
 *
 * Usage :
 *   node outils/email-suggestions.mjs               envoie les emails
 *   node outils/email-suggestions.mjs --essai        affiche sans envoyer
 *   node outils/email-suggestions.mjs --max=5        limite le nombre
 *
 * Variable d'environnement requise : BREVO_API_KEY
 */

import config from "./lib/config.mjs";
import { lireFiches, ecrireFiche, urlFiche, ETATS } from "./lib/fiches.mjs";
import { site } from "./lib/site.mjs";
import { aujourdhui } from "./lib/texte.mjs";
import { preparerSms } from "./lib/sms.mjs";

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

function aMailer(fiche) {
  return (
    fiche.statut === ETATS.PUBLIEE &&
    !fiche.site_web_gmb &&
    fiche.suggestion?.etat === "en-attente" &&
    !fiche.suggestion?.date_email &&
    !fiche.exemple
  );
}

const SIGNATURE_SMS = config.suggestions?.signatureSms || "Vitrine Locale";

function urlSuggerer(fiche) {
  const sms = preparerSms(fiche, site.base + urlFiche(fiche), SIGNATURE_SMS);
  const params = new URLSearchParams({
    id: fiche.id,
    t: SUGGERER_TOKEN,
    nom: fiche.nom,
    url: site.base + urlFiche(fiche),
  });
  if (sms.numero) params.set("tel", sms.numero);
  return `${SUGGERER_BASE}?${params}`;
}

function echapper(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Bloc SMS de l'email : bouton d'envoi d'un tap si mobile, texte à copier sinon. */
function blocSms(fiche) {
  const sms = preparerSms(fiche, site.base + urlFiche(fiche), SIGNATURE_SMS);
  const texte = echapper(sms.texte).replace(/\n/g, "<br>");
  const relance = echapper(sms.relance);
  const entete = sms.mobile
    ? `<p style="margin:0 0 10px;font-size:14px;color:#444;"><strong>SMS au dirigeant</strong> (${echapper(sms.telephone)}) :</p>
    <p style="text-align:center;margin:0 0 14px;">
      <a href="${echapper(sms.lien)}"
         style="display:inline-block;background:#0d8a4a;color:#fff;padding:14px 32px;
                border-radius:10px;text-decoration:none;font-size:15px;font-weight:bold;">
        Envoyer le SMS &rarr;
      </a>
    </p>`
    : `<p style="margin:0 0 10px;font-size:14px;color:#444;"><strong>SMS au dirigeant</strong> :
       ${sms.telephone ? `le numéro (${echapper(sms.telephone)}) est une ligne fixe, pas de SMS possible — à lire au téléphone ou à envoyer si vous obtenez un mobile.` : "aucun numéro sur la fiche Google — texte à utiliser si vous en obtenez un."}</p>`;
  return `
  <div style="background:#fff;border-radius:12px;padding:22px 24px;margin-top:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    ${entete}
    <div style="background:#f0f6ff;border:1px dashed #90caf9;border-radius:8px;padding:12px 14px;
                font-size:14px;line-height:1.5;color:#1a1a1a;white-space:pre-wrap;">${texte}</div>
    <p style="margin:16px 0 6px;font-size:13px;color:#666;"><strong>Relance</strong>, quelques jours plus tard si le lien n'apparaît toujours pas sur la fiche :</p>
    <div style="background:#f8f9fa;border:1px dashed #ccc;border-radius:8px;padding:12px 14px;
                font-size:13px;line-height:1.5;color:#333;white-space:pre-wrap;">${relance}</div>
  </div>`;
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
  ${blocSms(fiche)}
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

  const fiches = lireFiches();
  const aTraiter = fiches.filter(aMailer).slice(0, maxFiches);

  if (!aTraiter.length) {
    console.log("Aucune nouvelle fiche à mailer.");
    return;
  }

  console.log(`${aTraiter.length} fiche(s) à traiter.`);
  if (essai) console.log("Mode essai — aucun email ne sera envoyé.\n");

  const date = aujourdhui();
  let envoyes = 0;
  for (let i = 0; i < aTraiter.length; i++) {
    const fiche = aTraiter[i];
    console.log(`  ${essai ? "·" : "→"} ${fiche.nom}`);

    if (essai) {
      console.log(`    ${urlSuggerer(fiche)}`);
      const sms = preparerSms(fiche, site.base + urlFiche(fiche), SIGNATURE_SMS);
      console.log(`    SMS ${sms.mobile ? sms.numero : "(pas de mobile)"} : ${sms.texte.replace(/\n/g, " ")}`);
      continue;
    }

    try {
      await envoyerEmail(fiche);
      envoyes++;
      console.log(`    ✓ email envoyé`);

      fiche.suggestion = fiche.suggestion || {};
      fiche.suggestion.date_email = date;
      ecrireFiche(fiche);
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

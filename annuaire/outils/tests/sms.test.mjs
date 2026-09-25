/**
 * SMS de suggestion : seuls les mobiles reçoivent un SMS, le texte demande une
 * seule action et contient le lien de la page.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { numeroSms, smsInitial, smsRelance, lienSms, preparerSms, horsGsm, segments } from "../lib/sms.mjs";

test("seuls les mobiles français (06/07) reçoivent un SMS, au format international", () => {
  assert.equal(numeroSms("06 43 41 63 44"), "+33643416344");
  assert.equal(numeroSms("07.12.34.56.78"), "+33712345678");
  assert.equal(numeroSms("+33 6 43 41 63 44"), "+33643416344");
  assert.equal(numeroSms("03 86 00 00 00"), null, "ligne fixe");
  assert.equal(numeroSms("09 70 00 00 00"), null, "VoIP");
  assert.equal(numeroSms(""), null);
  assert.equal(numeroSms(undefined), null);
});

test("le SMS fait agir le dirigeant lui-même : chemin exact, lien copiable en dernière ligne, objections levées", () => {
  const url = "https://andpro.fr/vitrine-locale/loisirs-sport-culture/chastel-nouvel/lozer-kids/";
  const texte = smsInitial({ nom: "Lozer' kids", url, signature: "Guillaume de Vitrine Locale" });
  assert.ok(texte.endsWith("\n" + url), "le lien est seul en dernière ligne, pour un appui long");
  assert.ok(texte.includes("Lozer' kids"));
  assert.match(texte, /Google Maps > votre établissement > Modifier le profil > Site Web/);
  assert.match(texte, /perd des appels face aux concurrents/, "l'argument d'acquisition est présent");
  assert.match(texte, /gratuite/);
  assert.match(texte, /Sans engagement/);
  assert.match(texte, /Répondez ici/);
  assert.ok(segments(texte) <= 3, `trop long : ${texte.length} caractères, ${segments(texte)} segments`);
  const relance = smsRelance({ nom: "Lozer' kids", url });
  assert.ok(relance.endsWith("\n" + url));
  assert.match(relance, /rappel/);
});

test("le lien sms: pré-remplit destinataire et texte", () => {
  const lien = lienSms("+33643416344", "Bonjour & bienvenue");
  assert.equal(lien, "sms:+33643416344?body=Bonjour%20%26%20bienvenue");
});

test("preparerSms distingue mobile et ligne fixe", () => {
  const mobile = preparerSms({ nom: "A", telephone: "06 00 00 00 00" }, "https://x.fr/a/", "Sig");
  assert.equal(mobile.mobile, true);
  assert.ok(mobile.lien.startsWith("sms:+33600000000?body="));
  const fixe = preparerSms({ nom: "B", telephone: "03 00 00 00 00" }, "https://x.fr/b/", "Sig");
  assert.equal(fixe.mobile, false);
  assert.equal(fixe.lien, null);
  assert.ok(fixe.texte.includes("https://x.fr/b/"));
});

test("les SMS restent dans l'alphabet GSM et tiennent en trois segments au plus", () => {
  const url = "https://andpro.fr/vitrine-locale/loisirs-sport-culture/chastel-nouvel/lozer-kids/";
  for (const texte of [
    smsInitial({ nom: "Lozer' kids", url, signature: "Guillaume de Vitrine Locale" }),
    smsRelance({ nom: "Lozer' kids", url }),
  ]) {
    assert.deepEqual(horsGsm(texte), [], `caractères hors GSM : ${horsGsm(texte).join(" ")}`);
    assert.ok(segments(texte) <= 3, `${segments(texte)} segments`);
  }
  assert.deepEqual(horsGsm("attend d'être"), ["ê"]);
  assert.equal(segments("a".repeat(160)), 1);
  assert.equal(segments("a".repeat(161)), 2);
  assert.equal(segments("ê" + "a".repeat(70)), 2);
});

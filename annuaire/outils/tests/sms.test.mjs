/**
 * SMS de suggestion : seuls les mobiles reçoivent un SMS, le texte demande une
 * seule action et contient le lien de la page.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { numeroSms, smsInitial, smsRelance, lienSms, preparerSms } from "../lib/sms.mjs";

test("seuls les mobiles français (06/07) reçoivent un SMS, au format international", () => {
  assert.equal(numeroSms("06 43 41 63 44"), "+33643416344");
  assert.equal(numeroSms("07.12.34.56.78"), "+33712345678");
  assert.equal(numeroSms("+33 6 43 41 63 44"), "+33643416344");
  assert.equal(numeroSms("03 86 00 00 00"), null, "ligne fixe");
  assert.equal(numeroSms("09 70 00 00 00"), null, "VoIP");
  assert.equal(numeroSms(""), null);
  assert.equal(numeroSms(undefined), null);
});

test("le SMS demande une seule action, lève les objections et contient le lien", () => {
  const url = "https://andpro.fr/vitrine-locale/loisirs-sport-culture/chastel-nouvel/lozer-kids/";
  const texte = smsInitial({ nom: "Lozer' kids", url, signature: "Guillaume de Vitrine Locale" });
  assert.ok(texte.includes(url));
  assert.ok(texte.includes("Lozer' kids"));
  assert.match(texte, /Répondez OUI/);
  assert.match(texte, /Gratuit, sans engagement, retirable/);
  assert.ok(texte.length <= 320 + url.length, `trop long : ${texte.length}`);
  assert.match(smsRelance(), /validez-la/);
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

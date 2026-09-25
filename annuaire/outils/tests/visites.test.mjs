/**
 * Mesure d'audience propre : reconnaissance de Google et agrégation sur une fenêtre.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { estGoogle, agreger, releverVisites } from "../lib/visites.mjs";

test("les visites venues de Google (recherche, Maps, sous-domaines) sont reconnues", () => {
  assert.equal(estGoogle("https://www.google.com/"), true);
  assert.equal(estGoogle("https://www.google.fr/search?q=lozer+kids"), true);
  assert.equal(estGoogle("https://maps.google.com/"), true);
  assert.equal(estGoogle("android-app://com.google.android.googlequicksearchbox/"), false);
  assert.equal(estGoogle("https://notgoogle.com/"), false);
  assert.equal(estGoogle("https://google.com.evil.io/"), false);
  assert.equal(estGoogle(""), false);
});

test("l'agrégation ne compte que les jours de la fenêtre et calcule l'ancienneté de la mesure", () => {
  const releve = {
    depuis: "2026-08-01",
    pages: {
      "/restaurants/nevers/zilan/": { "2026-09-01": { t: 3, g: 1 }, "2026-09-20": { t: 2, g: 2 } },
      "/cafes-bars/nevers/le-gaspard/": { "2026-07-15": { t: 9, g: 9 } },
    },
  };
  const { joursMesure, pages } = agreger(releve, 45, new Date("2026-09-25T12:00:00Z"));
  assert.equal(joursMesure, 55);
  assert.deepEqual(pages.get("/restaurants/nevers/zilan/"), { total: 5, google: 3 });
  assert.deepEqual(pages.get("/cafes-bars/nevers/le-gaspard/"), { total: 0, google: 0 });
  const court = agreger(releve, 7, new Date("2026-09-25T12:00:00Z"));
  assert.deepEqual(court.pages.get("/restaurants/nevers/zilan/"), { total: 2, google: 2 });
});

test("un relevé absent ou en erreur donne null, jamais une exception", async () => {
  assert.equal(await releverVisites("https://x.fr", async () => ({ ok: false })), null);
  assert.equal(await releverVisites("https://x.fr", async () => { throw new Error("réseau"); }), null);
  const ok = await releverVisites("https://x.fr", async (url) => ({ ok: true, json: async () => ({ url }) }));
  assert.match(ok.url, /\/visites\.php\?action=liste&t=/);
});

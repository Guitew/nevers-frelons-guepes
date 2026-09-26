/** Téléchargeur : politesse par hôte, robots.txt, non-HTML, Latin-1, taille maximale, délais. */
import test from "node:test";
import assert from "node:assert/strict";
import { creerTelechargeur, detecterCharset } from "../lib/telechargeur.mjs";
import { demarrerServeur } from "./serveur.mjs";

test("détection du jeu de caractères", () => {
  assert.equal(detecterCharset("text/html; charset=ISO-8859-1"), "windows-1252");
  assert.equal(detecterCharset("text/html", new TextEncoder().encode('<html><head><meta charset="utf-8">')), "utf-8");
  assert.equal(detecterCharset("text/html", new TextEncoder().encode('<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">')), "windows-1252");
  assert.equal(detecterCharset("", new Uint8Array(0)), "utf-8");
});

test("robots.txt, hôte muet, contenu non HTML, Latin-1, taille max, espacement des requêtes", async (t) => {
  const serveur = await demarrerServeur();
  serveur.installer(`http://localhost:${serveur.port}`);
  serveur.table["/gros"] = { corps: "<html><title>gros</title>" + "x".repeat(50_000) + "</html>", type: "text/html" };
  serveur.table["/redirige"] = { redirection: "/mention/" };
  t.after(() => serveur.fermer());
  const journal = [];
  const tel = creerTelechargeur({ delaiParHoteMs: 120, timeoutMs: 2000, tailleMax: 10_000, journal: (l) => journal.push(l) });

  const interdit = await tel.recuperer(serveur.base + "/interdit/page");
  assert.equal(interdit.interdit, true);
  assert.equal(tel.compteurs.interdits, 1);

  const pdf = await tel.recuperer(serveur.base + "/fichier.pdf");
  assert.equal(pdf.corps, null);
  assert.match(pdf.erreur, /non HTML/);

  const latin = await tel.recuperer(serveur.base + "/livre-d-or.php");
  assert.equal(latin.charset, "windows-1252");
  assert.ok(latin.corps.includes("Frédéric"));

  const gros = await tel.recuperer(serveur.base + "/gros");
  assert.ok(gros.corps.length <= 10_000, "tronqué à la taille maximale");

  const redirige = await tel.recuperer(serveur.base + "/redirige");
  assert.equal(redirige.statut, 200);
  assert.ok(redirige.url.endsWith("/mention/") && redirige.redirige);

  const introuvable = await tel.recuperer(serveur.base + "/nexiste-pas");
  assert.equal(introuvable.statut, 404);

  const t0 = Date.now();
  await Promise.all([tel.recuperer(serveur.base + "/mention/"), tel.recuperer(serveur.base + "/liens/"), tel.recuperer(serveur.base + "/annuaire/")]);
  assert.ok(Date.now() - t0 >= 200, "trois requêtes sur un même hôte sont espacées d'au moins delaiParHoteMs");

  const muet = await tel.recuperer("http://127.0.0.1:1/x");
  assert.equal(muet.bloque, true, "un hôte dont robots.txt est injoignable est ignoré");
  assert.ok(journal.some((l) => l.startsWith("robots ")));

  const sansRobots = creerTelechargeur({ delaiParHoteMs: 1, timeoutMs: 2000, respecterRobots: false });
  const brut = await sansRobots.recuperer(serveur.base + "/robots.txt", { accepterTout: true });
  assert.ok(brut.corps.includes("User-agent"));
});

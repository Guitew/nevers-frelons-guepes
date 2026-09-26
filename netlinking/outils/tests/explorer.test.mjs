/**
 * Bout en bout : exploration d'un mini-site servi en local. Vérifie la politesse
 * (robots.txt), le décodage Latin-1, l'ignorance des fichiers non HTML, la
 * découverte externe, l'enregistrement des relais, la persistance de l'état et
 * l'absence de revisite.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { completerConfig } from "../lib/config.mjs";
import { CONFIG_JSON, fichiers } from "../lib/chemins.mjs";
import { explorer } from "../explorer.mjs";
import { chercher } from "../chercher.mjs";
import { marquer } from "../marquer.mjs";
import { selectionner, versMarkdown, COLONNES } from "../rapport.mjs";
import { verifierRelais } from "../cibles.mjs";
import { verifierIndexation } from "../indexation.mjs";
import { versCsv } from "../lib/csv.mjs";
import { lireSpots } from "../lib/spots.mjs";
import { lireExploration } from "../lib/exploration.mjs";
import { lireCibles } from "../lib/cibles.mjs";
import { creerTelechargeur } from "../lib/telechargeur.mjs";
import { demarrerServeur } from "./serveur.mjs";

function configTest() {
  const config = completerConfig(JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8")));
  config.exploration.delaiParHoteMs = 5;
  config.exploration.pagesParHote = 40;
  config.exploration.timeoutMs = 3000;
  config.concurrents.domaines = ["desinsectisation-nord.fr"];
  // Aucun accès réseau externe dans les tests : les liens vers de vrais domaines sont ignorés.
  config.exploration.domainesIgnores.push("jardin-voisin.fr", "blog-de-jean.fr", "sophie-jardin.fr", "desinsectisation-nord.fr", "miel-du-nord.fr", "guepes-apens.fr", "anti-nuisibles-59.fr", "frelonasiatique.fr", "apiculture.net", "abeilles-nord.fr", "jardin-nature.fr", "guepes-info.fr", "site-a.fr", "site-b.fr", "site-c.fr", "site-d.fr", "site-e.fr", "site-f.fr");
  return config;
}

test("exploration complète d'un mini-site", async (t) => {
  const serveur = await demarrerServeur();
  const externe = `http://localhost:${serveur.port}`;
  serveur.installer(externe);
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "netlinking-e2e-"));
  fs.copyFileSync(new URL("../../donnees/cibles.json", import.meta.url), path.join(dossier, "cibles.json"));
  const config = configTest();
  const journal = [];
  t.after(async () => {
    await serveur.fermer();
    fs.rmSync(dossier, { recursive: true, force: true });
  });

  const resultat = await explorer({ config, dossier, max: 60, urls: [serveur.base + "/"], journal: (l) => journal.push(l) });
  const spots = lireSpots(fichiers(dossier).spots);
  const etat = lireExploration(fichiers(dossier).exploration);
  const cibles = lireCibles(fichiers(dossier).cibles, config);
  const parUrl = new Map(spots.map((s) => [new URL(s.url).pathname + new URL(s.url).search, s]));

  // Types détectés.
  assert.equal(parUrl.get("/blog/nid-de-frelons/").type, "commentaire");
  assert.equal(parUrl.get("/forum/").type, "forum");
  assert.equal(parUrl.get("/annuaire/").type, "annuaire");
  assert.equal(parUrl.get("/livre-d-or.php").type, "livre-dor");
  assert.equal(parUrl.get("/mention/").type, "mention-non-liee");
  assert.equal(parUrl.get("/liste-professionnels/").type, "liste-prestataires");
  assert.equal(parUrl.get("/liens/").type, "page-liens");
  assert.ok(!parUrl.has("/"), "l'accueil n'est pas un spot");
  assert.ok(!parUrl.has("/contact/"), "le contact n'est pas un spot");
  assert.ok(!parUrl.has("/relais/"), "une page relais n'est pas un spot");

  // Latin-1 décodé : le titre du livre d'or porte ses accents.
  assert.equal(parUrl.get("/livre-d-or.php").titre, "Livre d'or - Le rucher de Frédéric");

  // Politesse : robots.txt respecté pour notre agent, les fichiers binaires ne sont pas demandés.
  const vues = Object.keys(etat.vues).map((u) => new URL(u).pathname);
  assert.ok(!serveur.requetes.includes("/interdit/page"), "chemin interdit à AlloFrelonsBot jamais demandé au serveur");
  assert.equal(etat.vues[serveur.base + "/interdit/page"].erreur, "interdit par robots.txt");
  assert.ok(!serveur.requetes.includes("/fichier.pdf") && !serveur.requetes.includes("/image.png"), "binaires jamais demandés");
  // Deux hôtes (127.0.0.1 = le site, localhost = le site « externe ») → deux lectures de robots.txt, pas plus.
  assert.equal(serveur.requetes.filter((r) => r === "/robots.txt").length, 2, "robots.txt lu une seule fois par hôte");
  assert.ok(vues.includes("/prive/secret/"), "l'interdiction de * ne s'applique pas à notre groupe dédié");
  assert.ok(vues.includes("/blog-apiculture/"), "site externe découvert via la blogroll");

  // Robots IA lus depuis robots.txt : GPTBot et ClaudeBot bloqués.
  const forum = parUrl.get("/forum/");
  assert.ok(forum.ia.bloques.includes("GPTBot") && forum.ia.bloques.includes("ClaudeBot"));
  assert.ok(forum.ia.autorises.includes("PerplexityBot"));

  // Relais enregistré avec son ancre.
  const relais = cibles.relais.find((r) => r.url.endsWith("/relais/"));
  assert.ok(relais, "page relais enregistrée");
  assert.equal(relais.liens[0].ancre, "ALLO FRELONS 59");
  assert.equal(relais.etat, "present");

  // Noindex signalé, pas indexable.
  assert.equal(parUrl.get("/noindex/").indexabilite.indexable, false);

  // Origine conservée.
  assert.equal(parUrl.get("/forum/").origine.type, "lien-interne");
  assert.equal(resultat.compteurs.nouveaux, spots.length);
  assert.ok(journal.some((l) => l.includes("Visitées")));

  // Deuxième passage : rien n'est revisité, les spots gardent leur état.
  marquer({ dossier, url: serveur.base + "/forum/", etat: "fait", note: "inscrit le 26/09" });
  const second = await explorer({ config, dossier, max: 60, journal: () => {} });
  assert.equal(second.compteurs.visitees, 0, "aucune page revisitée avant revisiteJours");
  const relus = lireSpots(fichiers(dossier).spots);
  assert.equal(relus.find((s) => s.url.endsWith("/forum/")).etat, "fait");
  assert.equal(relus.find((s) => s.url.endsWith("/forum/")).note, "inscrit le 26/09");

  // Rapport : sélection, Markdown et CSV.
  const selection = selectionner(relus, { min: 0, etat: "a-traiter", config });
  assert.ok(!selection.some((s) => s.url.endsWith("/forum/")), "le spot fait sort du rapport « à traiter »");
  assert.equal(selection[0].type, "liste-prestataires");
  const md = versMarkdown(selection, { limite: 10 });
  assert.ok(md.includes("| 1 |") && md.includes("Liste de prestataires"));
  const csv = versCsv(selection, COLONNES);
  assert.ok(csv.startsWith("﻿Priorité;Score SEO;Score IA;Facilité;Type;URL du spot"));
  assert.equal(csv.trim().split("\r\n").length, selection.length + 1);

  // Rejet d'un domaine : spots rejetés et domaine exclu.
  const { touches, exclu } = marquer({ dossier, domaine: "127.0.0.1", etat: "rejete", note: "test" });
  assert.ok(touches >= 5 && exclu);
  assert.ok(fs.readFileSync(fichiers(dossier).exclusions, "utf8").includes("127.0.0.1"));

  // Vérification des relais : le lien est toujours là ; une page disparue passe « absent ».
  const telechargeur = creerTelechargeur({ delaiParHoteMs: 5, timeoutMs: 3000 });
  serveur.table["/relais-disparu/"] = { corps: "<html><title>x</title><body>plus rien</body></html>", type: "text/html" };
  const c = lireCibles(fichiers(dossier).cibles, config);
  c.relais = c.relais.filter((r) => r.url.startsWith(serveur.base));
  c.relais.push({ url: serveur.base + "/relais-disparu/", domaine: "127.0.0.1", source: "manuel", etat: "a-verifier" });
  fs.writeFileSync(fichiers(dossier).cibles, JSON.stringify(c));
  const verif = await verifierRelais({ config, dossier, telechargeur, journal: () => {} });
  assert.deepEqual(verif, { present: 1, absent: 1, erreur: 0 });
});

test("chercher : les résultats d'un moteur alimentent la frontière, les requêtes sont datées", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "netlinking-chercher-"));
  const config = configTest();
  const appels = [];
  const moteur = {
    nom: "factice",
    async chercher(requete) {
      appels.push(requete);
      if (requete.includes("erreur")) throw new Error("HTTP 500");
      return [
        { url: "https://blog-jardin.fr/frelons/", titre: "Frelons" },
        { url: "https://allo-frelons.fr/frelon-asiatique", titre: "nous-mêmes" },
        { url: "https://www.facebook.com/x", titre: "ignoré" },
      ];
    },
  };
  const c = await chercher({ config, dossier, moteur, requetes: ['"allo frelons"', "frelon forum", "erreur"], journal: () => {} });
  assert.deepEqual(appels, ['"allo frelons"', "frelon forum", "erreur"]);
  assert.equal(c.requetes, 2);
  assert.equal(c.erreurs, 1);
  assert.equal(c.ajoutes, 1, "nos pages et les domaines ignorés ne sont pas ajoutés, et un doublon ne compte qu'une fois");
  const etat = lireExploration(fichiers(dossier).exploration);
  assert.equal(etat.frontiere[0].url, "https://blog-jardin.fr/frelons/");
  assert.equal(etat.frontiere[0].origine, "relais", "une requête de marque produit des relais potentiels");
  assert.ok(etat.requetes['"allo frelons"'].date);
  assert.ok(!etat.requetes.erreur);
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("indexation : « site: » via le moteur, résultat daté sur le spot", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "netlinking-index-"));
  const config = configTest();
  const spots = [
    { url: "https://a.fr/page", scores: { priorite: 80 }, etat: "a-traiter" },
    { url: "https://b.fr/page", scores: { priorite: 70 }, etat: "a-traiter" },
    { url: "https://c.fr/page", scores: { priorite: 60 }, etat: "fait" },
  ];
  fs.writeFileSync(fichiers(dossier).spots, JSON.stringify(spots));
  const moteur = { nom: "factice", async chercher(q) { return q.includes("a.fr") ? [{ url: "https://www.a.fr/page/" }] : []; } };
  const c = await verifierIndexation({ config, dossier, moteur, max: 10, journal: () => {} });
  assert.deepEqual(c, { verifies: 2, oui: 1, non: 1, erreurs: 0 });
  const relus = lireSpots(fichiers(dossier).spots);
  assert.equal(relus.find((s) => s.url.startsWith("https://a.fr")).indexee, "oui");
  assert.equal(relus.find((s) => s.url.startsWith("https://b.fr")).indexee, "non");
  assert.equal(relus.find((s) => s.url.startsWith("https://c.fr")).indexee, undefined, "les spots faits ne consomment pas de requête");
  fs.rmSync(dossier, { recursive: true, force: true });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RACINE } from "../lib/chemins.mjs";
import { extraireLocs, rapprocher, correspondance } from "../importer-sitemap.mjs";

test("cycle complet en bac à sable : simulation → export, sans toucher aux données du projet", () => {
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), "images-seo-cycle-"));
  const avant = fs.readFileSync(path.join(RACINE, "donnees", "file-attente.json"), "utf8");
  const sortie = execFileSync(process.execPath, ["outils/quotidien.mjs", "--fournisseur=simulation", "--publication=export", "--essai", "--date=2026-08-01"], {
    cwd: RACINE,
    env: { ...process.env, IMAGES_SEO_BAC_A_SABLE: bac },
    encoding: "utf8",
  });
  assert.match(sortie, /File d'attente : \{"publie":2\}/);
  assert.equal(fs.readFileSync(path.join(RACINE, "donnees", "file-attente.json"), "utf8"), avant);
  const file = JSON.parse(fs.readFileSync(path.join(bac, "file-attente.json"), "utf8"));
  assert.equal(file.length, 2);
  for (const it of file) {
    const d = path.join(bac, "sortie", it.date, it.nomFichier);
    assert.ok(fs.existsSync(path.join(d, "manifeste.json")));
    assert.ok(fs.existsSync(path.join(d, "integration.html")));
    assert.ok(fs.existsSync(path.join(d, `${it.nomFichier}.jpg`)));
  }
  assert.ok(fs.existsSync(path.join(bac, "sortie", "sitemap-images.xml")));
  // Relance le même jour : rien de nouveau n'est planifié
  const encore = execFileSync(process.execPath, ["outils/quotidien.mjs", "--fournisseur=simulation", "--publication=export", "--essai", "--date=2026-08-01"], {
    cwd: RACINE,
    env: { ...process.env, IMAGES_SEO_BAC_A_SABLE: bac },
    encoding: "utf8",
  });
  assert.match(encore, /Rien à planifier/);
  fs.rmSync(bac, { recursive: true, force: true });
});

test("fournisseur dépôt : sans fichier, écrit la liste des prompts et laisse l'élément en attente", () => {
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), "images-seo-depot-"));
  const sortie = execFileSync(process.execPath, ["outils/quotidien.mjs", "--fournisseur=depot", "--publication=export", "--essai", "--date=2026-08-02"], {
    cwd: RACINE,
    env: { ...process.env, IMAGES_SEO_BAC_A_SABLE: bac },
    encoding: "utf8",
  });
  assert.match(sortie, /en attente de dépôt manuel/);
  const liste = fs.readFileSync(path.join(bac, "depot", "A-GENERER.md"), "utf8");
  assert.match(liste, /## 2026-08-02-01-.*\.png/);
  assert.match(liste, /Ne mets AUCUN texte/);
  const file = JSON.parse(fs.readFileSync(path.join(bac, "file-attente.json"), "utf8"));
  assert.ok(file.every((it) => it.statut === "a_generer"));
  fs.rmSync(bac, { recursive: true, force: true });
});

test("importer-sitemap : extraction des URLs et rapprochement par slug", () => {
  const xml = `<urlset><url><loc>https://allo-frelons.fr/</loc></url><url><loc> https://allo-frelons.fr/nid-de-guepes/ </loc></url><url><loc>https://allo-frelons.fr/blog/frelon-asiatique-ou-europeen-difference/</loc></url><url><loc>https://allo-frelons.fr/tarifs/</loc></url></urlset>`;
  const urls = extraireLocs(xml);
  assert.equal(urls.length, 4);
  const pages = [
    { id: "nid-de-guepes", url: "", a_completer: true, mot_cle: "nid de guêpes" },
    { id: "frelon-asiatique-ou-europeen", url: "", a_completer: true, mot_cle: "différence frelon asiatique et européen" },
    { id: "piqure-frelon", url: "", a_completer: true, mot_cle: "piqûre de frelon" },
  ];
  const { pages: apres, ajoutees } = rapprocher(pages, urls);
  assert.equal(apres[0].url, "https://allo-frelons.fr/nid-de-guepes/");
  assert.equal(apres[0].a_completer, undefined);
  assert.equal(apres[1].url, "https://allo-frelons.fr/blog/frelon-asiatique-ou-europeen-difference/");
  assert.equal(apres[2].url, "");
  assert.deepEqual(ajoutees.map((a) => a.id), ["tarifs"]);
  assert.equal(correspondance(pages[2], "https://allo-frelons.fr/tarifs/"), 0);
});

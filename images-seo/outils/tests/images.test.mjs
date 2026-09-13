import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { decliner, controlerSource, couperLignes, svgSurcouche } from "../lib/images.mjs";
import { generer as simuler } from "../lib/fournisseurs/simulation.mjs";

const charte = { marque: "ALLO FRELONS", signature: "allo-frelons.fr", couleurs: { accent: "#F5B700", sombre: "#1C1C1C", clair: "#FFFFFF" } };

test("couperLignes : respecte la longueur et le nombre de lignes", () => {
  assert.deepEqual(couperLignes("Le nid au fil de l'année", 12), ["Le nid au", "fil de", "l'année"]);
  assert.equal(couperLignes("un deux trois quatre cinq six sept huit", 8, 2).length, 2);
});

test("svgSurcouche : badge, titre et signature", () => {
  assert.match(svgSurcouche({ largeur: 1200, hauteur: 900, mode: "badge", texte: "Nid", charte }), /allo-frelons.fr[\s\S]*<rect[^>]+fill="#F5B700"/);
  assert.match(svgSurcouche({ largeur: 1000, hauteur: 1500, mode: "titre", texte: "Titre & test", charte }), /Titre &amp; test/);
  assert.doesNotMatch(svgSurcouche({ largeur: 1200, hauteur: 900, mode: "aucune", texte: "X", charte }), /fill="#F5B700"/);
});

test("decliner : produit WebP + JPEG aux dimensions de chaque surface, avec XMP", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "images-seo-test-"));
  const element = { id: "t", visuel: 0, requete: "test", formatSource: "paysage", serps: ["google-images", "discover"], surcouche: "Badge" };
  const { fichier } = await simuler({ element, destination: path.join(dossier, "maitre") });
  const controle = await controlerSource(fichier, "paysage");
  assert.deepEqual(controle.anomalies, []);
  assert.deepEqual((await controlerSource(fichier, "portrait")).anomalies, ["orientation paysage alors qu'un portrait était attendu"]);
  const res = await decliner({ source: fichier, dossier, element, charte, xmp: "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\"></x:xmpmeta>", nommer: (s, e) => `${s}.${e}` });
  assert.equal(res.length, 2);
  const gi = await sharp(path.join(dossier, "google-images.jpg")).metadata();
  assert.equal(`${gi.width}x${gi.height}`, "1200x900");
  const dc = await sharp(path.join(dossier, "discover.webp")).metadata();
  assert.equal(`${dc.width}x${dc.height}`, "1536x864");
  assert.ok(gi.xmp && gi.xmp.length > 10, "XMP embarqué dans le JPEG");
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("decliner : portrait → Pinterest 1000×1500 avec titre", async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "images-seo-test-"));
  const element = { id: "t", visuel: 1, requete: "cycle", formatSource: "portrait", serps: ["pinterest"], surcouche: "Le nid au fil de l'année" };
  const { fichier } = await simuler({ element, destination: path.join(dossier, "maitre") });
  const res = await decliner({ source: fichier, dossier, element, charte, xmp: null, nommer: (s, e) => `${s}.${e}` });
  const m = await sharp(res[0].jpeg).metadata();
  assert.equal(`${m.width}x${m.height}`, "1000x1500");
  fs.rmSync(dossier, { recursive: true, force: true });
});

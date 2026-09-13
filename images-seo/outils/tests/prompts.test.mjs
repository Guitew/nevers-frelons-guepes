import { test } from "node:test";
import assert from "node:assert/strict";
import { construirePrompt, fichesPour, promptReprise } from "../lib/prompts.mjs";

test("fichesPour : détecte les espèces et les nids cités", () => {
  assert.deepEqual(fichesPour("gros nid de frelon asiatique dans un arbre"), ["nid de frelon asiatique", "frelon asiatique"]);
  assert.deepEqual(fichesPour("guêpe germanique sur un melon"), ["guêpe"]);
  assert.deepEqual(fichesPour("abeille et frelon européen"), ["frelon européen", "abeille"]);
});

test("construirePrompt : format, faits morphologiques, règles CTR et interdiction du texte", () => {
  const p = construirePrompt({
    angle: "frelon asiatique posé sur une branche",
    requete: "frelon asiatique",
    mot_cle: "frelon asiatique",
    formatSource: "paysage",
    charte: { style: "photo réaliste", interdits: "aucun texte" },
  });
  assert.match(p, /1536 × 1024/);
  assert.match(p, /Vespa velutina/);
  assert.match(p, /pattes jaune vif/);
  assert.match(p, /AUCUN texte/);
  assert.match(p, /un seul sujet principal/);
  assert.match(p, /marge libre/);
});

test("construirePrompt : le portrait demande 1024 × 1536", () => {
  const p = construirePrompt({ angle: "nid", requete: "nid", mot_cle: "nid", formatSource: "portrait" });
  assert.match(p, /1024 × 1536/);
});

test("promptReprise : conserve le prompt et nomme le motif", () => {
  assert.match(promptReprise("base", "texte présent"), /base[\s\S]*texte présent/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { completerConfig } from "../lib/config.mjs";
import { CONFIG_JSON } from "../lib/chemins.mjs";
import { genererRequetes, lireRequetes, requetesAFaire } from "../lib/requetes.mjs";
import { premiereColonne, versCsv } from "../lib/csv.mjs";

const config = completerConfig(JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8")));

test("génération : marque, listes, thèmes × empreintes, zones, sans doublon", () => {
  const r = genererRequetes(config);
  assert.ok(r.length > 100 && r.length <= 400);
  assert.equal(new Set(r).size, r.length);
  assert.ok(r.includes('"allo frelons"'));
  assert.ok(r.includes('"allo frelons" -site:allo-frelons.fr'));
  assert.ok(r.some((q) => q.startsWith('liste "désinsectiseurs" Lille')));
  assert.ok(r.some((q) => q === 'frelon "laisser un commentaire"'));
  assert.ok(r.some((q) => q === 'annuaire "ajouter un site" Nord'));
  assert.ok(r.some((q) => q === "frelon asiatique Lille forum"));
});

test("fichier de requêtes : les lignes remplacent la génération, les commentaires sont ignorés", () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "netlinking-requetes-"));
  const chemin = path.join(dossier, "requetes.txt");
  fs.writeFileSync(chemin, "# commentaire\n\nfrelon forum\nfrelon forum\n  guêpes blog  \n");
  assert.deepEqual(lireRequetes(chemin, config), { requetes: ["frelon forum", "guêpes blog"], source: "fichier" });
  fs.writeFileSync(chemin, "# rien\n");
  assert.equal(lireRequetes(chemin, config).source, "generation");
  fs.rmSync(dossier, { recursive: true, force: true });
});

test("requêtes dues : jamais lancées d'abord, puis les plus anciennes ; les fraîches attendent", () => {
  const etat = { requetes: { a: { date: "2020-01-01" }, b: { date: new Date().toISOString().slice(0, 10) }, c: { date: "2021-01-01" } } };
  assert.deepEqual(requetesAFaire(etat, ["a", "b", "c", "d"], config, 10), ["d", "a", "c"]);
  assert.deepEqual(requetesAFaire(etat, ["a", "b", "c", "d"], config, 2), ["d", "a"]);
});

test("CSV : échappement, BOM, première colonne d'un export", () => {
  const csv = versCsv([{ a: 'x;"y"', b: ["l1", "l2"], c: null }], [{ cle: "a", libelle: "A" }, { cle: "b" }, { cle: "c", valeur: (l) => (l.c == null ? "vide" : l.c) }]);
  assert.equal(csv, '﻿A;b;c\r\n"x;""y""";l1 | l2;vide\r\n');
  assert.deepEqual(premiereColonne('﻿"Site";"Liens"\nhttps://a.fr/,12\n"https://b.fr/page";3\n\n'), ["Site", "https://a.fr/", "https://b.fr/page"]);
});

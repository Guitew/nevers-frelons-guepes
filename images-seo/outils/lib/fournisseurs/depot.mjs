/**
 * Dépôt manuel : la personne génère l'image dans ChatGPT (gratuit) à partir du
 * prompt fourni, puis dépose le fichier dans donnees/depot/<id>.png|jpg|webp.
 * Sans fichier, le fournisseur écrit la liste des prompts à traiter et s'arrête.
 */
import fs from "node:fs";
import path from "node:path";
import { DEPOT } from "../chemins.mjs";

const EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

export function fichierDepose(id) {
  for (const ext of EXTENSIONS) {
    const f = path.join(DEPOT, `${id}.${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

export function ecrireListeAGenerer(elements) {
  const lignes = [
    "# Images à générer (dépôt manuel)",
    "",
    "Pour chaque bloc : copier le prompt dans ChatGPT, enregistrer l'image générée sous le nom indiqué dans ce dossier, puis relancer `npm run quotidien`.",
    "",
  ];
  for (const el of elements) {
    lignes.push(`## ${el.id}.png`, "", `Page : ${el.titrePage} (${el.url || "URL à compléter"})`, `Format attendu : ${el.formatSource}`, "", "```", el.prompt, "```", "");
  }
  fs.mkdirSync(DEPOT, { recursive: true });
  fs.writeFileSync(path.join(DEPOT, "A-GENERER.md"), lignes.join("\n"), "utf8");
}

export async function generer({ element, destination, enAttente = [] }) {
  const depose = fichierDepose(element.id);
  if (!depose) {
    ecrireListeAGenerer(enAttente.length ? enAttente : [element]);
    const e = new Error(`aucun fichier déposé pour ${element.id} — prompts écrits dans donnees/depot/A-GENERER.md`);
    e.enAttenteDepot = true;
    throw e;
  }
  const fichier = `${destination}${path.extname(depose).toLowerCase()}`;
  fs.copyFileSync(depose, fichier);
  return { fichier, fournisseur: "depot", detail: `fichier déposé : ${path.basename(depose)}` };
}

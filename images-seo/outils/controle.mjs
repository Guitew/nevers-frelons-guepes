/**
 * Barrière avant push : rejoue un cycle complet en simulation dans un bac à sable
 * (rien n'est écrit dans donnees/ ni sortie/), puis vérifie ce qui a été produit.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const bac = fs.mkdtempSync(path.join(os.tmpdir(), "images-seo-controle-"));
process.env.IMAGES_SEO_BAC_A_SABLE = bac;
const { executerCycle } = await import("./quotidien.mjs");
const { SORTIE, FILE_ATTENTE_JSON } = await import("./lib/chemins.mjs");

await executerCycle({ fournisseur: "simulation", publication: "export", essai: true, date: "2026-07-15" });
await executerCycle({ fournisseur: "simulation", publication: "export", essai: true, date: "2026-07-16" });

const file = JSON.parse(fs.readFileSync(FILE_ATTENTE_JSON, "utf8"));
const anomalies = [];
if (file.length !== 4) anomalies.push(`4 éléments attendus dans la file, ${file.length} trouvés`);
for (const it of file) if (it.statut !== "publie") anomalies.push(`${it.id} en statut ${it.statut}`);
const sitemap = path.join(SORTIE, "sitemap-images.xml");
if (!fs.existsSync(sitemap)) anomalies.push("sitemap images absent");
else {
  const xml = fs.readFileSync(sitemap, "utf8");
  if (/<image:caption>\.\s/.test(xml)) anomalies.push("légende vide dans le sitemap");
}
for (const it of file) {
  const dossier = path.join(SORTIE, it.date, it.nomFichier);
  for (const f of ["manifeste.json", "integration.html", `${it.nomFichier}.jpg`, `${it.nomFichier}.webp`]) {
    if (!fs.existsSync(path.join(dossier, f))) anomalies.push(`fichier manquant : ${it.date}/${it.nomFichier}/${f}`);
  }
}
fs.rmSync(bac, { recursive: true, force: true });
if (anomalies.length) {
  console.error("CONTRÔLE EN ÉCHEC :\n - " + anomalies.join("\n - "));
  process.exit(1);
}
console.log("Contrôle réussi : 2 cycles simulés, 4 images publiées, sitemap et manifestes cohérents.");

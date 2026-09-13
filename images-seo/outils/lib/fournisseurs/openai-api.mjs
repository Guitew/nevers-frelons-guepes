/**
 * API OpenAI Images (payante, quelques centimes par image) : voie 100 % automatisable
 * sur un serveur ou GitHub Actions. Nécessite OPENAI_API_KEY.
 */
import fs from "node:fs";
import { FORMATS_SOURCE } from "../serps.mjs";
import { ErreurQuota } from "./index.mjs";

export async function generer({ element, destination, config }) {
  const cle = process.env.OPENAI_API_KEY;
  if (!cle) throw new Error("OPENAI_API_KEY absente : définir la variable d'environnement ou choisir un autre fournisseur");
  const f = FORMATS_SOURCE[element.formatSource] || FORMATS_SOURCE.paysage;
  const reglages = config.generation?.openai || {};
  const reponse = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: reglages.modele || "gpt-image-1",
      prompt: element.prompt,
      n: 1,
      size: `${f.largeur}x${f.hauteur}`,
      quality: reglages.qualite || "medium",
      output_format: "png",
    }),
  });
  if (reponse.status === 429) throw new ErreurQuota(`OpenAI : quota ou débit dépassé (${await reponse.text()})`);
  if (!reponse.ok) throw new Error(`OpenAI ${reponse.status} : ${(await reponse.text()).slice(0, 300)}`);
  const json = await reponse.json();
  const donnee = json.data?.[0];
  let octets;
  if (donnee?.b64_json) octets = Buffer.from(donnee.b64_json, "base64");
  else if (donnee?.url) octets = Buffer.from(await (await fetch(donnee.url)).arrayBuffer());
  else throw new Error("OpenAI : réponse sans image");
  const fichier = `${destination}.png`;
  fs.writeFileSync(fichier, octets);
  return { fichier, fournisseur: "openai-api", detail: `${reglages.modele || "gpt-image-1"} ${f.largeur}x${f.hauteur}` };
}

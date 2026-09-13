/** Résumé console : pages prêtes / à compléter, file d'attente, dernières productions. */
import { lirePages, lireFileAttente } from "./lib/config.mjs";
import { lireJournal } from "./lib/journal.mjs";

const pages = lirePages();
const file = lireFileAttente();
const journal = lireJournal();
const pretes = pages.filter((p) => p.url && p.visuels?.length);
console.log(`Pages : ${pages.length} (prêtes : ${pretes.length}, sans URL : ${pages.filter((p) => !p.url).length}, à qualifier : ${pages.filter((p) => p.a_qualifier).length})`);
console.log(`Visuels disponibles : ${pages.reduce((n, p) => n + (p.visuels?.length || 0), 0)}`);
const parStatut = {};
for (const it of file) parStatut[it.statut] = (parStatut[it.statut] || 0) + 1;
console.log(`File d'attente : ${file.length} ${JSON.stringify(parStatut)}`);
const publies = journal.filter((e) => e.type === "publie");
console.log(`Images publiées (journal) : ${publies.length}`);
for (const e of publies.slice(0, 10)) console.log(`  ${e.date.slice(0, 10)}  ${e.page}  visuel ${e.visuel}  ${e.statut}`);
const parPage = {};
for (const e of publies) parPage[e.page] = (parPage[e.page] || 0) + 1;
console.log("Par page :", JSON.stringify(parPage));

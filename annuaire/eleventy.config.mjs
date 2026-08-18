import { slugifier, dateLisible, telephoneLisible, telephoneLien, tronquer, aujourdhui } from "./outils/lib/texte.mjs";
import { heureLisible, journeeLisible, resumeHoraires, JOURS } from "./outils/lib/redaction.mjs";
import { pilotage } from "./outils/lib/pilotage.mjs";
import { schemaFiche, schemaFil, schemaFaq, schemaListe, schemaSite } from "./outils/lib/schema.mjs";

export default function (eleventyConfig) {
  // ------- Assets copiés tels quels -------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "." });
  eleventyConfig.addWatchTarget("src/assets/");
  eleventyConfig.addWatchTarget("donnees/");

  // ------- Dates -------
  eleventyConfig.addFilter("dateFr", (v) => dateLisible(typeof v === "string" ? v.slice(0, 10) : v));
  eleventyConfig.addFilter("isoDate", (v) => {
    if (!v) return "";
    const d = new Date(typeof v === "string" && v.length === 10 ? v + "T12:00:00Z" : v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  });
  eleventyConfig.addFilter("annee", () => new Date().getFullYear());
  eleventyConfig.addFilter("aujourdhui", () => aujourdhui());

  // ------- Texte -------
  eleventyConfig.addFilter("slug", slugifier);
  eleventyConfig.addFilter("tronquer", tronquer);
  eleventyConfig.addFilter("jsonify", (o) => JSON.stringify(o));
  eleventyConfig.addFilter("telLisible", telephoneLisible);
  eleventyConfig.addFilter("telLien", telephoneLien);
  eleventyConfig.addFilter("nombreFr", (n) => new Intl.NumberFormat("fr-FR").format(n || 0));
  eleventyConfig.addFilter("noteFr", (n) => (n == null ? "" : String(n).replace(".", ",")));

  // ------- Horaires -------
  eleventyConfig.addFilter("heure", heureLisible);
  eleventyConfig.addFilter("journee", journeeLisible);
  eleventyConfig.addFilter("resumeHoraires", resumeHoraires);
  eleventyConfig.addFilter("nomJour", (i) => JOURS[i] || "");

  // ------- Données structurées -------
  eleventyConfig.addFilter("schemaFiche", schemaFiche);
  eleventyConfig.addFilter("schemaFil", schemaFil);
  eleventyConfig.addFilter("schemaFaq", schemaFaq);
  eleventyConfig.addFilter("schemaListe", schemaListe);
  eleventyConfig.addFilter("schemaSite", schemaSite);

  // ------- Tableau de bord privé -------
  eleventyConfig.addFilter("pilotage", pilotage);

  // ------- Listes -------
  eleventyConfig.addFilter("limite", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("melangerStable", (arr, graine) => {
    // Ordre stable mais non alphabétique, pour éviter que les mêmes fiches
    // occupent toujours les blocs « à découvrir ».
    const liste = [...(arr || [])];
    const g = String(graine || "").length + 7;
    return liste.sort((a, b) => ((a.slug || "").charCodeAt(g % 5) || 0) - ((b.slug || "").charCodeAt(g % 5) || 0));
  });
  eleventyConfig.addFilter("voisines", (fiches, fiche, n) =>
    (fiches || [])
      .filter((f) => f.url !== fiche.url && f.ville_slug === fiche.ville_slug && f.categorie === fiche.categorie)
      .concat(
        (fiches || []).filter(
          (f) => f.url !== fiche.url && f.ville_slug === fiche.ville_slug && f.categorie !== fiche.categorie
        )
      )
      .slice(0, n)
  );

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html", "11ty.js"],
  };
}

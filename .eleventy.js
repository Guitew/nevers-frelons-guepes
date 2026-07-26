const { DateTime } = require("luxon");
const { feedPlugin } = require("@11ty/eleventy-plugin-rss");

module.exports = function (eleventyConfig) {
  // Copie des assets statiques tels quels
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "." });

  // Rechargement du navigateur quand le CSS change
  eleventyConfig.addWatchTarget("src/assets/css/");
  eleventyConfig.addWatchTarget("src/assets/js/");

  // ------- Filtres de dates -------
  eleventyConfig.addFilter("dateFr", (value) => {
    if (!value) return "";
    return DateTime.fromJSDate(new Date(value), { zone: "Europe/Paris" })
      .setLocale("fr")
      .toFormat("d LLLL yyyy");
  });
  eleventyConfig.addFilter("isoDate", (value) => {
    if (!value) return "";
    return DateTime.fromJSDate(new Date(value), { zone: "utc" }).toISODate();
  });
  eleventyConfig.addFilter("annee", () => new Date().getFullYear());

  // ------- Filtres utilitaires -------
  eleventyConfig.addFilter("slug", (str) =>
    (str || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );

  eleventyConfig.addFilter("limite", (arr, n) => (arr || []).slice(0, n));

  // Retourne n éléments d'une collection en excluant la page courante (par url)
  eleventyConfig.addFilter("autresQue", (arr, url, n) =>
    (arr || []).filter((e) => e.url !== url).slice(0, n)
  );

  // Retourne n fiches de la MÊME catégorie (maillage interne thématique),
  // complétées par d'autres si nécessaire.
  eleventyConfig.addFilter("memeCategorie", (arr, categorie, url, n) => {
    const list = (arr || []).filter((e) => e.url !== url);
    const meme = list.filter((e) => e.data.categorie === categorie);
    const autres = list.filter((e) => e.data.categorie !== categorie);
    return meme.concat(autres).slice(0, n);
  });

  eleventyConfig.addFilter("triNom", (arr) =>
    [...(arr || [])].sort((a, b) =>
      (a.data.nom_commun || a.data.title || "").localeCompare(
        b.data.nom_commun || b.data.title || "",
        "fr"
      )
    )
  );

  // Regroupe une collection par valeur d'un champ de données
  eleventyConfig.addFilter("groupePar", (arr, cle) => {
    const groupes = {};
    for (const item of arr || []) {
      const k = item.data[cle] || "Autres";
      (groupes[k] = groupes[k] || []).push(item);
    }
    return Object.keys(groupes)
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((k) => ({ nom: k, items: groupes[k] }));
  });

  // JSON pour l'index de recherche
  eleventyConfig.addFilter("jsonify", (obj) => JSON.stringify(obj));

  // ------- Collections -------
  eleventyConfig.addCollection("especes", (api) =>
    api.getFilteredByGlob("src/especes/*.md").sort((a, b) =>
      (a.data.nom_commun || "").localeCompare(b.data.nom_commun || "", "fr")
    )
  );

  eleventyConfig.addCollection("habitats", (api) =>
    api.getFilteredByGlob("src/habitats/*.md").sort((a, b) =>
      (a.data.title || "").localeCompare(b.data.title || "", "fr")
    )
  );

  eleventyConfig.addCollection("dossiers", (api) =>
    api.getFilteredByGlob("src/dossiers/*.md").sort(
      (a, b) => new Date(b.data.date) - new Date(a.data.date)
    )
  );

  // Faune uniquement (règne animal)
  eleventyConfig.addCollection("faune", (api) =>
    api
      .getFilteredByGlob("src/especes/*.md")
      .filter((e) => e.data.regne === "Animalia")
      .sort((a, b) =>
        (a.data.nom_commun || "").localeCompare(b.data.nom_commun || "", "fr")
      )
  );

  // Flore uniquement (règne végétal)
  eleventyConfig.addCollection("flore", (api) =>
    api
      .getFilteredByGlob("src/especes/*.md")
      .filter((e) => e.data.regne === "Plantae")
      .sort((a, b) =>
        (a.data.nom_commun || "").localeCompare(b.data.nom_commun || "", "fr")
      )
  );

  // ------- Flux RSS des dossiers -------
  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/flux.xml",
    collection: { name: "dossiers", limit: 20 },
    metadata: {
      language: "fr",
      title: "Observatoire de la biodiversité du Nord et du Pas-de-Calais",
      subtitle: "Dossiers et actualités des milieux naturels des Hauts-de-France.",
      base: "https://observatoire-biodiversite-npdc.fr/",
      author: { name: "Observatoire de la biodiversité du Nord et du Pas-de-Calais" },
    },
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
};

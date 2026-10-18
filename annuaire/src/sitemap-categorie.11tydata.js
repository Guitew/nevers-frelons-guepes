// Une catégorie vidée (plus aucune fiche publiée, page passée en noindex) n'a
// pas de sitemap : on la retire de la pagination AVANT le rendu. L'ancienne
// solution rendait un permalink « false » dans le gabarit, mais Eleventy ne
// reconnaît le booléen false que dans une donnée, pas dans une chaîne rendue :
// il écrivait `_site/false`, et deux catégories vides provoquaient un conflit
// de permalien qui bloquait tout le déploiement (14/10/2026).
export default {
  pagination: {
    data: "annuaire.categories",
    size: 1,
    alias: "c",
    before: (categories) => categories.filter((c) => !c.vide),
  },
};

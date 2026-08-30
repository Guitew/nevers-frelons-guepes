/**
 * Jeu de données du tableau de bord, servi à part du HTML.
 *
 * Le tableau était rendu côté serveur : à 3 000 fiches, la page pesait 3 Mo et
 * le navigateur devait poser autant de lignes dans le DOM avant le moindre
 * filtrage. Les données transitent désormais en JSON compact (clés d'une
 * lettre, dates tronquées au jour) et le tableau est peint par tranches.
 *
 * Ce fichier vit à l'intérieur de la zone protégée par authentification : il
 * hérite du .htaccess du dossier, et n'est donc pas plus exposé que la page.
 */
export default class {
  data() {
    return {
      permalink: (data) => `${data.site.cheminPrive}donnees.json`,
      eleventyExcludeFromCollections: true,
    };
  }

  render({ annuaire, site }) {
    const jour = (v) => (v ? String(v).slice(0, 10) : null);
    return JSON.stringify({
      genere_le: new Date().toISOString().slice(0, 10),
      base: site.base,
      fiches: annuaire.toutes.map((f) => ({
        n: f.nom,
        c: f.categorie_nom,
        v: f.ville,
        s: f.statut,
        b: f.backlink?.etat || "en-attente",
        e: f.backlink?.echecs || 0,
        p: jour(f.backlink?.premiere_detection),
        d: jour(f.backlink?.derniere_verification),
        u: f.url,
        m: f.retrait?.mode || null,
        mo: f.retrait?.motif || null,
        x: f.exemple ? 1 : 0,
      })),
    });
  }
}

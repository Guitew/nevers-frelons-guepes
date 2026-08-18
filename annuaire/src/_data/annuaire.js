/**
 * Couche de données du site : lit les fiches JSON sur le disque et en dérive
 * tout ce dont les gabarits ont besoin (catégories peuplées, villes, statistiques,
 * table des retraits pour le .htaccess).
 *
 * Les fiches retirées ne sont jamais transmises aux pages publiques : elles ne
 * servent qu'à produire les règles de redirection et le tableau de bord privé.
 */

import { lireFiches, urlFiche, ETATS } from "../../outils/lib/fiches.mjs";
import { categories as taxonomie, categorieParSlug } from "../../outils/lib/categories.mjs";
import { lireJournal } from "../../outils/lib/journal.mjs";

/** Taille d'une page de liste. Au-delà, la liste est découpée en /page-2/, /page-3/… */
const PAR_PAGE = 48;

/**
 * Découpe une liste de fiches en pages numérotées.
 * La première page garde l'URL canonique de la rubrique ; les suivantes
 * portent un suffixe et sont liées entre elles par prev/next.
 */
function paginer(fiches, urlBase, contexte) {
  const total = Math.max(1, Math.ceil(fiches.length / PAR_PAGE));
  return Array.from({ length: total }, (_, i) => ({
    ...contexte,
    fiches: fiches.slice(i * PAR_PAGE, (i + 1) * PAR_PAGE),
    numero: i + 1,
    total,
    url: i === 0 ? urlBase : `${urlBase}page-${i + 1}/`,
    urlBase,
    precedente: i === 0 ? null : i === 1 ? urlBase : `${urlBase}page-${i}/`,
    suivante: i + 1 < total ? `${urlBase}page-${i + 2}/` : null,
  }));
}

function enrichir(fiche) {
  const categorie = categorieParSlug(fiche.categorie);
  return {
    ...fiche,
    url: urlFiche(fiche),
    categorie_nom: categorie?.nom || fiche.categorie,
    categorie_emoji: categorie?.emoji || "•",
    indexable: !fiche.exemple && fiche.statut === ETATS.PUBLIEE,
  };
}

export default function () {
  const toutes = lireFiches().map(enrichir);
  const publiees = toutes.filter((f) => f.statut === ETATS.PUBLIEE);
  const retirees = toutes.filter((f) => f.statut === ETATS.RETIREE);

  // --- Catégories.
  //     Une catégorie est publiée dès qu'elle a hébergé au moins une fiche,
  //     même si toutes ont été retirées depuis : sa page reste la cible des
  //     redirections 301 émises pour ces fiches. Une catégorie vidée est
  //     conservée mais passée en noindex plutôt que supprimée — supprimer la
  //     cible d'une 301 la transformerait en 404, ce qui gâche l'autorité
  //     transmise et dégrade l'expérience.
  const categories = taxonomie
    .map((c) => {
      const fiches = publiees.filter((f) => f.categorie === c.slug);
      const anciennes = retirees.filter((f) => f.categorie === c.slug);
      const villes = [...new Set(fiches.map((f) => f.ville_slug))];
      return {
        ...c,
        fiches,
        nombre: fiches.length,
        villes,
        vide: fiches.length === 0,
        historique: fiches.length + anciennes.length,
      };
    })
    .filter((c) => c.historique > 0);

  // --- Villes
  const parVille = new Map();
  for (const f of publiees) {
    if (!parVille.has(f.ville_slug)) {
      parVille.set(f.ville_slug, {
        slug: f.ville_slug,
        nom: f.ville,
        code_postal: f.adresse?.code_postal || "",
        departement: f.adresse?.departement || "",
        fiches: [],
      });
    }
    parVille.get(f.ville_slug).fiches.push(f);
  }
  const villes = [...parVille.values()]
    .map((v) => ({
      ...v,
      nombre: v.fiches.length,
      categories: [...new Set(v.fiches.map((f) => f.categorie))],
    }))
    .sort((a, b) => b.nombre - a.nombre || a.nom.localeCompare(b.nom, "fr"));

  // --- Couples catégorie × ville : les pages les plus recherchées
  //     (« boulangerie à Nevers »). Générées à partir de 1 fiche : elles
  //     servent aussi de cible de redirection 301 quand une fiche est retirée.
  const couples = [];
  for (const c of categories) {
    for (const villeSlug of c.villes) {
      const fiches = c.fiches.filter((f) => f.ville_slug === villeSlug);
      const ville = parVille.get(villeSlug);
      couples.push({
        categorie: c,
        ville: { slug: ville.slug, nom: ville.nom, code_postal: ville.code_postal },
        fiches,
        nombre: fiches.length,
        url: `/${c.slug}/${villeSlug}/`,
      });
    }
  }

  // --- Nouveautés : les dernières fiches publiées, tous secteurs confondus
  const nouveautes = [...publiees]
    .sort((a, b) => (b.dates?.publication || "").localeCompare(a.dates?.publication || ""))
    .slice(0, 60);

  // --- Pages paginées prêtes à consommer par les gabarits
  const pagesCategorie = categories.flatMap((c) =>
    paginer(c.fiches, `/${c.slug}/`, { categorie: c })
  );
  const pagesVille = villes.flatMap((v) =>
    paginer(v.fiches, `/villes/${v.slug}/`, { ville: v })
  );
  const pagesCouple = couples.flatMap((c) =>
    paginer(c.fiches, c.url, { categorie: c.categorie, ville: c.ville })
  );

  // Nouveautés groupées par date de publication (Nunjucks ne sait pas
  // conserver un accumulateur d'une itération à l'autre : on groupe ici).
  const nouveautesParJour = [];
  for (const f of nouveautes) {
    const jour = f.dates?.publication || "";
    const dernier = nouveautesParJour[nouveautesParJour.length - 1];
    if (dernier && dernier.date === jour) dernier.fiches.push(f);
    else nouveautesParJour.push({ date: jour, fiches: [f] });
  }

  const journal = lireJournal();

  return {
    fiches: publiees,
    toutes,
    retirees,
    categories,
    villes,
    couples,
    pagesCategorie,
    pagesVille,
    pagesCouple,
    nouveautes,
    nouveautesParJour,
    journal,
    stats: {
      fiches: publiees.length,
      retirees: retirees.length,
      categories: categories.length,
      villes: villes.length,
      avecBacklink: publiees.filter((f) => f.backlink?.etat === "present").length,
      enAttente: publiees.filter((f) => !f.backlink?.premiere_detection).length,
      derniereMaj: publiees.reduce((m, f) => ((f.dates?.maj || "") > m ? f.dates.maj : m), ""),
    },
  };
}

/**
 * Fichier de clé IndexNow.
 *
 * IndexNow exige qu'une clé soit accessible à la racine du site pour
 * authentifier les soumissions. La clé n'est pas un secret (elle est
 * publiée), mais elle n'existe qu'en environnement configuré : sans la
 * variable INDEXNOW_KEY, aucun fichier n'est produit.
 *
 * Écrit en gabarit JavaScript plutôt qu'en Nunjucks car seul ce format
 * permet un « permalink » booléen conditionnel.
 */
export default class {
  data() {
    const cle = process.env.INDEXNOW_KEY || "";
    return {
      permalink: cle ? `/${cle}.txt` : false,
      eleventyExcludeFromCollections: true,
    };
  }

  render() {
    return process.env.INDEXNOW_KEY || "";
  }
}

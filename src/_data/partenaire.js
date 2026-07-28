// Informations sur le partenaire ALLO FRELONS (liens, coordonnées, carte).
// -> Les coordonnées NAP locales (par département) se renseignent dans le
//    fichier `napLocales.json` de ce même dossier, éditable directement depuis
//    l'interface web de GitHub, sans toucher au code. Utilisez les valeurs
//    EXACTES de la fiche d'établissement Google (cohérence indispensable au
//    SEO local) ; un champ vide n'est pas affiché.
const napLocales = require("./napLocales.json");
const nap59 = napLocales["59"];
const nap62 = napLocales["62"];

module.exports = {
  nom: "ALLO FRELONS",
  entite59: "ALLO FRELONS 59",
  site: "https://allo-frelons.fr",

  // Liens thématiques fournis
  liens: {
    frelonEuropeen: "https://allo-frelons.fr/frelons-europeens",
    guepePoliste: "https://allo-frelons.fr/guepe-poliste",
    xylocope: "https://allo-frelons.fr/abeille-charpentiere",
    nuisibles59: "https://allo-frelons.fr/entreprise-anti-nuisibles-nord-59",
    nids62: "https://allo-frelons.fr/nids-de-guepes-et-frelons-dans-le-pas-de-calais-62",
  },

  // CTA SMS (numéro unique pour toute la zone d'intervention)
  sms: {
    numero: "06 75 36 24 05",
    lien: "sms:+33675362405",
    telLien: "tel:+33675362405",
  },

  // NAP (Name / Address / Phone) locales, par département.
  // Chaque entrée référence la page locale correspondante d'allo-frelons.fr.
  naps: {
    "59": {
      ...nap59,
      departement: "Nord (59)",
      lienLocal: "https://allo-frelons.fr/entreprise-anti-nuisibles-nord-59",
      lienLocalTexte: "Entreprise anti-nuisibles dans le Nord (59)",
    },
    "62": {
      ...nap62,
      departement: "Pas-de-Calais (62)",
      lienLocal: "https://allo-frelons.fr/nids-de-guepes-et-frelons-dans-le-pas-de-calais-62",
      lienLocalTexte: "Nids de guêpes et frelons dans le Pas-de-Calais (62)",
    },
  },

  // Alias historique : NAP principale (59), utilisée par le bloc contact EEE.
  nap: nap59,
  // Coordonnées géographiques (extraites de l'intégration Google Maps)
  geo: { latitude: 50.62428637162589, longitude: 3.032163475707874 },

  // Carte Google — URL du bloc « Intégrer une carte » de la fiche d'établissement.
  carteEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2531.1523611237526!2d3.032163475707874!3d50.62428637162589!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c2d50067686133%3A0xcd01b4fe43315fdb!2sALLO%20FRELONS%2059!5e0!3m2!1sfr!2sfr!4v1785057903092!5m2!1sfr!2sfr",
  carteLien: "https://maps.app.goo.gl/9jcx3ybpfosL1rrQ9",
};

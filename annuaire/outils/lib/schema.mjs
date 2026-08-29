/**
 * Données structurées schema.org.
 *
 * Choix assumé : PAS de « aggregateRating ».
 * La note affichée sur les pages provient de Google. Les règles de Google sur
 * les extraits enrichis interdisent à un site de baliser en aggregateRating des
 * avis collectés sur une autre plateforme à propos d'une entité tierce — le
 * faire expose à une action manuelle « avis frauduleux ». La note reste donc
 * visible pour l'internaute, avec sa source et sa date, mais n'est pas balisée.
 */

import { site } from "./site.mjs";

const JOURS_SCHEMA = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** Type schema.org le plus précis disponible pour une catégorie du site. */
const TYPES = {
  restaurants: "Restaurant",
  "boulangeries-patisseries": "Bakery",
  "cafes-bars": "CafeOrCoffeeShop",
  hebergement: "LodgingBusiness",
  "coiffure-beaute": "HealthAndBeautyBusiness",
  "sante-bien-etre": "HealthAndBeautyBusiness",
  "medecins-dentistes": "MedicalBusiness",
  "pharmacies-opticiens": "Pharmacy",
  "veterinaires-animaux": "VeterinaryCare",
  "plomberie-chauffage": "Plumber",
  electricite: "Electrician",
  "maconnerie-renovation": "GeneralContractor",
  "menuiserie-serrurerie": "HomeAndConstructionBusiness",
  "jardinage-paysage": "HomeAndConstructionBusiness",
  "nettoyage-hygiene": "ProfessionalService",
  "garages-automobile": "AutoRepair",
  "deux-roues-cycles": "BikeStore",
  "transport-demenagement": "MovingCompany",
  immobilier: "RealEstateAgent",
  "assurance-banque-finance": "InsuranceAgency",
  "avocats-notaires-juridique": "Attorney",
  "comptabilite-conseil": "AccountingService",
  "commerces-alimentation": "Store",
  "mode-equipement-maison": "Store",
  "loisirs-sport-culture": "LocalBusiness",
  "services-aux-particuliers": "ProfessionalService",
};

/** Fiche entreprise → LocalBusiness. */
export function schemaFiche(fiche) {
  const url = site.base + fiche.url;
  const noeud = {
    "@context": "https://schema.org",
    "@type": TYPES[fiche.categorie] || "LocalBusiness",
    "@id": url + "#entreprise",
    name: fiche.nom,
    url,
    description: fiche.redaction?.meta_description || "",
  };

  if (fiche.adresse?.complete) {
    noeud.address = {
      "@type": "PostalAddress",
      streetAddress: fiche.adresse.rue || undefined,
      postalCode: fiche.adresse.code_postal || undefined,
      addressLocality: fiche.ville,
      addressRegion: fiche.adresse.region || undefined,
      addressCountry: "FR",
    };
  }
  if (fiche.geo?.latitude) {
    noeud.geo = {
      "@type": "GeoCoordinates",
      latitude: fiche.geo.latitude,
      longitude: fiche.geo.longitude,
    };
  }
  if (fiche.telephone) noeud.telephone = fiche.telephone;
  if (fiche.lien_google) noeud.sameAs = [fiche.lien_google];
  if (fiche.ville) noeud.areaServed = { "@type": "City", name: fiche.ville };

  const horaires = (fiche.horaires || [])
    .filter((j) => !j.ferme && j.creneaux?.length)
    .flatMap((j) =>
      j.creneaux.map(([ouvre, ferme]) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${JOURS_SCHEMA[j.jour]}`,
        opens: ouvre,
        closes: ferme,
      }))
    );
  if (horaires.length) noeud.openingHoursSpecification = horaires;

  return noeud;
}

/** Fil d'Ariane → BreadcrumbList (« ariane » = [{titre, url}]). */
export function schemaFil(ariane) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ titre: "Accueil", url: "/" }, ...(ariane || [])].map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.titre,
      item: site.base + e.url,
    })),
  };
}

/** Questions/réponses → FAQPage. */
export function schemaFaq(faq) {
  if (!faq?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((q) => ({
      "@type": "Question",
      name: q.q,
      acceptedAnswer: { "@type": "Answer", text: q.r },
    })),
  };
}

/** Page de liste (catégorie, ville, couple) → CollectionPage + ItemList. */
export function schemaListe({ url, titre, description, fiches }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": site.base + url,
    name: titre,
    description,
    isPartOf: { "@type": "WebSite", name: site.nomCourt, url: site.base },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: fiches.length,
      itemListElement: fiches.slice(0, 100).map((f, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: f.nom,
        url: site.base + f.url,
      })),
    },
  };
}

/** Page d'accueil → WebSite (+ action de recherche interne). */
export function schemaSite() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": site.base + "/#site",
    name: site.nom,
    alternateName: site.nomCourt,
    url: site.base,
    description: site.description,
    inLanguage: "fr-FR",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.base}/recherche/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

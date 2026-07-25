# Observatoire de la biodiversité du Nord et du Pas-de-Calais

Site encyclopédique — « une sorte de Wikipédia de la biodiversité » — dédié à la faune, à la
flore et aux milieux naturels des départements du **Nord (59)** et du **Pas-de-Calais (62)**.

Le site est un **site statique** (aucune base de données, aucun langage serveur) généré avec
[Eleventy](https://www.11ty.dev/). Il est donc rapide, robuste, économe et se déploie sur
n'importe quel hébergement mutualisé — notamment **o2switch**, où le domaine
`observatoire-biodiversite-npdc.fr` est hébergé.

---

## Aperçu

- **Design institutionnel** sobre (palette forêt / littoral, typographie encyclopédique).
- **Fiches espèces** type encyclopédie, avec infobox « fiche d'identité », statut de conservation
  UICN et mesures de protection.
- **Fiches milieux** (dunes, marais, terrils, forêts, estuaires) reliées à leurs espèces.
- **Dossiers** thématiques.
- **Recherche** instantanée côté client (aucun serveur requis).
- **Responsive**, accessible, optimisé pour le référencement (SEO : balises, sitemap, Open Graph,
  données structurées, flux de syndication).

## Prérequis

- [Node.js](https://nodejs.org/) version 18 ou supérieure (testé avec Node 22).

## Installation et développement

```bash
npm install        # installe les dépendances (une seule fois)
npm start          # lance un serveur local avec rechargement automatique
```

Le site est alors accessible sur <http://localhost:8080>.

## Compilation pour la mise en ligne

```bash
npm run build
```

Le site compilé est écrit dans le dossier **`_site/`**. C'est **le contenu de ce dossier** qui
doit être mis en ligne (voir [DEPLOIEMENT-O2SWITCH.md](./DEPLOIEMENT-O2SWITCH.md)).

## Structure du projet

```
src/
├── _data/            Données globales (site, navigation, statuts UICN)
├── _includes/
│   ├── layouts/      Gabarits : base, page, espèce, milieu, dossier
│   └── partials/     Morceaux réutilisables (en-tête, pied, cartes)
├── assets/
│   ├── css/          Feuille de style (design institutionnel)
│   ├── js/           Menu mobile, filtres, recherche
│   └── img/          Logo et favicon (SVG)
├── especes/          ← une fiche espèce = un fichier .md (le cœur « Wikipédia »)
├── habitats/         ← une fiche milieu = un fichier .md
├── dossiers/         ← un dossier thématique = un fichier .md
├── static/           Fichiers copiés tels quels (.htaccess, robots.txt)
└── *.njk / *.md      Pages (accueil, faune, flore, recherche, mentions légales…)
```

## Ajouter une fiche espèce

Créez un nouveau fichier `.md` dans `src/especes/`. Exemple minimal :

```markdown
---
nom_commun: "Nom courant de l'espèce"
nom_scientifique: "Genre espece"
regne: "Animalia"        # Animalia (faune) ou Plantae (flore)
classe: "Oiseaux"
famille: "Nom de la famille"
categorie: "Oiseaux"     # sert au regroupement dans les listes
taille: "20 à 25 cm"
periode: "Mars à septembre"
statut_national: "LC"    # code UICN : RE, CR, EN, VU, NT, LC, DD…
statut_regional: "NT"
protections:
  - "Protection nationale"
departements:
  - "Nord"
  - "Pas-de-Calais"
theme: "zone-humide"     # nature, littoral, zone-humide, foret, terril, bocage, ciel
embleme: "🐦"            # emoji d'illustration (à défaut d'une photo)
image: "/assets/img/mon-espece.jpg"   # facultatif : chemin d'une vraie photo
chapo: "Phrase d'accroche présentant l'espèce."
date: 2026-07-25
sources:
  - "Référence documentaire."
---

## Description
Texte…

## Habitat et répartition régionale
Texte…
```

La fiche apparaît alors **automatiquement** dans les listes (Espèces, Faune ou Flore selon le
`regne`), dans la recherche, le plan du site et le sitemap. Le principe est identique pour les
milieux (`src/habitats/`) et les dossiers (`src/dossiers/`).

### Ajouter les photos des espèces

Deux possibilités :

- **Automatique** : `npm run photos` télécharge une photo sous licence libre depuis Wikimedia
  Commons pour chaque fiche et renseigne l'image et son crédit (voir
  [`outils/README.md`](./outils/README.md)). Nécessite un accès Internet.
- **Manuelle** : déposez une image dans `src/assets/img/especes/` puis renseignez les champs
  `image:`, `image_alt:`, `credit:` et `credit_url:` de la fiche.

En l'absence de photo, un visuel illustré (pictogramme) est utilisé. Les crédits des photos
apparaissent sur chaque fiche et sur la page **/credits/**.

## Déploiement

Voir le guide détaillé : **[DEPLOIEMENT-O2SWITCH.md](./DEPLOIEMENT-O2SWITCH.md)**.
Deux méthodes : mise en ligne manuelle par FTP, ou déploiement automatique via GitHub Actions.

## Licence

Code sous licence MIT. Les contenus rédactionnels sont diffusés à des fins pédagogiques et
d'information ; voir la page « Mentions légales » du site.

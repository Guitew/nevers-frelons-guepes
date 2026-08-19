# Vitrine Locale — l'annuaire des entreprises sans site web

Annuaire nouvelle génération qui consacre **une page complète à chaque entreprise locale dont la
fiche Google Business Profile ne déclare aucun site internet**. Site **statique** (Eleventy), donc
rapide, robuste, sans base de données et déployable sur n'importe quel hébergement mutualisé.

Ce dossier est un **projet autonome**, indépendant du site racine du dépôt : ses dépendances, sa
compilation et son déploiement lui sont propres.

---

## Le principe

```
   Collecte quotidienne          Publication              Contrepartie
   ────────────────────          ───────────              ────────────
   20 fiches GMB sans   ──▶   1 page SEO par     ──▶   l'entreprise déclare
   site web déclaré           entreprise                cette URL comme site
                                                        web sur sa fiche GMB
                                     │                          │
                                     ▼                          ▼
                            Soumission aux           Vérification du backlink
                            moteurs (IndexNow)       (quotidienne, via l'API)
                                                                │
                                        ┌───────────────────────┴───────────┐
                                        ▼                                   ▼
                                lien présent                        lien disparu
                                page maintenue              301 vers la catégorie
                                                            ou 410 Gone (définitif)
```

Le tableau de bord de suivi est publié sur une **URL privée non indexable**, protégée par
authentification HTTP.

## Démarrage

```bash
cd annuaire
npm install
npm start          # http://localhost:8080
```

Le dépôt contient **14 fiches de démonstration** (entreprises fictives de la Nièvre) pour que le
site soit visible immédiatement. Elles portent le drapeau `exemple: true` : bandeau d'avertissement,
`noindex`, exclusion du sitemap et de l'indexation. Supprimez-les avec `rm -rf donnees/fiches/*`
avant la mise en service réelle.

## Le cycle quotidien

| Commande | Rôle |
|---|---|
| `npm run collecte` | repère `fichesParJour` entreprises sans site web et rédige leur page |
| `npm run backlinks` | relit les fiches Google et met à jour l'état du lien |
| `npm run retraits` | applique les 301 / 410 (option `--essai` pour simuler) |
| `npm run build` | régénère le site **et le `.htaccess`** (redirections comprises) |
| `npm run indexation` | soumet les URLs modifiées à IndexNow |
| `npm test` | tests des règles métier (cycle de vie, classification, rédaction, balisage) |
| `npm run verifier` | contrôle le site compilé (liens, titres, canoniques, sitemaps, règles 301/410) |
| `npm run etat` | résumé console de l'état de l'annuaire |
| `npm run quotidien` | enchaîne collecte + backlinks + retraits |

En production, le workflow [`annuaire-quotidien.yml`](../.github/workflows/annuaire-quotidien.yml)
exécute ce cycle chaque matin et committe le résultat ; le push déclenche la compilation et le
déploiement.

**Les fiches sont versionnées dans Git.** Chaque publication, perte de lien ou retrait se lit en
diff : c'est la mémoire de l'annuaire, et le moyen de revenir en arrière sur une décision.

## Contrôle avant mise en ligne

```bash
npm run controle       # tests + compilation + vérification
```

Deux barrières complémentaires, toutes deux exécutées en intégration continue sur chaque
proposition de modification ([`annuaire-controle.yml`](../.github/workflows/annuaire-controle.yml))
et avant chaque déploiement.

**`npm test`** — 37 tests sans dépendance (`node --test`) sur les règles qui engagent le site :
décision de retrait 301/410, délai de grâce, purge des règles, republication, classification des
catégories, lecture des horaires Google et CSV, comparaison des backlinks, déterminisme de la
rédaction, absence de fait inventé, et absence d'`aggregateRating` dans le balisage.

**`npm run verifier`** — inspecte le **résultat** de la compilation, pas le code : liens internes
morts, `<title>` dupliqués, canoniques incohérentes, fichiers indispensables manquants, fils
d'Ariane identiques d'une fiche à l'autre, cohérence de l'index de sitemaps (fichiers présents,
URLs compilées et indexables) et cohérence entre les fiches retirées et les règles du `.htaccess`.
Sur un site généré, une erreur de gabarit se duplique sur des milliers de pages : ce contrôle est
la seule barrière qui la voie.

## Configuration

### `config.json` — les règles métier

| Clé | Effet |
|---|---|
| `collecte.fournisseur` | `google-places` (API officielle) ou `csv` (import manuel) |
| `collecte.fichesParJour` | quota quotidien (20 par défaut) |
| `collecte.zones` | points et rayons de recherche |
| `collecte.categoriesCiblees` | restreint la collecte à certaines catégories (vide = toutes) |
| `backlinks.delaiDeGraceJours` | délai avant retrait d'une fiche jamais liée (45 j) |
| `backlinks.echecsAvantRetrait` | vérifications négatives consécutives avant retrait (2) |
| `backlinks.modeRetraitParDefaut` | `301` — lien perdu, l'entreprise existe toujours |
| `backlinks.modeRetraitSiJamaisLie` | `410` — lien jamais posé après le délai de grâce |
| `backlinks.joursConservation410` | durée de vie d'une règle 410 avant purge (180 j) |
| `backlinks.joursConservation301` | durée de vie d'une règle 301 avant purge (365 j) |

### `donnees/site.json` — l'identité du site

Nom, domaine, adresse de contact, chemin de la zone privée (`cheminPrive`). **À renseigner avant
la mise en ligne** : le domaine sert aux URL canoniques, au sitemap et à la comparaison des
backlinks.

### `donnees/categories.json` — la taxonomie

26 catégories, chacune reliée aux types de l'API Places (`gmb`) et à des mots-clés de repêchage.
Une fiche non rattachable n'est **pas** publiée : mieux vaut une catégorie manquante qu'une page
mal classée.

### Variables d'environnement (jamais committées)

Voir [`.env.exemple`](./.env.exemple) : `GOOGLE_PLACES_API_KEY`, `INDEXNOW_KEY`,
`CHEMIN_HTPASSWD`, `GOOGLE_INDEXING_SERVICE_ACCOUNT`.

## Sources de données

| Fournisseur | Usage |
|---|---|
| `google-places` | **API Google Places (New)**, voie officielle. Le masque de champs demande `websiteUri`, ce qui permet de ne retenir que les fiches sans site. Seule cette voie permet de re-vérifier un backlink. |
| `csv` | import manuel (`donnees/import.csv`), sans clé d'API. Utile pour démarrer, tester ou reprendre une fiche à la main. Format documenté dans [`outils/lib/fournisseurs/csv.mjs`](./outils/lib/fournisseurs/csv.mjs). |

Ajouter un fournisseur tiers revient à déposer dans `outils/lib/fournisseurs/` un module exposant
`rechercher`, `detailler` et `normaliser`, puis à le déclarer dans `index.mjs`.

> **Point de vigilance contractuel.** Les conditions de l'API Places limitent la conservation des
> données (30 jours, hors identifiant de lieu). Les champs volatils — note, nombre d'avis, horaires —
> sont donc datés sur chaque page et rafraîchis par `npm run backlinks`. Le grattage des pages Maps
> n'est volontairement pas implémenté : il est fragile et contraire aux conditions d'utilisation.

## Ce qui rend les pages exploitables par les moteurs et les LLM

- **HTML statique**, sans rendu côté client : le contenu est dans la réponse.
- **Données structurées** : `LocalBusiness` (typé par catégorie), `BreadcrumbList`, `FAQPage`,
  `CollectionPage` sur les listes, `WebSite` sur l'accueil.
- **Miroir Markdown** de chaque fiche : ajoutez `index.md` à son adresse.
- **[`/llms.txt`](./src/llms.njk)** décrivant le site, ses conventions d'URL et ses catégories.
- **`robots.txt`** autorisant explicitement GPTBot, ClaudeBot, PerplexityBot, Google-Extended…
- **Maillage interne** : fiche ↔ catégorie ↔ catégorie×commune ↔ commune, plus un bloc « à proximité ».
- **Sitemap** et **flux Atom** régénérés à chaque compilation, `lastmod` sincères.
- Aucun cookie, aucun traceur, aucun bandeau de consentement.

### Pourquoi la note Google n'est pas balisée en `aggregateRating`

Les règles de Google interdisent à un site de baliser en `aggregateRating` des avis collectés
ailleurs à propos d'une entité tierce ; le faire expose à une action manuelle « avis frauduleux ».
La note reste **affichée**, avec sa source et sa date, mais n'est pas balisée. Ce choix est
volontaire et documenté dans [`outils/lib/schema.mjs`](./outils/lib/schema.mjs).

### Sur la qualité du contenu généré

Le générateur ([`outils/lib/redaction.mjs`](./outils/lib/redaction.mjs)) suit deux règles strictes :

1. **aucun fait inventé** — une donnée absente de la fiche Google ne produit pas de phrase ;
2. **variation déterministe** — le texte est tiré de variantes indexées sur l'identifiant du lieu :
   stable d'une compilation à l'autre, mais différent d'une fiche à l'autre.

Le texte est écrit **dans le fichier de la fiche au moment de la collecte**, jamais recalculé au
build : il est donc relisible et modifiable à la main, fiche par fiche, sans être écrasé. C'est le
levier principal pour enrichir les fiches à forte valeur.

## Zone privée de pilotage

Le tableau de bord des backlinks est publié à l'adresse définie par `site.cheminPrive`
(`/pilotage/` par défaut). Il affiche les compteurs, le taux de pose du lien, les fiches en fin de
délai de grâce, le tableau filtrable de toutes les fiches et le journal des événements — avec
export CSV et copie des URLs.

Protection, par ordre d'efficacité :

1. **authentification HTTP** (`AuthUserFile` renseigné par `CHEMIN_HTPASSWD`) : un robot reçoit un
   401 et n'indexe rien ;
2. en-tête `X-Robots-Tag: noindex, nofollow` ;
3. `<meta name="robots" content="noindex">` ;
4. absence du sitemap **et de `robots.txt`** — y interdire ce chemin reviendrait à en publier
   l'adresse.

Créer le fichier de mots de passe sur le serveur :

```bash
htpasswd -c ~/.htpasswd-pilotage pilote
```

puis renseigner son chemin absolu dans le secret `CHEMIN_HTPASSWD`.

## Tenue à l'échelle

Le projet a été éprouvé sur un jeu synthétique de **3 000 fiches** (cinq mois de collecte à
20 par jour), qui a servi à dimensionner trois choix :

| Point mesuré | Résultat |
|---|---|
| Compilation complète | 26 s pour 6 400 fichiers |
| Tableau de bord | rendu par tranches de 100 lignes depuis un JSON compact — 28 Ko de HTML au lieu de 3,1 Mo |
| Index de recherche | 470 Ko bruts, **31 Ko compressés** : chargé une fois, sur la seule page de recherche |
| Sitemaps | un index + un fichier par catégorie, pour suivre l'indexation catégorie par catégorie dans la Search Console |
| Règles `.htaccess` | purgées à expiration (voir ci-dessous) — Apache évalue chaque `RedirectMatch` à chaque requête |

La compression (`mod_deflate`) est configurée dans le `.htaccess` généré et couvre HTML, CSS, JS,
JSON, XML et Markdown : c'est elle qui rend acceptables l'index de recherche et les sitemaps.

## Retraits : 301 ou 410 ?

| Situation | Code | Raison |
|---|---|---|
| Le backlink a disparu, l'entreprise existe toujours | **301** vers la catégorie | l'autorité acquise par l'URL est transmise, l'internaute atterrit sur une liste utile |
| L'entreprise a déclaré son propre site | **301** vers la catégorie | notre page n'a plus d'objet, mais l'URL a de la valeur |
| Fiche Google introuvable (fermeture, suppression) | **410** | rien à transmettre, désindexation la plus rapide |
| Retrait demandé par le dirigeant | **410** | le retrait doit être définitif et explicite |
| Lien jamais posé après le délai de grâce | **410** | la page n'a jamais été reconnue par l'entreprise |

Les règles sont écrites dans le `.htaccess` **à chaque compilation**, à partir de l'état des
fiches. Une fiche republiée voit sa règle disparaître automatiquement.

**Les règles ont une durée de vie.** Une redirection n'a pas vocation à être évaluée éternellement
à chaque requête. Passé `joursConservation410` (180 j) ou `joursConservation301` (365 j — la durée
au-delà de laquelle Google considère une redirection comme assimilée), la fiche passe à l'état
`archivee` : la règle disparaît du `.htaccess`, l'URL retombe en 404 naturel, et la fiche reste sur
le disque pour mémoire. Sans ce mécanisme, un annuaire publiant 20 fiches par jour accumulerait
des milliers de règles. Une catégorie vidée de
toutes ses fiches **n'est pas supprimée** : elle reste en ligne, en `noindex`, pour ne pas
transformer les 301 qui la visent en 404.

Retrait manuel immédiat :

```bash
node outils/retraits.mjs --fiche=/categorie/commune/entreprise/ --mode=410 --motif="demande du dirigeant"
```

## Structure

```
annuaire/
├── config.json              règles métier (quotas, zones, politique de retrait)
├── donnees/
│   ├── site.json            identité du site
│   ├── categories.json      26 catégories ↔ types GMB
│   ├── fiches/<ville>/*.json  une fiche = un fichier (source de vérité)
│   ├── journal.json         historique des événements
│   └── import.exemple.csv   modèle d'import manuel
├── outils/
│   ├── collecte.mjs · backlinks.mjs · retraits.mjs · indexation.mjs
│   ├── etat.mjs · verifier.mjs
│   ├── lib/                 briques partagées outils ↔ Eleventy
│   │   ├── fournisseurs/    google-places.mjs, csv.mjs
│   │   ├── redaction.mjs    génération éditoriale
│   │   ├── politique.mjs    règles de retrait / archivage / republication
│   │   ├── schema.mjs       données structurées
│   │   └── pilotage.mjs     agrégats du tableau de bord
│   └── tests/               tests des règles métier (node --test)
└── src/
    ├── _data/               site, annuaire (fiches → pages), nav, env
    ├── _includes/           gabarits et partials
    ├── fiche.njk            page entreprise    → /categorie/commune/entreprise/
    ├── fiche-md.njk         miroir Markdown    → …/index.md
    ├── categorie.njk        page catégorie     → /categorie/
    ├── categorie-ville.njk  activité × commune → /categorie/commune/
    ├── ville.njk            page commune       → /villes/commune/
    ├── sitemap.njk          index de sitemaps (+ un fichier par catégorie)
    ├── htaccess.njk         .htaccess généré (301 / 410 compris)
    └── prive/               tableau de bord + protection Apache
```

## Déploiement

Voir [DEPLOIEMENT.md](./DEPLOIEMENT.md).

## Avant la mise en service

- [ ] renseigner `donnees/site.json` (nom, domaine, courriel) ;
- [ ] compléter l'éditeur et l'hébergeur dans `src/mentions-legales.md` ;
- [ ] définir les zones de collecte dans `config.json` ;
- [ ] créer la clé Google Places et le secret `GOOGLE_PLACES_API_KEY` ;
- [ ] générer une clé IndexNow (32 caractères hexadécimaux) et le secret `INDEXNOW_KEY` ;
- [ ] créer le `.htpasswd` de la zone privée et le secret `CHEMIN_HTPASSWD` ;
- [ ] vider `donnees/fiches/` des fiches de démonstration ;
- [ ] déclarer le site dans la Search Console et y coller le code de vérification
      (`site.json` → `verifGoogle`).

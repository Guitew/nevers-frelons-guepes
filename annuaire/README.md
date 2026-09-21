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
| `npm run search-console` | met en place l'accès Search Console (vérification, propriété, copropriétaires) |
| `npm run audience` | relève clics et impressions Search Console par page (ignoré sans compte de service) |
| `npm run couverture` | inspecte l'indexation des pages assez âgées (API d'inspection d'URL) |
| `npm run retraits` | applique les 301 / 410 (option `--essai` pour simuler) |
| `npm run build` | régénère le site **et le `.htaccess`** (redirections comprises) |
| `npm run indexation` | soumet les URLs modifiées à IndexNow |
| `npm test` | tests des règles métier (cycle de vie, classification, rédaction, balisage) |
| `npm run verifier` | contrôle le site compilé (liens, titres, canoniques, sitemaps, règles 301/410) |
| `npm run etat` | résumé console de l'état de l'annuaire |
| `npm run quotidien` | enchaîne collecte + backlinks + retraits |

En production, le workflow [`annuaire-quotidien.yml`](../.github/workflows/annuaire-quotidien.yml)
exécute ce cycle chaque matin, committe le résultat puis **déclenche explicitement** le workflow de
déploiement (`workflow_dispatch`). Ce déclenchement explicite est indispensable : un push effectué
avec le `GITHUB_TOKEN` d'un workflow ne déclenche jamais les workflows `on: push` (règle GitHub
anti-boucle). Sans lui, les fiches collectées restaient dans Git sans jamais être mises en ligne, et
leurs URLs répondaient 404.

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
| `collecte.fichesParJour` | quota quotidien (5 par défaut) |
| `collecte.mode` | `national` (un maillage par département, voir ci-dessous) ou `local` (zones de `collecte.zones`) |
| `collecte.rayonNational` | rayon exploré autour de chaque chef-lieu en mode national (15 km) |
| `collecte.mailleNationaleMetres` | rayon d'une cellule d'exploration nationale (2 500 m) |
| `collecte.cellulesParDepartement` | cellules interrogées par département et par jour (1) |
| `collecte.zones` | points et rayons de recherche |
| `collecte.mailleMetres` | rayon d'une cellule d'exploration (800 m) — voir ci-dessous |
| `collecte.appelsMaxParJour` | plafond d'appels à l'API par exécution (60) |
| `collecte.categoriesCiblees` | restreint la collecte à certaines catégories (vide = toutes) |
| `backlinks.delaiDeGraceJours` | délai avant retrait d'une fiche jamais liée (45 j) |
| `backlinks.echecsAvantRetrait` | vérifications négatives consécutives avant retrait (2) |
| `backlinks.modeRetraitParDefaut` | `301` — lien perdu, l'entreprise existe toujours |
| `backlinks.modeRetraitSiJamaisLie` | `410` — lien jamais posé après le délai de grâce |
| `backlinks.joursConservation410` | durée de vie d'une règle 410 avant purge (180 j) |
| `backlinks.joursConservation301` | durée de vie d'une règle 301 avant purge (365 j) |
| `audience.fenetreJours` | fenêtre du relevé Search Console (90 j) |
| `audience.clicsProtection` | à partir de ce nombre de clics sur la fenêtre, la page n'est jamais retirée automatiquement (1) |
| `audience.impressionsProlongation` | à partir de ce nombre d'impressions, le délai de grâce est prolongé (100) |
| `audience.prolongationJours` | durée de cette prolongation (45 j) |
| `audience.fraicheurJours` | au-delà, un relevé d'audience ne compte plus (7 j) |
| `couverture.retraitSiNonIndexeeJours` | âge à partir duquel une page non indexée est retirée (45 j) |
| `couverture.ageMinimumInspectionJours` | on n'inspecte pas une page plus jeune (38 j) |
| `couverture.inspectionsParJour` | inspections d'URL par jour, sous le quota Google de 2 000 (200) |
| `couverture.fraicheurJours` | au-delà, un verdict d'indexation ne fonde plus un retrait (7 j) |

### `donnees/site.json` — l'identité et l'adresse du site

```json
"url":    "https://andpro.fr",      ← le domaine
"chemin": "/vitrine-locale",        ← le sous-dossier ; "" pour la racine
```

Le site est publié dans un **sous-dossier** : `https://andpro.fr/vitrine-locale/`. Ces deux clés
gouvernent tout — liens internes, URL canoniques, données structurées, sitemaps, règles du
`.htaccess` et comparaison des backlinks. Les changer suffit à déménager le site ; rien d'autre
n'est à toucher.

Une conséquence à connaître : un `robots.txt` déposé dans un sous-dossier **n'est pas lu** par les
robots. Le fichier produit sert de source à recopier dans `andpro.fr/robots.txt` — voir
[DEPLOIEMENT.md](./DEPLOIEMENT.md).

### `donnees/categories.json` — la taxonomie

26 catégories, chacune reliée aux types de l'API Places (`gmb`) et à des mots-clés de repêchage.
Une fiche non rattachable n'est **pas** publiée : mieux vaut une catégorie manquante qu'une page
mal classée.

Une catégorie peut déclarer des `alias` : d'anciennes ou fausses orthographes de son slug
(`loisirs-sports` pour `loisirs-sport-culture`), rencontrées dans des URLs recopiées à la main sur
Google Maps. Chaque alias produit une règle 301 dans le `.htaccess` vers le slug réel, sous-chemin
conservé. En complément, la page 404 cherche l'identifiant d'entreprise de l'adresse demandée dans
l'index de recherche et redirige vers la fiche quand elle est unique.

### Variables d'environnement (jamais committées)

Voir [`.env.exemple`](./.env.exemple) : `GOOGLE_PLACES_API_KEY`, `INDEXNOW_KEY`,
`CHEMIN_HTPASSWD`, `GOOGLE_INDEXING_SERVICE_ACCOUNT`.

## Comment la collecte explore le territoire

`places:searchNearby` plafonne à **20 résultats par appel**, classés par popularité, sans
pagination. Interrogée chaque jour sur la même zone de 12 km, l'API renverrait donc éternellement
les mêmes 20 établissements : la collecte se tarirait au bout de quelques jours alors que la zone
serait loin d'être épuisée.

Chaque zone est donc découpée en **cellules de 800 m de rayon**, en quinconce et se recouvrant
légèrement pour ne laisser aucun angle mort — soit environ 350 cellules pour une zone de 12 km.
Elles sont parcourues **du centre vers la périphérie**, puisque la densité d'établissements décroît
avec l'éloignement du centre-ville : la collecte donne ainsi ses meilleurs résultats en premier.

Deuxième contrainte : `includedTypes` n'accepte pas plus de 50 types, alors que la taxonomie en
compte environ 150. Ils sont répartis en trois lots, eux aussi parcourus par le curseur ; une
cellule est entièrement couverte quand ses trois lots ont été interrogés.

Un **curseur persistant** (`donnees/progression.json`, versionné) retient la position exacte où
chaque exécution s'est arrêtée — y compris lorsqu'elle s'interrompt en cours de cellule parce que
le quota de fiches est atteint. La zone entièrement parcourue, le curseur repart du centre pour un
nouveau tour, qui ramasse les établissements ouverts depuis le passage précédent.

Enfin, chaque appel étant facturé, la consommation est bornée par `appelsMaxParJour` : la collecte
s'arrête dès qu'elle a son quota de fiches **ou** son budget d'appels.

```bash
# Éprouver toute la chaîne sans dépenser un centime d'API
node outils/collecte.mjs --fournisseur=simulation --max=20
```

### Le mode national : un maillage par département

Le mode national vise **au plus une fiche par département et par jour**, en commençant par les
départements les moins couverts puis, à couverture égale, les moins récemment explorés. Il obéit à
la même contrainte que le mode local : interroger chaque jour le centre du chef-lieu avec un rayon
de 15 km rendait toujours les 20 mêmes établissements populaires, et la collecte s'est tarie en dix
jours (zéro fiche du 12 au 18 septembre 2026, 60 appels par jour pour rien).

Chaque chef-lieu est donc découpé en cellules de 2 500 m parcourues du centre vers la périphérie,
et **chaque département garde son propre curseur** dans `progression.json` (clé
`departement-<code>`). Un département avance d'une cellule par passage, qu'il ait rendu une fiche
ou non ; la date de son dernier passage le fait céder la place aux autres le lendemain. Avec 60
appels par jour, une soixantaine de départements progressent chaque jour ; les fiches arrivent au
rythme du quota, réparties sur tout le territoire.

## Sources de données

| Fournisseur | Usage |
|---|---|
| `google-places` | **API Google Places (New)**, voie officielle. Le masque de champs demande `websiteUri`, ce qui permet de ne retenir que les fiches sans site. Seule cette voie permet de re-vérifier un backlink. |
| `csv` | import manuel (`donnees/import.csv`), sans clé d'API. Utile pour démarrer, tester ou reprendre une fiche à la main. Format documenté dans [`outils/lib/fournisseurs/csv.mjs`](./outils/lib/fournisseurs/csv.mjs). |
| `simulation` | établissements fictifs déterministes, hors ligne et gratuits. Sert à éprouver toute la chaîne — maillage, curseur, budget, classification, rédaction, publication — avant d'engager le moindre appel facturé. |

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

## L'audience Search Console tempère les retraits

Le contrat de base est simple : pas de lien GMB, pas de page. Mais une page que Google envoie
déjà à des visiteurs remplit sa mission, lien ou non, et la retirer détruirait ce trafic. Le relevé
quotidien `outils/audience.mjs` interroge donc l'API Search Console de la propriété du site et
inscrit sur chaque fiche ses clics, impressions et position des 90 derniers jours.

- **Des clics** (au moins `audience.clicsProtection`) : la page n'est jamais retirée
  automatiquement, ni en 301 ni en 410. Seule exception : la fiche Google a disparu
  (établissement fermé), auquel cas la page serait trompeuse.
- **Des impressions sans clic** (au moins `audience.impressionsProlongation`) : Google juge la
  page pertinente mais elle ne convainc pas encore. Le délai de grâce est prolongé de
  `audience.prolongationJours`, pas annulé : garder indéfiniment des pages vues mais jamais
  cliquées accumulerait du contenu faible, ce qui pèse sur la réputation de tout le site.
- Un relevé plus vieux que `audience.fraicheurJours` ne compte plus : si l'étape Search Console
  tombe en panne, la protection s'éteint d'elle-même au lieu de figer le site.

Sans compte de service, l'étape est ignorée et la politique de backlink s'applique seule. Avec un
compte de service en secret, `outils/search-console.mjs` vérifie le site, déclare la propriété et
ajoute les copropriétaires humains tout seul : voir [DEPLOIEMENT.md](./DEPLOIEMENT.md).

## Les pages que Google n'indexe pas sont retirées

Une page que Google refuse toujours d'indexer 45 jours après sa mise en ligne ne rapportera rien,
et les pages « explorées, actuellement non indexées » qui s'accumulent sont un signal de faible
qualité pour tout le site. Le cycle quotidien (`outils/couverture.mjs`) établit donc la couverture
réelle : une page avec des impressions récentes est indexée par définition, sans appel ; les autres
pages assez âgées sont soumises à l'API d'inspection d'URL de la Search Console (verdict `PASS` =
indexée), les jamais inspectées d'abord, dans la limite de `couverture.inspectionsParJour`.

Le retrait qui en découle est le plus propre possible pour les moteurs :

- **410 Gone** si aucun lien GMB n'a jamais existé : la page disparaît du sitemap, du maillage
  interne et des flux à la compilation suivante, l'URL répond 410 (page d'erreur dédiée), et elle
  est soumise en suppression à IndexNow ;
- **301 vers la page catégorie** si un lien GMB a existé : les visiteurs venus de la fiche Google
  atterrissent sur une liste utile plutôt que sur une porte fermée ;
- la page **n'est pas republiée** si le lien revient : Google la refuserait à nouveau ;
- un verdict de plus de `couverture.fraicheurJours` ne fonde jamais un retrait : si l'inspection
  tombe en panne, la règle s'éteint au lieu de retirer à l'aveugle ;
- une page avec des clics reste en ligne (elle est indexée par définition).

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
│   ├── progression.json     curseur d'exploration par zone
│   └── import.exemple.csv   modèle d'import manuel
├── outils/
│   ├── collecte.mjs · backlinks.mjs · retraits.mjs · indexation.mjs
│   ├── etat.mjs · verifier.mjs
│   ├── lib/                 briques partagées outils ↔ Eleventy
│   │   ├── fournisseurs/    google-places.mjs, csv.mjs, simulation.mjs
│   │   ├── maillage.mjs     découpe des zones en cellules + curseur
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

- [ ] vérifier `donnees/site.json` (`url` + `chemin` = https://andpro.fr/vitrine-locale, courriel) ;
- [ ] reporter les lignes de `_site/robots.txt` dans le `robots.txt` à la racine d'andpro.fr ;
- [ ] compléter l'éditeur et l'hébergeur dans `src/mentions-legales.md` ;
- [ ] définir les zones de collecte dans `config.json` ;
- [ ] créer la clé Google Places et le secret `GOOGLE_PLACES_API_KEY` ;
- [ ] générer une clé IndexNow (32 caractères hexadécimaux) et le secret `INDEXNOW_KEY` ;
- [ ] créer le `.htpasswd` de la zone privée et le secret `CHEMIN_HTPASSWD` ;
- [ ] vider `donnees/fiches/` des fiches de démonstration ;
- [ ] déclarer le site dans la Search Console en propriété **« préfixe d'URL »** sur
      `https://andpro.fr/vitrine-locale/`, et coller le code de vérification
      (`site.json` → `verifGoogle`).

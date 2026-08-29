# Contexte du projet — annuaire des entreprises sans site web (à lire avant toute modification)

Tu travailles sur le dépôt `Guitew/nevers-frelons-guepes`, branche
`claude/business-directory-gmb-x5rdq3` (PR #4, en brouillon, CI verte). Le dépôt contient deux
sites indépendants : le site racine (observatoire biodiversité, ne pas y toucher) et **`annuaire/`,
le projet sur lequel tu travailles** — un projet autonome avec ses propres dépendances, sa
compilation et son déploiement. Tout ce qui suit concerne `annuaire/`.

## Ce que fait le projet

Un annuaire SEO nouvelle génération : une page complète par entreprise locale dont la fiche Google
Business Profile ne déclare **aucun site internet**. Le modèle repose sur un échange :

1. la collecte quotidienne repère 20 entreprises sans `websiteUri` via l'API Google Places (New) ;
2. chaque entreprise reçoit une page SEO publiée et soumise aux moteurs (IndexNow) ;
3. l'entreprise déclare l'URL de sa page comme « site web » sur sa fiche Google (= le backlink GMB) ;
4. un contrôle quotidien relit chaque fiche Google : tant que le lien est là, la page vit ;
5. si le lien disparaît → retrait : **301 vers la page catégorie** (le lien a existé, l'autorité se
   transmet) ou **410 Gone** (fiche Google disparue, retrait demandé, ou lien jamais posé après le
   délai de grâce de 45 jours) ;
6. les règles 301/410 sont **purgées à expiration** (180 j pour une 410, 365 j pour une 301) : la
   fiche passe à l'état `archivee` et l'URL retombe en 404 naturel ;
7. si le lien réapparaît, la page est republiée automatiquement (sauf retrait manuel, qui prime).

Le site est organisé en 26 catégories calquées sur les types GMB. URLs :
`/{categorie}/{commune}/{entreprise}/`, plus pages catégorie, catégorie×commune et commune.
Un tableau de bord privé des backlinks vit sur `/pilotage/` (auth HTTP, noindex, hors sitemap
ET hors robots.txt — y mettre un Disallow publierait l'adresse).

## Pile et structure

Eleventy 3 statique, Node ≥ 18 (testé 22), **une seule dépendance** (`@11ty/eleventy`) — garder ça.
Une fiche = un fichier JSON dans `donnees/fiches/<ville>/<slug>.json`, **versionné dans Git** :
le dépôt est la mémoire de l'annuaire, chaque retrait se relit en diff. Pas de base de données.

```
annuaire/
├── config.json               règles métier (quotas, zones, maille, politique de retrait)
├── donnees/
│   ├── site.json             url + chemin + identité  ← gouverne TOUTES les URLs
│   ├── categories.json       26 catégories ↔ types GMB
│   ├── fiches/<ville>/*.json source de vérité (texte rédigé inclus)
│   ├── progression.json      curseur d'exploration par zone
│   └── journal.json          historique des événements
├── outils/
│   ├── collecte.mjs · backlinks.mjs · retraits.mjs · indexation.mjs · etat.mjs · verifier.mjs
│   ├── lib/                  politique.mjs, maillage.mjs, redaction.mjs, site.mjs, schema.mjs,
│   │                         pilotage.mjs, fiches.mjs, categories.mjs, texte.mjs, journal.mjs
│   ├── lib/fournisseurs/     google-places.mjs, csv.mjs, simulation.mjs
│   └── tests/                48 tests node --test
└── src/                      gabarits Eleventy (fiche.njk, categorie.njk, htaccess.njk…)
```

Workflows à la racine du dépôt : `annuaire-controle.yml` (tests+build+verifier sur chaque PR),
`annuaire-quotidien.yml` (cron : collecte+backlinks+retraits, commit), `annuaire-deploiement.yml`
(déploiement FTPS depuis `main` uniquement).

## Invariants — ne jamais casser

1. **Aucun fait inventé.** `redaction.mjs` : une donnée absente de la fiche Google ne produit pas
   de phrase. Le texte est écrit dans le JSON de la fiche À LA COLLECTE, jamais recalculé au build
   (il est donc éditable à la main sans être écrasé). La variation des tournures est déterministe
   (empreinte de l'id du lieu).
2. **Jamais d'`aggregateRating`** dans le JSON-LD. La note Google est affichée, datée, sourcée —
   mais la baliser (avis d'une plateforme tierce sur une entité tierce) expose à une action
   manuelle Google. Un test le verrouille.
3. **Une catégorie vidée n'est pas supprimée** : elle reste en ligne en noindex, car elle est la
   cible des 301 des fiches retirées. La supprimer transformerait ces 301 en 404.
4. **Comptage de jours calendaire** (`joursDepuis` dans texte.mjs, ancré à midi UTC) : le délai de
   grâce ne doit pas dépendre de l'heure d'exécution du cron.
5. **Le site vit dans un SOUS-DOSSIER : https://andpro.fr/vitrine-locale/.** Dans
   `donnees/site.json`, `url` = le domaine, `chemin` = le sous-dossier ; `outils/lib/site.mjs` en
   dérive `base` (la racine réelle). Toute URL publique se construit avec `site.base`, jamais
   `site.url` seul (exception : le « host » IndexNow = domaine nu). Dans les gabarits, tout lien
   interne passe par le filtre Eleventy `url` (pathPrefix) — attention Nunjucks : `(a + b) | url`,
   les parenthèses sont obligatoires. Les scripts client lisent `window.RACINE`. Le backlink d'une
   entreprise n'est valide que s'il pointe SOUS /vitrine-locale (test dédié).
6. **Le robots.txt généré n'est PAS lu en sous-dossier** : ses lignes (déjà préfixées) sont à
   reporter dans andpro.fr/robots.txt. Le .htaccess généré ne contient ni redirection HTTPS ni
   canonicalisation www (elles relèvent du .htaccess racine du domaine).
7. **searchNearby plafonne à 20 résultats, sans pagination** : la collecte explore par cellules de
   800 m (quinconce, centre → périphérie, `maillage.mjs`) avec un curseur persistant
   (`progression.json`) et un budget `appelsMaxParJour`. Ne jamais revenir à une requête unique
   par zone : la collecte se tarirait en quelques jours.
8. **Pas de grattage de Google Maps** — API officielle uniquement, ou fournisseurs csv/simulation.

## Commandes

```bash
npm run controle     # LA barrière : 48 tests + build + vérification du site produit — à passer avant tout push
npm test             # tests seuls
npm run verifier     # inspecte _site : liens morts, préfixe manquant, canoniques, sitemaps, cohérence 301/410
npm start            # serveur local http://localhost:8080
npm run etat         # résumé console de l'annuaire
node outils/collecte.mjs --fournisseur=simulation --max=20   # éprouver la chaîne SANS appel API payant
node outils/retraits.mjs --essai                             # simuler la politique de retrait
node outils/retraits.mjs --fiche=/cat/ville/slug/ --mode=410 --motif="demande du dirigeant"
```

`verifier.mjs` existe parce qu'une erreur de gabarit se duplique sur des milliers de pages :
il regarde le RÉSULTAT compilé, pas le code. Ne jamais pousser s'il signale une anomalie.

## État actuel et ce qui reste avant mise en ligne

Le site N'EST PAS en ligne. Il contient 14 fiches de démonstration fictives (drapeau
`exemple: true` → bandeau, noindex, hors sitemap) — les retirer avec `rm -rf donnees/fiches/*`
avant la mise en service réelle. Restent, côté humain :

- [ ] créer les secrets GitHub : FTP_SERVER_ANNUAIRE, FTP_USERNAME_ANNUAIRE, FTP_PASSWORD_ANNUAIRE,
      GOOGLE_PLACES_API_KEY, INDEXNOW_KEY (32 hex), CHEMIN_HTPASSWD (chemin absolu serveur)
- [ ] vérifier `server-dir: ./andpro.fr/vitrine-locale/` dans annuaire-deploiement.yml (valeur devinée)
- [ ] fusionner la PR #4 dans main (le déploiement ne part que de main)
- [ ] reporter les lignes de `_site/robots.txt` dans andpro.fr/robots.txt
- [ ] créer le .htpasswd de /pilotage/ sur le serveur (`htpasswd -c ~/.htpasswd-pilotage pilote`)
- [ ] Search Console : propriété « préfixe d'URL » sur https://andpro.fr/vitrine-locale/,
      code dans site.json → verifGoogle
- [ ] compléter éditeur/hébergeur dans src/mentions-legales.md ; vérifier le courriel de contact
- [ ] ajuster les zones de collecte dans config.json (défaut : Nevers et alentours)

## Conventions de travail

Code et commentaires en français, noms français (fiche, retrait, maillage…). Tester la moindre
règle de cycle de vie dans `outils/tests/` (elles font disparaître des URLs publiques). Un doc
détaillé existe : `annuaire/README.md` (architecture, décisions) et `annuaire/DEPLOIEMENT.md`
(mise en ligne pas à pas). Lis-les avant un gros chantier.

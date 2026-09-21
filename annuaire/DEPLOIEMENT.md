# Déploiement

Le site compilé est un dossier de fichiers statiques : il fonctionne sur n'importe quel hébergement
Apache.

## Où le site est publié

**`https://andpro.fr/vitrine-locale/`** — un **sous-dossier** d'un domaine existant, pas un domaine
dédié. Ce choix a trois conséquences qu'il faut avoir en tête :

| Point | Conséquence |
|---|---|
| Les liens internes | Ils portent tous le préfixe `/vitrine-locale`. Le site ne fonctionnera **pas** s'il est déposé ailleurs sans changer `donnees/site.json`. |
| `robots.txt` | Un `robots.txt` dans un sous-dossier **n'est pas lu** par les robots. Seul `andpro.fr/robots.txt` fait foi : les lignes générées sont à y reporter (voir étape 3). |
| Le `.htaccess` généré | Il ne contient **ni** redirection HTTPS **ni** canonicalisation `www`. Celles-ci relèvent du `.htaccess` à la racine d'andpro.fr ; les dupliquer ici risquerait de les contredire. |

Pour changer d'adresse plus tard, deux clés dans `donnees/site.json` suffisent :

```json
"url":    "https://andpro.fr",
"chemin": "/vitrine-locale"
```

Un `chemin` vide (`""`) remet le site à la racine du domaine, et tout le reste — liens, canoniques,
sitemaps, règles `.htaccess` — suit automatiquement.

## 1. Compiler

```bash
cd annuaire
npm ci
npm run build
```

Le résultat est dans `_site/`. **C'est le contenu de ce dossier** qui doit être mis en ligne —
`_site/.htaccess` compris : il porte les redirections 301, les 410 et les en-têtes de sécurité.

> Attention : beaucoup de clients FTP masquent les fichiers commençant par un point.
> Vérifiez que `.htaccess` (racine) et `pilotage/.htaccess` sont bien transférés.

Deux variables d'environnement influencent la compilation :

| Variable | Effet si absente |
|---|---|
| `INDEXNOW_KEY` | le fichier de clé IndexNow n'est pas produit (soumissions inopérantes) |
| `CHEMIN_HTPASSWD` | la zone privée pointe vers un chemin fictif → Apache renvoie 500, donc la zone reste fermée |

## 2. Envoyer

### Automatiquement (recommandé)

Le workflow [`annuaire-deploiement.yml`](../.github/workflows/annuaire-deploiement.yml) compile et
envoie par FTPS à chaque modification du dossier `annuaire/` sur `main`.

Secrets à définir dans **Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|---|---|
| `FTP_SERVER_ANNUAIRE` | hôte FTP d'andpro.fr |
| `FTP_USERNAME_ANNUAIRE` | identifiant FTP |
| `FTP_PASSWORD_ANNUAIRE` | mot de passe |
| `GOOGLE_PLACES_API_KEY` | clé de l'API Places (New) |
| `INDEXNOW_KEY` | 32 caractères hexadécimaux, générés une fois pour toutes |
| `CHEMIN_HTPASSWD` | chemin **absolu** du `.htpasswd` sur le serveur |

Le workflow dépose le contenu de `_site/` dans **`./andpro.fr/vitrine-locale/`**. Vérifiez ce chemin
sur votre hébergement : sur o2switch, un domaine ajouté a pour racine un dossier du même nom à la
racine du compte (et non `public_html`) ; le sous-dossier `vitrine-locale` y est créé au premier
transfert.

### Manuellement

Transférez le contenu de `_site/` dans le dossier **`vitrine-locale/`** à la racine d'andpro.fr, en
conservant l'arborescence. Le `.htaccess` généré doit se retrouver dans ce sous-dossier, pas à la
racine du domaine.

## 3. Reporter le robots.txt à la racine du domaine

C'est l'étape qu'on oublie, et sans elle les moteurs ne reçoivent aucune consigne pour l'annuaire.

Ouvrez le fichier compilé `_site/robots.txt` : il contient les lignes déjà préfixées de
`/vitrine-locale`. **Copiez-les dans `andpro.fr/robots.txt`**, à la suite des règles existantes du
domaine — sans supprimer ces dernières.

```
User-agent: *
Allow: /vitrine-locale/
Disallow: /vitrine-locale/recherche/
Disallow: /vitrine-locale/index-recherche.json
…
Sitemap: https://andpro.fr/vitrine-locale/sitemap.xml
```

À refaire uniquement si les règles changent — pas à chaque déploiement.

## 4. Protéger la zone de pilotage

En SSH sur le serveur :

```bash
htpasswd -c ~/.htpasswd-pilotage pilote      # demande le mot de passe
pwd                                          # note le chemin absolu du dossier personnel
```

Le chemin complet (par exemple `/home/monconpte/.htpasswd-pilotage`) devient la valeur du secret
`CHEMIN_HTPASSWD`. Sans SSH, cPanel propose « Répertoires protégés par mot de passe », qui crée le
fichier pour vous.

Vérification : `https://andpro.fr/vitrine-locale/pilotage/` doit demander un identifiant. Si la page
s'ouvre sans mot de passe, **arrêtez tout** : le chemin du `.htpasswd` est faux ou `AllowOverride`
est désactivé sur l'hébergement.

## 5. Après la première mise en ligne

1. Dans la **Google Search Console**, créer une propriété de type **« préfixe d'URL »** sur
   `https://andpro.fr/vitrine-locale/` — et non une propriété de domaine, qui mélangerait l'annuaire
   avec le reste d'andpro.fr. Coller le code de vérification dans `donnees/site.json`
   (`verifGoogle`), recompiler, redéployer.
2. Y soumettre `https://andpro.fr/vitrine-locale/sitemap.xml`. L'index renvoie vers un sitemap par
   catégorie : la Search Console donnera alors les statistiques d'indexation catégorie par catégorie.
3. Lancer une première collecte réelle :
   `GOOGLE_PLACES_API_KEY=… node outils/collecte.mjs`.
4. Vérifier que `https://andpro.fr/robots.txt` contient bien les lignes de l'étape 3, et que
   `https://andpro.fr/vitrine-locale/llms.txt` répond.
5. Contrôler une fiche avec l'outil de test des résultats enrichis de Google.
6. Vérifier qu'une fiche retirée renvoie bien le bon code :
   ```bash
   curl -I https://andpro.fr/vitrine-locale/categorie/commune/entreprise-retiree/
   ```
   → `HTTP/1.1 410 Gone` ou `301 Moved Permanently` selon le mode.
7. Vérifier qu'une adresse sans barre finale redirige :
   ```bash
   curl -I https://andpro.fr/vitrine-locale/restaurants
   ```
   → `301` vers `/vitrine-locale/restaurants/`.

## Sauvegarde et reprise

Toute la mémoire de l'annuaire tient dans `annuaire/donnees/` (fiches + journal), versionnée dans
Git. Le site peut être reconstruit à l'identique à partir de ce seul dossier : aucune base de
données à sauvegarder, aucun état hors du dépôt.

## Search Console : protéger du retrait les pages qui reçoivent des clics

Le cycle quotidien relève, pour chaque page, ses clics et impressions Google des 90 derniers jours
(`outils/audience.mjs`). Une page qui reçoit des clics n'est alors jamais retirée automatiquement.

**Tout est automatique sauf la création du compte de service**, qui exige une connexion à votre
compte Google. Une fois son JSON en secret, le cycle quotidien (`outils/search-console.mjs`)
obtient un jeton de vérification, l'inscrit dans `site.json`, le déploie, vérifie le site, déclare
la propriété `https://andpro.fr/vitrine-locale/` dans la Search Console et ajoute les adresses de
`config.audience.proprietaires` comme copropriétaires, pour que la propriété apparaisse dans
votre propre Search Console. Comptez deux cycles (un jour) entre le secret et le premier relevé.

### Les deux gestes à faire une fois

Aucune clé n'est créée ni stockée : GitHub Actions s'authentifie auprès de Google par
**Workload Identity Federation** (échange du jeton OIDC de GitHub contre un jeton Google). C'est
la méthode recommandée par Google, et la seule possible quand l'organisation interdit les clés de
compte de service (règle `iam.disableServiceAccountKeyCreation`, appliquée par défaut).

1. **Lancer le script d'installation dans Cloud Shell**, le terminal en ligne de Google Cloud :
   ouvrir <https://shell.cloud.google.com>, attendre l'invite, coller cette ligne et valider :

   ```bash
   bash <(curl -sS https://raw.githubusercontent.com/Guitew/nevers-frelons-guepes/main/annuaire/outils/installer-google.sh)
   ```

   Le script ([`outils/installer-google.sh`](./outils/installer-google.sh)) demande le projet si
   besoin (celui de la clé Places), active les API, crée le compte de service `vitrine-locale`,
   le pool et le fournisseur Workload Identity restreints au dépôt GitHub, puis affiche deux lignes
   `GOOGLE_WORKLOAD_IDENTITY_PROVIDER=…` et `GOOGLE_SERVICE_ACCOUNT=…`. Il est relançable sans
   risque. Si l'autorisation finale est refusée par la règle « partage restreint au domaine »,
   il affiche le lien et la valeur exacte à ajouter, puis se relance.
2. **Recopier ces deux lignes** dans le bloc `env:` en tête de
   [`annuaire-quotidien.yml`](../.github/workflows/annuaire-quotidien.yml) (ou les transmettre à
   Claude, qui le fera). Ces valeurs ne sont pas secrètes : elles n'autorisent que ce dépôt, sur
   ce compte de service, pour ces API.

Vérification : au cycle suivant, l'étape « Préparer l'accès Search Console » affiche « jeton-ecrit »,
puis « verifiee » le lendemain, et « Relever l'audience Search Console » liste les pages avec
impressions. Les données Search Console ont deux à trois jours de retard, le relevé s'arrête donc
à J-3. Tant que le bloc `env:` est vide, ces étapes sont ignorées sans erreur. Un compte de service en
JSON base64 dans le secret `GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT` reste accepté en repli, pour
une organisation qui autoriserait encore les clés.

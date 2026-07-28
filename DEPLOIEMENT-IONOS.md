# Déployer le site sur IONOS

Ce site est **statique** : une fois compilé, il ne s'agit que de fichiers HTML, CSS, JavaScript
et images. Seule la page d'administration des coordonnées (`admin-nap.php`) utilise PHP, que
l'hébergement mutualisé **IONOS** (Apache + PHP) exécute nativement. Aucune base de données
n'est nécessaire.

Le domaine concerné est **allo-frelons.com**.

Deux méthodes sont possibles :

1. **Mise en ligne manuelle par FTP** — simple, sans configuration, idéale pour débuter.
2. **Déploiement automatique via GitHub Actions** — le site se met à jour tout seul à chaque
   modification. À configurer une seule fois.

---

## Ce qu'il faut mettre en ligne

Toujours **le contenu du dossier `_site/`** (généré par `npm run build`), et **non** le dossier
`src/`. Sur IONOS, la cible est le **dossier du webspace vers lequel pointe le domaine**
`allo-frelons.com` (racine du webspace, ou sous-dossier défini dans l'espace client :
*Domaines & SSL → allo-frelons.com → destination*).

> Le fichier `.htaccess` (redirection HTTPS, pages d'erreur, cache, sécurité) est inclus dans
> `_site/`. Pensez à bien transférer aussi les fichiers cachés (commençant par un point).

---

## Méthode 1 — Mise en ligne manuelle par FTP

### a. Compiler le site

Sur votre ordinateur, dans le dossier du projet :

```bash
npm install     # une seule fois
npm run build
```

Le dossier `_site/` contient désormais le site prêt à être publié.

### b. Récupérer vos identifiants FTP

Dans votre **espace client IONOS** :

- rubrique **Hébergement → Accès SFTP & FTP** (ou « Détails d'accès ») ;
- notez l'**hôte** (du type `access-XXXXXXXXX.webspace-host.com`), l'**identifiant**
  (du type `u12345678` ou `a123456789`) et le **mot de passe** (définissez-le si besoin).

### c. Transférer les fichiers

Avec un client FTP comme **FileZilla** :

1. connectez-vous (hôte, identifiant, mot de passe — FTP explicite sur TLS, ou SFTP port 22) ;
2. côté serveur, ouvrez le **dossier cible du domaine** `allo-frelons.com` ;
3. côté local, ouvrez le dossier **`_site/`** ;
4. sélectionnez **tout le contenu de `_site/`** (fichiers cachés compris) et glissez-le dans le
   dossier cible.

> Dans FileZilla, affichez les fichiers cachés via *Serveur → Forcer l'affichage des fichiers
> cachés*, afin de bien transférer le `.htaccess`.

À chaque mise à jour du site, il suffit de refaire `npm run build` puis de retransférer `_site/`.

---

## Méthode 2 — Déploiement automatique (GitHub Actions)

Le dépôt contient déjà un workflow prêt à l'emploi : **`.github/workflows/deploy.yml`**. Il
compile le site et l'envoie par FTP sur IONOS **à chaque `push` sur la branche `main`** (ou
manuellement depuis l'onglet *Actions* de GitHub).

### Configuration (une seule fois)

Dans GitHub : **Settings → Secrets and variables → Actions → New repository secret**, créez :

| Secret         | Valeur                                                  |
|----------------|---------------------------------------------------------|
| `FTP_SERVER`   | l'hôte IONOS (ex. `access-XXXXXXXXX.webspace-host.com`) |
| `FTP_USERNAME` | votre identifiant d'accès IONOS                         |
| `FTP_PASSWORD` | le mot de passe associé                                 |

### Vérifier la cible

Dans `.github/workflows/deploy.yml`, le paramètre `server-dir` indique le dossier de destination
sur le serveur (par défaut `./`, la racine du webspace). Adaptez-le si le domaine
`allo-frelons.com` pointe vers un sous-dossier (par exemple `./allo-frelons.com/`).

Une fois les secrets en place, chaque modification poussée sur `main` met le site à jour
automatiquement. Vous pouvez suivre le déroulement dans l'onglet **Actions** de GitHub.

> Le dossier `donnees/` (créé sur le serveur par la page d'administration `admin-nap.php`)
> n'est **pas** effacé par les déploiements : l'action ne supprime que les fichiers qu'elle a
> elle-même déployés.

---

## PHP : la page d'administration des coordonnées

La page **`/admin-nap.php`** (gestion des NAP locales ALLO FRELONS, voir le README) nécessite
**PHP 8.0 ou supérieur**. Dans l'espace client IONOS : **Hébergement → PHP** (ou « Version
PHP »), sélectionnez une version 8.x pour le webspace. À la première visite de la page, vous
définirez le mot de passe d'administration.

---

## Après la mise en ligne : quelques vérifications

- Le site s'affiche bien sur `https://allo-frelons.com` (avec le cadenas HTTPS).
- Dans l'espace IONOS, vérifiez que le **certificat SSL** est actif pour le domaine (inclus
  dans les offres d'hébergement) : la redirection HTTP → HTTPS du `.htaccess` le suppose.
- Testez quelques pages (une fiche espèce, un milieu, la recherche) et la page 404
  (ex. une URL inexistante).
- Ouvrez `https://allo-frelons.com/admin-nap.php`, créez le mot de passe et vérifiez
  l'enregistrement des coordonnées.
- Vérifiez que `https://allo-frelons.com/sitemap.xml` et `/robots.txt` répondent, puis
  déclarez le sitemap dans la Google Search Console (propriété `allo-frelons.com` à ajouter).

## Dépannage rapide

- **Page blanche ou styles manquants** : vérifiez que les dossiers `assets/` ont bien été
  transférés dans le dossier cible du domaine.
- **Le `.htaccess` ne semble pas pris en compte** : assurez-vous qu'il a bien été transféré
  (fichier caché) à la racine du dossier cible.
- **Erreur de redirection en boucle** : vérifiez que le certificat SSL est actif pour le domaine
  avant de laisser la redirection HTTPS active.
- **`admin-nap.php` s'affiche en texte brut ou renvoie une erreur** : vérifiez que PHP 8.x est
  bien activé pour le webspace (Hébergement → PHP).
- **Contenu non mis à jour** : videz le cache du navigateur (le `.htaccess` met en cache les
  ressources statiques) ou faites un rafraîchissement forcé.

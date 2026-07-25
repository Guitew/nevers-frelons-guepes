# Déployer le site sur o2switch

Ce site est **statique** : une fois compilé, il ne s'agit que de fichiers HTML, CSS, JavaScript
et images. Il n'a besoin ni de PHP, ni de base de données. L'hébergement mutualisé **o2switch**
(basé sur cPanel + Apache) le sert donc parfaitement.

Le domaine concerné est **observatoire-biodiversite-npdc.fr**.

Deux méthodes sont possibles :

1. **Mise en ligne manuelle par FTP** — simple, sans configuration, idéale pour débuter.
2. **Déploiement automatique via GitHub Actions** — le site se met à jour tout seul à chaque
   modification. À configurer une seule fois.

---

## Ce qu'il faut mettre en ligne

Toujours **le contenu du dossier `_site/`** (généré par `npm run build`), et **non** le dossier
`src/`. Sur o2switch, la racine web d'un domaine est en général le dossier **`public_html/`**
(ou un sous-dossier dédié si le domaine est un domaine additionnel).

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

Dans votre espace **cPanel o2switch** :

- rubrique **« Comptes FTP »** pour créer/retrouver un compte FTP, ou utilisez le compte principal ;
- notez l'**hôte FTP** (souvent votre domaine, ou un hôte du type `xxxx.o2switch.net`),
  l'**identifiant** et le **mot de passe**.

### c. Transférer les fichiers

Avec un client FTP comme **FileZilla** :

1. connectez-vous (hôte, identifiant, mot de passe, port 21 en FTP explicite/FTPS) ;
2. côté serveur, ouvrez le dossier **`public_html/`** ;
3. côté local, ouvrez le dossier **`_site/`** ;
4. sélectionnez **tout le contenu de `_site/`** (fichiers cachés compris) et glissez-le dans
   `public_html/`.

> Dans FileZilla, affichez les fichiers cachés via *Serveur → Forcer l'affichage des fichiers
> cachés*, afin de bien transférer le `.htaccess`.

Vous pouvez aussi passer par le **Gestionnaire de fichiers** de cPanel : compressez le contenu de
`_site/` en une archive `.zip`, téléversez-la dans `public_html/`, puis extrayez-la sur place.

À chaque mise à jour du site, il suffit de refaire `npm run build` puis de retransférer `_site/`.

---

## Méthode 2 — Déploiement automatique (GitHub Actions)

Le dépôt contient déjà un workflow prêt à l'emploi : **`.github/workflows/deploy.yml`**. Il
compile le site et l'envoie par FTP sur o2switch **à chaque `push` sur la branche `main`** (ou
manuellement depuis l'onglet *Actions* de GitHub).

### Configuration (une seule fois)

Dans GitHub : **Settings → Secrets and variables → Actions → New repository secret**, créez :

| Secret         | Valeur                                                             |
|----------------|-------------------------------------------------------------------|
| `FTP_SERVER`   | l'hôte FTP o2switch (ex. `ftp.observatoire-biodiversite-npdc.fr`)  |
| `FTP_USERNAME` | votre identifiant FTP                                              |
| `FTP_PASSWORD` | le mot de passe FTP                                                |

### Vérifier la cible

Dans `.github/workflows/deploy.yml`, le paramètre `server-dir` indique le dossier de destination
sur le serveur (par défaut `./public_html/`). Adaptez-le si votre domaine pointe vers un
sous-dossier (par exemple pour un domaine additionnel :
`./observatoire-biodiversite-npdc.fr/`).

Une fois les secrets en place, chaque modification poussée sur `main` met le site à jour
automatiquement. Vous pouvez suivre le déroulement dans l'onglet **Actions** de GitHub.

---

## Après la mise en ligne : quelques vérifications

- Le site s'affiche bien sur `https://observatoire-biodiversite-npdc.fr` (avec le cadenas HTTPS).
- Dans cPanel, activez si besoin le **certificat SSL gratuit (Let's Encrypt)** pour le domaine :
  la redirection HTTP → HTTPS du `.htaccess` suppose qu'un certificat est actif.
- Testez quelques pages (une fiche espèce, un milieu, la recherche) et la page 404
  (ex. une URL inexistante).
- Vérifiez que `https://observatoire-biodiversite-npdc.fr/sitemap.xml` et `/robots.txt`
  répondent, puis déclarez le sitemap dans la Google Search Console.

## Dépannage rapide

- **Page blanche ou styles manquants** : vérifiez que les dossiers `assets/` ont bien été
  transférés dans `public_html/`.
- **Le `.htaccess` ne semble pas pris en compte** : assurez-vous qu'il a bien été transféré
  (fichier caché) à la racine `public_html/`.
- **Erreur de redirection en boucle** : vérifiez que le certificat SSL est actif pour le domaine
  avant de laisser la redirection HTTPS active.
- **Contenu non mis à jour** : videz le cache du navigateur (le `.htaccess` met en cache les
  ressources statiques) ou faites un rafraîchissement forcé.

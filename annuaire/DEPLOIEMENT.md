# Déploiement

Le site compilé est un dossier de fichiers statiques : il fonctionne sur n'importe quel hébergement
Apache. Les instructions ci-dessous visent **o2switch** (cPanel / Apache), comme le site racine du
dépôt, mais s'adaptent à tout hébergement mutualisé.

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
| `FTP_SERVER_ANNUAIRE` | hôte FTP (ex. `ftp.mon-domaine.fr`) |
| `FTP_USERNAME_ANNUAIRE` | identifiant FTP |
| `FTP_PASSWORD_ANNUAIRE` | mot de passe |
| `GOOGLE_PLACES_API_KEY` | clé de l'API Places (New) |
| `INDEXNOW_KEY` | 32 caractères hexadécimaux, générés une fois pour toutes |
| `CHEMIN_HTPASSWD` | chemin **absolu** du `.htpasswd` sur le serveur |

Adaptez `server-dir:` dans le workflow au dossier racine du domaine. Sur o2switch, un domaine
ajouté a pour racine un dossier du même nom à la racine du compte (et non `public_html`).

### Manuellement

Transférez le contenu de `_site/` dans le dossier racine du domaine, en conservant l'arborescence.

## 3. Protéger la zone de pilotage

En SSH sur le serveur :

```bash
htpasswd -c ~/.htpasswd-pilotage pilote      # demande le mot de passe
pwd                                          # note le chemin absolu du dossier personnel
```

Le chemin complet (par exemple `/home/monconpte/.htpasswd-pilotage`) devient la valeur du secret
`CHEMIN_HTPASSWD`. Sans SSH, cPanel propose « Répertoires protégés par mot de passe », qui crée le
fichier pour vous.

Vérification : `https://mon-domaine.fr/pilotage/` doit demander un identifiant. Si la page s'ouvre
sans mot de passe, **arrêtez tout** : le chemin du `.htpasswd` est faux ou `AllowOverride` est
désactivé sur l'hébergement.

## 4. Après la première mise en ligne

1. Déclarer le domaine dans la **Google Search Console**, coller le code de vérification dans
   `donnees/site.json` (`verifGoogle`), recompiler.
2. Y soumettre `https://mon-domaine.fr/sitemap.xml`.
3. Lancer une première collecte réelle :
   `GOOGLE_PLACES_API_KEY=… node outils/collecte.mjs`.
4. Vérifier que `https://mon-domaine.fr/robots.txt` et `/llms.txt` répondent.
5. Contrôler une fiche avec l'outil de test des résultats enrichis de Google.
6. Vérifier qu'une fiche retirée renvoie bien le bon code :
   ```bash
   curl -I https://mon-domaine.fr/categorie/commune/entreprise-retiree/
   ```
   → `HTTP/1.1 410 Gone` ou `301 Moved Permanently` selon le mode.

## Sauvegarde et reprise

Toute la mémoire de l'annuaire tient dans `annuaire/donnees/` (fiches + journal), versionnée dans
Git. Le site peut être reconstruit à l'identique à partir de ce seul dossier : aucune base de
données à sauvegarder, aucun état hors du dépôt.

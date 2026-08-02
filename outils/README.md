# Outils

## `photos.mjs` — ajouter les photographies des fiches espèces

Ce script télécharge, pour chaque fiche de `src/especes/`, une photographie de l'espèce depuis
**Wikimedia Commons** (médias sous licence libre), puis renseigne automatiquement dans la fiche :

- `image` : le chemin de l'image téléchargée (dans `src/assets/img/especes/`) ;
- `image_alt` : un texte alternatif ;
- `credit` : l'auteur et la licence (attribution obligatoire des licences Creative Commons) ;
- `credit_url` : le lien vers la licence / la page source.

Les crédits apparaissent ensuite sur chaque fiche et sur la page **/credits/**.

### Prérequis

- Node.js 18 ou supérieur (le script utilise `fetch` natif) ;
- un **accès Internet** vers `wikipedia.org` et `commons.wikimedia.org`.

> Note : dans certains environnements d'exécution restreints (par exemple un bac à sable dont la
> politique réseau bloque les sites externes), ce script ne peut pas fonctionner. Exécutez-le
> depuis un poste disposant d'un accès Internet normal, puis committez les images et les fiches
> mises à jour.

### Utilisation

```bash
# Toutes les fiches qui n'ont pas encore d'image
npm run photos

# Forcer le re-téléchargement de toutes les fiches
node outils/photos.mjs --force

# Seulement certaines fiches (par leur nom de fichier, sans .md)
node outils/photos.mjs oyat vipere-peliade phoque-veau-marin
```

Après exécution :

```bash
npm run build      # vérifier le rendu
git add src/assets/img/especes src/especes
git commit -m "Ajouter les photographies des fiches espèces"
```

### Remplacer une photo ou en choisir une meilleure

Le script prend l'image principale de l'article Wikipédia correspondant. Pour utiliser une autre
photo (meilleure qualité, cadrage plus parlant, cliché personnel), déposez votre fichier dans
`src/assets/img/especes/` et renseignez à la main, dans la fiche concernée, les champs `image`,
`image_alt`, `credit` et éventuellement `credit_url`. Veillez toujours à respecter les droits
d'auteur et à créditer correctement la source.

### Vérification des licences

Le script n'accepte que les licences libres (CC0, CC BY, CC BY-SA, domaine public) et ignore les
autres. Wikimedia Commons n'héberge en principe que des médias librement réutilisables, mais
l'attribution reste obligatoire : ne retirez pas les crédits générés.

---

## `veille-inpi.mjs` — alerte courriel sur les dépôts de marque « Allo Frelons »

Ce script surveille la **base Marques de l'INPI** ([data.inpi.fr](https://data.inpi.fr/recherche_avancee/marques))
et envoie un courriel à **allofrelons@gmail.com** dès qu'un nouveau dépôt dont la dénomination
contient « Allo Frelons » y apparaît.

La comparaison ignore la casse, les accents, les tirets, les espaces et le pluriel : `ALLO FRELONS`,
`Allo-Frelons`, `AlloFrelons`, `Allo Frelon 59` ou `Groupe Allo Frelons SAS` déclenchent l'alerte,
`Allo Guêpes` ou `Frelons Express` non.

Les marques déjà vues sont mémorisées dans **`outils/etat-veille-inpi.json`** : une même marque
n'est signalée qu'une seule fois, et une marque temporairement absente de la recherche ne
redéclenche pas d'alerte si l'INPI la ré-indexe plus tard.

### Sources interrogées

1. **API PI officielle** (`api-gateway.inpi.fr`) — utilisée si `INPI_API_USERNAME` et
   `INPI_API_PASSWORD` sont renseignés. C'est la source recommandée : elle est prévue pour un
   usage automatisé. Le compte technique se crée depuis [data.inpi.fr](https://data.inpi.fr/login)
   → **Mes accès API / SFTP** → **Accès APIs PI** (gratuit ; l'INPI renvoie un identifiant et un
   mot de passe distincts de ceux du compte).
2. **Recherche publique de `data.inpi.fr`** — repli sans compte, utilisé automatiquement si l'API
   n'est pas configurée ou ne répond pas. Cet accès n'est pas contractuel : il peut être limité ou
   modifié par l'INPI sans préavis, d'où l'intérêt du compte API.

> La base Marques est mise à jour **une fois par semaine** par l'INPI : une vérification
> quotidienne suffit largement, et un dépôt peut mettre quelques jours à apparaître.

### Configuration

Variables d'environnement (en local : un `export` avant la commande ; sur GitHub : des *secrets*) :

| Variable | Rôle |
| --- | --- |
| `SMTP_HOST` | serveur d'envoi, ex. `smtp.gmail.com` |
| `SMTP_PORT` | `465` (SSL, par défaut) ou `587` (STARTTLS) |
| `SMTP_USER` | identifiant SMTP, ex. `allofrelons@gmail.com` |
| `SMTP_PASSWORD` | **mot de passe d'application**, jamais le mot de passe du compte |
| `SMTP_SECURITY` | `auto` (défaut), `ssl`, `starttls` ou `aucun` |
| `MAIL_FROM` | expéditeur (défaut : `Veille INPI <SMTP_USER>`) |
| `MAIL_TO` | destinataire(s), séparés par des virgules (défaut : `allofrelons@gmail.com`) |
| `INPI_API_USERNAME` / `INPI_API_PASSWORD` | compte technique APIs PI (facultatif) |
| `INPI_API_COLLECTIONS` | collections interrogées (défaut : `FR`) |
| `VEILLE_TERMES` | noms surveillés, séparés par des virgules (défaut : `Allo Frelons`) |

**Gmail** : la connexion SMTP exige un *mot de passe d'application* — compte Google → **Sécurité**
→ activer la **validation en deux étapes** → **Mots de passe des applications** → générer un mot de
passe de 16 caractères, à coller dans `SMTP_PASSWORD`. Réglages : `SMTP_HOST=smtp.gmail.com`,
`SMTP_PORT=465`.

### Utilisation

```bash
npm run veille-inpi                        # vérification + alerte s'il y a du nouveau
node outils/veille-inpi.mjs --init         # 1er passage : enregistre l'existant sans alerter
node outils/veille-inpi.mjs --stdout       # affiche l'alerte au lieu de l'envoyer (essai à blanc)
node outils/veille-inpi.mjs --test-courriel  # vérifie la configuration SMTP
node outils/veille-inpi.mjs --debug        # écrit les réponses brutes de l'INPI
node outils/veille-inpi.mjs --terme "Allo Guêpes,Allo Nuisibles"   # autres noms
node outils/veille-inpi.mjs --source=publique   # forcer une source (api | publique | auto)
```

Le premier passage sert de référence : les marques déjà déposées (dont les vôtres) sont
enregistrées **sans** courriel, puis chaque nouveau dépôt déclenche une alerte.

### Automatisation (GitHub Actions)

Le workflow **`.github/workflows/veille-inpi.yml`** exécute la veille **chaque jour à 6 h 17 UTC**
et committe l'état mis à jour. Mise en route :

1. renseigner les secrets `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (et éventuellement `SMTP_PORT`,
   `MAIL_TO`, `INPI_API_USERNAME`, `INPI_API_PASSWORD`) dans **Settings → Secrets and variables →
   Actions** ;
2. fusionner ce workflow dans la branche par défaut — GitHub ne déclenche les tâches planifiées que
   depuis celle-ci ;
3. lancer une première fois le workflow à la main (onglet **Actions** → *Veille INPI* → **Run
   workflow**) en cochant **test_courriel** pour valider la réception, puis une seconde fois en
   cochant **init** pour enregistrer l'existant.

En cas de panne (INPI injoignable, SMTP refusé), le workflow échoue : GitHub prévient par courriel
le propriétaire du dépôt, et le détail figure dans le résumé de l'exécution.

### Tests

```bash
npm test    # correspondance des noms, lecture des réponses INPI, envoi SMTP (serveur local factice)
```

Les appels réels à l'INPI ne sont pas couverts par les tests (réseau et identifiants requis) : en
cas de changement de format côté INPI, lancer `node outils/veille-inpi.mjs --debug` et inspecter
`outils/.veille-inpi-debug.json`, qui contient les réponses brutes.

### Aller plus loin

La veille porte sur la base **Marques**. Pour surveiller en plus les **immatriculations
d'entreprises** portant ce nom (Registre national des entreprises), l'INPI expose une autre API
(`registre-national-entreprises.inpi.fr`) : le script est organisé pour accueillir cette source
supplémentaire dans `interrogerInpi()`.

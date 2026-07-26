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

# Images SEO — ALLO FRELONS

Production **quotidienne et automatique de 2 images** optimisées pour le référencement image des
pages et articles d'[allo-frelons.fr](https://allo-frelons.fr) : Google Images / pack d'images,
Google Discover, Pinterest. Chaque image sort avec tout ce qui la fait classer et cliquer : nom de
fichier, alt, légende, `ImageObject` JSON-LD, Open Graph, sitemap images, métadonnées XMP
embarquées, badge / titre incrusté dans la charte.

Ce dossier est un **projet autonome** du dépôt (comme `annuaire/`), avec ses dépendances, ses
tests et ses workflows. L'analyse du process se lit dans
[`docs/process-ranking-images.md`](docs/process-ranking-images.md) et la charte dans
[`docs/charte-images-ctr.md`](docs/charte-images-ctr.md).

> Le transcript de la vidéo de référence n'était pas accessible depuis l'environnement de
> construction (voir `docs/process-ranking-images.md § 0`). Le process a été reconstitué ; pour
> l'aligner sur la vidéo, il suffit d'ajuster la grille d'angles (`donnees/pages.json`) et la
> charte (`config.json`).

---

## La chaîne, en une image

```
  pages.json               file-attente.json            travail/                sortie/<date>/<slug>/
  (inventaire qualifié)    (2 éléments du jour           (image maître            ├── slug.jpg / .webp        (Google Images 4:3)
  mot-clé · surfaces  ──▶   + prompt prêt)      ──▶      1536×1024 ou    ──▶     ├── slug-discover.jpg/webp  (Discover 16:9)
  angles · saison           planifier                    1024×1536)               ├── slug-pinterest.jpg/webp (Pinterest 2:3)
                                                         generer                  ├── integration.html  (head + <figure> + épingle)
                                                                                  └── manifeste.json
                                                         optimiser ─────────────▶ sortie/sitemap-images.xml (cumulé)
                                                                                  sortie/images/  (miroir à téléverser)
                                                         publier  ──────────────▶ WordPress (option) : médiathèque + image mise en avant
```

Quatre étapes, quatre commandes, un enchaînement (`npm run quotidien`). Chaque étape est
idempotente : relancée, elle reprend ce qui reste à faire, sans doublon.

## Démarrage

```bash
cd images-seo
npm install                 # sharp (traitement d'image) ; playwright en dépendance optionnelle
cp .env.exemple .env        # puis renseigner selon le fournisseur choisi
npm run controle            # tests + cycle simulé en bac à sable : tout doit passer
```

### 1. Qualifier l'inventaire des pages (une fois, ~30 min)

`donnees/pages.json` est livré avec 12 pages types d'un site de destruction de nids (frelon
asiatique, frelon européen, nid de guêpes, comparatifs, piqûre, intervention 59/62…) et 37 angles
visuels. Une seule URL est connue avec certitude (`/frelon-asiatique`) ; les autres sont
marquées `a_completer`.

```bash
npm run importer            # lit https://allo-frelons.fr/sitemap.xml, renseigne les URLs
                            # correspondantes et ajoute les URLs inconnues « à qualifier »
```

Puis, à la main, pour chaque page : vérifier `url`, `mot_cle`, `serps` (`google-images`,
`discover`, `pinterest`), `priorite` (1 = page argent), `saison` (mois), et 2 à 4 `visuels`
(`angle` décrit la photo, `requete` est la requête image visée, `surcouche` le texte du badge ou
du titre, `format` force `portrait` pour Pinterest).

Une page **sans URL n'est jamais planifiée** (sauf `--essai`).

### 2. Choisir comment les images sont générées

| Fournisseur | Quand | Automatique ? | Où ça tourne |
|---|---|---|---|
| `chatgpt-navigateur` | ChatGPT **gratuit**, quota de quelques images/jour (d'où 2/jour) | Oui, après une connexion manuelle unique | Poste ou petit serveur qui garde le profil du navigateur |
| `depot` | Pas d'automatisation du compte ChatGPT | Semi : les prompts sont écrits dans `donnees/depot/A-GENERER.md`, on dépose `<id>.png` | Partout (GitHub Actions inclus) |
| `openai-api` | Budget de quelques centimes par image, 100 % sans surveillance | Oui | Partout (GitHub Actions inclus) |
| `simulation` | Tests et contrôle | Oui | Partout |

**ChatGPT gratuit piloté par navigateur** (`chatgpt-navigateur`) :

```bash
npm install playwright && npx playwright install chromium
npm run generer -- --connexion      # ouvre une fenêtre : se connecter à ChatGPT, puis la fermer
npm run quotidien                    # dès lors : planifie, génère 2 images, décline, publie
```

Points à connaître :

- la session vit dans `profil-chatgpt/` (ignoré par Git) ; quand elle expire, relancer `--connexion` ;
- au message de limite quotidienne, la série s'arrête proprement et reprend au prochain passage ;
- l'interface de ChatGPT change : les sélecteurs sont dans `config.json → generation.chatgpt.selecteurs`
  et se corrigent sans toucher au code ; une capture `travail/diagnostic-*.png` est prise en cas d'échec ;
- un runner GitHub (adresse de centre de données, sans session) ne convient pas à ce fournisseur ;
- l'automatisation d'un compte ChatGPT relève des conditions d'utilisation d'OpenAI : compte
  personnel, cadence humaine (2 images/jour, 20 s de pause), en connaissance de cause. La voie
  `openai-api` est la voie officielle si l'on veut zéro surveillance.

Planifier le cycle sur le poste (Linux/macOS) :

```
30 7 * * *  cd /chemin/vers/images-seo && npm run quotidien >> journal-cron.log 2>&1
```

Sous Windows : Planificateur de tâches → `npm run quotidien` dans le dossier `images-seo`.

### 3. Choisir comment les images sont publiées

`PUBLICATION_IMAGES=export` (défaut) écrit tout dans `sortie/` :

- `sortie/<date>/<slug>/integration.html` — **à coller** : balises `<head>` (og:image,
  `max-image-preview:large`, JSON-LD), `<figure>` avec `<picture>` WebP/JPEG à placer près du
  H1/H2 concerné, texte de l'épingle Pinterest ;
- `sortie/images/` — miroir exact du dossier à téléverser sur le site
  (`donnees/site.json → cheminImages`, par défaut `/wp-content/uploads/images-seo/`) ;
- `sortie/sitemap-images.xml` — à téléverser à la racine du site et à déclarer dans la
  Search Console (ou à référencer depuis le sitemap index).

`PUBLICATION_IMAGES=export,wordpress` ajoute, si le site est sous WordPress, le téléversement
dans la médiathèque (alt, titre, légende, description renseignés), le rattachement à l'article
retrouvé par son slug et la définition de l'image mise en avant si l'article n'en a pas
(`config.json → publication.wordpress`). Identifiants : `WP_UTILISATEUR` et
`WP_MOT_DE_PASSE_APPLICATION` (Profil → Mots de passe d'application). L'insertion dans le corps de
l'article reste volontairement manuelle (`integration.html`), pour ne pas réécrire le contenu.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run quotidien` | planifier → générer → optimiser → publier (options : `--fournisseur=`, `--publication=`, `--date=`, `--n=`, `--essai`) |
| `npm run planifier` | choisit les 2 images du jour (pages, angles, surfaces) et rédige les prompts |
| `npm run generer` | produit l'image maître via le fournisseur (`-- --connexion` pour ChatGPT) |
| `npm run optimiser` | recadre par surface, incruste badge/titre/signature, exporte WebP + JPEG avec XMP |
| `npm run publier` | export dans `sortie/` (+ sitemap images) et/ou WordPress |
| `npm run importer` | rapproche l'inventaire du sitemap réel du site |
| `npm run etat` | résumé console |
| `npm test` | 29 tests (`node --test`) : planification, prompts, métadonnées, images, cycle complet |
| `npm run controle` | tests + deux cycles simulés en bac à sable — **à passer avant tout push** |

## Ce qui rend une image « classable » et « cliquable » ici

- **Prompt** : sujet unique, contraste, angle inhabituel, marge basse libre, **fiche morphologique de
  l'espèce** injectée (thorax noir / anneau orange / pattes jaunes pour le frelon asiatique…),
  interdiction du texte et des logos (le générateur fait des fautes ; nous incrustons nous-mêmes).
- **Déclinaisons** : 1200×900 (Google Images), 1536×864 (Discover, ≥ 1200 px et 16:9),
  1000×1500 (Pinterest), recadrage sur le sujet, WebP + JPEG progressif.
- **Surcouche** : badge jaune 2-4 mots (Google Images), titre 1-3 lignes (Pinterest), rien
  (Discover), signature `allo-frelons.fr` partout.
- **Métadonnées** : nom de fichier = requête en slug ; alt ≤ 125 caractères qui décrit l'image ;
  légende ; `ImageObject` avec `creator`, `creditText`, `license`, `acquireLicensePage` (badge
  « Licence » Google Images, citations AI Overviews) ; XMP/IPTC embarqué ; sitemap images.
- **Rotation** : 2 pages distinctes par jour, 7 jours minimum avant de revenir sur une page,
  priorité et saison pondérées, angles inédits d'abord, choix déterministe pour une date donnée.

## Structure

```
images-seo/
├── config.json                 cadence, fournisseur, charte (couleurs, style, interdits), publication
├── donnees/
│   ├── site.json               nom, URL, zone, licence, chemin public des images
│   ├── pages.json              inventaire qualifié : mot-clé, surfaces, priorité, saison, angles
│   ├── file-attente.json       éléments du jour et leur statut (a_generer → a_optimiser → a_publier → publie)
│   ├── journal.json            historique (planifie, genere, optimise, publie, quota, erreur)
│   └── depot/                  dépôt manuel des images (fournisseur « depot »)
├── outils/
│   ├── planifier · generer · optimiser · publier · quotidien · importer-sitemap · etat · controle
│   ├── lib/  serps.mjs (profils de surfaces) · prompts.mjs · planification.mjs · metadonnees.mjs
│   │         images.mjs (sharp) · config.mjs · texte.mjs · journal.mjs · chemins.mjs
│   ├── lib/fournisseurs/  chatgpt-navigateur · openai-api · depot · simulation
│   ├── lib/publication/   export · wordpress
│   └── tests/              29 tests node --test
├── sortie/                     images produites (committées : le dépôt garde la trace)
└── docs/                       analyse du process, charte CTR
```

Workflows à la racine du dépôt : `images-controle.yml` (tests + cycle simulé sur chaque PR) et
`images-quotidien.yml` (cron quotidien : API OpenAI si clé présente, sinon mode dépôt ; export ;
WordPress et FTP si secrets présents).

## Invariants

1. **Aucune image sans page cible** : pas d'URL, pas de planification.
2. **Le texte visible est toujours incrusté par nous**, jamais généré : orthographe et charte garanties.
3. **Une image d'espèce respecte la fiche morphologique** : mieux vaut aucune image qu'un frelon
   asiatique à rayures jaunes.
4. **Idempotence** : relancer le cycle le même jour ne crée rien de plus.
5. **Le dépôt est la mémoire** : `sortie/`, `file-attente.json` et `journal.json` sont committés.

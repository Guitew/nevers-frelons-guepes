# Analyse — faire ranker les pages d'ALLO FRELONS par l'image

## 0. Au sujet de la vidéo de référence

La vidéo indiquée (`youtu.be/ehpYnhZP6ik`) **n'a pas pu être lue** depuis l'environnement de
travail : YouTube, ses miroirs (Invidious, Piped), les services de transcription tiers et le
site allo-frelons.fr lui-même sont refusés par la politique réseau de la session (réponse 403
du proxy sortant). Aucune recherche web n'indexe cet identifiant.

Le process ci-dessous est donc **reconstitué** à partir de ce que ces vidéos « ranker en images
avec ChatGPT » enseignent en général et des règles documentées par Google pour ses surfaces
image. Pour caler la solution sur la vidéo réelle, coller son transcript (ou ses étapes) dans
`docs/transcript-video.md` : la seule pièce qui dépend d'elle est la **grille des angles**
(`donnees/pages.json`) et la **charte** (`config.json → charte`) — le reste de la chaîne est
générique.

## 1. Pourquoi l'image est un levier à part entière pour ALLO FRELONS

Les requêtes du métier sont **visuelles par nature** : « frelon asiatique », « nid de guêpes »,
« frelon asiatique ou européen », « piqûre de frelon »… L'internaute veut *voir* pour
identifier avant d'agir. Sur ces requêtes, Google affiche presque toujours un **pack d'images**
dans la page de résultats classique, et le trafic Google Images est important. Une image qui
sort dans ce pack, c'est :

- une **seconde porte d'entrée** vers la page, indépendante de sa position organique ;
- une vignette dans les **AI Overviews** (Google y cite de préférence les images portant un
  balisage `ImageObject` complet : créateur, crédit, licence) ;
- une carte **Discover** possible si la page a une image ≥ 1200 px de large et la balise
  `max-image-preview:large` ;
- des **épingles Pinterest** qui ranked elles-mêmes dans Google Images et ramènent vers le site.

## 2. Le process reconstitué (ce que la vidéo enseigne, en général)

| Étape | Ce que fait l'humain dans la vidéo | Ce que fait la solution |
|---|---|---|
| 1. Repérer les requêtes « image » | Chercher les mots-clés du site où la SERP montre un pack d'images / un onglet Images fourni | `donnees/pages.json` : chaque page porte son mot-clé, ses requêtes images et les **surfaces** visées |
| 2. Étudier les vignettes qui rankent | Regarder ce qui sort déjà : cadrage, couleurs, style, présence de texte | Grille d'**angles** par page (3-4 par page, tous différents des photos de banque) |
| 3. Rédiger un prompt « CTR » | Sujet unique, contraste, angle inhabituel, marge pour un texte | `outils/lib/prompts.mjs` : règles de composition + **fiche morphologique** de l'espèce (un générateur invente sinon des rayures fantaisistes) + interdiction du texte |
| 4. Générer dans ChatGPT gratuit | 2 à 3 images/jour selon le quota gratuit | Fournisseur `chatgpt-navigateur` (Playwright, session persistante) ou `depot` (prompt fourni, image déposée à la main) |
| 5. Ajouter le texte qui fait cliquer | Canva ou équivalent : badge, titre, marque | `outils/lib/images.mjs` : surcouche SVG par surface (badge / titre / signature) — orthographe garantie, charte respectée |
| 6. Décliner par surface | Une taille par usage | 4:3 1200×900 (Google Images), 16:9 1536×864 (Discover), 2:3 1000×1500 (Pinterest), WebP + JPEG |
| 7. Nommer et décrire | Nom de fichier = mot-clé ; alt descriptif ; légende | `outils/lib/metadonnees.mjs` : nom de fichier en slug, alt ≤ 125 caractères, titre, légende, description |
| 8. Baliser | `ImageObject`, Open Graph, sitemap images | JSON-LD avec `creator` / `creditText` / `license` (badge « Licence » dans Google Images), `og:image`, sitemap images cumulé |
| 9. Embarquer les métadonnées | IPTC dans le fichier | XMP embarqué (crédit, droits, licence, mots-clés) dans le JPEG et le WebP |
| 10. Publier et faire indexer | Téléverser, insérer près du H1/H2, soumettre | `sortie/<date>/<slug>/integration.html` prêt à coller ; WordPress REST en option ; sitemap images à déclarer |

## 3. Quelle surface pour quelle page ?

| Surface | Quand la viser | Ce qui y fait cliquer | Contraintes techniques |
|---|---|---|---|
| **Google Images / pack d'images** | Toute requête d'identification (espèce, nid, piqûre) et d'intervention | Sujet unique centré, contraste fort, couleur d'accent, badge 2-4 mots lisible en vignette | 4:3 ou 1:1, ≥ 1200 px, alt + nom de fichier + texte autour, `ImageObject` |
| **Discover** | Articles d'actualité/saison (« c'est la saison des nids », « que faire ») | Image grande et propre, **sans texte**, émotion / curiosité | 16:9, ≥ 1200 px de large, `max-image-preview:large`, image mise en avant |
| **Pinterest** | Comparatifs, cycles, tutoriels (« asiatique ou européen », « le nid au fil de l'année ») | Titre incrusté en gros, format vertical, signature | 2:3 (1000×1500), description ≤ 500 caractères, lien vers la page |
| AI Overviews | Automatique dès que Google Images est bien servi | Balisage `ImageObject` complet | `creator`, `creditText`, `license`, `acquireLicensePage` |

Le champ `serps` de chaque page pilote tout : une image maître (paysage 3:2 ou portrait 2:3)
est générée, puis **recadrée sur le sujet** (stratégie « attention » de sharp) pour chaque
surface compatible.

## 4. Ce qui fait cliquer une vignette (règles encodées dans les prompts et la surcouche)

1. **Un seul sujet**, 40-60 % du cadre, net, centré ou au tiers.
2. **Contraste** : fond plus sombre ou plus clair que le sujet, peu chargé.
3. **Couleur d'accent** (le jaune de la charte) sur le badge — la mosaïque Google Images est
   surtout verte/brune sur ces requêtes, le jaune ressort.
4. **Angle inhabituel** (macro des pattes, contre-jour du nid, technicien vu de dos) : ce qui ne
   ressemble pas à une banque d'images se remarque.
5. **Texte court** ajouté après coup : 2-4 mots en badge (Google Images), titre de 3 lignes
   maximum (Pinterest), aucun texte (Discover). Jamais de texte généré par l'IA (fautes).
6. **Signature** discrète `allo-frelons.fr` : notoriété + protection contre la reprise.
7. **Exactitude** : un frelon asiatique mal dessiné (rayures jaunes) casse la confiance et
   contredit le texte de la page. D'où la fiche morphologique injectée dans chaque prompt.

## 5. Signaux de classement couverts

| Signal | Où c'est traité |
|---|---|
| Nom de fichier = mot-clé | `nomFichier()` — slug de la requête, suffixe de surface |
| Alt descriptif, ≤ 125 caractères | `alt()` |
| Titre / légende / texte autour | `titre()`, `legende()`, `figureHtml()` avec `<figcaption>` |
| Dimensions déclarées, lazy-loading sauf image principale | `figureHtml()` |
| WebP + JPEG de repli, poids maîtrisé | `decliner()` (qualité 80 / 82, mozjpeg) |
| `ImageObject` avec crédit / licence | `imageObject()` |
| `og:image` + `max-image-preview:large` | `balisesHead()` |
| Sitemap images | `sitemapImages()` → `sortie/sitemap-images.xml` |
| IPTC/XMP embarqué | `xmp()` |
| Image hébergée sur le domaine | `donnees/site.json → cheminImages` |
| Fraîcheur et régularité | cadence 2/jour, rotation des pages et des angles |

## 6. Ce que la solution ne fait pas (et pourquoi)

- **Elle ne modifie pas le HTML des pages d'allo-frelons.fr** : le CMS du site n'est pas dans ce
  dépôt. Elle produit le bloc exact à coller (`integration.html`) et, si le site est sous
  WordPress, téléverse dans la médiathèque avec les bons champs et définit l'image mise en avant.
- **Elle ne « scrape » pas les SERP** pour choisir les requêtes : l'inventaire est qualifié à la
  main une fois (30 minutes), enrichi par `npm run importer` à partir du sitemap du site.
- **Elle ne contourne pas les quotas** : à quota gratuit épuisé, la série s'arrête et reprend le
  lendemain.

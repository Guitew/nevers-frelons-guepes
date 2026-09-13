# Charte visuelle des images ALLO FRELONS (orientée clic)

Cette charte est appliquée automatiquement (`config.json → charte`, `outils/lib/images.mjs`).
Elle est là pour qu'un humain puisse juger une image produite en 10 secondes.

## Le test de la vignette

Réduire mentalement l'image à 120 px de large. Si l'on ne reconnaît pas **immédiatement** le
sujet (un frelon, un nid, une combinaison blanche), l'image est à refaire.

## Règles par surface

| | Google Images | Discover | Pinterest |
|---|---|---|---|
| Format | 4:3 — 1200×900 | 16:9 — 1536×864 | 2:3 — 1000×1500 |
| Texte incrusté | Badge jaune, 2-4 mots, bas gauche | Aucun | Titre 1-3 lignes, bas, sur dégradé sombre |
| Signature | `allo-frelons.fr`, bas droite | idem | idem |
| Sujet | Plein cadre, centré | Peut respirer, lecture « carte » | Centré haut (le titre occupe le bas) |
| Exemple de badge/titre | « Frelon asiatique », « Nid sous les tuiles », « Pattes jaunes = asiatique » | — | « Asiatique ou européen ? », « Le nid au fil de l'année » |

## Couleurs

- Accent : `#F5B700` (jaune frelon) — badge et tiret de titre. À remplacer par la couleur de la
  charte réelle du site si elle diffère (`config.json → charte.couleurs.accent`).
- Sombre : `#1C1C1C` — fond de signature, dégradé du titre, contour du texte.
- Clair : `#FFFFFF` — texte.

## Style photographique demandé au générateur

Photographie réaliste, lumière naturelle directionnelle, netteté sur le sujet, arrière-plan
simple et contrasté, **aucun texte ni logo**, aucun visage reconnaissable, pas de rendu « dessin
animé ». Angles privilégiés : macro, contre-jour, vue de dos du technicien, nid en silhouette.

## Exactitude biologique (non négociable)

- Frelon asiatique : thorax **noir**, abdomen sombre à **un seul anneau orange**, **extrémités des
  pattes jaunes**, 2-3 cm.
- Frelon européen : thorax **roux et noir**, abdomen **jaune rayé de noir**, pattes rousses, 2,5-3,5 cm.
- Guêpe : jaune vif rayé de noir, lisse, taille fine, 1,2-1,7 cm.
- Nid de frelon asiatique : sphère beige striée, **entrée latérale**, haut dans un arbre
  (nid primaire : taille d'une orange, entrée par le dessous).
- Nid de guêpes : papier gris, sous un toit / dans un mur / un volet roulant.

Une image qui contredit ces points est rejetée, même si elle est belle.

## Cadence et rotation

- 2 images par jour, sur 2 pages distinctes, jamais deux fois la même page à moins de 7 jours.
- Priorité aux pages « argent » (priorité 1) et à la saison (avril → novembre pour le frelon
  asiatique, mai → septembre pour les guêpes).
- Chaque page dispose de 2 à 4 angles : ils tournent avant toute répétition.

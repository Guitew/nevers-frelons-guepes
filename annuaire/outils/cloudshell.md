# Vitrine Locale : accès Google sans clé pour GitHub Actions

## Ce qui va se passer

Ce guide lance un script qui prépare, dans votre projet Google Cloud, l'accès
sans clé dont l'annuaire a besoin pour lire la Search Console. Il ne crée
aucune clé (votre organisation l'interdit) et se relance sans risque.

Durée : environ deux minutes.

## Choisir le projet

Sélectionnez le projet Google Cloud qui contient déjà votre clé Google Places.

<walkthrough-project-setup></walkthrough-project-setup>

## Lancer l'installation

Cliquez sur l'icône à droite du bloc ci-dessous : la commande se colle dans le
terminal, en bas de l'écran. Appuyez ensuite sur **Entrée**.

```bash
bash annuaire/outils/installer-google.sh {{project-id}}
```

Si une fenêtre « Autoriser Cloud Shell » apparaît, cliquez sur **Autoriser**.

## Récupérer le résultat

À la fin, le terminal affiche deux lignes qui commencent par
`GOOGLE_WORKLOAD_IDENTITY_PROVIDER=` et `GOOGLE_SERVICE_ACCOUNT=`.

Sélectionnez-les à la souris, copiez-les, et collez-les dans la conversation
avec Claude. Elles ne sont pas secrètes. Claude les inscrit dans le workflow,
et le cycle quotidien fait le reste tout seul.

Si le terminal affiche un avertissement sur la règle « partage restreint au
domaine », suivez le lien qu'il donne, puis relancez ce guide.

<walkthrough-conclusion-trophy></walkthrough-conclusion-trophy>

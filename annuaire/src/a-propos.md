---
layout: layouts/page.njk
titre: "Comment fonctionne Vitrine Locale"
meta_titre: "Le projet : un annuaire pour les entreprises sans site web"
meta_description: "Pourquoi cet annuaire existe, d'où viennent les données, comment une fiche est créée, mise à jour puis retirée."
chapo: "Un annuaire n'a d'intérêt que si l'on comprend d'où viennent ses données et à quelles règles il obéit. Voici les nôtres, en clair."
ariane:
  - titre: "Le projet"
    url: "/a-propos/"
---

## Le constat

Une part considérable des entreprises françaises n'a pas de site internet. Non par choix, le plus
souvent : par manque de temps, de budget ou d'appétence. Leur seule présence en ligne est une fiche
Google Business Profile — un nom, une épingle sur une carte, un numéro de téléphone.

Cette fiche est utile, mais elle appartient à Google, n'est pas une page web, et reste largement
invisible pour tout ce qui n'est pas une recherche cartographique. Les moteurs de recherche
classiques et, désormais, les assistants conversationnels ont besoin de **pages** : du texte
structuré, des données lisibles, une adresse stable.

## Ce que fait cet annuaire

Chaque jour, un outil interne repère **{{ site.fichesParJour }} établissements** dont la fiche Google
ne renvoie vers aucun site internet, dans les communes couvertes. Pour chacun, une page est créée
avec :

- l'identité de l'entreprise et son secteur d'activité ;
- l'adresse complète, les coordonnées géographiques et un lien d'itinéraire ;
- le téléphone déclaré ;
- les horaires d'ouverture relevés, jour par jour ;
- les informations pratiques déclarées (accessibilité, moyens de paiement…) ;
- des questions-réponses reprenant ce que les internautes cherchent réellement.

Chaque information est **datée de son relevé**. Rien n'est inventé, rien n'est extrapolé : lorsqu'une
donnée est absente de la fiche Google, elle est absente de la page.

## D'où viennent les données

Les données proviennent des fiches **publiques** Google Business Profile, interrogées via l'API
officielle Google Places. Ce sont les mêmes informations que celles affichées à tout internaute qui
cherche l'entreprise sur Google ou Maps.

Les avis et les notes restent la propriété de Google : la note est reproduite à titre indicatif, avec
sa date de relevé, et n'est pas retraitée. Le contenu des avis n'est pas recopié.

## Le principe du lien

Une page publiée ici n'a de sens que si l'entreprise la reconnaît. Le contrat est simple et
réciproque :

1. l'annuaire publie une page complète, gratuite et sans publicité ;
2. l'entreprise peut déclarer l'adresse de cette page dans le champ « Site Web » de sa fiche Google ;
3. tant que ce lien existe, la page reste en ligne et est mise à jour.

**Si le lien disparaît, la page disparaît.** Un contrôle automatique le vérifie régulièrement. Selon
le cas, l'adresse est redirigée définitivement (301) vers la page de sa catégorie, ou supprimée avec
un code « 410 Gone » qui demande aux moteurs de la retirer de leur index. Aucune page n'est maintenue
contre la volonté de l'entreprise concernée.

Les fiches nouvellement publiées bénéficient d'un **délai de grâce** : elles ne sont jamais retirées
avant que l'entreprise ait eu le temps matériel de prendre connaissance de leur existence.

## Lisible par les moteurs et par les assistants

Le site est entièrement statique : du HTML, du CSS, quelques kilooctets de JavaScript facultatif.
Pas de rendu côté client, pas de mur de cookies, pas de traceur. Chaque page fournit :

- des données structurées [schema.org](https://schema.org/LocalBusiness) (entreprise, fil d'Ariane, questions fréquentes) ;
- un [fichier `llms.txt`]({{ "/llms.txt" | url }}) décrivant le site aux robots des modèles de langage ;
- une **version Markdown** de chaque fiche, accessible en ajoutant `index.md` à son adresse ;
- un [sitemap]({{ "/sitemap.xml" | url }}) et un [flux Atom]({{ "/flux.xml" | url }}) tenus à jour à chaque publication.

## Vous dirigez une entreprise référencée

Vous restez maître de votre fiche. Consultez la page
[« Vous dirigez une entreprise »]({{ "/entreprises/" | url }}) ou demandez directement une
[correction ou un retrait]({{ "/signaler/" | url }}).

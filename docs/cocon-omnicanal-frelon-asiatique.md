# Plan de transformation omnicanale — Cocon « Frelon asiatique » (Allo Frelons)

## 1. Contexte & hypothèses

- **Inputs reçus** : cocon texte existant sur `observatoire-biodiversite-npdc.fr` (pilier + 5
  dossiers), page argent `allo-frelons.fr/frelon-asiatique` + pages intervention Nord 59 /
  Pas-de-Calais 62, brief Thot-SEO « frelon asiatique » (SERP informationnelle, 6 intentions).
- **Objectif business prioritaire** : **générer des demandes d'intervention** (appels/devis) pour
  Allo Frelons, en s'appuyant sur l'autorité informationnelle du site observatoire.
- **Double convergence assumée** : le cocon vit sur **deux sites** — l'observatoire (colonne
  vertébrale informationnelle, TOFU/MOFU) et Allo Frelons (BOFU, conversion). Chaque canal externe
  **reconverge vers les contenus d'Allo Frelons**, en s'appuyant sur les dossiers de l'observatoire
  comme relais éducatif.
- **Hypothèses posées (ressources non précisées)** — à valider :
  - production **artisanale et de terrain** : tournage smartphone lors des interventions réelles,
    montage léger, 1 personne ;
  - activité **fortement locale et saisonnière** (pic mai–septembre) → cadence resserrée en saison ;
  - canaux réalistes : **YouTube, Shorts/Reels/TikTok, fiche Google Business Profile, Facebook
    local, Pinterest, newsletter** ; pas de studio ni de budget publicitaire supposé.
  - Si ces hypothèses sont fausses, ajuster la Phase 6 (priorisation).

## 2. Squelette sémantique reconstruit

| Nœud | Page (colonne vertébrale) | Funnel | Intention | Entités clés |
|------|---------------------------|--------|-----------|--------------|
| **N0 – Pilier** | `/especes/frelon-asiatique/` | pivot | « frelon asiatique » (vue d'ensemble) | *Vespa velutina nigrithorax*, frelon à pattes jaunes |
| N1 | `/dossiers/frelon-asiatique-ou-europeen-reconnaitre/` | TOFU | reconnaître / différence | *Vespa crabro*, thorax noir, pattes jaunes |
| N2 | `/dossiers/frelon-asiatique-danger-piqure/` | TOFU | danger, piqûre | danger sanitaire, piqûres multiples |
| N3 | `/dossiers/nid-frelon-asiatique-reconnaitre-cycle/` | TOFU→MOFU | nid & cycle | nid primaire/secondaire, reine fondatrice |
| N4 | `/dossiers/frelon-asiatique-abeilles-menace/` | TOFU | impact abeilles | abeille domestique, pollinisation, ruche |
| **N5 – pont** | `/dossiers/que-faire-nid-frelon-asiatique-signalement/` | **MOFU** | que faire / qui appeler | destruction des nids, signalement, professionnel |
| **BOFU** | `allo-frelons.fr/frelon-asiatique` + interventions 59/62 | **BOFU** | intervention / devis | Allo Frelons, urgence, local |

**Nœuds à fort potentiel de déclinaison** (riches en visuel/émotion/geste) : **N1** (comparaison
visuelle), **N3** (nid spectaculaire, cycle = timeline), **N4** (prédation d'abeilles = charge
émotionnelle), **N5** (démonstration d'intervention = geste métier). Ce sont les premiers à décliner.

## 3. Stratégie omnicanale (nœud → canal → format)

- **N1 Reconnaître** → **Infographie comparative** (asiatique vs européen, côte à côte) + **Short**
  « asiatique ou européen ? le seul critère fiable : les pattes jaunes » + intégration YouTube.
  *Pourquoi : intention visuelle et comparative, forte en recherche sociale et Pinterest.*
- **N2 Danger** → **Short FAQ** « le frelon asiatique est-il dangereux ? » + **section FAQ optimisée
  AI Overviews** sur la page. *Pourquoi : question courte, réponse directe = surface générative.*
- **N3 Nid & cycle** → **Infographie « cycle du nid sur l'année »** (Pinterest/Discover) + **vidéo
  YouTube** « reconnaître un nid de frelon asiatique ». *Pourquoi : process/timeline = infographie ;
  repérage = démonstration vidéo.*
- **N4 Abeilles** → **Reels/TikTok** (vol stationnaire devant la ruche, images fortes) + **post
  Facebook/partenariat apiculteurs locaux**. *Pourquoi : charge émotionnelle = social + notoriété
  locale.*
- **N5 Que faire (pont MOFU)** → **Vidéo YouTube « destruction d'un nid » (démonstration métier)** +
  **Shorts découpés** (avant/après, nid haut perché, le geste sécurisé) + **posts Google Business
  Profile** + **newsletter**. *Pourquoi : « comment se débarrasser » = requête MOFU/BOFU la plus
  proche de la conversion → c'est LE nœud qui pousse vers Allo Frelons.*
- **N0 Pilier** → **hub** qui embarque la vidéo longue + les infographies (voir Phase 4) ; optimisé
  **AI Overviews** (structure Q/R déjà en place).

> **Google Business Profile** est traité comme un canal à part entière : c'est la surface la plus
> proche de la conversion locale (« frelon asiatique [ville] », appels, itinéraire).

## 4. Architecture de convergence (le cœur)

**Règle** : chaque contenu externe ramène vers **le nœud qui traite la même intention**, et les
nœuds MOFU/BOFU pointent vers **Allo Frelons**.

| Canal / format | Lien retour (ancre / mention) | Cible |
|---|---|---|
| YouTube « destruction d'un nid » (N5) | description → « faire intervenir un pro » | **allo-frelons.fr** (intervention 59/62) + N5 |
| Short « pattes jaunes » (N1) | bio / épinglé → « tout reconnaître » | dossier N1 (observatoire) → puis Allo Frelons |
| Short danger (N2) | « que faire face à un nid » | N5 → Allo Frelons |
| Infographie nid/cycle (N3) Pinterest | pin → « le guide du nid » | dossier N3 → N5 → Allo Frelons |
| Reels abeilles (N4) | « protéger les ruches : signaler & agir » | N5 → Allo Frelons |
| Google Business Profile (N5) | post + bouton | **allo-frelons.fr** (intervention locale) |
| Newsletter (N5/N0) | bouton « demander une intervention » | **allo-frelons.fr** |

**Modules hub à embarquer sur les pages du cocon** (à implémenter quand les contenus existent) :
- page N5 (« que faire ») : **vidéo YouTube d'intervention** embarquée + boutons 59/62 déjà en place ;
- page N3 (« nid & cycle ») : **infographie du cycle** ;
- page N1 (« reconnaître ») : **infographie comparative** ;
- pilier N0 : vidéo longue + lien vers les infographies.

**Préservation du maillage interne** : l'omnicanal **n'altère pas** le silo texte existant
(descendant pilier→dossiers, montant dossiers→pilier, lien argent d'ancre exacte sur le pilier). Les
embeds s'ajoutent, ils ne remplacent aucun lien.

## 5. Cohérence sémantique & entités

- **Champ lexical pivot** (identique sur tous les canaux) : frelon asiatique, frelon à pattes jaunes,
  *Vespa velutina nigrithorax*, *Vespa crabro* (européen), nid primaire/secondaire, reine fondatrice,
  colonie annuelle, abeille/ruche, danger sanitaire, destruction des nids, signalement.
- **Formes canoniques des entités** (à écrire toujours pareil) : « frelon asiatique (*Vespa velutina*) »,
  « frelon à pattes jaunes », « Allo Frelons », « Nord (59) / Pas-de-Calais (62) ».
- **Contrôle de cannibalisation cross-canal** : une seule requête « comment se débarrasser / destruction
  nid » portée par **N5 + la vidéo YouTube** (hiérarchie claire : la vidéo renvoie à N5 qui renvoie à
  Allo Frelons) — pas deux contenus concurrents sur la même requête sans lien.

## 6. Plan de déploiement (vagues)

- **Vague 1 — pilote (valider la chaîne)** : filmer **une intervention réelle** → 1 vidéo YouTube (N5)
  + 3 Shorts + 1 post Google Business Profile. Embarquer la vidéo sur la page N5. C'est le chemin le
  plus court vers la conversion.
- **Vague 2 — captation TOFU** : infographie comparative (N1) + infographie cycle du nid (N3),
  déclinées Pinterest + carrousels + embed sur les dossiers ; Short « pattes jaunes ».
- **Vague 3 — notoriété & fidélisation** : Reels abeilles (N4) + partenariat apiculteurs locaux ;
  lancement **newsletter** saisonnière (« c'est la saison des nids »).
- **Cadence tenable** : 1 tournage / mois hors saison, 1 / semaine en pic (mai–septembre) grâce au
  réemploi (1 tournage → 5-6 contenus). Séquence : **texte (fait) → vidéo → découpes sociales → GBP**.

## 7. Mesure & pilotage

- **KPIs par canal** : vues YouTube + durée de visionnage ; taux de rétention Shorts ; enregistrements
  Pinterest ; actions Google Business Profile (**appels, demandes d'itinéraire, clics site**).
- **KPIs de convergence** (les plus importants) : trafic référé **canal → observatoire → Allo Frelons**,
  clics sortants vers les pages d'intervention, **appels/devis attribués**, progression du cluster
  « frelon asiatique » (positions + apparition en AI Overviews).
- **Traçage** : **UTM** sur tous les liens retour (`utm_source=youtube&utm_medium=video&utm_campaign=frelon-asiatique`),
  suivi des appels via le numéro de la fiche Google Business, IDs de campagne par vague.

---

### Récapitulatif en une phrase

Un seul **tournage d'intervention** nourrit une vidéo YouTube + des Shorts + un post Google Business,
qui renvoient tous vers le dossier **« que faire face à un nid »** de l'observatoire — lequel, comme
le pilier, pousse vers **Allo Frelons** : la découverte sociale (TOFU) descend, via l'autorité
informationnelle, jusqu'à la **demande d'intervention** (BOFU).

---

## Pièce 2 — Matrice opérationnelle (document de travail)

| Nœud | Funnel | Canal | Format | Angle natif | Requête visée | Lien retour (→ ancre) | Module hub | Vague | Effort | KPI |
|---|---|---|---|---|---|---|---|---|---|---|
| N5 Que faire | MOFU→BOFU | YouTube | Vidéo 5-8 min | « Destruction d'un nid de frelon asiatique : comment on intervient » | comment se débarrasser frelon asiatique | desc. → allo-frelons.fr (intervention) + N5 « la marche à suivre » | vidéo embed sur N5 | **1** | Élevé | vues, clics sortants, appels |
| N5 Que faire | BOFU | Google Business | Post + photo | « Nid détruit à [ville] cette semaine » | frelon asiatique [ville] | bouton → allo-frelons.fr | — | **1** | Faible | appels, itinéraires |
| N5 Que faire | TOFU | Shorts/Reels/TikTok | 3 Shorts (avant/après, nid perché, geste) | « Ce nid faisait la taille d'un ballon » | nid frelon asiatique | épinglé/bio → N5 → Allo Frelons | — | **1** | Faible | rétention, vues |
| N1 Reconnaître | TOFU | Infographie | Comparatif côte à côte | asiatique vs européen : le bon critère | différence frelon asiatique européen | pin/desc → N1 | infographie embed sur N1 | **2** | Moyen | enregistrements, trafic référé |
| N1 Reconnaître | TOFU | Short | 30 s | « Regardez les pattes » | reconnaître frelon asiatique | bio → N1 | — | **2** | Faible | vues |
| N3 Nid & cycle | TOFU→MOFU | Infographie | Timeline de l'année | du nid primaire au gros nid d'automne | cycle nid frelon asiatique | Pinterest/Discover → N3 | infographie embed sur N3 | **2** | Moyen | enregistrements, Discover |
| N2 Danger | TOFU | Short + FAQ | Q/R 30 s + section FAQ | « Dangereux ? Oui, mais seulement là » | frelon asiatique danger | → N2 | FAQ AI Overviews sur N2 | **2** | Faible | apparition AIO, vues |
| N4 Abeilles | TOFU | Reels/TikTok | Images de prédation | « Il chasse les abeilles devant la ruche » | frelon asiatique abeilles | → N4 → N5 | — | **3** | Moyen | partages, notoriété |
| N4 Abeilles | TOFU | Facebook local / partenariat | Post + relais apiculteurs | protéger les ruches locales | — | → N4 | — | **3** | Faible | portée locale, leads |
| N0 / N5 | MOFU→BOFU | Newsletter | Encart saisonnier | « C'est la saison des nids » | — | bouton → allo-frelons.fr | — | **3** | Faible | taux de clic, appels |

**Grappe de réemploi vague 1** : 1 tournage d'intervention → 1 vidéo longue + 3 Shorts + 1 audiogramme éventuel + 1 post Google Business + 1 embed sur la page N5. Coût marginal faible, cohérence sémantique maximale.

# Netlinking — prospection de spots pour ALLO FRELONS

Outil autonome (Node ≥ 18, **aucune dépendance**) qui explore le Web pour repérer les
endroits où l'on peut déposer facilement un lien ou une citation vers **allo-frelons.fr** —
ou vers les pages qui pointent déjà vers lui — et qui qualifie chaque « spot » :

- **peut-on y publier ?** commentaire de blog, message de forum, fiche d'annuaire, entrée de
  livre d'or, réponse à une question, avis, article invité, page de liens, liste de
  prestataires à compléter, mention de la marque sans lien ;
- **Google et Bing le verront-ils ?** page en 200, sans `noindex`, canonique propre, Googlebot et
  bingbot autorisés par le robots.txt, liens en `dofollow` / `ugc` / `nofollow` dans la zone où
  l'on publierait, commentaires rendus dans la page (et non par un widget JavaScript) ;
- **les IA le reprendront-elles ?** robots IA (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot,
  Google-Extended…) autorisés, contenu textuel, plateformes que les assistants citent
  volontiers (forums, questions/réponses, wikis, listes) ;
- **quelle page pousser, avec quelle ancre ?** niveau 1 (une page d'allo-frelons.fr proche du
  thème) pour les spots solides, niveau 2 (une page « relais » qui fait déjà un lien vers
  allo-frelons.fr) pour les spots de masse ou en `nofollow`.

> L'outil **repère et qualifie**. Il ne publie jamais rien : poster automatiquement des
> commentaires ou des fiches, c'est du spam (pénalisé par Google, banni par les sites). Le
> rapport est fait pour qu'un humain intervienne, avec un texte utile et adapté à chaque endroit.

## Démarrage

```bash
cd netlinking
npm test                          # 55 tests, sans réseau (serveur local)
node outils/chercher.mjs --generer   # voir les requêtes d'empreinte générées
npm run explorer -- --url=https://exemple.fr/   # explorer un site
npm run rapport                   # donnees/rapport.csv + donnees/rapport.md
```

Sans clé d'API, l'outil explore les **graines** (`donnees/graines.txt`), les URLs passées en
argument, puis les liens qu'il découvre (internes, et externes thématiques : blogrolls,
partenaires…). Avec une clé de moteur de recherche (voir `.env.exemple`), `npm run chercher`
lance en plus les requêtes d'empreinte et remplit la frontière tout seul.

## Les commandes

| Commande | Rôle |
|---|---|
| `npm run chercher` | lance les requêtes d'empreinte dues (budget `moteurs.requetesParExecution`) sur Brave, Serper (Google) ou Google Programmable Search ; `--generer` les affiche, `--generer --ecrire` les fige dans `donnees/requetes.txt`, `--requete="…"` en lance une, `--si-possible` n'échoue pas sans clé |
| `npm run explorer` | visite la frontière (budget `exploration.pagesParExecution`), qualifie, enregistre ; `--url=…` (répétable), `--graines=fichier`, `--max=N`, `--sans-externes`, `--duree=minutes`, `--silencieux` |
| `npm run rapport` | écrit `donnees/rapport.csv` (toutes colonnes) et `donnees/rapport.md` (top 100) ; `--min=`, `--type=`, `--etat=`, `--limite=` |
| `npm run marquer -- --url=… --etat=fait` | consigne le travail (`a-traiter`, `en-cours`, `fait`, `rejete`, `--note="…"`) ; `--domaine=x.fr --etat=rejete` rejette tout un domaine et l'ajoute à `donnees/exclusions.txt` |
| `npm run cibles` | lit le sitemap d'allo-frelons.fr (pages cibles + mots-clés) ; `--titres` lit aussi les titres ; `--relais=URL` déclare une page relais ; `--csv=export.csv` importe un export Search Console (« Sites les plus liés ») ; `--verifier` revisite les relais |
| `npm run indexation` | demande au moteur si les meilleurs spots sont indexés (`site:`) — un spot non indexé n'apporte rien |
| `npm run cycle` | chercher (si clé) → explorer → rapport |

## Comment ça marche

```
requêtes d'empreinte ──┐
graines.txt ───────────┼──► frontière (file de priorité, un hôte à la fois) ──► téléchargeur poli
liens découverts ──────┘                                                          │ robots.txt, délais,
                                                                                  │ taille et durée bornées
                                              analyse HTML (liens + contexte, formulaires, méta)
                                                                                  │
   détection ──► indexabilité ──► robots IA ──► pertinence ──► scores ──► cible suggérée
                                                                                  │
                                      donnees/spots.json (mémoire, versionnée)  ◄─┘
                                      donnees/cibles.json (pages du site + relais)
                                      donnees/exploration.json (vues, frontière, hôtes)
```

### Détection (`outils/lib/detection.mjs`)

Heuristiques lisibles, chacune laissant un **signal** dans le rapport :

| Type | Ce qui est reconnu |
|---|---|
| Commentaire de blog | formulaire natif (WordPress, SPIP, Dotclear, Blogger, Overblog, Canalblog…) avec zone de texte, champ « site web », captcha, connexion requise, modération annoncée, commentaires fermés, nombre de commentaires existants, `rel` des liens des commentaires. Un widget (Disqus, Facebook…) est signalé comme non indexé |
| Forum | phpBB, XenForo, vBulletin, MyBB, SMF, Invision, Discourse, Flarum, Forumactif… ou structure de forum (sujets + inscription) ; liens des messages et des signatures |
| Annuaire | formulaire d'ajout (URL + titre/description/catégorie) ou lien « ajouter votre site » |
| Livre d'or | page ou formulaire « livre d'or » / guestbook |
| Wiki | MediaWiki, DokuWiki, lien de modification |
| Questions / réponses | « poser une question », « répondre », Question2Answer… |
| Avis / témoignages | formulaire ou invitation à déposer un avis |
| Article invité / communiqué | « écrire pour nous », « proposer un article », « publier un communiqué »… |
| Page de liens / partenaires | pages « liens utiles », « sites amis » avec au moins 5 liens externes |
| Liste de prestataires | page thématique (frelons, guêpes, nuisibles…) qui liste des professionnels, ou qui cite un **concurrent** (`config.concurrents.domaines`) |
| Mention sans lien | la page parle d'ALLO FRELONS sans lien vers le site : demander le lien est le spot le plus rentable |
| Relais | la page fait **déjà** un lien vers allo-frelons.fr : elle rejoint `cibles.relais` (niveau 2) au lieu des spots |

### Scores (`outils/lib/score.mjs`)

- **SEO** (0-100) : base par type × pertinence thématique (thèmes `principaux` / `connexes`
  de `config.json`), + liens dofollow / − nofollow, + champ site web, + concurrent cité,
  + indexable, + localité citée (`zones.liste`), − widget, − commentaires fermés, − page non
  francophone.
- **IA** (0-100) : base par type × pertinence, + robots IA autorisés (− 30 s'ils sont tous
  bloqués), + page indexable, + contenu long, + localité.
- **Facilité** : `immediate` (formulaire ouvert), `inscription` (compte à créer), `contact`
  (écrire au site : liste, mention, article invité, page de liens).
- **Priorité** = 0,55 × SEO + 0,35 × IA + bonus de facilité. C'est l'ordre du rapport.

### Cible suggérée

Les spots éditoriaux (liste de prestataires, mention sans lien, article invité, page de liens,
annuaire) visent **allo-frelons.fr** — la page dont les mots-clés recoupent le mieux le spot.
Les spots de masse (commentaires, livres d'or, profils) et les spots faibles (score SEO
< `score.seuilNiveau1`, liens nofollow, page non indexable) visent une **page relais** :
une page tierce qui pointe déjà vers allo-frelons.fr. Renforcer ces pages consolide les liens
existants sans exposer le site principal à des liens de faible qualité. Les ancres proposées
restent naturelles : marque, URL nue, titre de la page cible, marque + localité.

Les relais se découvrent de trois façons : l'exploration (toute page rencontrée qui lie
allo-frelons.fr), les requêtes de marque (`"allo frelons"`, `"allo-frelons.fr"`), et l'import
de l'export Search Console (`npm run cibles -- --csv=…`). `npm run cibles -- --verifier`
contrôle que le lien y est toujours.

## Politesse et limites

- **robots.txt respecté** (groupe `AlloFrelonsBot`, sinon `*`, `Crawl-delay` honoré jusqu'à
  15 s) ; un hôte dont le robots.txt ne répond pas est laissé tranquille jusqu'à
  `revisiteJours`.
- **Un accès à la fois par hôte**, 2,5 s minimum entre deux accès, au plus `pagesParHote` pages
  par site, 2 Mo et 15 s par page, 4 hôtes en parallèle. Un site n'est jamais « aspiré ».
- Les gros réseaux sociaux et plateformes inutiles (`exploration.domainesIgnores`) ne sont
  jamais visités.
- Le User-Agent se présente et donne l'adresse du site (`exploration.userAgent`).
- Les scores sont **des heuristiques** : un humain relit les signaux avant d'agir. Le champ
  « Indexée » n'est renseigné que par `npm run indexation` (requête `site:`), et reste indicatif.
- **Moteurs** : Microsoft a fermé les API Bing Search en août 2025 ; Serper (résultats Google)
  et Brave les remplacent, Google Programmable Search reste gratuit à 100 requêtes/jour.

## Fichiers

```
netlinking/
├── config.json           site, thèmes, zones, concurrents, politesse, moteurs, empreintes, seuils
├── .env.exemple          clés d'API (BRAVE_API_KEY, SERPER_API_KEY, GOOGLE_CSE_KEY/CX) — optionnelles
├── donnees/
│   ├── graines.txt       URLs de départ (à compléter)
│   ├── requetes.txt      requêtes d'empreinte (vide = générées depuis config.json)
│   ├── exclusions.txt    domaines rejetés à la main
│   ├── cibles.json       pages d'allo-frelons.fr + pages relais
│   ├── spots.json        LA mémoire : tous les spots, leurs signaux, leur état
│   ├── exploration.json  URLs vues, frontière, compteurs par hôte, requêtes lancées
│   ├── rapport.csv       export tableur (séparateur « ; », UTF-8 avec BOM)
│   └── rapport.md        top 100 lisible sur GitHub
└── outils/
    ├── explorer.mjs · chercher.mjs · rapport.mjs · marquer.mjs · cibles.mjs · indexation.mjs
    ├── lib/              html (analyseur sans dépendance), detection, score, indexabilite, robots,
    │                     telechargeur, exploration, spots, cibles, requetes, moteurs/…
    └── tests/            node --test : unitaires + bout en bout sur un serveur HTTP local
```

## Automatisation

Deux workflows GitHub Actions à la racine du dépôt :

- `netlinking-controle.yml` : tests sur chaque modification de `netlinking/` ;
- `netlinking-hebdo.yml` : chaque lundi (et à la demande), `chercher` (si une clé est
  définie dans les secrets), `explorer`, `rapport`, puis commit de `donnees/`. Le rapport
  Markdown est donc toujours lisible dans le dépôt, et chaque nouveau spot apparaît en diff.

## Lire un rapport, puis agir

1. Ouvrir `donnees/rapport.csv` dans un tableur, trier par **Priorité**.
2. Traiter d'abord les **mentions sans lien** et les **listes de prestataires** (un courriel
   suffit souvent : « vous parlez de nous / vous listez les intervenants du secteur, pourriez-vous
   ajouter un lien vers … »).
3. Sur les **forums** et **questions/réponses** thématiques, répondre utilement (identification,
   conduite à tenir, qui appeler) en citant ALLO FRELONS et la localité : la citation compte pour
   les IA même en nofollow.
4. Sur les **commentaires** et **livres d'or**, contribuer avec un vrai apport, le lien allant
   vers la page relais suggérée.
5. Marquer : `npm run marquer -- --url=… --etat=fait --note="…"`. Le spot sort du rapport, le
   dépôt garde la trace.

# Cocon sémantique — Frelon asiatique (Vespa velutina)

**Site d'autorité** : observatoire-biodiversite-npdc.fr
**Page argent (BOFU, externe)** : https://allo-frelons.fr/frelon-asiatique
**Persona** : particulier qui vient de repérer / d'apercevoir un frelon ou un nid, inquiet, cherche
d'abord à comprendre (identifier, évaluer le danger) puis à agir (faire intervenir).
**Action de conversion** : faire appel à un professionnel (pages d'intervention Allo Frelons 59/62)
+ transmission d'autorité vers la page argent via le pilier.

> Cocon construit sans export Haloscan, à partir de la connaissance du sujet et du sitemap
> existant. Les volumes de recherche ne sont donc pas chiffrés ici (« non fournis ») ; l'ossature
> repose sur les intentions de recherche connues du domaine.

## Architecture (mind map, colorée par étape d'entonnoir)

```mermaid
flowchart TD
    ARG["💰 PAGE ARGENT (BOFU externe)<br/>allo-frelons.fr/frelon-asiatique"]:::argent

    PIL["🎯 PILIER in-situ<br>/especes/frelon-asiatique/<br><i>fiche — nœud de convergence</i>"]:::pilier

    MOFU["🛟 MOFU — page-pont<br>/dossiers/que-faire-nid-frelon-asiatique-signalement/<br><i>que faire · signalement · intervention</i>"]:::mofu

    T1["🔍 TOFU<br>reconnaître asiatique / européen"]:::tofu
    T2["⚠️ TOFU<br>danger &amp; piqûre"]:::tofu
    T3["🪺 TOFU<br>le nid &amp; son cycle"]:::tofu
    T4["🐝 TOFU<br>menace pour les abeilles"]:::tofu

    HUB["🧭 Hub thématique<br>/especes-exotiques-envahissantes/"]:::hub

    T1 --> MOFU
    T2 --> MOFU
    T3 --> MOFU
    T4 --> MOFU
    MOFU --> PIL
    T1 -.remonte.-> PIL
    T2 -.remonte.-> PIL
    T3 -.remonte.-> PIL
    T4 -.remonte.-> PIL
    PIL --> ARG
    MOFU --> ARG
    HUB --> PIL
    HUB --> T1 & T2 & T3 & T4 & MOFU
    T1 <-.transversal.-> T3

    classDef argent fill:#b8143c,stroke:#7a0d28,color:#fff;
    classDef pilier fill:#123a2b,stroke:#0f3324,color:#fff;
    classDef mofu fill:#b9843d,stroke:#8a601f,color:#fff;
    classDef tofu fill:#2e7d5b,stroke:#1d5c43,color:#fff;
    classDef hub fill:#1b3a5b,stroke:#12283f,color:#fff;
```

## Le parcours de conversion, en une phrase

Une porte d'entrée **TOFU** (l'internaute veut *reconnaître*, *évaluer le danger*, comprendre le
*nid* ou la *menace sur les abeilles*) → descente vers la page **MOFU** *« que faire face à un
nid »* → **conversion** : appel à un professionnel (Allo Frelons 59/62) **et** remontée d'autorité
vers le **pilier** (fiche frelon asiatique) qui transmet le jus à la **page argent** via un lien
d'ancre exacte « frelon asiatique ».

## Les nœuds

| Rôle | Page | Étape | Intention |
|------|------|-------|-----------|
| Pilier (relais BOFU) | `/especes/frelon-asiatique/` | pivot | Le frelon asiatique (espèce) — **à améliorer**, existant |
| Fille MOFU (pont) | `/dossiers/que-faire-nid-frelon-asiatique-signalement/` | MOFU | que faire, signalement, qui appeler |
| Fille TOFU | `/dossiers/frelon-asiatique-ou-europeen-reconnaitre/` | TOFU | différence asiatique / européen |
| Fille TOFU | `/dossiers/frelon-asiatique-danger-piqure/` | TOFU | danger, piqûre |
| Fille TOFU | `/dossiers/nid-frelon-asiatique-reconnaitre-cycle/` | TOFU | reconnaître le nid, cycle |
| Fille TOFU | `/dossiers/frelon-asiatique-abeilles-menace/` | TOFU | impact sur les abeilles |
| Hub | `/especes-exotiques-envahissantes/` | — | dossier EEE (accès menu) |

## Règles de maillage appliquées

- **Descendant** : le pilier (section « Le frelon asiatique en détail ») et le hub EEE lient les 5 dossiers.
- **Montant** : chaque dossier remonte vers le pilier (fiche) avec des **ancres variées** (jamais l'ancre exacte en interne).
- **Chemin de conversion** : chaque page TOFU pousse d'un cran vers la page MOFU ; la MOFU pousse vers l'intervention (pages 59/62) → pas de feuille orpheline.
- **Ancre exacte réservée** : le lien vers la page argent avec l'ancre exacte « frelon asiatique » reste sur le **pilier** uniquement, pour éviter la sur-optimisation.
- **Transversal justifié** : reconnaissance ↔ nid ; abeilles ↔ fiche abeille domestique ; danger ↔ frelon européen.

## Anti-cannibalisation

- La fiche `/especes/frelon-asiatique/` **existait déjà** → statut **« à améliorer »** : elle reste
  le pilier (page espèce, vue d'ensemble), enrichie d'une section liant les dossiers. Les 5 dossiers
  couvrent des **intentions distinctes** (comparaison, danger, nid, abeilles, que faire) et ne se
  cannibalisent pas entre eux ni avec la fiche.
- Chaque intention = **une seule page**.

## Suite possible

- Rédaction fine d'une page à partir d'un export **Thot-SEO** (phase 2 du skill cocon) pour caler
  précisément le champ lexical obligatoire.
- Extension du cocon (frelon européen, guêpes, nids dans un mur/toiture) si les volumes le justifient.
- Déclinaison **omnicanale** (vidéo, infographie, réseaux) via le skill `cocon-omnicanal`.

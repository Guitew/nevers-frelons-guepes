/**
 * Notation des spots.
 *
 *   scoreSeo  (0-100) : valeur du lien pour Google et Bing — page indexable,
 *                       lien suivi (dofollow) plutôt que nofollow/ugc, page
 *                       thématique et locale, spot éditorial plutôt que UGC.
 *   scoreIa   (0-100) : valeur de la citation pour les assistants IA — robots IA
 *                       autorisés, contenu textuel rendu côté serveur, plateformes
 *                       que les LLM reprennent volontiers (forums, Q/R, wikis, listes),
 *                       thème et localité (la mention « ALLO FRELONS à Lille » compte
 *                       même sans lien).
 *   facilite            : immediate (formulaire ouvert), inscription (compte à créer),
 *                       contact (il faut écrire au site).
 *   priorite  (0-100) : ordre de traitement du rapport.
 *
 * Cible suggérée : niveau 1 (allo-frelons.fr, page la plus proche du thème) pour les
 * spots solides, niveau 2 (une page « relais » qui pointe déjà vers allo-frelons.fr)
 * pour les spots de masse ou nofollow, afin de renforcer les liens existants sans
 * exposer le site principal à des liens de faible qualité.
 */

import { compterOccurrences, empreinte, expressionsPresentes, motsSignificatifs, normaliser } from "./texte.mjs";
import { domaineDe } from "./url.mjs";
import { DEPARTEMENTS, departementsCites, jetonsDepartement, jetonsNumeros } from "./departements.mjs";

const BASE_SEO = {
  "liste-prestataires": 70,
  "mention-non-liee": 74,
  "article-invite": 60,
  annuaire: 50,
  forum: 48,
  "question-reponse": 46,
  wiki: 34,
  avis: 36,
  "page-liens": 52,
  commentaire: 40,
  "livre-dor": 30,
  profil: 24,
};

const BASE_IA = {
  "liste-prestataires": 66,
  "mention-non-liee": 62,
  "article-invite": 58,
  annuaire: 44,
  forum: 58,
  "question-reponse": 62,
  wiki: 56,
  avis: 52,
  "page-liens": 36,
  commentaire: 40,
  "livre-dor": 22,
  profil: 18,
};

/** Types dont la pertinence est acquise par construction (la marque ou le métier y figurent déjà). */
const PERTINENCE_PLANCHER = { "mention-non-liee": 1, "liste-prestataires": 0.8 };

const FACILITE = {
  "liste-prestataires": "contact",
  "mention-non-liee": "contact",
  "article-invite": "contact",
  annuaire: "immediate",
  forum: "inscription",
  "question-reponse": "inscription",
  wiki: "inscription",
  avis: "immediate",
  "page-liens": "contact",
  commentaire: "immediate",
  "livre-dor": "immediate",
  profil: "inscription",
};

/** Ordre de facilité pour le tri. */
export const ORDRE_FACILITE = { immediate: 3, inscription: 2, contact: 1 };

/** Mots trop généraux pour orienter vers une page plutôt qu'une autre. */
const MOTS_BANALS = new Set(
  "ville commune mairie conseil departement region france site page entreprise societe professionnel expert service intervention destruction traitement elimination lutte lutter faire cas contre nid guide complet tout savoir conseil conseils comment pourquoi quoi que quel quelle quels quelles avec pour dans sur chez votre notre nos vos mon les des une des".split(" ")
);

/** Radical grossier : le pluriel ne doit pas séparer « frelons » de « frelon ». */
function radical(mot) {
  const m = normaliser(mot);
  return m.length > 4 && m.endsWith("s") ? m.slice(0, -1) : m;
}

const cacheFrequences = new WeakMap();

/** Nombre de pages cibles contenant chaque mot-clé (calculé une fois par jeu de cibles). */
function frequencesMots(cibles, pages) {
  if (cibles && cacheFrequences.has(cibles) && cacheFrequences.get(cibles).taille === pages.length) return cacheFrequences.get(cibles).frequences;
  const frequences = new Map();
  for (const p of pages) for (const m of new Set((p.motsCles || []).map((x) => radical(x)))) frequences.set(m, (frequences.get(m) || 0) + 1);
  if (cibles) cacheFrequences.set(cibles, { taille: pages.length, frequences });
  return frequences;
}

/** Nombre de segments du slug d'une URL (« /nid-de-guepes » → 3). */
function segmentsSlug(u) {
  try {
    return new URL(u).pathname.split(/[-_/.]+/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

function normaliserUrlSimple(u) {
  return String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
}

/** decodeURIComponent tolérant : une URL mal encodée (%E9 en Latin-1) ne doit pas faire échouer la notation. */
function decoderSansErreur(u) {
  try {
    return decodeURIComponent(u);
  } catch {
    return String(u || "");
  }
}

function borner(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Pertinence thématique (0-1) et thèmes/zones trouvés. */
export function pertinence(page, url, config) {
  const principaux = config.themes?.principaux || [];
  const connexes = config.themes?.connexes || [];
  const zones = config.zones?.liste || [];
  const titre = normaliser([page.titre, page.h1].join(" "));
  const entetes = normaliser(page.entetes.map((e) => e.texte).join(" "));
  const urlN = normaliser(decoderSansErreur(url).replace(/[-_/.]+/g, " "));
  const texte = normaliser(page.texte).slice(0, 60_000);

  let points = 0;
  const themes = [];
  for (const t of principaux) {
    const dansTitre = expressionsPresentes(titre + " " + urlN, [t]).length > 0;
    const occurrences = compterOccurrences(texte, t);
    if (dansTitre || occurrences) themes.push(t);
    points += (dansTitre ? 6 : 0) + Math.min(occurrences, 5) * 1.2 + (expressionsPresentes(entetes, [t]).length ? 2 : 0);
  }
  for (const t of connexes) {
    const dansTitre = expressionsPresentes(titre + " " + urlN, [t]).length > 0;
    const occurrences = compterOccurrences(texte, t);
    if (dansTitre || occurrences) themes.push(t);
    points += (dansTitre ? 2.5 : 0) + Math.min(occurrences, 4) * 0.5;
  }
  const zonesTrouvees = expressionsPresentes(titre + " " + texte, zones);
  for (const d of departementsCites(titre + " " + texte.slice(0, 20_000))) if (!zonesTrouvees.includes(d.nom)) zonesTrouvees.push(d.nom);
  return {
    score: Math.min(1, points / 18),
    themes: [...new Set(themes)].slice(0, 8),
    zones: zonesTrouvees.slice(0, 6),
    themeFort: principaux.some((t) => themes.includes(t)),
  };
}

/** Calcule les scores et la facilité d'un spot détecté. */
export function noter({ detection, indexabilite, ia, pertinence: p, page, statutHttp = 200 }) {
  const type = detection.type;
  const d = detection.details;
  const pert = Math.max(p.score, PERTINENCE_PLANCHER[type] ?? 0);
  let seo = (BASE_SEO[type] ?? 30) * (0.5 + 0.5 * pert);
  let iaScore = (BASE_IA[type] ?? 30) * (0.6 + 0.4 * pert);

  // Suivi des liens (dofollow / ugc / nofollow) dans la zone où l'on publierait.
  const zone = type === "commentaire" ? d.liens.commentaires : type === "forum" ? (d.liens.contenu !== "inconnu" ? d.liens.contenu : d.liens.signatures) : d.liens.contenu;
  if (zone === "dofollow") seo += 12;
  else if (zone === "ugc") seo += 2;
  else if (zone === "nofollow") seo -= 12;

  if (d.champSiteWeb) seo += 5;
  if ((d.concurrentsCites || []).length) {
    seo += 8;
    iaScore += 6;
  }
  if (d.widget && type === "commentaire") {
    seo -= 25;
    iaScore -= 25;
  }
  if (d.commentairesFermes && type === "commentaire") seo -= 20;
  if (d.connexionRequise && (type === "commentaire" || type === "livre-dor")) seo -= 4;
  if (d.captcha) seo -= 1;
  if (type === "commentaire" && d.commentairesExistants > 0) seo += Math.min(d.commentairesExistants, 10) * 0.5;
  if (type === "commentaire" && d.commentairesExistants > 40) seo -= 6; // fil spammé

  // Indexabilité classique.
  if (!indexabilite.indexable) seo *= statutHttp === 200 && !indexabilite.noindex && indexabilite.googlebot ? 0.6 : 0.25;
  else seo += 6;
  if (indexabilite.nofollowPage) seo -= 10;

  // Accès des robots IA.
  const principaux = ia.principauxAutorises.length + ia.principauxBloques.length;
  if (principaux) {
    const part = ia.principauxAutorises.length / principaux;
    if (part === 1) iaScore += 14;
    else if (part >= 0.5) iaScore += 4;
    else if (part > 0) iaScore -= 8;
    else iaScore -= 30;
  }
  if (indexabilite.indexable) iaScore += 6; // AI Overviews et Copilot puisent dans l'index
  else if (!indexabilite.googlebot || indexabilite.noindex) iaScore -= 10;
  if (page.nbMots >= 300) iaScore += 5;
  else if (page.nbMots < 120) iaScore -= 8;
  if (type === "commentaire" && d.commentairesExistants >= 3) iaScore += 3;

  // Localité : une page qui cite la zone d'intervention vaut une citation locale.
  if (p.zones.length) {
    seo += 5;
    iaScore += 8;
  }
  if (page.langue && !/^fr/.test(page.langue)) {
    seo -= 15;
    iaScore -= 15;
  }

  let facilite = FACILITE[type] || "contact";
  if (type === "commentaire" && d.connexionRequise) facilite = "inscription";
  if (type === "annuaire" && !detection.signaux.some((s) => s.startsWith("formulaire d'ajout"))) facilite = "inscription";
  if ((type === "avis" || type === "question-reponse") && d.connexionRequise) facilite = "inscription";

  const seoFinal = borner(seo);
  const iaFinal = borner(iaScore);
  const priorite = borner(seoFinal * 0.55 + iaFinal * 0.35 + (ORDRE_FACILITE[facilite] - 1) * 5);
  return { seo: seoFinal, ia: iaFinal, priorite, facilite };
}

/** Choisit la page à pousser depuis ce spot, et des ancres suggérées. */
export function choisirCible({ spot, page, cibles, config }) {
  const seuil = config.score?.seuilNiveau1 ?? 60;
  const pages = (cibles.pages || []).filter((p) => p.url);
  const relais = (cibles.relais || []).filter((r) => r.url && r.etat !== "absent" && domaineDe(r.url) !== spot.domaine);
  const type = spot.type;
  const zone = spot.type === "commentaire" ? spot.liens?.commentaires : spot.liens?.contenu;
  const editorial = ["liste-prestataires", "mention-non-liee", "article-invite", "page-liens", "annuaire"].includes(type);
  const masse = ["commentaire", "livre-dor", "profil"].includes(type);
  let niveau = 1;
  let motif = "spot éditorial : lien direct vers le site";
  if (!editorial) {
    if (masse) {
      niveau = 2;
      motif = "spot de masse : renforcer une page relais plutôt que le site principal";
    } else if (spot.scores.seo < seuil || zone === "nofollow" || !spot.indexabilite?.indexable) {
      niveau = 2;
      motif = spot.scores.seo < seuil ? `score SEO ${spot.scores.seo} < ${seuil}` : zone === "nofollow" ? "liens nofollow" : "page non indexable";
    } else {
      motif = `score SEO ${spot.scores.seo} ≥ ${seuil}, liens ${zone || "inconnus"}`;
    }
  }
  if (niveau === 2 && !relais.length) {
    niveau = 1;
    motif += " (aucune page relais connue : lien vers le site avec une ancre de marque)";
  }

  // Ce que l'on cherche dans les mots-clés d'une page cible : les mots du titre du spot (2, sauf
  // les mots banals ou présents sur toutes les pages du site : 0,5), et surtout ses lieux — zone
  // configurée ou département — qui pèsent 6 dans le titre et 1 dans le texte. Une zone
  // composée (« Pas-de-Calais », « Île-de-France ») ne compte que si tous ses mots sont présents.
  const entrees = new Map(); // clé → { jetons, poids }
  const ajouter = (jetons, poids) => {
    const liste = jetons.map((m) => radical(m)).filter(Boolean);
    if (!liste.length) return;
    const cle = liste.join(" ");
    if ((entrees.get(cle)?.poids || 0) < poids) entrees.set(cle, { jetons: liste, poids });
  };
  const themesConfig = new Set(motsSignificatifs([...(config.themes?.principaux || []), ...(config.themes?.connexes || []), "allo frelons"].join(" "), 200).map(radical));
  const titreEtH1 = [page?.titre, page?.h1].filter(Boolean).join(" ");
  for (const m of motsSignificatifs(titreEtH1, 60)) ajouter([m], 2); // les mots banals sont rabaissés à la notation
  const jetonsLieu = (nomZone) => {
    const jetons = motsSignificatifs(nomZone, 5);
    const cle = normaliser(nomZone);
    const d = DEPARTEMENTS.find(([, nom]) => normaliser(nom) === cle);
    return { jetons, dep: d ? "dep" + d[0].toLowerCase() : null };
  };
  const ajouterLieu = (nomZone, poids) => {
    const { jetons, dep } = jetonsLieu(nomZone);
    if (jetons.length) ajouter(jetons, poids);
    if (dep) ajouter([dep], poids);
  };
  for (const z of config.zones?.liste || []) if (expressionsPresentes(titreEtH1, [z]).length) ajouterLieu(z, 6);
  for (const d of departementsCites(titreEtH1 + " " + spot.url)) {
    ajouter(jetonsDepartement(d).filter((j) => !j.startsWith("dep")), 6);
    ajouter([d.jeton], 6);
  }
  for (const j of jetonsNumeros(page?.titre || "")) ajouter([j], 6);
  try {
    for (const j of jetonsNumeros(new URL(spot.url).hostname)) ajouter([j], 5);
  } catch {
    /* URL invalide : ignorée */
  }
  for (const z of spot.zonesTrouvees || []) ajouterLieu(z, 1); // simple départage : un lieu cité dans le texte ne suffit pas seul

  // Un mot présent dans plus de 3 % des slugs du site (« entreprise », « nids », « destruction »,
  // « ville »…) ne distingue rien : il ne pèse plus que 0,5.
  const frequences = frequencesMots(cibles, pages);
  const banal = (jeton) => MOTS_BANALS.has(jeton) || (frequences.get(jeton) || 0) > Math.max(3, pages.length * 0.03);

  // Une page locale du site (slug portant un département ou une ville) ne se mérite que par un
  // lieu affirmé dans le titre ou l'URL du spot ; sinon elle est divisée par deux, pour qu'un
  // article national ne soit pas envoyé vers « … à Paris » parce qu'il cite Paris en passant.
  const zonesConnues = new Set([
    ...(config.zones?.liste || []).flatMap((z) => motsSignificatifs(z, 5).map(radical)),
    ...DEPARTEMENTS.flatMap(([, nom]) => motsSignificatifs(nom, 5).map(radical)).filter((m) => !["haute", "haut", "hautes", "bas", "sud", "val", "territoire", "belfort", "seine", "loire", "marne", "saint", "denis", "alpes", "provence", "corse", "reunion"].includes(m)),
  ]);
  const estLocale = (presents) => [...presents].some((m) => /^dep(\d{2,3}|2a|2b)$/.test(m) || zonesConnues.has(m));

  /** Note d'une page : somme des entrées couvertes, rapportée à sa longueur ; bonus si tout son slug est couvert. */
  const noter = (motsCles) => {
    if (!motsCles?.length) return { note: 0, forts: 0, couverts: 0 };
    const presents = new Set(motsCles.map((m) => radical(m)));
    let total = 0;
    let forts = 0;
    let couverts = 0;
    const jetonsCouverts = new Set();
    for (const e of entrees.values()) {
      if (!e.jetons.every((j) => presents.has(j))) continue;
      const poids = e.jetons.length === 1 && e.poids <= 2 && banal(e.jetons[0]) ? 0.5 : e.poids;
      total += poids;
      couverts++;
      if (poids >= 3) forts++;
      for (const j of e.jetons) jetonsCouverts.add(j);
    }
    let note = total / Math.sqrt(motsCles.length + 3);
    if (motsCles.length >= 2 && [...presents].every((j) => jetonsCouverts.has(j))) note *= 1.5; // la page parle exactement du sujet
    if (forts === 0 && estLocale(presents)) note *= 0.5;
    if (process.env.NETLINKING_DEBUG) console.error("  note", note.toFixed(2), "forts", forts, "couverts", couverts, [...presents].join(","), "|", [...entrees.values()].map((e) => e.jetons.join("+") + ":" + e.poids).join(" "));
    return { note, forts, couverts };
  };
  /** Une correspondance faible (un seul mot ordinaire) ne vaut pas mieux que la page d'accueil. */
  const acceptable = (r) => r.note >= 0.8 && (r.forts >= 1 || r.couverts >= 2);

  let cible;
  if (niveau === 1) {
    let meilleure = null;
    let meilleur = { note: 0 };
    for (const p of pages) {
      const r = noter(p.motsCles);
      if (r.note > meilleur.note) {
        meilleur = r;
        meilleure = p;
      }
    }
    if (!meilleure || !acceptable(meilleur)) {
      // Repli : la page pilier du thème (slug fait uniquement de mots de thème, tous cités par le
      // titre du spot ou trouvés dans son texte : « frelon-asiatique », « guepes »…), sinon l'accueil.
      const motsTitre = new Set([...motsSignificatifs(titreEtH1, 60), ...(spot.themes || []).flatMap((t) => motsSignificatifs(t, 5))].map(radical));
      // Entre plusieurs piliers possibles (« frelon-asiatique », « abeille-frelon-asiatique »), le
      // slug le plus court est la page la plus générale : c'est elle que l'on pousse.
      let pilier = null;
      for (const p of pages) {
        const jetons = (p.motsCles || []).map(radical);
        if (!jetons.length || !jetons.every((j) => themesConfig.has(j) && motsTitre.has(j))) continue;
        if (segmentsSlug(p.url) !== jetons.length) continue; // « dd-frelon » n'est pas la page « frelon »
        if (!pilier || jetons.length < pilier.motsCles.length) pilier = p;
      }
      meilleure = pilier || pages.find((p) => p.principale) || pages.find((p) => normaliserUrlSimple(p.url) === normaliserUrlSimple(config.site.url)) || null;
    }
    cible = meilleure || { url: config.site.url, titre: config.site.nom, motsCles: [] };
  } else {
    let meilleur = -1;
    let choisies = [];
    for (const r of relais) {
      const n = noter(r.motsCles || motsSignificatifs(r.titre || "", 30)).note;
      if (n > meilleur) {
        meilleur = n;
        choisies = [r];
      } else if (n === meilleur) choisies.push(r);
    }
    cible = choisies[empreinte(spot.url) % choisies.length];
  }

  const nom = config.site?.nom || "";
  const ancres = [];
  if (niveau === 1) {
    ancres.push(nom, cible.url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
    if (cible.titre) ancres.push(cible.titre);
    if ((spot.zonesTrouvees || []).length) ancres.push(`${nom} ${spot.zonesTrouvees[0]}`);
  } else {
    if (cible.titre) ancres.push(cible.titre);
    ancres.push(cible.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), "cet article");
  }
  return { url: cible.url, niveau, motif, titre: cible.titre || "", ancres: [...new Set(ancres.filter(Boolean))].slice(0, 4) };
}

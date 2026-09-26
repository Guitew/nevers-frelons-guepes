/**
 * Détection des « spots » : à partir d'une page analysée (html.mjs), dit
 * si l'on peut y déposer un commentaire, un message de forum, une fiche
 * d'annuaire, une entrée de livre d'or, une réponse, un avis, un article
 * invité… et avec quelles conditions (champ site web, captcha, connexion,
 * modération, liens nofollow).
 *
 * Tout est heuristique et assumé comme tel : chaque conclusion est
 * accompagnée de « signaux » lisibles dans le rapport, pour qu'un humain
 * vérifie avant d'agir. Aucune action n'est jamais effectuée sur le site.
 */

import { expressionsPresentes, normaliser } from "./texte.mjs";
import { appartientA, hoteDe, memeSite, domaineDe } from "./url.mjs";

/** Types de spots, du plus précieux au plus courant (ordre de priorité du type principal). */
export const TYPES = [
  "liste-prestataires",
  "mention-non-liee",
  "article-invite",
  "annuaire",
  "forum",
  "question-reponse",
  "wiki",
  "avis",
  "page-liens",
  "commentaire",
  "livre-dor",
  "profil",
];

/** Libellés lisibles pour le rapport. */
export const LIBELLES = {
  "liste-prestataires": "Liste de prestataires",
  "mention-non-liee": "Mention sans lien",
  "article-invite": "Article invité / communiqué",
  annuaire: "Annuaire",
  forum: "Forum",
  "question-reponse": "Questions / réponses",
  wiki: "Wiki",
  avis: "Avis / témoignages",
  "page-liens": "Page de liens / partenaires",
  commentaire: "Commentaire de blog",
  "livre-dor": "Livre d'or",
  profil: "Profil avec site web",
};

/** Plateformes reconnues : [nom, famille, test sur le HTML minuscule et la page]. */
const PLATEFORMES = [
  ["WordPress", "blog", (h) => /wp-content\/|wp-includes\/|wp-comments-post\.php|wp-json/.test(h)],
  ["Blogger", "blog", (h, p) => /blogger\.com\/|blogspot\.|blogger-comment/.test(h) || /blogger/i.test(p.generateur)],
  ["SPIP", "blog", (h, p) => /spip\.php|formulaire_forum|spip_/.test(h) || /spip/i.test(p.generateur)],
  ["Dotclear", "blog", (h, p) => /dotclear/.test(h) || /dotclear/i.test(p.generateur)],
  ["Overblog", "blog", (h) => /over-blog\.com|overblog/.test(h)],
  ["Canalblog", "blog", (h) => /canalblog\.com/.test(h)],
  ["Eklablog", "blog", (h) => /eklablog/.test(h)],
  ["Joomla", "cms", (h, p) => /\/components\/com_|\/media\/jui\//.test(h) || /joomla/i.test(p.generateur)],
  ["Drupal", "cms", (h, p) => /drupal\.js|drupal-settings-json|\/sites\/default\/files/.test(h) || /drupal/i.test(p.generateur)],
  ["Wix", "cms", (h) => /wixstatic\.com|wix\.com\/|_wix/.test(h)],
  ["Squarespace", "cms", (h) => /squarespace/.test(h)],
  ["Jimdo", "cms", (h) => /jimdo/.test(h)],
  ["e-monsite", "cms", (h) => /e-monsite\.com/.test(h)],
  ["Ghost", "blog", (h, p) => /ghost/i.test(p.generateur)],
  ["Hugo", "statique", (h, p) => /hugo/i.test(p.generateur)],
  ["Jekyll", "statique", (h, p) => /jekyll/i.test(p.generateur)],
  ["Discourse", "forum", (h, p) => /discourse-cdn|discourse/i.test(p.generateur) || /discourse-cdn\.com|data-discourse-setup/.test(h)],
  ["phpBB", "forum", (h, p) => /phpbb/.test(h) || /viewtopic\.php|ucp\.php\?mode=register|posting\.php/.test(h) || /phpbb/i.test(p.generateur)],
  ["XenForo", "forum", (h) => /data-xf-init|xenforo|\/js\/xf\//.test(h)],
  ["vBulletin", "forum", (h, p) => /vbulletin/.test(h) || /vbulletin/i.test(p.generateur)],
  ["MyBB", "forum", (h, p) => /mybb/.test(h) || /mybb/i.test(p.generateur)],
  ["SMF", "forum", (h) => /simple machines|smf_|index\.php\?action=register|\?action=profile/.test(h)],
  ["Invision Community", "forum", (h) => /ipsbox|ips\.setsetting|ipsapp|\/index\.php\?\/topic\//.test(h)],
  ["Flarum", "forum", (h) => /flarum/.test(h)],
  ["NodeBB", "forum", (h) => /nodebb/.test(h)],
  ["Vanilla", "forum", (h) => /vanillaforums|vanilla\.js|class="vanilla/.test(h)],
  ["Forumactif", "forum", (h) => /forumactif|forumotion|forumgratuit|forumsactifs|forumpro\.fr|forum2jeux|frenchboard|\/post\?t=/.test(h)],
  ["Xooit", "forum", (h) => /xooit/.test(h)],
  ["FluxBB", "forum", (h, p) => /fluxbb|punbb/.test(h) || /fluxbb|punbb/i.test(p.generateur)],
  ["MediaWiki", "wiki", (h, p) => /mediawiki/i.test(p.generateur) || /mw-content-text|load\.php\?.*modules=/.test(h)],
  ["DokuWiki", "wiki", (h, p) => /dokuwiki/.test(h) || /dokuwiki/i.test(p.generateur)],
  ["Question2Answer", "qr", (h) => /question2answer|qa-content|qa-main/.test(h)],
  ["Arfooo", "annuaire", (h) => /arfooo/.test(h)],
  ["phpLD", "annuaire", (h) => /phplinkdirectory|phpld/.test(h)],
  ["GeoDirectory", "annuaire", (h) => /geodirectory|geodir-/.test(h)],
  ["Business Directory Plugin", "annuaire", (h) => /wpbdp/.test(h)],
  ["Directorist", "annuaire", (h) => /directorist/.test(h)],
  ["Listify / Listable", "annuaire", (h) => /listify|listable-/.test(h)],
  ["PrestaShop", "boutique", (h, p) => /prestashop/.test(h) || /prestashop/i.test(p.generateur)],
  ["Shopify", "boutique", (h) => /cdn\.shopify\.com/.test(h)],
];

/** Widgets de commentaires chargés en JavaScript : invisibles pour les moteurs et les IA. */
const WIDGETS = [
  ["Disqus", /disqus\.com\/embed\.js|disqus_thread|disqus_shortname|disqus\.com\/count/],
  ["Facebook Comments", /fb-comments|comments-plugin|facebook\.com\/plugins\/comments/],
  ["Commento", /commento\.io|commento\.js/],
  ["Cusdis", /cusdis/],
  ["Hyvor Talk", /hyvor/],
  ["Giscus", /giscus\.app/],
  ["Utterances", /utteranc\.es/],
  ["IntenseDebate", /intensedebate/],
  ["Isso", /isso\.js|isso-thread/],
  ["Talkyard", /talkyard/],
  ["Remark42", /remark42/],
];

const PHRASES = {
  fermes: [
    "les commentaires sont fermes",
    "commentaires fermes",
    "commentaires clos",
    "les commentaires sont clos",
    "les commentaires sont desactives",
    "commentaires desactives",
    "comments are closed",
    "comments closed",
    "comments are disabled",
    "les commentaires de cet article sont fermes",
  ],
  connexion: [
    "vous devez etre connecte",
    "vous devez etre identifie",
    "vous devez vous connecter",
    "connectez-vous pour commenter",
    "connectez vous pour commenter",
    "connectez-vous pour repondre",
    "connectez-vous pour poster",
    "identifiez-vous pour",
    "veuillez vous connecter",
    "you must be logged in",
    "log in to reply",
    "log in to post",
    "login to post",
    "please log in",
    "inscrivez-vous ou connectez-vous",
  ],
  moderation: [
    "en attente de moderation",
    "sera publie apres validation",
    "sera publie apres moderation",
    "sera publie apres approbation",
    "soumis a moderation",
    "soumis a validation",
    "modere avant publication",
    "moderes avant publication",
    "moderes avant d'etre publies",
    "awaiting moderation",
    "will be reviewed before",
    "subject to moderation",
    "commentaires sont moderes",
    "les commentaires sont moderes",
  ],
  ajoutAnnuaire: [
    "ajouter un site",
    "ajouter votre site",
    "ajoutez votre site",
    "ajouter mon site",
    "proposer un site",
    "proposez votre site",
    "soumettre un site",
    "soumettre votre site",
    "soumettez votre site",
    "referencer votre site",
    "referencez votre site",
    "inscrire votre site",
    "inscrivez votre site",
    "ajouter une entreprise",
    "ajouter votre entreprise",
    "ajoutez votre entreprise",
    "ajouter mon entreprise",
    "inscrire votre entreprise",
    "inscrivez votre entreprise",
    "referencer votre entreprise",
    "ajouter une fiche",
    "ajouter votre fiche",
    "creer votre fiche",
    "creer ma fiche",
    "ajouter votre societe",
    "ajouter un professionnel",
    "ajouter une adresse",
    "proposer une adresse",
    "ajouter un lien",
    "proposer un lien",
    "suggerer un site",
    "add your site",
    "submit your site",
    "submit a site",
    "add url",
    "add listing",
    "add your business",
    "suggest a site",
    "referencement gratuit",
    "inscription gratuite",
  ],
  livreDor: ["livre d'or", "livre d or", "livredor", "guestbook", "guest book", "signer le livre"],
  question: [
    "poser une question",
    "posez votre question",
    "poser votre question",
    "posez une question",
    "repondre a cette question",
    "repondre a la question",
    "ajouter une reponse",
    "ajoutez votre reponse",
    "votre reponse",
    "ask a question",
    "post your answer",
    "add an answer",
  ],
  avis: [
    "laisser un avis",
    "laissez un avis",
    "laissez votre avis",
    "donner votre avis",
    "donnez votre avis",
    "deposer un avis",
    "deposez un avis",
    "deposez votre avis",
    "ajouter un avis",
    "rediger un avis",
    "ecrire un avis",
    "publier un avis",
    "votre temoignage",
    "laisser un temoignage",
    "laissez un temoignage",
    "deposer un temoignage",
    "ajouter un temoignage",
    "write a review",
    "leave a review",
    "add a review",
    "noter cette entreprise",
    "noter ce professionnel",
  ],
  invite: [
    "article invite",
    "articles invites",
    "ecrire pour nous",
    "ecrivez pour nous",
    "proposer un article",
    "proposez un article",
    "proposez vos articles",
    "soumettre un article",
    "soumettez un article",
    "publier un article",
    "publiez un article",
    "publiez vos articles",
    "devenir contributeur",
    "devenez contributeur",
    "devenir redacteur",
    "devenez redacteur",
    "redacteur invite",
    "auteur invite",
    "contributeur invite",
    "guest post",
    "guest posting",
    "write for us",
    "contribuer au blog",
    "contribuer au site",
    "publiez votre communique",
    "publier un communique",
    "deposer un communique",
    "deposez votre communique",
    "communique de presse gratuit",
    "communiques de presse gratuits",
    "publiez vos communiques",
    "espace redacteur",
    "espace contributeur",
    "appel a contributions",
    "proposer un contenu",
  ],
  pageLiens: [
    "liens utiles",
    "sites utiles",
    "sites amis",
    "sites partenaires",
    "nos partenaires",
    "partenaires",
    "liens externes",
    "liens favoris",
    "blogroll",
    "annuaire de liens",
    "ressources utiles",
    "sites a visiter",
    "sites recommandes",
    "liens recommandes",
    "webographie",
    "bons liens",
  ],
  listePrestataires: [
    "liste des professionnels",
    "liste de professionnels",
    "liste des entreprises",
    "liste d'entreprises",
    "liste des desinsectiseurs",
    "liste de desinsectiseurs",
    "liste des intervenants",
    "liste d'intervenants",
    "liste des prestataires",
    "liste de prestataires",
    "liste des referents",
    "liste des piegeurs",
    "liste des destructeurs",
    "liste des societes",
    "liste des specialistes",
    "professionnels agrees",
    "professionnels references",
    "professionnels certifies",
    "entreprises agreees",
    "entreprises referencees",
    "entreprises specialisees",
    "societes specialisees",
    "societes agreees",
    "intervenants agrees",
    "intervenants referenc",
    "prestataires agrees",
    "prestataires referenc",
    "referent frelon",
    "referents frelon",
    "referent frelons",
    "referents frelons",
    "qui contacter",
    "a qui s'adresser",
    "ou s'adresser",
    "qui appeler",
    "que faire en cas de nid",
    "faire detruire un nid",
    "destructeurs de nids",
    "destruction des nids",
    "entreprises de destruction",
    "desinsectiseurs agrees",
    "professionnels de la destruction",
    "professionnels de la desinsectisation",
    "annuaire des desinsectiseurs",
    "trouver un desinsectiseur",
    "trouver un professionnel",
    "trouver une entreprise",
  ],
  themeListe: ["frelon", "frelons", "guepe", "guepes", "nid", "nids", "nuisible", "nuisibles", "desinsectisation", "desinsectiseur", "desinsectiseurs", "apiculteur", "apiculteurs", "abeilles"],
};

const RE_CHAMP_SITE = /^(url|website|web_site|site|site_web|siteweb|site-web|web|homepage|home_page|url_site|siteurl|site_url|lien|adresse_site|user_url|comment_url|author_url|c_site|session_url|website_url|link|weblink|www|http|monsite|votre_site|your-url|your_url|urlsite)$/i;
const RE_CHAMP_SITE_LARGE = /(^|[_\-\[])(url|website|site[_-]?web|siteweb|homepage|weblink)([_\-\]]|$)/i;
const RE_TEXTAREA_COMMENTAIRE = /^(comment|comments|commentaire|commentaires|comment_content|comment-content|c_content|texte|text|reaction|reponse|response|reply|message|body|content|contenu|post|post_text|msg|memo|texto|txt|commentbody|guestbook|livredor|entry|mot|temoignage|avis|review|question|answer|reponse_texte)$/i;
const RE_IDENT_COMMENTAIRE = /comment|commentaire|respond|reaction|reponse|reply|forum|livre[-_]?d?or|guestbook|temoignage|review|avis/i;
const RE_IDENT_HORS_SUJET = /contact|devis|quote|newsletter|search|recherche|login|connexion|register|inscription|signup|sign-up|subscribe|abonn|password|mot_de_passe|mdp|cart|panier|checkout|paiement|payment|calcul|simulateur|reservation|booking|rdv|rendez-vous|wpcf7|gform|ninja|elementor-form|forminator|fluentform/i;
const RE_URL_FORUM = /viewtopic|showthread|\/topic\/|\/topics\/|\/thread|\/sujet|\/t\/\d+|\/forum(s)?\/|viewforum|\/discussion\/|\/discussions\/|\/f\d+-|\/t\d+-|\/posts?\/\d+/i;
const RE_URL_INSCRIPTION = /register|inscription|inscrire|signup|sign-up|sign_up|creer-un-compte|creer-compte|create-account|createaccount|ucp\.php\?mode=register|action=register|\/join|adhesion|nouveau-compte|devenir-membre|\/membres\/inscription|\/inscription\.php|\/account\/new|register\.php|\/login|connexion/i;
const RE_URL_AJOUT = /\/(submit|ajouter|ajout|add|proposer|proposition|soumettre|soumission|referencer|referencement|inscription|inscrire|add-listing|add_listing|addlisting|ajouter-un-site|ajouter-site|ajouter-entreprise|ajouter-une-entreprise|ajouter-votre-site|proposer-un-site|suggest|add-url|addurl|link-submit|submit-link|nouvelle-fiche|creer-fiche|ajouter-une-fiche)(\/|\.php|\.html?|$|\?)/i;
const RE_URL_LIVRE_DOR = /livre-?d-?or|livredor|guestbook|gbook|livre_d_or/i;
const RE_URL_LIENS = /\/(liens|links|partenaires|partners|sites-amis|sites-utiles|liens-utiles|blogroll|ressources|webographie|annuaire-liens)(\/|\.php|\.html?|$|\?)/i;
const RE_CAPTCHA = /recaptcha|hcaptcha|turnstile|friendlycaptcha|captcha/i;
const RE_LIEN_PRESTATAIRE = /frelon|guep|guêp|nuisible|desinsect|désinsect|anti-?nuisible|hygiene|hygiène|pest[-_ ]?control|3d\b|deratis|dératis|extermin|piegeur|piégeur|apiculteur|apiculture|nid/i;

/** Plateforme et famille détectées. */
export function detecterPlateforme(page, htmlMinuscule) {
  for (const [nom, famille, test] of PLATEFORMES) {
    try {
      if (test(htmlMinuscule, page)) return { nom, famille };
    } catch {
      /* test défaillant : on continue */
    }
  }
  if (page.generateur) return { nom: page.generateur.split(/\s+/)[0].slice(0, 40), famille: "inconnue" };
  return { nom: "", famille: "inconnue" };
}

/** Widget de commentaires JavaScript détecté (Disqus, Facebook…). */
export function detecterWidget(htmlMinuscule) {
  for (const [nom, re] of WIDGETS) if (re.test(htmlMinuscule)) return nom;
  return "";
}

/** Analyse les formulaires et repère ceux qui permettent de publier quelque chose. */
export function analyserFormulaires(page) {
  const resultat = { commentaire: null, annuaire: null, livreDor: null, inscription: null, avis: null, question: null, contact: null };
  for (const f of page.formulaires) {
    const ident = `${f.id} ${f.classe} ${f.action || ""}`.toLowerCase();
    const textareas = f.champs.filter((c) => c.type === "textarea");
    const nomsTextarea = textareas.map((t) => `${t.nom}|${t.id}`).join(" ");
    const tousNoms = f.champs.map((c) => `${c.nom} ${c.id} ${c.placeholder}`).join(" ").toLowerCase();
    const champSiteWeb = f.champs.some(
      (c) =>
        c.type === "url" ||
        (["text", "url", ""].includes(c.type) &&
          (RE_CHAMP_SITE.test(c.nom) || RE_CHAMP_SITE_LARGE.test(c.nom) || RE_CHAMP_SITE.test(c.id) || /site ?web|votre site|your website|url de votre|adresse de votre site|http:\/\//i.test(c.placeholder)))
    );
    const champEmail = f.champs.some((c) => c.type === "email" || /e-?mail|courriel/i.test(c.nom + " " + c.id));
    const champNom = f.champs.some((c) => /^(author|name|nom|pseudo|auteur|username|user_name|prenom|fullname|your-name|c_name|session_nom|nickname|login|signature|display_name)$/i.test(c.nom) || /author|auteur|pseudo|(^|[_-])nom([_-]|$)|(^|[_-])name([_-]|$)/i.test(c.nom + " " + c.id));
    const champTitre = f.champs.some((c) => /^(title|titre|nom_site|site_name|sitename|name_site|nom_du_site|titre_site|libelle|denomination|raison_sociale|entreprise|company|societe|nom_entreprise)$/i.test(c.nom) || /titre|title|nom_site|site_name|raison|entreprise|societe|company/i.test(c.nom + " " + c.id));
    const champDescription = f.champs.some((c) => /descr|presentation|resume|about|bio/i.test(c.nom + " " + c.id));
    const champCategorie = f.champs.some((c) => c.type === "select" && /categ|rubrique|cat_id|catid|theme|secteur|activite|type/i.test(c.nom + " " + c.id));
    const champHorsSujet = f.champs.some((c) => /^(subject|sujet|objet|telephone|phone|tel|mobile|portable|societe_tel)$/i.test(c.nom));
    const identCommentaire = RE_IDENT_COMMENTAIRE.test(ident);
    const identHorsSujet = RE_IDENT_HORS_SUJET.test(ident) && !identCommentaire;
    const cache = f.champs.filter((c) => c.type === "hidden").map((c) => c.nom.toLowerCase());
    const cacheCommentaire = cache.some((c) => /comment_post_id|comment_parent|id_article|id_forum|id_objet|post_id|thread_id|topic_id|c_post|entry_id|article_id|billet|id_billet|id_message|parent_id/.test(c));
    const textareaCommentaire = textareas.some((t) => RE_TEXTAREA_COMMENTAIRE.test(t.nom) || RE_TEXTAREA_COMMENTAIRE.test(t.id));
    const boutons = f.boutons.join(" ").toLowerCase();
    const boutonPublier = /comment|publier|poster|envoyer|repondre|répondre|valider|soumettre|signer|ajouter|submit|post/.test(normaliser(boutons));
    const captcha = RE_CAPTCHA.test(ident + " " + tousNoms);

    const detail = { action: f.action, id: f.id, classe: f.classe, champSiteWeb, champEmail, champNom, captcha, contexte: f.contexte, nbChamps: f.champs.length };

    // Inscription (compte utilisateur) avec champ site web → un profil publie une URL.
    if (/register|inscription|inscrire|signup|sign-up|creer-un-compte|create-account|nouveau-compte|join/i.test(ident) && f.champs.some((c) => c.type === "password")) {
      if (!resultat.inscription) resultat.inscription = { ...detail, champSiteWeb };
      continue;
    }
    if (f.champs.some((c) => c.type === "password")) continue; // connexion : pas un spot

    if (textareas.length === 0) {
      // Annuaire minimal : URL + titre (sans description longue).
      if (champSiteWeb && (champTitre || champCategorie) && !identHorsSujet && !champHorsSujet) {
        if (!resultat.annuaire) resultat.annuaire = { ...detail, forme: "url+titre" };
      }
      continue;
    }

    // Annuaire : URL + (titre / description / catégorie), quel que soit le nom du formulaire.
    if (champSiteWeb && (champTitre || champDescription || champCategorie) && (RE_URL_AJOUT.test(f.action || "") || /annuaire|directory|listing|submit|ajout|proposer|soumettre|referenc|inscription|fiche/i.test(ident) || champCategorie)) {
      if (!resultat.annuaire) resultat.annuaire = { ...detail, forme: "url+description" };
      continue;
    }

    // Livre d'or.
    if (/livre[-_]?d?or|guestbook|gbook/i.test(ident) || textareas.some((t) => /livre|guest|gbook/i.test(t.nom + " " + t.id))) {
      if (!resultat.livreDor) resultat.livreDor = detail;
      continue;
    }

    // Avis / témoignage.
    if (/avis|review|temoignage|testimonial|rating|note/i.test(ident) && (champNom || champEmail) && !identHorsSujet) {
      if (!resultat.avis) resultat.avis = detail;
      continue;
    }

    // Question / réponse.
    if (/question|answer|reponse|qa-/i.test(ident) && !identHorsSujet && !/comment/i.test(ident)) {
      if (!resultat.question) resultat.question = detail;
      continue;
    }

    // Commentaire : identifiant explicite, ou champs typiques (textarea « comment » + champ cache d'article),
    // ou triplet nom + email + site web autour d'une zone de texte (blogs sans identifiant).
    const estCommentaire =
      !identHorsSujet &&
      !champHorsSujet &&
      (identCommentaire ||
        (textareaCommentaire && (cacheCommentaire || champSiteWeb)) ||
        (champNom && champEmail && champSiteWeb && textareas.length === 1));
    if (estCommentaire) {
      if (!resultat.commentaire || (champSiteWeb && !resultat.commentaire.champSiteWeb)) {
        resultat.commentaire = { ...detail, boutonPublier, cacheCommentaire };
      }
      continue;
    }

    // Contact (nom + email + message) : pas un spot, mais un moyen de joindre le site.
    if (champEmail && (champNom || champHorsSujet) && !resultat.contact) resultat.contact = detail;
  }
  return resultat;
}

/** Résumé du suivi des liens externes d'une zone : dofollow, ugc, nofollow ou inconnu. */
export function suiviLiens(liens) {
  if (!liens.length) return "inconnu";
  if (liens.some((l) => !l.nofollow && !l.ugc && !l.sponsored)) return "dofollow";
  if (liens.some((l) => l.ugc && !l.nofollow)) return "ugc";
  return "nofollow";
}

/**
 * Détecte les types de spot d'une page.
 * @returns {{ types: string[], type: string|null, plateforme: object, widget: string, signaux: string[], details: object, relais: object|null }}
 */
export function detecter({ url, page, html, config, cibles }) {
  const htmlMin = String(html || "").slice(0, 400_000).toLowerCase() + "\n" + (page.signaturesScripts || "");
  const hote = hoteDe(url);
  const plateforme = detecterPlateforme(page, htmlMin);
  const widget = detecterWidget(htmlMin);
  const formulaires = analyserFormulaires(page);
  const texteNormalise = normaliser(page.texte);
  const titreEtEntetes = normaliser([page.titre, page.h1, ...page.entetes.map((e) => e.texte)].join(" "));
  const textesLiens = normaliser(page.liens.map((l) => l.texte).join(" | "));
  const tout = titreEtEntetes + " " + texteNormalise + " " + textesLiens;
  const urlMin = url.toLowerCase();
  const signaux = [];
  const types = new Set();
  const details = {
    liensUtiles: [],
    commentairesExistants: page.compteurs.commentaires,
    captcha: RE_CAPTCHA.test(htmlMin),
    connexionRequise: expressionsPresentes(texteNormalise, PHRASES.connexion).length > 0,
    moderation: expressionsPresentes(texteNormalise, PHRASES.moderation).length > 0,
    commentairesFermes: expressionsPresentes(texteNormalise, PHRASES.fermes).length > 0,
    champSiteWeb: false,
    widget,
    contact: formulaires.contact ? formulaires.contact.action : null,
  };

  const externes = page.liens.filter((l) => {
    const lh = hoteDe(l.href);
    return lh && lh !== hote && !memeSite(l.href, url);
  });
  const liensCommentaires = externes.filter((l) => l.contexte.includes("commentaire") && !l.contexte.includes("navigation"));
  const liensContenu = externes.filter((l) => l.contexte.includes("contenu") && !l.contexte.includes("navigation") && !l.contexte.includes("pied") && !l.contexte.includes("commentaire"));
  const liensSignature = externes.filter((l) => l.contexte.includes("signature"));
  const liensAuteur = externes.filter((l) => l.contexte.includes("auteur"));
  details.liens = {
    commentaires: suiviLiens(liensCommentaires),
    contenu: suiviLiens(liensContenu),
    signatures: suiviLiens(liensSignature),
    auteurs: suiviLiens(liensAuteur),
    externes: externes.length,
  };

  // --- Relais et mentions de la marque ---------------------------------------------------
  const domainesCibles = config.site?.domaines || [];
  const liensVersCible = page.liens.filter((l) => appartientA(l.href, domainesCibles));
  let relais = null;
  if (liensVersCible.length && !appartientA(url, domainesCibles)) {
    relais = {
      url,
      domaine: domaineDe(url),
      liens: liensVersCible.slice(0, 10).map((l) => ({ href: l.href, ancre: l.texte, nofollow: l.nofollow, ugc: l.ugc, sponsored: l.sponsored, contexte: l.contexte })),
      titre: page.titre,
    };
    signaux.push(`relais : ${liensVersCible.length} lien(s) vers ${domainesCibles[0]}${liensVersCible.every((l) => l.nofollow) ? " (nofollow)" : ""}`);
  }
  const mentions = expressionsPresentes(texteNormalise, config.site?.mentions || []);
  if (mentions.length && !liensVersCible.length && !appartientA(url, domainesCibles)) {
    types.add("mention-non-liee");
    signaux.push(`mention sans lien : « ${mentions[0]} »`);
  }

  // --- Commentaires ------------------------------------------------------------------------
  if (formulaires.commentaire) {
    const f = formulaires.commentaire;
    if (details.commentairesFermes && !f.champSiteWeb) {
      signaux.push("formulaire présent mais mention « commentaires fermés »");
    } else {
      types.add("commentaire");
      signaux.push("formulaire de commentaire natif" + (f.id ? ` (#${f.id})` : ""));
      if (f.champSiteWeb) {
        details.champSiteWeb = true;
        signaux.push("champ « site web » dans le formulaire");
      }
      if (f.captcha) signaux.push("captcha sur le formulaire");
    }
  } else if (plateforme.nom === "Blogger" && /comment-editor|blogger\.com\/comment/.test(htmlMin) && !details.commentairesFermes) {
    types.add("commentaire");
    signaux.push("commentaires Blogger (formulaire en iframe, commentaires publiés dans la page)");
  } else if (widget) {
    signaux.push(`commentaires via widget ${widget} : non indexés (chargés en JavaScript)`);
  } else if (details.commentairesFermes) {
    signaux.push("commentaires fermés");
  }
  if (types.has("commentaire")) {
    if (details.commentairesExistants) signaux.push(`${details.commentairesExistants} commentaire(s) déjà publié(s)`);
    if (details.liens.commentaires !== "inconnu") signaux.push(`liens des commentaires : ${details.liens.commentaires}`);
    if (details.moderation) signaux.push("modération annoncée");
    if (details.connexionRequise) signaux.push("connexion requise pour commenter");
  }

  // --- Livre d'or --------------------------------------------------------------------------
  const livreDorTexte = expressionsPresentes(titreEtEntetes + " " + textesLiens, PHRASES.livreDor);
  if (formulaires.livreDor || (livreDorTexte.length && (RE_URL_LIVRE_DOR.test(urlMin) || page.formulaires.some((f) => f.champs.some((c) => c.type === "textarea"))))) {
    if (formulaires.livreDor || RE_URL_LIVRE_DOR.test(urlMin) || expressionsPresentes(titreEtEntetes, PHRASES.livreDor).length) {
      types.add("livre-dor");
      signaux.push(formulaires.livreDor ? "formulaire de livre d'or" : "page livre d'or");
      if (formulaires.livreDor?.champSiteWeb) {
        details.champSiteWeb = true;
        signaux.push("champ « site web » dans le livre d'or");
      }
    }
  }
  for (const l of page.liens) {
    if (RE_URL_LIVRE_DOR.test(l.href) && memeSite(l.href, url)) details.liensUtiles.push({ href: l.href, motif: "livre-dor" });
  }

  // --- Forum -------------------------------------------------------------------------------
  const liensForum = page.liens.filter((l) => memeSite(l.href, url) && RE_URL_FORUM.test(l.href)).length;
  const liensCompte = page.liens.filter((l) => memeSite(l.href, url) && RE_URL_INSCRIPTION.test(l.href) && !/logout|deconnexion/i.test(l.href));
  // Une vraie page d'inscription d'abord ; à défaut la page de connexion (qui mène souvent à l'inscription).
  const lienInscription = liensCompte.find((l) => !/\/login|connexion|mode=login/i.test(l.href)) || liensCompte[0];
  const vocabulaireForum = expressionsPresentes(tout, ["nouveau sujet", "repondre au sujet", "dernier message", "derniers messages", "messages non lus", "sujets recents", "poster un message", "nouveau message", "liste des membres", "s'inscrire", "inscrivez-vous", "creer un compte", "topics", "threads", "new topic", "post reply"]).length;
  if (plateforme.famille === "forum" || (liensForum >= 3 && (lienInscription || vocabulaireForum >= 2)) || (RE_URL_FORUM.test(urlMin) && vocabulaireForum >= 2)) {
    types.add("forum");
    signaux.push(plateforme.famille === "forum" ? `forum ${plateforme.nom}` : "structure de forum (sujets, inscription)");
    if (lienInscription) {
      details.lienInscription = lienInscription.href;
      details.liensUtiles.push({ href: lienInscription.href, motif: "inscription" });
    }
    if (details.liens.contenu !== "inconnu") signaux.push(`liens dans les messages : ${details.liens.contenu}`);
    if (details.liens.signatures !== "inconnu") signaux.push(`liens de signature : ${details.liens.signatures}`);
  }

  // --- Wiki --------------------------------------------------------------------------------
  const lienEdition = page.liens.find((l) => memeSite(l.href, url) && /action=edit|veaction=edit|do=edit|\/edit\b|\?edit/i.test(l.href));
  if (plateforme.famille === "wiki" || (lienEdition && /wiki/i.test(urlMin + " " + plateforme.nom))) {
    types.add("wiki");
    signaux.push(`wiki ${plateforme.nom || ""}`.trim() + (lienEdition ? " (lien de modification présent)" : ""));
    if (lienEdition) details.liensUtiles.push({ href: lienEdition.href, motif: "edition" });
  }

  // --- Questions / réponses ----------------------------------------------------------------
  const phrasesQuestion = expressionsPresentes(tout, PHRASES.question);
  if (plateforme.famille === "qr" || formulaires.question || (phrasesQuestion.length && (/question|reponse|answer|\/q\//i.test(urlMin) || page.formulaires.some((f) => f.champs.some((c) => c.type === "textarea"))))) {
    if (!types.has("forum")) {
      types.add("question-reponse");
      signaux.push(phrasesQuestion.length ? `questions/réponses : « ${phrasesQuestion[0]} »` : "plateforme de questions/réponses");
    }
  }

  // --- Annuaire ----------------------------------------------------------------------------
  const phrasesAnnuaire = expressionsPresentes(textesLiens + " " + titreEtEntetes, PHRASES.ajoutAnnuaire);
  const liensAjout = page.liens.filter((l) => memeSite(l.href, url) && (RE_URL_AJOUT.test(l.href) || expressionsPresentes(l.texte, PHRASES.ajoutAnnuaire).length));
  const motAnnuaire = /annuaire|directory|repertoire|listing|pages ?jaunes|guide des|bottin/i.test(normaliser(page.titre + " " + page.h1 + " " + urlMin + " " + hote));
  if (formulaires.annuaire) {
    types.add("annuaire");
    details.champSiteWeb = true;
    signaux.push(`formulaire d'ajout (${formulaires.annuaire.forme})`);
    if (formulaires.annuaire.captcha) signaux.push("captcha sur le formulaire");
  } else if (plateforme.famille === "annuaire" || (liensAjout.length && (motAnnuaire || phrasesAnnuaire.length)) || (motAnnuaire && phrasesAnnuaire.length)) {
    types.add("annuaire");
    signaux.push(liensAjout.length ? `annuaire avec lien d'ajout : « ${liensAjout[0].texte || liensAjout[0].href} »` : `annuaire (${plateforme.nom || phrasesAnnuaire[0]})`);
  }
  for (const l of liensAjout.slice(0, 5)) details.liensUtiles.push({ href: l.href, motif: "ajout-annuaire" });

  // --- Avis / témoignages ------------------------------------------------------------------
  const phrasesAvis = expressionsPresentes(titreEtEntetes + " " + textesLiens, PHRASES.avis);
  if (formulaires.avis || (phrasesAvis.length && page.formulaires.some((f) => f.champs.some((c) => c.type === "textarea")) && !types.has("commentaire"))) {
    types.add("avis");
    signaux.push(formulaires.avis ? "formulaire d'avis / témoignage" : `avis : « ${phrasesAvis[0]} »`);
  }

  // --- Article invité / communiqué ---------------------------------------------------------
  const phrasesInvite = expressionsPresentes(titreEtEntetes + " " + textesLiens, PHRASES.invite);
  if (phrasesInvite.length) {
    types.add("article-invite");
    signaux.push(`contribution proposée : « ${phrasesInvite[0]} »`);
    const lien = page.liens.find((l) => memeSite(l.href, url) && expressionsPresentes(l.texte, PHRASES.invite).length);
    if (lien) details.liensUtiles.push({ href: lien.href, motif: "article-invite" });
  }

  // --- Page de liens / partenaires ---------------------------------------------------------
  const phrasesLiens = expressionsPresentes(normaliser(page.titre + " " + page.h1), PHRASES.pageLiens);
  if ((phrasesLiens.length || RE_URL_LIENS.test(urlMin)) && liensContenu.length + externes.filter((l) => l.contexte.length === 0).length >= 5 && !types.has("forum")) {
    types.add("page-liens");
    signaux.push(`page de liens (${externes.length} liens externes)`);
    if (details.liens.contenu !== "inconnu") signaux.push(`liens de la page : ${details.liens.contenu}`);
  }
  for (const l of page.liens) {
    if (memeSite(l.href, url) && (RE_URL_LIENS.test(l.href) || expressionsPresentes(l.texte, PHRASES.pageLiens).length) && details.liensUtiles.length < 20) {
      details.liensUtiles.push({ href: l.href, motif: "page-liens" });
    }
  }

  // --- Liste de prestataires (concurrents cités, ou vocabulaire de liste + thème + liens métier) ---
  // Sur une plateforme UGC (forum, blog à commentaires, Q/R), citer un concurrent reste un simple
  // bonus : le spot garde son type (on y participe comme tout le monde).
  const concurrents = config.concurrents?.domaines || [];
  const liensConcurrents = concurrents.length ? externes.filter((l) => appartientA(l.href, concurrents)) : [];
  const liensMetier = externes.filter((l) => RE_LIEN_PRESTATAIRE.test(l.texte + " " + l.href) && !l.contexte.includes("navigation") && !l.contexte.includes("pied") && !l.contexte.includes("lateral"));
  const phrasesListeTitre = expressionsPresentes(titreEtEntetes, PHRASES.listePrestataires);
  const phrasesListeTexte = expressionsPresentes(texteNormalise, PHRASES.listePrestataires);
  const themeListe = expressionsPresentes(titreEtEntetes + " " + texteNormalise, PHRASES.themeListe);
  const ugc = types.has("forum") || types.has("commentaire") || types.has("question-reponse");
  if (liensConcurrents.length) {
    details.concurrentsCites = [...new Set(liensConcurrents.map((l) => hoteDe(l.href)))];
    signaux.push(`cite ${details.concurrentsCites.length} concurrent(s) : ${details.concurrentsCites.slice(0, 3).join(", ")}`);
  }
  const listeParTexte =
    themeListe.length > 0 &&
    ((phrasesListeTitre.length && liensMetier.length >= 1) || (phrasesListeTexte.length >= 2 && liensMetier.length >= 2) || liensMetier.length >= 3);
  if (!ugc && (liensConcurrents.length || listeParTexte)) {
    types.add("liste-prestataires");
    const phrase = phrasesListeTitre[0] || phrasesListeTexte[0];
    if (phrase) signaux.push(`liste : « ${phrase} »`);
    if (liensMetier.length) signaux.push(`${liensMetier.length} lien(s) vers des sites du métier`);
    if (details.liens.contenu !== "inconnu") signaux.push(`liens de la liste : ${details.liens.contenu}`);
  }

  // --- Profil avec site web ----------------------------------------------------------------
  if (formulaires.inscription?.champSiteWeb && !types.has("forum")) {
    types.add("profil");
    details.champSiteWeb = true;
    signaux.push("inscription avec champ « site web » (profil public probable)");
  } else if (formulaires.inscription && !details.lienInscription) {
    details.lienInscription = url;
  }

  // Liens utiles : inscription et ajout, même hors forum.
  if (lienInscription && !types.has("forum") && (types.has("annuaire") || types.has("question-reponse") || types.has("wiki") || types.has("avis"))) {
    details.liensUtiles.push({ href: lienInscription.href, motif: "inscription" });
  }

  if (details.captcha) signaux.push("captcha détecté sur la page");
  const type = TYPES.find((t) => types.has(t)) || null;
  return { types: [...types], type, plateforme, widget, signaux, details, relais };
}

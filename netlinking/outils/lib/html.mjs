/**
 * Analyse HTML tolérante, sans dépendance : un tokenizer (balises, attributs,
 * texte, entités) et une pile d'éléments ouverts suffisent à extraire ce qui
 * qualifie un spot : liens (avec leur contexte : commentaire, contenu,
 * navigation…), formulaires et leurs champs, métadonnées, titres, texte.
 *
 * On ne construit pas de DOM : le HTML réel est souvent mal fermé et un
 * arbre exact n'apporte rien ici. La pile sert seulement à savoir « dans
 * quoi » se trouve un lien ou un formulaire.
 */

import { decoderEntites } from "./entites.mjs";
import { normaliserUrl } from "./url.mjs";

/** Éléments sans contenu (jamais empilés). */
const VIDES = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** Éléments dont l'ouverture ferme un <p> laissé ouvert. */
const BLOCS = new Set(["p", "div", "section", "article", "aside", "nav", "header", "footer", "main", "ul", "ol", "li", "table", "tr", "td", "th", "form", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "dl", "dt", "dd", "figure", "fieldset", "hr"]);

const LIMITE_HTML = 2_500_000;
const LIMITE_TEXTE = 400_000;
const LIMITE_LIENS = 3000;
const LIMITE_PILE = 200;

/** Étiquettes de contexte déduites d'un élément (nom, classe, id). */
function etiquettes(nom, classe, id) {
  const cle = classe + " " + id;
  const e = [];
  if (nom === "nav" || nom === "header" || /(^|[\s_-])(nav|menu|header|breadcrumb|ariane|topbar|masthead)([\s_-]|$)/.test(cle)) e.push("navigation");
  if (nom === "footer" || /(^|[\s_-])(footer|pied|colophon)([\s_-]|$)/.test(cle)) e.push("pied");
  if (nom === "aside" || /(^|[\s_-])(sidebar|aside|widget|widgets|colonne|blogroll|secondary)([\s_-]|$)/.test(cle)) e.push("lateral");
  if (/comment|commentaire|respond|reply|discussion|disqus|reactions|reaction|review|avis/.test(cle)) e.push("commentaire");
  if (/(^|[\s_-])(signature|sig)([\s_-]|$)/.test(cle)) e.push("signature");
  if (/author|auteur|byline|vcard|profil|profile|membre|member|user-info|userinfo|postprofile/.test(cle)) e.push("auteur");
  if (
    nom === "article" ||
    nom === "main" ||
    /(^|[\s_-])(content|contenu|entry|post|article|texte|message|postbody|post-body|messagecontent|bbcode|topic|sujet|main)([\s_-]|$)/.test(cle)
  )
    e.push("contenu");
  if (nom === "form") e.push("formulaire");
  return e;
}

/** Est-ce un espace blanc ? */
function blanc(c) {
  return c === 32 || c === 10 || c === 13 || c === 9 || c === 12;
}

/**
 * Analyse un document HTML.
 * @param {string} html
 * @param {string} urlBase URL de la page (résolution des liens relatifs)
 */
export function analyserHtml(html, urlBase = "") {
  const source = String(html || "").slice(0, LIMITE_HTML);
  const n = source.length;
  const res = {
    titre: "",
    langue: "",
    charset: "",
    base: urlBase,
    meta: {},
    lienBalises: [],
    canonical: null,
    liens: [],
    formulaires: [],
    entetes: [],
    iframes: [],
    scripts: [],
    signaturesScripts: "",
    jsonLd: [],
    classes: new Set(),
    ids: new Set(),
    balises: {},
    compteurs: { commentaires: 0, commentairesCorps: 0, commentairesItems: 0, textareasHorsFormulaire: 0 },
    texte: "",
    texteContenu: "",
    nbMots: 0,
  };
  const pile = [];
  const morceauxTexte = [];
  const morceauxContenu = [];
  let tailleTexte = 0;
  let ancre = null;
  let formulaire = null;
  let bouton = null;
  let entete = null;
  let dansTitre = false;
  let titreVu = false;
  let signatures = [];
  let tailleSignatures = 0;

  function contexte() {
    const ensemble = new Set();
    for (const el of pile) for (const e of el.etiquettes) ensemble.add(e);
    return [...ensemble];
  }

  function ajouterTexte(brut) {
    if (!brut) return;
    const t = decoderEntites(brut);
    if (dansTitre) res.titre += t;
    if (ancre) ancre.morceaux.push(t);
    if (entete) entete.morceaux.push(t);
    if (bouton) bouton.push(t);
    if (tailleTexte < LIMITE_TEXTE) {
      morceauxTexte.push(t);
      tailleTexte += t.length;
      if (!dansHabillage()) morceauxContenu.push(t);
    }
  }

  /** Le texte courant est-il dans l'habillage (menus, pied de page, colonne latérale) ? */
  function dansHabillage() {
    for (const el of pile) for (const e of el.etiquettes) if (e === "navigation" || e === "pied" || e === "lateral") return true;
    return false;
  }

  function resoudre(href) {
    return normaliserUrl(href, res.base || undefined);
  }

  function ouvrir(nom, attrs, autoFermant) {
    res.balises[nom] = (res.balises[nom] || 0) + 1;
    const classe = (attrs.class || "").toLowerCase().trim();
    const id = (attrs.id || "").toLowerCase().trim();
    if (classe && res.classes.size < 4000) for (const c of classe.split(/\s+/)) res.classes.add(c);
    if (id && res.ids.size < 4000) res.ids.add(id);

    // Commentaires déjà publiés : on compte les corps (div.comment-body…) et les
    // items (li.comment) séparément, puis on garde le plus grand des deux.
    if (/(comment-body|comment-content|comment-text|commentaire-corps|comment_body|comment-inner|commentbody)/.test(classe + " " + id)) {
      res.compteurs.commentairesCorps++;
    } else if (
      (nom === "li" || nom === "article") &&
      /(^|\s)(comment|commentaire)(\s|$|-)/.test(classe) &&
      !/comment-form|commentform|comment-reply|comment-respond|comments-title|comment-navigation|comments-area|comment-list/.test(classe)
    ) {
      res.compteurs.commentairesItems++;
    }

    switch (nom) {
      case "html":
        if (attrs.lang) res.langue = attrs.lang.toLowerCase().slice(0, 5);
        break;
      case "title":
        if (!titreVu) {
          dansTitre = true;
          titreVu = true;
        }
        break;
      case "meta": {
        const cle = (attrs.name || attrs.property || attrs["http-equiv"] || "").toLowerCase();
        if (cle && attrs.content != null && !(cle in res.meta)) res.meta[cle] = attrs.content;
        if (attrs.charset) res.charset = attrs.charset.toLowerCase();
        break;
      }
      case "base":
        if (attrs.href) {
          const b = normaliserUrl(attrs.href, urlBase || undefined);
          if (b) res.base = b;
        }
        break;
      case "link": {
        const rel = (attrs.rel || "").toLowerCase();
        const href = attrs.href ? resoudre(attrs.href) : null;
        if (rel && href && res.lienBalises.length < 200) res.lienBalises.push({ rel, href });
        if (rel.split(/\s+/).includes("canonical") && href && !res.canonical) res.canonical = href;
        break;
      }
      case "a": {
        const href = attrs.href != null ? resoudre(attrs.href) : null;
        ancre = {
          href,
          brut: attrs.href || "",
          rel: (attrs.rel || "").toLowerCase().split(/\s+/).filter(Boolean),
          titre: attrs.title || "",
          classe,
          contexte: contexte(),
          morceaux: [],
        };
        break;
      }
      case "img":
        if (ancre && attrs.alt) ancre.morceaux.push(attrs.alt);
        break;
      case "form":
        formulaire = {
          action: attrs.action != null ? resoudre(attrs.action) || attrs.action : res.base,
          methode: (attrs.method || "get").toLowerCase(),
          id,
          classe,
          contexte: contexte(),
          champs: [],
          boutons: [],
        };
        if (res.formulaires.length < 100) res.formulaires.push(formulaire);
        break;
      case "input":
      case "textarea":
      case "select": {
        const type = nom === "input" ? (attrs.type || "text").toLowerCase() : nom;
        const champ = {
          type,
          nom: attrs.name || "",
          id,
          placeholder: attrs.placeholder || "",
          valeur: type === "hidden" || type === "submit" ? (attrs.value || "").slice(0, 200) : "",
          requis: "required" in attrs,
        };
        if (formulaire) {
          if (formulaire.champs.length < 200) formulaire.champs.push(champ);
          if (type === "submit" && attrs.value) formulaire.boutons.push(attrs.value);
        } else if (nom === "textarea") {
          res.compteurs.textareasHorsFormulaire++;
        }
        break;
      }
      case "button":
        bouton = [];
        break;
      case "iframe":
        if (attrs.src && res.iframes.length < 100) res.iframes.push(resoudre(attrs.src) || attrs.src);
        break;
      case "h1":
      case "h2":
      case "h3":
        entete = { niveau: Number(nom[1]), morceaux: [] };
        break;
      default:
        break;
    }

    if (BLOCS.has(nom) && pile.length && pile[pile.length - 1].nom === "p") pile.pop();
    if (nom === "li" && pile.length && pile[pile.length - 1].nom === "li") pile.pop();
    if (BLOCS.has(nom) || nom === "br") ajouterTexte(" ");

    if (!VIDES.has(nom) && !autoFermant && pile.length < LIMITE_PILE) {
      pile.push({ nom, etiquettes: etiquettes(nom, classe, id) });
    }
  }

  function fermer(nom) {
    switch (nom) {
      case "a":
        if (ancre) {
          if (ancre.href && res.liens.length < LIMITE_LIENS) {
            res.liens.push({
              href: ancre.href,
              texte: ancre.morceaux.join(" ").replace(/\s+/g, " ").trim().slice(0, 300),
              rel: ancre.rel,
              nofollow: ancre.rel.includes("nofollow"),
              ugc: ancre.rel.includes("ugc"),
              sponsored: ancre.rel.includes("sponsored"),
              titre: ancre.titre,
              classe: ancre.classe,
              contexte: ancre.contexte,
            });
          }
          ancre = null;
        }
        break;
      case "form":
        formulaire = null;
        break;
      case "title":
        dansTitre = false;
        break;
      case "button":
        if (bouton) {
          const t = bouton.join(" ").replace(/\s+/g, " ").trim();
          if (formulaire && t) formulaire.boutons.push(t);
          bouton = null;
        }
        break;
      case "h1":
      case "h2":
      case "h3":
        if (entete) {
          const t = entete.morceaux.join(" ").replace(/\s+/g, " ").trim();
          if (t && res.entetes.length < 300) res.entetes.push({ niveau: entete.niveau, texte: t.slice(0, 300) });
          entete = null;
        }
        break;
      default:
        break;
    }
    if (BLOCS.has(nom)) ajouterTexte(" ");
    for (let k = pile.length - 1; k >= 0; k--) {
      if (pile[k].nom === nom) {
        pile.length = k;
        break;
      }
    }
  }

  function texteBrut(nom, depuis) {
    // Contenu brut jusqu'à la balise fermante correspondante (script, style…).
    const fermeture = "</" + nom;
    let fin = depuis;
    for (;;) {
      fin = source.indexOf("</", fin);
      if (fin === -1) return { contenu: source.slice(depuis), suite: n };
      if (source.slice(fin, fin + fermeture.length).toLowerCase() === fermeture) {
        const chevron = source.indexOf(">", fin);
        return { contenu: source.slice(depuis, fin), suite: chevron === -1 ? n : chevron + 1 };
      }
      fin += 2;
    }
  }

  let i = 0;
  while (i < n) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      ajouterTexte(source.slice(i));
      break;
    }
    if (lt > i) ajouterTexte(source.slice(i, lt));

    if (source.startsWith("<!--", lt)) {
      const fin = source.indexOf("-->", lt + 4);
      i = fin === -1 ? n : fin + 3;
      continue;
    }
    const c1 = source.charCodeAt(lt + 1);
    if (c1 === 33 || c1 === 63) {
      // <!DOCTYPE …> ou <?xml …?>
      const fin = source.indexOf(">", lt);
      i = fin === -1 ? n : fin + 1;
      continue;
    }
    let j = lt + 1;
    const fermante = source.charCodeAt(j) === 47; // '/'
    if (fermante) j++;
    const debutNom = j;
    while (j < n) {
      const c = source.charCodeAt(j);
      if (blanc(c) || c === 62 || c === 47) break;
      j++;
    }
    const nom = source.slice(debutNom, j).toLowerCase();
    if (!nom || !/^[a-z][a-z0-9:-]*$/.test(nom)) {
      ajouterTexte("<");
      i = lt + 1;
      continue;
    }

    // Attributs.
    const attrs = {};
    let autoFermant = false;
    while (j < n) {
      let c = source.charCodeAt(j);
      if (blanc(c)) {
        j++;
        continue;
      }
      if (c === 62) {
        j++;
        break;
      }
      if (c === 47) {
        autoFermant = true;
        j++;
        continue;
      }
      let k = j;
      while (k < n) {
        c = source.charCodeAt(k);
        if (blanc(c) || c === 61 || c === 62 || c === 47) break;
        k++;
      }
      if (k === j) {
        j++;
        continue;
      }
      const nomAttr = source.slice(j, k).toLowerCase();
      j = k;
      while (j < n && blanc(source.charCodeAt(j))) j++;
      let valeur = "";
      if (source.charCodeAt(j) === 61) {
        j++;
        while (j < n && blanc(source.charCodeAt(j))) j++;
        const q = source.charCodeAt(j);
        if (q === 34 || q === 39) {
          const fin = source.indexOf(String.fromCharCode(q), j + 1);
          valeur = source.slice(j + 1, fin === -1 ? n : fin);
          j = fin === -1 ? n : fin + 1;
        } else {
          k = j;
          while (k < n) {
            c = source.charCodeAt(k);
            if (blanc(c) || c === 62) break;
            k++;
          }
          valeur = source.slice(j, k);
          j = k;
        }
      }
      if (!(nomAttr in attrs)) attrs[nomAttr] = decoderEntites(valeur);
    }
    i = j;

    if (fermante) {
      fermer(nom);
      continue;
    }

    if (nom === "script" || nom === "style" || nom === "textarea" || nom === "noscript" || nom === "svg") {
      ouvrir(nom, attrs, true);
      if (autoFermant) continue; // <script src="…"/>, <textarea/> : pas de contenu brut à lire
      const { contenu, suite } = texteBrut(nom, i);
      i = suite;
      if (nom === "script") {
        const src = attrs.src ? resoudre(attrs.src) || attrs.src : "";
        if (src && res.scripts.length < 300) res.scripts.push(src);
        const type = (attrs.type || "").toLowerCase();
        if (type.includes("ld+json")) {
          try {
            const donnees = JSON.parse(contenu);
            const liste = Array.isArray(donnees) ? donnees : donnees["@graph"] ? donnees["@graph"] : [donnees];
            for (const d of liste) if (d && d["@type"]) res.jsonLd.push(String(d["@type"]));
          } catch {
            /* JSON-LD invalide : ignoré */
          }
        } else if (tailleSignatures < 200_000) {
          const extrait = (src + " " + contenu.slice(0, 600)).toLowerCase();
          signatures.push(extrait);
          tailleSignatures += extrait.length;
        }
      } else if (nom === "noscript") {
        // Le contenu de <noscript> est du HTML ordinaire (souvent des iframes) : on le signale.
        if (/<iframe/i.test(contenu)) {
          const m = /<iframe[^>]*src\s*=\s*["']?([^"'\s>]+)/i.exec(contenu);
          if (m) res.iframes.push(resoudre(m[1]) || m[1]);
        }
      }
      continue;
    }

    ouvrir(nom, attrs, autoFermant);
  }

  res.signaturesScripts = signatures.join("\n");
  res.compteurs.commentaires = Math.max(res.compteurs.commentairesCorps, res.compteurs.commentairesItems);
  res.texte = morceauxTexte.join("").replace(/[ \s]+/g, " ").trim();
  res.texteContenu = morceauxContenu.join("").replace(/[ \s]+/g, " ").trim();
  res.nbMots = res.texte ? res.texte.split(" ").filter((m) => m.length > 1).length : 0;
  res.titre = res.titre.replace(/\s+/g, " ").trim().slice(0, 300);
  res.h1 = (res.entetes.find((e) => e.niveau === 1) || {}).texte || "";
  res.generateur = (res.meta.generator || "").trim();
  res.robotsMeta = (res.meta.robots || "").toLowerCase();
  res.classes = [...res.classes];
  res.ids = [...res.ids];
  return res;
}

/** Sous-ensemble utile des liens : externes (autre hôte) et exploitables. */
export function liensExternes(page, hotePage) {
  const h = String(hotePage || "").replace(/^www\./, "");
  return page.liens.filter((l) => {
    try {
      const lh = new URL(l.href).hostname.replace(/^www\./, "");
      return lh !== h;
    } catch {
      return false;
    }
  });
}

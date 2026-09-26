/** Détection des spots : chaque type reconnu, et les faux positifs évités. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { analyserHtml } from "../lib/html.mjs";
import { analyserFormulaires, detecter } from "../lib/detection.mjs";
import { completerConfig } from "../lib/config.mjs";
import { CONFIG_JSON } from "../lib/chemins.mjs";
import * as F from "./fixtures/site.mjs";

const config = completerConfig(JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8")));
config.concurrents.domaines = ["desinsectisation-nord.fr"];
const cibles = { pages: [], relais: [] };

function analyser(html, url) {
  const corps = html.replace(/https:\/\/SITE/g, "https://site.fr");
  const page = analyserHtml(corps, url);
  return detecter({ url, page, html: corps, config, cibles });
}

test("article WordPress : commentaire natif, champ site web, liens nofollow, commentaires existants", () => {
  const d = analyser(F.ARTICLE, "https://site.fr/blog/nid-de-frelons/");
  assert.equal(d.type, "commentaire");
  assert.equal(d.plateforme.nom, "WordPress");
  assert.equal(d.details.champSiteWeb, true);
  assert.equal(d.details.captcha, true);
  assert.equal(d.details.commentairesExistants, 3);
  assert.equal(d.details.liens.commentaires, "nofollow");
  assert.equal(d.details.liens.contenu, "dofollow");
  assert.ok(d.signaux.some((s) => s.includes("formulaire de commentaire natif")));
  assert.equal(d.relais, null);
});

test("commentaires fermés : pas un spot", () => {
  const d = analyser(F.ARTICLE_FERME, "https://site.fr/blog/vieil-article/");
  assert.equal(d.type, null);
  assert.equal(d.details.commentairesFermes, true);
});

test("forum phpBB : type forum, inscription, liens dofollow, concurrent cité en bonus (pas en type)", () => {
  const d = analyser(F.FORUM, "https://site.fr/forum/viewtopic.php?t=12");
  assert.equal(d.type, "forum");
  assert.ok(!d.types.includes("liste-prestataires"));
  assert.equal(d.plateforme.nom, "phpBB");
  assert.equal(d.details.lienInscription, "https://site.fr/forum/ucp.php?mode=register", "l'inscription est préférée à la connexion");
  assert.equal(d.details.liens.contenu, "dofollow");
  assert.equal(d.details.liens.signatures, "dofollow");
  assert.deepEqual(d.details.concurrentsCites, ["desinsectisation-nord.fr"]);
  assert.equal(d.details.connexionRequise, true);
});

test("annuaire : formulaire d'ajout url + description + catégorie", () => {
  const d = analyser(F.ANNUAIRE, "https://site.fr/annuaire/");
  assert.equal(d.type, "annuaire");
  assert.equal(d.details.champSiteWeb, true);
  assert.ok(d.signaux.some((s) => s.startsWith("formulaire d'ajout")));
});

test("livre d'or (Latin-1 décodé en amont) : formulaire avec champ site", () => {
  const d = analyser(F.LIVRE_DOR_LATIN1, "https://site.fr/livre-d-or.php");
  assert.equal(d.type, "livre-dor");
  assert.equal(d.details.champSiteWeb, true);
});

test("page qui pointe déjà vers allo-frelons.fr : relais, jamais « mention sans lien »", () => {
  const d = analyser(F.RELAIS, "https://site.fr/relais/");
  assert.ok(d.relais);
  assert.equal(d.relais.liens[0].ancre, "ALLO FRELONS 59");
  assert.equal(d.relais.liens[0].nofollow, false);
  assert.ok(!d.types.includes("mention-non-liee"));
});

test("mention de la marque sans lien", () => {
  const d = analyser(F.MENTION, "https://site.fr/mention/");
  assert.equal(d.type, "mention-non-liee");
  assert.equal(d.relais, null);
});

test("liste de professionnels : vocabulaire de liste + thème + liens métier", () => {
  const d = analyser(F.LISTE_PROS, "https://site.fr/liste-professionnels/");
  assert.equal(d.type, "liste-prestataires");
  assert.ok(d.signaux.some((s) => s.startsWith("cite 1 concurrent")));
});

test("page d'accueil d'un blog : ni liste, ni commentaire (pas de faux positif)", () => {
  const d = analyser(F.accueil("https://externe.fr"), "https://site.fr/");
  assert.equal(d.type, null);
});

test("page de liens / sites amis", () => {
  const d = analyser(F.PAGE_LIENS, "https://site.fr/liens/");
  assert.equal(d.type, "page-liens");
});

test("formulaire de contact : pas un spot, mais un contact enregistré", () => {
  const d = analyser(F.CONTACT, "https://site.fr/contact/");
  assert.equal(d.type, null);
  assert.equal(d.details.contact, "https://site.fr/contact/envoyer");
});

test("widget Disqus : pas de commentaire natif, signal explicite", () => {
  const d = analyser(F.blogExterne(), "https://externe.fr/blog-apiculture/");
  assert.equal(d.type, null);
  assert.equal(d.widget, "Disqus");
  assert.ok(d.signaux.some((s) => s.includes("Disqus")));
});

test("SPIP et Dotclear : formulaires de commentaire reconnus par leurs champs", () => {
  const spip = `<html lang="fr"><head><title>Article SPIP frelons</title></head><body><div class="formulaire_spip formulaire_forum"><form action="/spip.php?article12" method="post">
<input type="hidden" name="id_article" value="12"><input type="text" name="session_nom"><input type="text" name="session_email"><input type="text" name="url_site"><textarea name="texte"></textarea><input type="submit" value="Prévisualiser"></form></div></body></html>`;
  let d = analyser(spip, "https://site.fr/spip.php?article12");
  assert.equal(d.type, "commentaire");
  assert.equal(d.plateforme.nom, "SPIP");
  assert.equal(d.details.champSiteWeb, true);

  const dotclear = `<html lang="fr"><head><title>Billet Dotclear</title><meta name="generator" content="Dotclear"></head><body><form id="comment-form" action="/post/2024/frelons" method="post">
<input name="c_name" type="text"><input name="c_mail" type="text"><input name="c_site" type="text"><textarea name="c_content"></textarea><input type="submit" value="envoyer"></form></body></html>`;
  d = analyser(dotclear, "https://site.fr/post/2024/frelons");
  assert.equal(d.type, "commentaire");
  assert.equal(d.details.champSiteWeb, true);
});

test("article invité et questions/réponses", () => {
  const invite = `<html lang="fr"><head><title>Blog jardin</title></head><body><nav><a href="/ecrire-pour-nous/">Écrire pour nous</a></nav><h1>Proposer un article invité</h1><p>Nous acceptons les articles invités sur le jardin.</p></body></html>`;
  assert.equal(analyser(invite, "https://site.fr/ecrire-pour-nous/").type, "article-invite");
  const qr = `<html lang="fr"><head><title>Question : frelon dans le grenier ?</title></head><body><h1>Frelon dans le grenier, que faire ?</h1><p>3 réponses</p><a href="/questions/poser">Poser une question</a><form action="/questions/12/repondre" method="post" id="answer-form"><textarea name="answer"></textarea><input type="submit" value="Répondre"></form></body></html>`;
  assert.equal(analyser(qr, "https://site.fr/questions/12").type, "question-reponse");
});

test("wiki MediaWiki avec lien de modification", () => {
  const wiki = `<html lang="fr"><head><title>Frelon asiatique — Wiki apicole</title><meta name="generator" content="MediaWiki 1.41"></head><body><div id="mw-content-text"><p>Le frelon asiatique…</p></div><a href="/index.php?title=Frelon&action=edit">Modifier</a></body></html>`;
  const d = analyser(wiki, "https://wiki.site.fr/Frelon");
  assert.equal(d.type, "wiki");
  assert.ok(d.details.liensUtiles.some((l) => l.motif === "edition"));
});

test("analyserFormulaires distingue commentaire, annuaire minimal, inscription avec site web", () => {
  const html = `<html><body>
<form action="/register" id="register"><input name="username"><input type="password" name="pass"><input type="url" name="website"><input type="submit"></form>
<form action="/submit"><input name="title"><input type="url" name="url"><select name="category"><option>a</option></select></form>
<form action="/newsletter" class="newsletter"><input type="email" name="email"><textarea name="message"></textarea></form>
</body></html>`;
  const r = analyserFormulaires(analyserHtml(html, "https://site.fr/"));
  assert.ok(r.inscription?.champSiteWeb);
  assert.equal(r.annuaire?.forme, "url+titre");
  assert.equal(r.commentaire, null);
});

/** Analyse HTML : liens et contexte, formulaires, métadonnées, texte, robustesse. */
import test from "node:test";
import assert from "node:assert/strict";
import { analyserHtml } from "../lib/html.mjs";
import { decoderEntites } from "../lib/entites.mjs";
import { ARTICLE } from "./fixtures/site.mjs";

test("entités HTML : nommées, numériques, Windows-1252, sans point-virgule", () => {
  assert.equal(decoderEntites("&eacute;t&eacute; &amp; &laquo;&nbsp;x&nbsp;&raquo; &#8217; &#x27; &#146; &copy;"), "été & « x » ’ ' ’ ©");
  assert.equal(decoderEntites("a=1&b=2&amp;c=3"), "a=1&b=2&c=3");
  assert.equal(decoderEntites("&inconnue; &#99999999;"), "&inconnue; &#99999999;");
});

test("l'article WordPress : titre, métadonnées, liens contextualisés, formulaire de commentaire", () => {
  const page = analyserHtml(ARTICLE.replace(/https:\/\/SITE/g, "https://blog.fr"), "https://blog.fr/blog/nid-de-frelons/");
  assert.equal(page.titre, "Un nid de frelons asiatiques dans mon jardin à Lille");
  assert.equal(page.langue, "fr");
  assert.equal(page.generateur, "WordPress 6.6");
  assert.equal(page.canonical, "https://blog.fr/blog/nid-de-frelons/");
  assert.equal(page.h1, "Un nid de frelons asiatiques dans mon jardin");
  assert.equal(page.compteurs.commentaires, 3);
  assert.ok(page.scripts.some((s) => s.includes("recaptcha")));

  const jean = page.liens.find((l) => l.texte === "Jean");
  assert.ok(jean.contexte.includes("commentaire"));
  assert.ok(jean.nofollow && jean.ugc);
  const guide = page.liens.find((l) => l.href.includes("jardin-voisin"));
  assert.ok(guide.contexte.includes("contenu") && !guide.contexte.includes("commentaire"));
  assert.ok(!guide.nofollow);

  assert.equal(page.formulaires.length, 1);
  const f = page.formulaires[0];
  assert.equal(f.id, "commentform");
  assert.equal(f.methode, "post");
  assert.equal(f.action, "https://blog.fr/wp-comments-post.php");
  assert.deepEqual(f.champs.map((c) => c.type), ["textarea", "text", "email", "text", "submit", "hidden", "hidden"]);
  assert.equal(f.champs.find((c) => c.nom === "comment_post_ID").valeur, "42");
  assert.deepEqual(f.boutons, ["Laisser un commentaire"]);
  assert.ok(f.contexte.includes("commentaire"));
});

test("balises mal fermées, attributs sans guillemets, commentaires, script et style ignorés", () => {
  const html = `<html><head><title>T</title><style>a{color:red}</style><script>var x = "<a href='/piege'>";</script></head>
<body><p>Un <b>texte<p>Deuxième paragraphe <a href=/relatif class=lien>lien nu</a><!-- <a href="/commente">x</a> -->
<textarea name="t"><a href="/dans-textarea">non</a></textarea><img src=x.png alt="alt"><br><a href="https://ext.fr/">ext</a>`;
  const page = analyserHtml(html, "https://site.fr/dir/");
  assert.deepEqual(page.liens.map((l) => l.href), ["https://site.fr/relatif", "https://ext.fr/"]);
  assert.equal(page.liens[0].texte, "lien nu");
  assert.ok(!page.texte.includes("color:red"));
  assert.ok(!page.texte.includes("var x"));
  assert.ok(page.texte.includes("Deuxième paragraphe"));
  assert.equal(page.compteurs.textareasHorsFormulaire, 1);
});

test("base href, iframes, JSON-LD, meta charset, robots meta", () => {
  const html = `<html><head><base href="https://cdn.site.fr/racine/"><meta charset="ISO-8859-1"><meta name="robots" content="NOINDEX,follow">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":"BreadcrumbList"}]}</script></head>
<body><a href="page.html">p</a><iframe src="https://www.facebook.com/plugins/comments.php"></iframe><noscript><iframe src="//disqus.com/embed"></iframe></noscript></body></html>`;
  const page = analyserHtml(html, "https://site.fr/x/");
  assert.equal(page.liens[0].href, "https://cdn.site.fr/racine/page.html");
  assert.deepEqual(page.jsonLd, ["Article", "BreadcrumbList"]);
  assert.equal(page.charset, "iso-8859-1");
  assert.equal(page.robotsMeta, "noindex,follow");
  assert.equal(page.iframes.length, 2);
});

test("balises auto-fermées à contenu brut : <textarea/> et <script/> n'avalent pas la suite du document", () => {
  const page = analyserHtml(`<html><body><form><textarea name="t"/><input name="url"></form><script src="/x.js"/><a href="/apres">après</a></body></html>`, "https://site.fr/");
  assert.equal(page.liens.length, 1);
  assert.equal(page.formulaires[0].champs.length, 2);
});

test("un très gros document est traité sans exploser", () => {
  const gros = "<html><body>" + "<p>mot frelon <a href='/x'>lien</a></p>".repeat(60000) + "</body></html>";
  const page = analyserHtml(gros, "https://site.fr/");
  assert.equal(page.liens.length, 3000); // plafond
  assert.ok(page.nbMots > 1000);
});

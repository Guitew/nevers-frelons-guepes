/**
 * Mini-site de test servi en local par les tests de bout en bout et réutilisé
 * par les tests de détection. Chaque page illustre un type de spot.
 */

export const ROBOTS = `# robots de test
User-agent: *
Disallow: /prive/
Allow: /prive/ouvert

User-agent: GPTBot
User-agent: ClaudeBot
Disallow: /

User-agent: AlloFrelonsBot
Disallow: /interdit/
Crawl-delay: 0
`;

export function accueil(externe) {
  return `<!DOCTYPE html><html lang="fr"><head><title>Le blog du jardin et des abeilles</title>
<meta name="generator" content="WordPress 6.6"><link rel="canonical" href="/"></head>
<body><header class="site-header"><nav class="menu"><a href="/">Accueil</a> <a href="/blog/nid-de-frelons/">Article frelons</a>
<a href="/forum/">Forum</a> <a href="/annuaire/">Annuaire</a> <a href="/livre-d-or.php">Livre d'or</a> <a href="/liens/">Liens utiles</a>
<a href="/relais/">Relais</a> <a href="/mention/">Mention</a> <a href="/prive/secret/">Privé</a> <a href="/noindex/">Noindex</a>
<a href="/fichier.pdf">PDF</a> <a href="/image.png">Image</a> <a href="/interdit/page">Interdit</a> <a href="/contact/">Contact</a>
<a href="/liste-professionnels/">Qui contacter</a></nav></header>
<main><h1>Un jardin vivant : abeilles, guêpes et frelons</h1><p>Bienvenue sur ce blog consacré au jardin, à l'apiculture et aux insectes. On y parle de frelon asiatique, de nids de guêpes et de biodiversité à Lille et dans le Nord.</p></main>
<aside class="sidebar"><h3>Blogroll</h3><a href="${externe}/blog-apiculture/">Le blog apiculture</a> <a href="https://www.facebook.com/page">Facebook</a></aside>
<footer class="site-footer"><a href="/mentions-legales/">Mentions légales</a></footer></body></html>`;
}

export const ARTICLE = `<!DOCTYPE html><html lang="fr"><head><title>Un nid de frelons asiatiques dans mon jardin à Lille</title>
<meta name="generator" content="WordPress 6.6"><link rel="canonical" href="https://SITE/blog/nid-de-frelons/">
<script src="https://www.google.com/recaptcha/api.js"></script></head>
<body><article class="post"><h1>Un nid de frelons asiatiques dans mon jardin</h1>
<div class="entry-content"><p>Cet été, un nid de frelon asiatique est apparu dans le cerisier. Piqûre, danger pour les abeilles, que faire ? J'ai fini par appeler un professionnel de la désinsectisation dans le Nord.</p>
<p>Lire aussi <a href="https://www.jardin-voisin.fr/frelons">le guide du jardin voisin</a>.</p></div>
<div id="comments" class="comments-area"><h2>3 commentaires</h2><ol class="comment-list">
<li class="comment"><div class="comment-body"><a href="https://www.blog-de-jean.fr/" rel="external nofollow ugc" class="url">Jean</a> : merci pour ce retour !</div></li>
<li class="comment"><div class="comment-body">Marie : nous avons eu le même problème à Roubaix.</div></li>
<li class="comment"><div class="comment-body">Paul : très utile.</div></li></ol>
<div id="respond" class="comment-respond"><h3>Laisser un commentaire</h3>
<form action="https://SITE/wp-comments-post.php" method="post" id="commentform" class="comment-form">
<p><textarea id="comment" name="comment" cols="45" rows="8" required></textarea></p>
<p><input id="author" name="author" type="text" size="30"></p><p><input id="email" name="email" type="email"></p>
<p><input id="url" name="url" type="text" placeholder="Site web"></p>
<p><input name="submit" type="submit" id="submit" value="Laisser un commentaire"><input type="hidden" name="comment_post_ID" value="42"><input type="hidden" name="comment_parent" value="0"></p>
</form></div></div></article></body></html>`;

export const ARTICLE_FERME = `<!DOCTYPE html><html lang="fr"><head><title>Vieil article</title></head><body><article><h1>Vieil article sur les guêpes</h1><p>Texte sur les guêpes.</p><p class="nocomments">Les commentaires sont fermés.</p></article></body></html>`;

export const FORUM = `<!DOCTYPE html><html lang="fr"><head><title>Forum apiculture - Frelon asiatique dans le Nord - Page 1</title>
<meta name="generator" content="phpBB 3.3"></head>
<body><div id="page-header"><ul class="navbar"><li><a href="/forum/ucp.php?mode=register">S'inscrire</a></li><li><a href="/forum/ucp.php?mode=login">Connexion</a></li><li><a href="/forum/search.php">Rechercher</a></li></ul></div>
<h2 class="topic-title"><a href="/forum/viewtopic.php?t=12">Frelon asiatique : piège ou destruction du nid ?</a></h2>
<div class="post"><div class="postbody"><div class="content">Bonjour, j'ai un nid de frelon asiatique près de mes ruches à Valenciennes. Qui contacter ? J'ai trouvé <a href="https://www.desinsectisation-nord.fr/">cette entreprise de désinsectisation</a>.</div><div class="signature">Mon site : <a href="https://www.miel-du-nord.fr/">Miel du Nord</a></div></div></div>
<div class="post"><div class="postbody"><div class="content">Réponse : appelle un professionnel agréé, pas les pompiers.</div></div></div>
<a href="/forum/posting.php?mode=reply&t=12" class="button">Répondre</a> <a href="/forum/viewtopic.php?t=13">Sujet suivant</a> <a href="/forum/viewtopic.php?t=14">Nouveau sujet : nids de guêpes</a> <a href="/forum/viewforum.php?f=3">Retour au forum</a>
<p>Vous devez être connecté pour poster un message.</p></body></html>`;

export const ANNUAIRE = `<!DOCTYPE html><html lang="fr"><head><title>Annuaire des professionnels du jardin et de la maison - Ajouter votre site</title></head>
<body><h1>Ajouter votre site à l'annuaire</h1><p>Inscription gratuite. Votre fiche sera publiée après validation.</p>
<form action="/annuaire/ajouter.php" method="post" id="form-ajout">
<label>Titre du site</label><input type="text" name="titre">
<label>URL</label><input type="text" name="url_site">
<label>Description</label><textarea name="description"></textarea>
<label>Catégorie</label><select name="categorie"><option>Jardin</option><option>Nuisibles</option></select>
<input type="email" name="email"><input type="submit" value="Proposer le site"></form>
<div class="liste"><a href="/annuaire/jardin/">Jardin</a> <a href="/annuaire/nuisibles/">Nuisibles</a></div></body></html>`;

/** Livre d'or en ISO-8859-1 (octets Latin-1 à encoder dans le serveur). */
export const LIVRE_DOR_LATIN1 = `<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><title>Livre d'or - Le rucher de Frédéric</title></head>
<body><h1>Livre d'or</h1><p>Laissez un mot dans le livre d'or du rucher : apéritif, miel et abeilles à Douai.</p>
<form action="livredor.php" method="post"><input type="text" name="nom"><input type="text" name="email"><input type="text" name="site" placeholder="Votre site web"><textarea name="message"></textarea><input type="submit" value="Signer"></form>
<div class="message"><b>Sophie</b> <a href="http://www.sophie-jardin.fr/">www.sophie-jardin.fr</a> : superbe rucher !</div></body></html>`;

export const RELAIS = `<!DOCTYPE html><html lang="fr"><head><title>Frelons : nos partenaires et liens utiles</title></head>
<body><main><h1>Liens utiles sur les frelons</h1><p>Pour faire détruire un nid dans le Nord, nous recommandons <a href="https://allo-frelons.fr/entreprise-anti-nuisibles-nord-59">ALLO FRELONS 59</a>, entreprise de désinsectisation à Lille.</p>
<ul><li><a href="https://www.frelonasiatique.fr/">frelonasiatique.fr</a></li><li><a href="https://www.apiculture.net/">apiculture.net</a></li><li><a href="https://www.abeilles-nord.fr/">abeilles-nord.fr</a></li><li><a href="https://www.jardin-nature.fr/">jardin-nature.fr</a></li><li><a href="https://www.guepes-info.fr/">guepes-info.fr</a></li></ul></main></body></html>`;

export const MENTION = `<!DOCTYPE html><html lang="fr"><head><title>Retour d'expérience : destruction d'un nid de frelons à Lille</title></head>
<body><article><h1>Retour d'expérience</h1><p>Nous avons fait appel à Allo Frelons pour un nid de frelons asiatiques sous la toiture. Intervention rapide et propre, à Lille. Merci à eux.</p><p>Article publié dans la rubrique nature et jardin.</p></article></body></html>`;

export const NOINDEX = `<!DOCTYPE html><html lang="fr"><head><title>Page noindex</title><meta name="robots" content="noindex, follow"></head>
<body><h1>Page de test noindex</h1><form id="commentform" action="/wp-comments-post.php" method="post"><textarea name="comment"></textarea><input name="author"><input name="email" type="email"><input name="url"><input type="submit" value="Envoyer"></form></body></html>`;

export const CONTACT = `<!DOCTYPE html><html lang="fr"><head><title>Contact</title></head><body><h1>Nous contacter</h1>
<form action="/contact/envoyer" method="post" class="wpcf7-form"><input type="text" name="your-name"><input type="email" name="your-email"><input type="text" name="your-subject"><textarea name="your-message"></textarea><input type="submit" value="Envoyer"></form></body></html>`;

export const LISTE_PROS = `<!DOCTYPE html><html lang="fr"><head><title>Frelon asiatique : qui contacter dans le Nord ? Liste des professionnels agréés</title></head>
<body><main><h1>Nid de frelon asiatique : qui contacter ?</h1><p>Voici la liste des professionnels agréés pour la destruction des nids de frelons dans le Nord et le Pas-de-Calais :</p>
<ul><li><a href="https://www.desinsectisation-nord.fr/">Désinsectisation Nord</a> — Lille</li><li><a href="https://www.guepes-apens.fr/">Guêpes Apens</a> — Douai</li><li><a href="https://www.anti-nuisibles-59.fr/">Anti-nuisibles 59</a> — Valenciennes</li></ul>
<p>Cette liste est mise à jour par la mairie ; contactez-nous pour y figurer.</p></main></body></html>`;

export const PAGE_LIENS = `<!DOCTYPE html><html lang="fr"><head><title>Sites amis et liens utiles - Le blog du jardin</title></head>
<body><main><h1>Sites amis</h1><ul><li><a href="https://www.site-a.fr/">Site A</a></li><li><a href="https://www.site-b.fr/">Site B</a></li><li><a href="https://www.site-c.fr/">Site C</a></li><li><a href="https://www.site-d.fr/">Site D</a></li><li><a href="https://www.site-e.fr/">Site E</a></li><li><a href="https://www.site-f.fr/">Site F</a></li></ul></main></body></html>`;

export function blogExterne() {
  return `<!DOCTYPE html><html lang="fr"><head><title>Le blog apiculture - frelons et ruches</title></head>
<body><article><h1>Protéger ses ruches du frelon asiatique</h1><p>Nos conseils d'apiculteur : pièges, muselières, et appel à un professionnel en cas de nid.</p></article>
<div id="disqus_thread"></div><script src="https://blog-apiculture.disqus.com/embed.js"></script></body></html>`;
}

/** Table de routage : chemin → { corps, type, statut, latin1 } */
export function pages({ externe, site }) {
  const remplacer = (t) => t.replace(/https:\/\/SITE/g, site);
  return {
    "/robots.txt": { corps: ROBOTS, type: "text/plain" },
    "/": { corps: accueil(externe), type: "text/html; charset=utf-8" },
    "/blog/nid-de-frelons/": { corps: remplacer(ARTICLE), type: "text/html; charset=utf-8" },
    "/blog/vieil-article/": { corps: ARTICLE_FERME, type: "text/html; charset=utf-8" },
    "/forum/": { corps: FORUM, type: "text/html; charset=utf-8" },
    "/forum/viewtopic.php?t=12": { corps: FORUM, type: "text/html; charset=utf-8" },
    "/annuaire/": { corps: ANNUAIRE, type: "text/html; charset=utf-8" },
    "/livre-d-or.php": { corps: LIVRE_DOR_LATIN1, type: "text/html; charset=iso-8859-1", latin1: true },
    "/liens/": { corps: PAGE_LIENS, type: "text/html; charset=utf-8" },
    "/relais/": { corps: RELAIS, type: "text/html; charset=utf-8" },
    "/mention/": { corps: MENTION, type: "text/html; charset=utf-8" },
    "/noindex/": { corps: NOINDEX, type: "text/html; charset=utf-8" },
    "/contact/": { corps: CONTACT, type: "text/html; charset=utf-8" },
    "/liste-professionnels/": { corps: LISTE_PROS, type: "text/html; charset=utf-8" },
    "/prive/secret/": { corps: "<html><title>secret</title></html>", type: "text/html" },
    "/prive/ouvert": { corps: "<html><title>ouvert</title></html>", type: "text/html" },
    "/interdit/page": { corps: "<html><title>interdit</title></html>", type: "text/html" },
    "/fichier.pdf": { corps: "%PDF-1.4", type: "application/pdf" },
    "/image.png": { corps: "PNG", type: "image/png" },
    "/mentions-legales/": { corps: "<html lang='fr'><head><title>Mentions</title></head><body>Mentions légales</body></html>", type: "text/html" },
    "/blog-apiculture/": { corps: blogExterne(), type: "text/html; charset=utf-8" },
  };
}

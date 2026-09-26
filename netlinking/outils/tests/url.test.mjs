/** Normalisation d'URL : c'est elle qui évite de visiter dix fois la même page. */
import test from "node:test";
import assert from "node:assert/strict";
import { appartientA, cheminRobots, domaineDe, estBinaire, hoteDe, memeSite, normaliserUrl } from "../lib/url.mjs";

test("normaliserUrl résout les liens relatifs et retire fragment et paramètres de suivi", () => {
  assert.equal(normaliserUrl("/page?utm_source=x&b=2&a=1#haut", "https://www.Site.fr/dir/"), "https://www.site.fr/page?b=2&a=1");
  assert.equal(normaliserUrl("../autre.html", "https://site.fr/dir/sous/"), "https://site.fr/dir/autre.html");
  assert.equal(normaliserUrl("viewtopic.php?t=12&sid=abc123", "https://forum.fr/"), "https://forum.fr/viewtopic.php?t=12");
  assert.equal(normaliserUrl("https://site.fr/blog/index.php"), "https://site.fr/blog/");
  assert.equal(normaliserUrl("https://site.fr//double//barre"), "https://site.fr/double/barre");
});

test("normaliserUrl rejette ce qui n'est pas une page web", () => {
  for (const u of ["mailto:a@b.fr", "javascript:void(0)", "tel:+33612345678", "data:text/html,x", "#", "", null, "ftp://x.fr/a", "nom-sans-schema-ni-base"]) {
    assert.equal(normaliserUrl(u), null, `devrait rejeter ${u}`);
  }
  assert.equal(normaliserUrl("#", "https://site.fr/page"), "https://site.fr/page");
});

test("normaliserUrl accepte les hôtes locaux (tests) mais pas les hôtes sans point", () => {
  assert.equal(normaliserUrl("http://localhost:8080/x"), "http://localhost:8080/x");
  assert.equal(normaliserUrl("http://127.0.0.1:3000/"), "http://127.0.0.1:3000/");
  assert.equal(normaliserUrl("http://intranet/page"), null);
});

test("domaineDe rend le domaine enregistrable, y compris pour les plateformes de blogs", () => {
  assert.equal(domaineDe("https://www.exemple.fr/page"), "exemple.fr");
  assert.equal(domaineDe("https://sous.domaine.exemple.fr/"), "exemple.fr");
  assert.equal(domaineDe("https://monblog.over-blog.com/x"), "monblog.over-blog.com");
  assert.equal(domaineDe("https://forum.truc.forumactif.com/"), "truc.forumactif.com");
  assert.equal(domaineDe("www.example.co.uk"), "example.co.uk");
  assert.equal(domaineDe("https://asso.exemple.asso.fr/"), "exemple.asso.fr");
  assert.equal(domaineDe("http://127.0.0.1:99/"), "127.0.0.1");
});

test("memeSite et appartientA", () => {
  assert.ok(memeSite("https://www.exemple.fr/a", "https://blog.exemple.fr/b"));
  assert.ok(!memeSite("https://a.over-blog.com/", "https://b.over-blog.com/"));
  assert.ok(!memeSite("https://exemple.fr/", "https://exemple.com/"));
  assert.ok(appartientA("https://www.allo-frelons.fr/page", ["allo-frelons.fr"]));
  assert.ok(appartientA("https://blog.allo-frelons.fr/", ["allo-frelons.fr"]));
  assert.ok(!appartientA("https://allo-frelons.fr.evil.com/", ["allo-frelons.fr"]));
  assert.ok(!appartientA("https://notallo-frelons.fr/", ["allo-frelons.fr"]));
});

test("estBinaire, hoteDe, cheminRobots", () => {
  assert.ok(estBinaire("https://x.fr/doc.PDF"));
  assert.ok(estBinaire("https://x.fr/img/photo.jpg?x=1"));
  assert.ok(!estBinaire("https://x.fr/page.html"));
  assert.ok(!estBinaire("https://x.fr/pdf/"));
  assert.equal(hoteDe("https://WWW.Exemple.fr/x"), "exemple.fr");
  assert.equal(cheminRobots("https://x.fr/a/b?c=1"), "/a/b?c=1");
  assert.equal(cheminRobots("https://x.fr"), "/");
});

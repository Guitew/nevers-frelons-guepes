/**
 * Avis Google : compilation et synthèse.
 * Deux garanties : rien n'est inventé (un thème n'est cité que s'il est dans
 * un avis, aucun bloc sans matière), et la sélection suit la règle annoncée
 * (3 meilleurs récents, le plus mauvais récent, 2 moyens récents).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { depuisApiGoogle, compilerAvis, syntheseAvis, themesDesAvis, avisARafraichir, prioriteAvis, blocAvis } from "../lib/avis.mjs";

const avis = (note, date, texte = "Texte " + note, auteur = "A.") => ({ note, date, texte, auteur, auteur_lien: "", lien: "" });

test("depuisApiGoogle normalise et trie du plus récent au plus ancien", () => {
  const liste = depuisApiGoogle([
    { rating: 5, text: { text: "Super", languageCode: "fr" }, publishTime: "2026-03-01T10:00:00Z", authorAttribution: { displayName: "Léa", uri: "https://g/1" }, googleMapsUri: "https://maps/1" },
    { rating: 2, originalText: { text: "Bof" }, publishTime: "2026-05-01T10:00:00Z" },
    { rating: "x" },
    { rating: 4, publishTime: "2026-04-01T10:00:00Z" },
  ]);
  assert.equal(liste.length, 3);
  assert.deepEqual(liste.map((a) => a.date), ["2026-05-01", "2026-04-01", "2026-03-01"]);
  assert.equal(liste[2].auteur, "Léa");
  assert.equal(liste[2].auteur_lien, "https://g/1");
  assert.equal(liste[1].texte, "");
});

test("compilerAvis : 3 meilleurs (5 étoiles d'abord, puis récents), le pire, 2 moyens, chacun une seule fois", () => {
  const liste = [
    avis(5, "2026-01-10"),
    avis(4, "2026-06-01"),
    avis(5, "2026-03-05"),
    avis(1, "2026-02-01"),
    avis(3, "2026-05-01"),
    avis(4, "2026-04-01"),
    avis(2, "2026-05-20"),
    avis(3, "2026-01-01"),
  ];
  const c = compilerAvis(blocAvis(liste, "2026-06-10"));
  assert.deepEqual(c.meilleurs.map((a) => [a.note, a.date]), [[5, "2026-03-05"], [5, "2026-01-10"], [4, "2026-06-01"]]);
  assert.deepEqual([c.pire.note, c.pire.date], [1, "2026-02-01"]);
  assert.deepEqual(c.moyens.map((a) => [a.note, a.date]), [[3, "2026-05-01"], [4, "2026-04-01"]]);
  assert.equal(c.total, 6);
  assert.equal(c.releve, "2026-06-10");
});

test("compilerAvis : que des 5 étoiles → pas de bloc critique ni nuancé ; sans texte → rien", () => {
  const c = compilerAvis(blocAvis([avis(5, "2026-01-01"), avis(5, "2026-02-01")], "2026-03-01"));
  assert.equal(c.meilleurs.length, 2);
  assert.equal(c.pire, null);
  assert.equal(c.moyens.length, 0);
  assert.equal(compilerAvis(blocAvis([avis(5, "2026-01-01", "")], "2026-03-01")), null);
  assert.equal(compilerAvis(null), null);
  assert.equal(compilerAvis({ liste: [] }), null);
});

test("compilerAvis : le pire est la note la plus basse, la plus récente à note égale", () => {
  const c = compilerAvis(blocAvis([avis(2, "2026-01-01"), avis(2, "2026-04-01"), avis(3, "2026-05-01")], "2026-06-01"));
  assert.deepEqual([c.pire.note, c.pire.date], [2, "2026-04-01"]);
  assert.deepEqual(c.moyens.map((a) => a.date), ["2026-05-01"]);
});

test("themesDesAvis : polarité par les mots d'abord, par la note ensuite, jamais sans occurrence", () => {
  const t = themesDesAvis([
    avis(5, "2026-01-01", "Très bon accueil et travail soigné."),
    avis(4, "2026-01-02", "Un peu cher mais rapide et efficace."),
    avis(1, "2026-01-03", "Jamais rappelé, attente interminable."),
    avis(2, "2026-01-04", "On m'a fait attendre une heure, jamais rappelé."),
  ]);
  assert.deepEqual(t.positifs.map((x) => x.id).sort(), ["accueil", "qualite"].sort());
  // « rapidite » : un avis positif (« rapide et efficace ») contre deux avis négatifs (un seul
  // compte par avis). « rappelé » finit par une lettre accentuée : \b ne la voit pas, d'où \p{L}.
  assert.deepEqual(t.negatifs.map((x) => x.id).sort(), ["prix", "rapidite"].sort());
  const vide = themesDesAvis([avis(5, "2026-01-01", "Rien à dire de particulier.")]);
  assert.deepEqual(vide, { positifs: [], negatifs: [] });
});

test("syntheseAvis : ne cite que des thèmes présents, donne des comptes exacts, vide sans avis", () => {
  const fiche = {
    id: "ChIJ-test",
    nom: "Le Fournil",
    note: 4.6,
    avis: 213,
    avis_detail: blocAvis(
      [
        avis(5, "2026-03-01", "Excellent accueil, produits de qualité, prix corrects."),
        avis(5, "2026-02-01", "Super accueil, très professionnel."),
        avis(2, "2026-01-15", "Attente trop longue et accueil froid."),
      ],
      "2026-04-01"
    ),
  };
  const s = syntheseAvis(fiche);
  assert.match(s, /accueil/);
  assert.match(s, /qualité|prix|professionnalisme/);
  assert.match(s, /rapidité du service/);
  assert.match(s, /2 (des|avis sur) 3/);
  assert.match(s, /1 est très critique/);
  assert.match(s, /4,6 sur 5 pour 213 avis/);
  assert.doesNotMatch(s, /propreté|ambiance|choix/);
  assert.equal(syntheseAvis({ ...fiche, avis_detail: null }), "");
  assert.equal(syntheseAvis({ ...fiche, avis_detail: blocAvis([], "2026-04-01") }), "");
  // Déterminisme : deux appels, même texte.
  assert.equal(syntheseAvis(fiche), s);
});

test("syntheseAvis : avis sans thème détecté → seulement la répartition des notes", () => {
  const s = syntheseAvis({
    id: "x",
    nom: "Garage X",
    note: 3.9,
    avis: 12,
    avis_detail: blocAvis([avis(5, "2026-01-01", "Rien à redire."), avis(1, "2026-01-02", "Non.")], "2026-02-01"),
  });
  assert.match(s, /^1 (des 2 avis relevés attribue 4|avis sur 2 relevés donne 4)/);
  assert.doesNotMatch(s, /apprécient|mettent en avant|soulignent/);
  const zero = syntheseAvis({
    id: "y",
    nom: "Garage Y",
    avis_detail: blocAvis([avis(2, "2026-01-01", "Non."), avis(1, "2026-01-02", "Non plus.")], "2026-02-01"),
  });
  assert.match(zero, /^(Aucun des 2 avis relevés n'attribue|Aucun avis sur 2 relevés ne donne)/);
  assert.match(zero, /2 sont très critiques/);
});

test("avisARafraichir : absent, périmé ou en langue étrangère ; priorité à la retraduction", () => {
  assert.equal(avisARafraichir({}, 90), true);
  assert.equal(prioriteAvis({}, 90), 1);
  assert.equal(avisARafraichir({ avis_detail: blocAvis([], "2000-01-01") }, 90), true);
  assert.equal(prioriteAvis({ avis_detail: blocAvis([], "2000-01-01") }, 90), 2);
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  assert.equal(avisARafraichir({ avis_detail: blocAvis([], hier) }, 90), false);
  assert.equal(prioriteAvis({ avis_detail: blocAvis([{ ...avis(5, hier, "Parfait"), langue: "fr" }], hier) }, 90), null);
  const anglais = { avis_detail: blocAvis([{ ...avis(5, hier, "Great place"), langue: "en" }], hier) };
  assert.equal(avisARafraichir(anglais, 90), true);
  assert.equal(prioriteAvis(anglais, 90), 0);
  // Un avis sans texte n'a pas de langue à retraduire.
  assert.equal(prioriteAvis({ avis_detail: blocAvis([{ ...avis(5, hier, ""), langue: "en" }], hier) }, 90), null);
});

/* Recherche instantanée, entièrement côté navigateur.
   L'index est un JSON compact généré au build ; aucune requête n'est
   émise pendant la frappe et aucune donnée de visiteur n'est collectée. */
(function () {
  "use strict";

  var champ = document.getElementById("recherche");
  var sortie = document.getElementById("resultats");
  var resume = document.getElementById("resume-recherche");
  if (!champ || !sortie) return;

  var index = [];
  var MAXIMUM = 60;

  function aplatir(s) {
    return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function echapper(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function chercher(requete) {
    var mots = aplatir(requete).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    return index
      .filter(function (e) {
        return mots.every(function (m) {
          return e._ .indexOf(m) !== -1;
        });
      })
      .slice(0, MAXIMUM);
  }

  function afficher(resultats, requete) {
    if (!requete) {
      sortie.innerHTML = "";
      resume.textContent = index.length + " entreprises consultables.";
      return;
    }
    resume.textContent = resultats.length
      ? resultats.length + (resultats.length >= MAXIMUM ? "+ résultats" : " résultat" + (resultats.length > 1 ? "s" : ""))
      : "Aucun résultat pour « " + requete + " ».";
    sortie.innerHTML = resultats
      .map(function (e) {
        return (
          '<li class="resultat"><a href="' + e.u + '">' + echapper(e.n) + "</a>" +
          "<p>" + echapper(e.c) + " — " + echapper(e.a ? e.a + ", " + e.v : e.v) + "</p></li>"
        );
      })
      .join("");
  }

  var minuteur;
  function surSaisie() {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () {
      var q = champ.value.trim();
      afficher(chercher(q), q);
      var url = q ? "?q=" + encodeURIComponent(q) : location.pathname;
      history.replaceState(null, "", url);
    }, 120);
  }

  fetch("/index-recherche.json")
    .then(function (r) { return r.json(); })
    .then(function (donnees) {
      index = donnees.map(function (e) {
        e._ = aplatir([e.n, e.c, e.v, e.a].join(" "));
        return e;
      });
      champ.addEventListener("input", surSaisie);
      var depart = new URLSearchParams(location.search).get("q");
      if (depart) {
        champ.value = depart;
        afficher(chercher(depart), depart);
      } else {
        afficher([], "");
      }
    })
    .catch(function () {
      resume.textContent = "L'index de recherche n'a pas pu être chargé.";
    });
})();

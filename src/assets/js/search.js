/* Recherche côté client sur l'index JSON généré à la compilation */
(function () {
  "use strict";

  var champ = document.getElementById("q-recherche");
  var sortie = document.getElementById("resultats-recherche");
  var info = document.getElementById("recherche-info");
  if (!champ || !sortie) return;

  var index = [];
  var pret = false;

  function normalise(s) {
    return (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  fetch("/index-recherche.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      index = data.map(function (item) {
        return { item: item, hay: normalise([item.titre, item.sci, item.categorie, item.type, item.mots].join(" ")) };
      });
      pret = true;
      var params = new URLSearchParams(window.location.search);
      var q = params.get("q");
      if (q) { champ.value = q; lancer(q); }
    })
    .catch(function () {
      if (info) info.textContent = "L'index de recherche n'a pas pu être chargé.";
    });

  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function lancer(q) {
    var termes = normalise(q).split(/\s+/).filter(Boolean);
    if (!termes.length) {
      sortie.innerHTML = "";
      if (info) info.textContent = "";
      return;
    }
    var trouves = index.filter(function (e) {
      return termes.every(function (t) { return e.hay.indexOf(t) !== -1; });
    });

    if (info) {
      info.textContent = trouves.length
        ? trouves.length + (trouves.length > 1 ? " résultats trouvés" : " résultat trouvé")
        : "Aucun résultat pour « " + q + " ».";
    }

    sortie.innerHTML = trouves
      .slice(0, 40)
      .map(function (e) {
        var it = e.item;
        return (
          '<a class="resultat" href="' + it.url + '">' +
          '<span class="resultat__type">' + echapper(it.categorie || it.type) + "</span>" +
          '<span class="resultat__titre">' + echapper(it.titre) + "</span>" +
          (it.sci ? '<span class="resultat__sci"><em>' + echapper(it.sci) + "</em></span>" : "") +
          "</a>"
        );
      })
      .join("");
  }

  var minuteur;
  champ.addEventListener("input", function () {
    clearTimeout(minuteur);
    var v = champ.value;
    minuteur = setTimeout(function () { if (pret) lancer(v); }, 120);
  });

  champ.addEventListener("keydown", function (e) {
    if (e.key === "Enter") e.preventDefault();
  });
})();

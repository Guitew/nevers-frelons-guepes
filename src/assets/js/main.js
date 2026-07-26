/* Interactions générales : menu mobile + filtres de listes */
(function () {
  "use strict";

  // ----- Menu mobile -----
  var bascule = document.querySelector(".menu-bascule");
  var nav = document.getElementById("nav-principale");
  if (bascule && nav) {
    bascule.addEventListener("click", function () {
      var ouvert = nav.classList.toggle("est-ouvert");
      bascule.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
  }

  // ----- Filtres des listes d'espèces (page /especes/) -----
  var filtres = document.querySelectorAll(".filtre-btn");
  if (filtres.length) {
    var compteur = document.querySelector("[data-compteur]");
    var cartes = Array.prototype.slice.call(document.querySelectorAll("[data-categorie]"));

    function appliquer(cat) {
      var visibles = 0;
      cartes.forEach(function (c) {
        var ok = cat === "tout" || c.getAttribute("data-categorie") === cat;
        c.hidden = !ok;
        if (ok) visibles++;
      });
      // Masque les groupes vides
      document.querySelectorAll(".groupe-taxo").forEach(function (g) {
        var reste = g.querySelectorAll("[data-categorie]:not([hidden])").length;
        g.hidden = reste === 0;
      });
      if (compteur) {
        compteur.textContent =
          visibles + (visibles > 1 ? " fiches affichées" : " fiche affichée");
      }
    }

    filtres.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filtres.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        appliquer(btn.getAttribute("data-filtre"));
      });
    });
  }
})();

/* Interactions minimales — le site reste entièrement utilisable sans JavaScript. */
(function () {
  "use strict";

  // --- Menu mobile
  var bouton = document.querySelector("[data-menu]");
  var nav = document.getElementById("navigation");
  if (bouton && nav) {
    bouton.addEventListener("click", function () {
      var ouvert = nav.getAttribute("data-ouvert") === "oui";
      nav.setAttribute("data-ouvert", ouvert ? "non" : "oui");
      bouton.setAttribute("aria-expanded", String(!ouvert));
    });
  }

  // --- Mise en évidence du jour courant dans le tableau des horaires.
  //     Fait côté navigateur volontairement : le calculer au build figerait
  //     le « jour courant » à la date de compilation.
  var table = document.querySelector("[data-horaires]");
  if (table) {
    var jour = (new Date().getDay() + 6) % 7; // dimanche = 0 → lundi = 0
    var ligne = table.querySelector('[data-jour="' + jour + '"]');
    if (ligne) {
      ligne.classList.add("aujourdhui");
      var cellule = ligne.querySelector("th");
      if (cellule) cellule.insertAdjacentHTML("beforeend", ' <span class="doux">(aujourd\'hui)</span>');
    }
  }
})();

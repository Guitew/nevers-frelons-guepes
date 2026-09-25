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

  // --- Mesure d'audience propre, anonyme : sur une page d'entreprise, on
  //     signale la visite et le site d'origine (visites.php). Pas de cookie,
  //     pas d'identifiant, pas d'adresse conservée. Sert à garder en ligne les
  //     pages que Google envoie réellement, et à retirer les autres.
  if (document.querySelector(".fiche") && !navigator.webdriver) {
    var racine = window.RACINE || "/";
    var chemin = window.location.pathname;
    if (chemin.indexOf(racine) === 0) chemin = "/" + chemin.slice(racine.length);
    var url =
      racine + "visites.php?p=" + encodeURIComponent(chemin) + "&r=" + encodeURIComponent(document.referrer || "");
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(url);
      else fetch(url, { method: "GET", keepalive: true, credentials: "omit", cache: "no-store" });
    } catch (e) {}
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

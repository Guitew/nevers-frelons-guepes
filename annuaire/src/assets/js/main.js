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

  // --- « Ouvert en ce moment » : calculé ici, à l'heure du visiteur, parce
  //     qu'un état figé au build serait faux dès le lendemain.
  var statut = document.querySelector("[data-statut-horaires]");
  if (statut) {
    try {
      var horaires = JSON.parse(statut.getAttribute("data-horaires-json") || "null");
      var maintenant = new Date();
      var jourIdx = (maintenant.getDay() + 6) % 7;
      var jour = (horaires || []).filter(function (j) { return j.jour === jourIdx; })[0];
      var lisible = function (h) {
        var p = h.split(":");
        return String(Number(p[0])) + " h" + (p[1] && p[1] !== "00" ? " " + p[1] : "");
      };
      var minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
      var enMinutes = function (h) { var p = h.split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); };
      var texte = "";
      if (jour && !jour.ferme && jour.creneaux && jour.creneaux.length) {
        var ouvertMaintenant = jour.creneaux.some(function (c) { return minutes >= enMinutes(c[0]) && minutes < enMinutes(c[1]); });
        var prochain = jour.creneaux.filter(function (c) { return enMinutes(c[0]) > minutes; })[0];
        var plages = jour.creneaux.map(function (c) { return "de " + lisible(c[0]) + " à " + lisible(c[1]); }).join(" et ");
        texte = (ouvertMaintenant ? "Ouvert en ce moment" : prochain ? "Fermé en ce moment, ouvre à " + lisible(prochain[0]) : "Fermé pour aujourd'hui") + " — aujourd'hui " + plages + ".";
        statut.className += ouvertMaintenant ? " fiche__statut--ouvert" : " fiche__statut--ferme";
      } else if (jour) {
        texte = "Fermé aujourd'hui.";
        statut.className += " fiche__statut--ferme";
      }
      if (texte) {
        statut.textContent = texte + " Horaires relevés sur la fiche Google, à vérifier en cas de doute.";
        statut.hidden = false;
      }
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

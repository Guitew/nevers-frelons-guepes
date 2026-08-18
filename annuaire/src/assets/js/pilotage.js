/* Filtres et exports du tableau de bord privé.
   Tout se passe dans le navigateur : la page reste un fichier statique. */
(function () {
  "use strict";

  var tableau = document.getElementById("tableau-fiches");
  if (!tableau) return;

  var lignes = Array.prototype.slice.call(tableau.tBodies[0].rows);
  var texte = document.getElementById("filtre-texte");
  var statut = document.getElementById("filtre-statut");
  var backlink = document.getElementById("filtre-backlink");
  var compte = document.getElementById("compte-lignes");

  function aplatir(s) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function visibles() {
    return lignes.filter(function (l) { return l.style.display !== "none"; });
  }

  function filtrer() {
    var q = aplatir(texte.value.trim());
    var s = statut.value;
    var b = backlink.value;
    lignes.forEach(function (l) {
      var ok =
        (!q || aplatir(l.dataset.texte).indexOf(q) !== -1) &&
        (!s || l.dataset.statut === s) &&
        (!b || l.dataset.backlink === b);
      l.style.display = ok ? "" : "none";
    });
    compte.textContent = visibles().length + " / " + lignes.length + " fiches";
  }

  [texte, statut, backlink].forEach(function (c) {
    c.addEventListener("input", filtrer);
    c.addEventListener("change", filtrer);
  });
  filtrer();

  function telecharger(nom, contenu, type) {
    var lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([contenu], { type: type }));
    lien.download = nom;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  document.getElementById("copier-urls").addEventListener("click", function () {
    var urls = visibles().map(function (l) { return l.dataset.url; }).join("\n");
    navigator.clipboard.writeText(urls).then(
      function () { this.textContent = visibles().length + " URLs copiées"; }.bind(this),
      function () { telecharger("urls.txt", urls, "text/plain"); }.bind(this)
    );
  });

  document.getElementById("exporter-csv").addEventListener("click", function () {
    var entetes = ["entreprise", "categorie", "commune", "statut", "backlink", "echecs", "url"];
    var corps = visibles().map(function (l) {
      var c = l.cells;
      return [
        c[0].textContent.trim(), c[1].textContent.trim(), c[2].textContent.trim(),
        l.dataset.statut, l.dataset.backlink, c[5].textContent.trim(), l.dataset.url,
      ]
        .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; })
        .join(";");
    });
    telecharger("pilotage-annuaire.csv", [entetes.join(";")].concat(corps).join("\n"), "text/csv;charset=utf-8");
  });
})();

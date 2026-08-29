/* Tableau de bord privé : filtres, pagination et exports.
   Les lignes sont peintes par tranches à partir de donnees.json — rendre
   plusieurs milliers de <tr> d'un coup rendait la page inutilisable. */
(function () {
  "use strict";

  var tableau = document.getElementById("tableau-fiches");
  if (!tableau) return;

  var corps = tableau.tBodies[0];
  var champTexte = document.getElementById("filtre-texte");
  var champStatut = document.getElementById("filtre-statut");
  var champBacklink = document.getElementById("filtre-backlink");
  var compte = document.getElementById("compte-lignes");
  var pagination = document.getElementById("pagination-fiches");

  var PAR_PAGE = 100;
  var fiches = [];
  var filtrees = [];
  var page = 1;
  var base = "";

  function aplatir(s) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function echapper(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var LIBELLES_STATUT = {
    publiee: ['etiquette--vert', 'en ligne'],
    retiree: ['etiquette--rouge', 'retirée'],
    archivee: ['', 'archivée'],
    brouillon: ['', 'brouillon'],
  };

  function celluleStatut(f) {
    var libelle = LIBELLES_STATUT[f.s] || ["", f.s];
    var texte = f.s === "retiree" ? f.m : libelle[1];
    return (
      '<span class="etiquette ' + libelle[0] + '">' + echapper(texte) + "</span>" +
      (f.mo ? ' <span class="doux">' + echapper(f.mo) + "</span>" : "")
    );
  }

  function celluleBacklink(f) {
    var classe = f.b === "present" ? "etiquette--vert" : f.b === "en-attente" ? "" : "etiquette--rouge";
    return '<span class="etiquette ' + classe + '">' + echapper(f.b) + "</span>";
  }

  function filtrer() {
    var q = aplatir(champTexte.value.trim());
    var s = champStatut.value;
    var b = champBacklink.value;
    filtrees = fiches.filter(function (f) {
      return (!q || f._.indexOf(q) !== -1) && (!s || f.s === s) && (!b || f.b === b);
    });
    page = 1;
    peindre();
  }

  function peindre() {
    var total = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
    if (page > total) page = total;
    var tranche = filtrees.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);

    corps.innerHTML = tranche.length
      ? tranche
          .map(function (f) {
            return (
              "<tr><td>" + echapper(f.n) + (f.x ? ' <span class="etiquette">démo</span>' : "") +
              "</td><td>" + echapper(f.c) +
              "</td><td>" + echapper(f.v) +
              "</td><td>" + celluleStatut(f) +
              "</td><td>" + celluleBacklink(f) +
              "</td><td>" + f.e +
              "</td><td>" + (f.p || "—") +
              "</td><td>" + (f.d || "jamais") +
              '</td><td><a href="' + echapper(base + f.u) + '">' + echapper(f.u) + "</a></td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="9" class="doux">Aucune fiche ne correspond à ces filtres.</td></tr>';

    compte.textContent = filtrees.length + " / " + fiches.length + " fiches";

    if (total <= 1) {
      pagination.innerHTML = "";
      return;
    }
    var boutons = [];
    if (page > 1) boutons.push('<a href="#" data-page="' + (page - 1) + '">← Précédent</a>');
    boutons.push("<span>page " + page + " sur " + total + "</span>");
    if (page < total) boutons.push('<a href="#" data-page="' + (page + 1) + '">Suivant →</a>');
    pagination.innerHTML = boutons.join("");
  }

  pagination.addEventListener("click", function (e) {
    var lien = e.target.closest("[data-page]");
    if (!lien) return;
    e.preventDefault();
    page = Number(lien.dataset.page);
    peindre();
    tableau.scrollIntoView({ block: "start", behavior: "instant" });
  });

  [champTexte, champStatut, champBacklink].forEach(function (c) {
    c.addEventListener("input", filtrer);
    c.addEventListener("change", filtrer);
  });

  function telecharger(nom, contenu, type) {
    var lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([contenu], { type: type }));
    lien.download = nom;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  document.getElementById("copier-urls").addEventListener("click", function () {
    var bouton = this;
    var urls = filtrees.map(function (f) { return base + f.u; }).join("\n");
    navigator.clipboard.writeText(urls).then(
      function () { bouton.textContent = filtrees.length + " URLs copiées"; },
      function () { telecharger("urls.txt", urls, "text/plain"); }
    );
  });

  document.getElementById("exporter-csv").addEventListener("click", function () {
    var entetes = ["entreprise", "categorie", "commune", "statut", "backlink", "echecs", "premiere_detection", "derniere_verification", "url"];
    var lignes = filtrees.map(function (f) {
      return [f.n, f.c, f.v, f.s, f.b, f.e, f.p || "", f.d || "", base + f.u]
        .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; })
        .join(";");
    });
    telecharger("pilotage-annuaire.csv", [entetes.join(";")].concat(lignes).join("\n"), "text/csv;charset=utf-8");
  });

  fetch("donnees.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      base = d.base || "";
      fiches = d.fiches.map(function (f) {
        f._ = aplatir(f.n + " " + f.v + " " + f.c);
        return f;
      });
      filtrer();
    })
    .catch(function () {
      corps.innerHTML = '<tr><td colspan="9" class="doux">Impossible de charger donnees.json.</td></tr>';
    });
})();

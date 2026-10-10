// Applique les coordonnées NAP enregistrées via /admin-nap.php (fichier
// /donnees/nap.json écrit sur le serveur) par-dessus les valeurs compilées.
// En l'absence du fichier (ou sans JavaScript), les valeurs compilées restent
// affichées telles quelles.
(async () => {
  try {
    const reponse = await fetch("/donnees/nap.json", { cache: "no-store" });
    if (!reponse.ok) return;
    const naps = await reponse.json();

    document.querySelectorAll("[data-nap-dept]").forEach((bloc) => {
      const n = naps[bloc.dataset.napDept];
      if (!n) return;

      const ecrire = (selecteur, valeur) => {
        const el = bloc.querySelector(selecteur);
        if (el && valeur) el.textContent = valeur;
      };

      ecrire('[itemprop="name"]', n.raison);
      ecrire('[itemprop="telephone"]', n.telephone);
      ecrire('[itemprop="areaServed"]', n.zone);
      ecrire('[itemprop="openingHours"]', n.horaires);

      const tel = bloc.querySelector('a[itemprop="telephone"]');
      if (tel && n.telephoneLien) tel.href = "tel:" + n.telephoneLien;

      const adresse = bloc.querySelector('[itemprop="address"]');
      if (adresse && n.adresse) {
        ecrire('[itemprop="streetAddress"]', n.adresse);
        ecrire('[itemprop="postalCode"]', n.codePostal);
        ecrire('[itemprop="addressLocality"]', n.ville);
        adresse.hidden = false;
      }
    });
  } catch (e) {
    // Silencieux : les valeurs compilées du site restent affichées.
  }
})();

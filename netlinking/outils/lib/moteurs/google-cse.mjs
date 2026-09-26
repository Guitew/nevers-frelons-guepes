/** Google Programmable Search (Custom Search JSON API) — 10 résultats par appel. */

export function googleCse(config, fetchFn) {
  const { googleCseCle: cle, googleCseCx: cx } = config.secrets;
  return {
    nom: "google-cse",
    async chercher(requete, { nombre = 20, pays = "fr", langue = "fr" } = {}) {
      const resultats = [];
      const pages = Math.min(Math.ceil(nombre / 10), 3);
      for (let p = 0; p < pages; p++) {
        const params = new URLSearchParams({ key: cle, cx, q: requete, gl: pays, lr: `lang_${langue}`, num: "10", start: String(p * 10 + 1) });
        const rep = await fetchFn(`https://www.googleapis.com/customsearch/v1?${params}`);
        if (!rep.ok) throw new Error(`Google CSE : HTTP ${rep.status} ${(await rep.text()).slice(0, 200)}`);
        const donnees = await rep.json();
        const items = donnees.items || [];
        resultats.push(...items.map((r) => ({ url: r.link, titre: r.title || "", extrait: r.snippet || "" })).filter((r) => r.url));
        if (items.length < 10) break;
      }
      return resultats;
    },
  };
}

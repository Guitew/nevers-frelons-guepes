/** Serper.dev — résultats Google en JSON. https://serper.dev/ */

export function serper(config, fetchFn) {
  const cle = config.secrets.serper;
  return {
    nom: "serper",
    async chercher(requete, { nombre = 20, pays = "fr", langue = "fr" } = {}) {
      const rep = await fetchFn("https://google.serper.dev/search", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": cle },
        body: JSON.stringify({ q: requete, gl: pays, hl: langue, num: Math.min(nombre, 100) }),
      });
      if (!rep.ok) throw new Error(`Serper : HTTP ${rep.status} ${(await rep.text()).slice(0, 200)}`);
      const donnees = await rep.json();
      return (donnees.organic || []).map((r) => ({ url: r.link, titre: r.title || "", extrait: r.snippet || "" })).filter((r) => r.url);
    },
  };
}

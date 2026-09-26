/** Brave Search API — https://api-dashboard.search.brave.com/ */

export function brave(config, fetchFn) {
  const cle = config.secrets.brave;
  return {
    nom: "brave",
    async chercher(requete, { nombre = 20, pays = "fr", langue = "fr" } = {}) {
      const params = new URLSearchParams({ q: requete, count: String(Math.min(nombre, 20)), country: pays.toUpperCase(), search_lang: langue, text_decorations: "0", safesearch: "off" });
      const rep = await fetchFn(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": cle },
      });
      if (!rep.ok) throw new Error(`Brave : HTTP ${rep.status} ${(await rep.text()).slice(0, 200)}`);
      const donnees = await rep.json();
      return (donnees.web?.results || []).map((r) => ({ url: r.url, titre: r.title || "", extrait: r.description || "" })).filter((r) => r.url);
    },
  };
}

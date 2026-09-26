/** Serveur HTTP local pour les tests (aucun accès réseau externe). */
import http from "node:http";
import { pages } from "./fixtures/site.mjs";

export async function demarrerServeur() {
  const table = {};
  const requetes = [];
  const serveur = http.createServer((req, res) => {
    const cle = req.url;
    requetes.push(cle);
    const page = table[cle] || table[cle.split("?")[0]];
    if (!page) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><title>404</title><body>Introuvable</body></html>");
      return;
    }
    if (page.redirection) {
      res.writeHead(301, { location: page.redirection });
      res.end();
      return;
    }
    const corps = page.latin1 ? Buffer.from(page.corps, "latin1") : Buffer.from(page.corps, "utf8");
    res.writeHead(page.statut || 200, { "content-type": page.type, ...(page.entetes || {}) });
    res.end(corps);
  });
  await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
  const port = serveur.address().port;
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    port,
    table,
    /** Chemins effectivement demandés au serveur (ordre d'arrivée). */
    requetes,
    /** Installe les pages du mini-site (le site « externe » est le même serveur, sous un autre hôte). */
    installer(externe = base) {
      Object.assign(table, pages({ externe, site: base }));
      return table;
    },
    fermer: () => new Promise((r) => serveur.close(r)),
  };
}

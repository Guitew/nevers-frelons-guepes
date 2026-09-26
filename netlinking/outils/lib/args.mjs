/**
 * Lecture des arguments « --cle=valeur » et « --drapeau » de la ligne de commande.
 * Une clé répétée accumule ses valeurs (--url=a --url=b → ["a", "b"]).
 */
export function lireArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  const positionnels = [];
  for (const a of argv) {
    if (!a.startsWith("--")) {
      positionnels.push(a);
      continue;
    }
    const egal = a.indexOf("=");
    const cle = egal === -1 ? a.slice(2) : a.slice(2, egal);
    const valeur = egal === -1 ? true : a.slice(egal + 1);
    if (args.has(cle)) {
      const existant = args.get(cle);
      args.set(cle, Array.isArray(existant) ? [...existant, valeur] : [existant, valeur]);
    } else {
      args.set(cle, valeur);
    }
  }
  return {
    /** Valeur brute (true pour un drapeau, dernière valeur si répétée). */
    get(cle, defaut) {
      if (!args.has(cle)) return defaut;
      const v = args.get(cle);
      return Array.isArray(v) ? v[v.length - 1] : v;
    },
    has: (cle) => args.has(cle),
    /** Toutes les valeurs d'une clé (répétée ou séparée par des virgules). */
    liste(cle) {
      if (!args.has(cle)) return [];
      const v = args.get(cle);
      return (Array.isArray(v) ? v : [v])
        .filter((x) => x !== true)
        .flatMap((x) => String(x).split(","))
        .map((x) => x.trim())
        .filter(Boolean);
    },
    nombre(cle, defaut) {
      const v = this.get(cle);
      if (v === undefined || v === true) return defaut;
      const n = Number(v);
      return Number.isFinite(n) ? n : defaut;
    },
    positionnels,
  };
}

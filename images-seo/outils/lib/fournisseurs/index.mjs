/**
 * Fournisseurs de génération d'image. Chacun expose :
 *   generer({ element, destination, config, journal }) → { fichier, fournisseur, detail }
 *   ou lève une erreur ; une erreur `quotaEpuise = true` arrête la série du jour.
 */
export const FOURNISSEURS = {
  "chatgpt-navigateur": () => import("./chatgpt-navigateur.mjs"),
  "openai-api": () => import("./openai-api.mjs"),
  depot: () => import("./depot.mjs"),
  simulation: () => import("./simulation.mjs"),
};

export async function chargerFournisseur(nom) {
  const charge = FOURNISSEURS[nom];
  if (!charge) throw new Error(`Fournisseur inconnu : ${nom} (connus : ${Object.keys(FOURNISSEURS).join(", ")})`);
  return charge();
}

export class ErreurQuota extends Error {
  constructor(message) {
    super(message);
    this.quotaEpuise = true;
  }
}

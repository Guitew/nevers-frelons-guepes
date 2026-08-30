/** Variables d'environnement utiles au build (jamais de secret exposé). */
export default {
  indexnowKey: process.env.INDEXNOW_KEY || "",
  production: process.env.ELEVENTY_RUN_MODE === "build",
  // Chemin absolu du fichier .htpasswd protégeant la zone de pilotage.
  // Une valeur erronée fait échouer l'authentification côté serveur (500),
  // ce qui laisse la zone fermée : l'erreur par défaut est la plus sûre.
  cheminHtpasswd: process.env.CHEMIN_HTPASSWD || "/chemin/absolu/vers/.htpasswd-pilotage",
};

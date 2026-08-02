#!/usr/bin/env node
/**
 * Petit client SMTP sans dépendance (Node 18+).
 *
 * Suffisant pour envoyer une alerte à un destinataire via un serveur SMTP
 * authentifié (Gmail, o2switch, OVH…). Gère :
 *   - la connexion TLS implicite (port 465) ou STARTTLS (port 587),
 *   - l'authentification AUTH LOGIN ou AUTH PLAIN,
 *   - un message multipart/alternative (texte + HTML) en UTF-8.
 *
 * Utilisé par `veille-inpi.mjs`. Aucune bibliothèque externe n'est nécessaire :
 * le dépôt reste installable avec un simple `npm ci`.
 */

import net from "node:net";
import tls from "node:tls";
import os from "node:os";
import { randomUUID } from "node:crypto";

const DELAI_MS = 30_000; // délai d'attente maximal sur le réseau

/* ------------------------------------------------------------------ */
/* Construction du message                                             */
/* ------------------------------------------------------------------ */

/** Encode un en-tête en =?UTF-8?B?…?= s'il contient autre chose que de l'ASCII. */
export function encoderEntete(valeur) {
  const texte = String(valeur ?? "");
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7e]*$/.test(texte)) return texte;
  return `=?UTF-8?B?${Buffer.from(texte, "utf8").toString("base64")}?=`;
}

/** Encode une adresse « Nom <adresse> » en gardant l'adresse intacte. */
export function encoderAdresse(adresse) {
  const m = String(adresse ?? "").match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!m) return String(adresse ?? "").trim();
  return `${encoderEntete(m[1])} <${m[2]}>`;
}

/** Extrait l'adresse seule (sans le nom d'affichage) pour MAIL FROM / RCPT TO. */
export function adresseSeule(adresse) {
  const m = String(adresse ?? "").match(/<([^>]+)>/);
  return (m ? m[1] : String(adresse ?? "")).trim();
}

const base64Lignes = (texte) =>
  Buffer.from(texte, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");

/**
 * Construit un message RFC 5322 complet (en-têtes + corps multipart).
 * Les deux parties sont encodées en base64 : pas de souci d'accents ni de
 * lignes commençant par un point.
 */
export function construireMessage({ de, a, sujet, texte, html, repondreA, date = new Date() }) {
  const frontiere = `----allo-frelons-${randomUUID()}`;
  const destinataires = Array.isArray(a) ? a : [a];
  const entetes = [
    `From: ${encoderAdresse(de)}`,
    `To: ${destinataires.map(encoderAdresse).join(", ")}`,
    repondreA ? `Reply-To: ${encoderAdresse(repondreA)}` : null,
    `Subject: ${encoderEntete(sujet)}`,
    `Date: ${date.toUTCString().replace(/GMT$/, "+0000")}`,
    `Message-ID: <${randomUUID()}@${(adresseSeule(de).split("@")[1] || "localhost").trim()}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${frontiere}"`,
  ].filter(Boolean);

  const corps = [
    `--${frontiere}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lignes(texte || ""),
    `--${frontiere}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lignes(html || `<pre>${texte || ""}</pre>`),
    `--${frontiere}--`,
    "",
  ];

  return [...entetes, "", ...corps].join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Dialogue SMTP                                                       */
/* ------------------------------------------------------------------ */

/** Enveloppe une connexion et permet de lire les réponses ligne à ligne. */
class Connexion {
  #socket = null;
  #tampon = "";
  #lignes = [];
  #attentes = [];
  #erreur = null;

  attacher(socket) {
    this.#socket = socket;
    socket.setTimeout(DELAI_MS);
    socket.on("data", (donnees) => this.#recevoir(donnees.toString("utf8")));
    socket.on("timeout", () =>
      this.#echouer(
        new Error(
          "délai d'attente SMTP dépassé — vérifiez le port et le chiffrement (465 → ssl, 587 → starttls, cf. SMTP_SECURITY)",
        ),
      ),
    );
    socket.on("error", (e) => this.#echouer(e));
    socket.on("close", () => this.#echouer(new Error("connexion SMTP fermée par le serveur")));
  }

  get socket() {
    return this.#socket;
  }

  #recevoir(donnees) {
    this.#tampon += donnees;
    let i;
    while ((i = this.#tampon.indexOf("\r\n")) !== -1) {
      const ligne = this.#tampon.slice(0, i);
      this.#tampon = this.#tampon.slice(i + 2);
      this.#lignes.push(ligne);
      // Une réponse est terminée quand le code est suivi d'une espace.
      if (/^\d{3}(?: |$)/.test(ligne)) {
        const reponse = { code: Number(ligne.slice(0, 3)), lignes: this.#lignes };
        this.#lignes = [];
        const attente = this.#attentes.shift();
        if (attente) attente.resoudre(reponse);
      }
    }
  }

  #echouer(e) {
    if (this.#erreur) return;
    this.#erreur = e;
    while (this.#attentes.length) this.#attentes.shift().rejeter(e);
  }

  lire() {
    if (this.#erreur) return Promise.reject(this.#erreur);
    return new Promise((resoudre, rejeter) => this.#attentes.push({ resoudre, rejeter }));
  }

  ecrire(texte) {
    if (this.#erreur) throw this.#erreur;
    this.#socket.write(texte);
  }

  /** Envoie une commande et vérifie le code de retour. */
  async commande(texte, codesAttendus, etiquette = texte) {
    this.ecrire(texte + "\r\n");
    const reponse = await this.lire();
    if (!codesAttendus.includes(reponse.code)) {
      throw new Error(`SMTP « ${etiquette.split("\r\n")[0]} » : ${reponse.lignes.join(" | ")}`);
    }
    return reponse;
  }

  fermer() {
    this.#erreur = this.#erreur || new Error("connexion terminée");
    this.#attentes = [];
    this.#socket?.destroy();
  }
}

const connecter = (options, securise) =>
  new Promise((resoudre, rejeter) => {
    const socket = securise
      ? tls.connect(options, () => resoudre(socket))
      : net.connect(options, () => resoudre(socket));
    socket.once("error", rejeter);
    socket.setTimeout(DELAI_MS, () => {
      socket.destroy();
      rejeter(new Error(`connexion à ${options.host}:${options.port} : délai dépassé`));
    });
  });

/**
 * Envoie un message.
 *
 * @param {object} config { hote, port, utilisateur, motDePasse, chiffrement }
 *   chiffrement : "ssl" (TLS implicite), "starttls", "aucun" ou "auto" (défaut :
 *   ssl si port 465, starttls sinon).
 * @param {object} message { de, a, sujet, texte, html, repondreA }
 */
export async function envoyerCourriel(config, message) {
  const port = Number(config.port || 465);
  const chiffrement =
    config.chiffrement && config.chiffrement !== "auto"
      ? config.chiffrement
      : port === 465
        ? "ssl"
        : "starttls";

  const nomClient = (os.hostname() || "localhost").replace(/[^\w.-]/g, "") || "localhost";
  const cx = new Connexion();
  const optionsBase = { host: config.hote, port };

  try {
    const socket = await connecter(
      chiffrement === "ssl" ? { ...optionsBase, servername: config.hote } : optionsBase,
      chiffrement === "ssl",
    );
    cx.attacher(socket);

    const accueil = await cx.lire();
    if (accueil.code !== 220) throw new Error(`accueil SMTP inattendu : ${accueil.lignes.join(" | ")}`);

    let ehlo = await cx.commande(`EHLO ${nomClient}`, [250]);

    if (chiffrement === "starttls") {
      await cx.commande("STARTTLS", [220]);
      const securise = tls.connect({ socket: cx.socket, servername: config.hote });
      await new Promise((r, j) => {
        securise.once("secureConnect", r);
        securise.once("error", j);
      });
      cx.attacher(securise);
      ehlo = await cx.commande(`EHLO ${nomClient}`, [250]);
    }

    if (config.utilisateur) {
      const capacites = ehlo.lignes.join(" ").toUpperCase();
      if (capacites.includes("AUTH") && capacites.includes("PLAIN") && !capacites.includes("LOGIN")) {
        const jeton = Buffer.from(`\0${config.utilisateur}\0${config.motDePasse}`, "utf8").toString("base64");
        await cx.commande(`AUTH PLAIN ${jeton}`, [235], "AUTH PLAIN");
      } else {
        await cx.commande("AUTH LOGIN", [334], "AUTH LOGIN");
        await cx.commande(Buffer.from(config.utilisateur, "utf8").toString("base64"), [334], "AUTH LOGIN (identifiant)");
        await cx.commande(Buffer.from(config.motDePasse || "", "utf8").toString("base64"), [235], "AUTH LOGIN (mot de passe)");
      }
    }

    const expediteur = adresseSeule(message.de);
    const destinataires = (Array.isArray(message.a) ? message.a : [message.a]).map(adresseSeule);

    await cx.commande(`MAIL FROM:<${expediteur}>`, [250]);
    for (const destinataire of destinataires) {
      await cx.commande(`RCPT TO:<${destinataire}>`, [250, 251]);
    }
    await cx.commande("DATA", [354]);

    const brut = construireMessage(message);
    // Point-stuffing (RFC 5321 §4.5.2) : une ligne réduite à « . » terminerait le message.
    const corps = brut.replace(/\r\n\./g, "\r\n..");
    cx.ecrire(corps + "\r\n.\r\n");
    const accuse = await cx.lire();
    if (accuse.code !== 250) throw new Error(`envoi refusé : ${accuse.lignes.join(" | ")}`);

    try {
      await cx.commande("QUIT", [221]);
    } catch {
      /* le serveur peut couper avant la réponse : sans conséquence */
    }
    return { destinataires, reponse: accuse.lignes.join(" | ") };
  } finally {
    cx.fermer();
  }
}

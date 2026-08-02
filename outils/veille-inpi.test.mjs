#!/usr/bin/env node
/**
 * Tests de la veille INPI (`node --test outils/` ou `npm test`).
 *
 * Ils couvrent ce qui peut l'être hors ligne : la reconnaissance du nom
 * « Allo Frelons », la lecture des réponses de l'INPI, la rédaction de l'alerte
 * et l'envoi SMTP (contre un faux serveur local). Les appels réels à l'INPI ne
 * sont pas testés ici : ils dépendent du réseau et des identifiants.
 */

import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import { normaliser, correspond, extraireMarques, cleMarque, composerAlerte } from "./veille-inpi.mjs";
import { envoyerCourriel, construireMessage, encoderEntete } from "./smtp.mjs";

const TERMES = ["Allo Frelons"];

test("normaliser neutralise casse, accents et ponctuation", () => {
  assert.equal(normaliser("Allo-Frelons 59"), "allofrelons59");
  assert.equal(normaliser("ALLÔ  FRELONS"), "allofrelons");
  assert.equal(normaliser(null), "");
});

test("correspond attrape les variantes du nom surveillé", () => {
  for (const nom of [
    "Allo Frelons",
    "allo frelons",
    "ALLO FRELONS",
    "Allo-Frelons",
    "AlloFrelons",
    "Allo Frelon",
    "ALLO FRELONS 59",
    "Groupe Allo Frelons SAS",
  ]) {
    assert.equal(correspond(nom, TERMES), true, `« ${nom} » aurait dû correspondre`);
  }

  for (const nom of ["Allo Guêpes", "Frelons Express", "Allo Nuisibles", "", null]) {
    assert.equal(correspond(nom, TERMES), false, `« ${nom} » n'aurait pas dû correspondre`);
  }
});

test("extraireMarques lit une réponse de type data.inpi.fr", () => {
  const reponse = {
    total: 1,
    hits: {
      hits: [
        {
          _id: "FR4812345",
          _source: {
            applicationNumber: "4812345",
            markVerbalElementText: "ALLO FRELONS",
            applicationDate: "2026-07-28",
            markCurrentStatusCode: "Marque déposée",
            applicant: [{ name: "Dupont Nuisibles SARL" }],
          },
        },
      ],
    },
  };

  const marques = extraireMarques(reponse, "data.inpi.fr");
  assert.equal(marques.length, 1);
  assert.deepEqual(
    { ...marques[0] },
    {
      nom: "ALLO FRELONS",
      numero: "4812345",
      date: "2026-07-28",
      statut: "Marque déposée",
      deposant: "Dupont Nuisibles SARL",
      classes: null,
      source: "data.inpi.fr",
      url: "https://data.inpi.fr/marques/4812345",
    },
  );
});

test("extraireMarques lit une réponse de type API PI", () => {
  const reponse = {
    result: {
      hits: [
        {
          numeroNational: "4899001",
          denomination: "Allo Frelons Nord",
          dateDepot: "2026-06-01",
          titulaire: { fullName: "SAS Guêpes & Cie" },
          classes: [35, 37],
        },
        { numeroNational: "4899002", denomination: "Allo Taupes", dateDepot: "2026-06-02" },
      ],
    },
  };

  const marques = extraireMarques(reponse, "api");
  assert.equal(marques.length, 2);
  const frelons = marques.filter((m) => correspond(m.nom, TERMES));
  assert.equal(frelons.length, 1);
  assert.equal(frelons[0].nom, "Allo Frelons Nord");
  assert.equal(frelons[0].deposant, "SAS Guêpes & Cie");
  assert.equal(frelons[0].classes, "35, 37");
});

test("cleMarque est stable et distingue les dépôts", () => {
  const a = { numero: "4812345", nom: "ALLO FRELONS" };
  const b = { numero: "4812345", nom: "Allo Frelons" }; // même dépôt, casse différente
  const c = { numero: "4899001", nom: "Allo Frelons" };
  assert.equal(cleMarque(a), cleMarque(b));
  assert.notEqual(cleMarque(a), cleMarque(c));

  // Sans numéro, on retombe sur la dénomination + la date.
  assert.equal(cleMarque({ nom: "Allo Frelons", date: "2026-07-28" }), "d:allofrelons|20260728");
});

test("composerAlerte reprend les informations utiles du dépôt", () => {
  const { sujet, texte, html } = composerAlerte(
    [
      {
        nom: "ALLO FRELONS",
        numero: "4812345",
        date: "2026-07-28",
        deposant: "Dupont Nuisibles SARL",
        url: "https://data.inpi.fr/marques/4812345",
      },
    ],
    TERMES,
  );

  assert.match(sujet, /Allo Frelons/);
  assert.match(sujet, /1 nouveau dépôt/);
  for (const attendu of ["ALLO FRELONS", "4812345", "2026-07-28", "Dupont Nuisibles SARL"]) {
    assert.ok(texte.includes(attendu), `le texte devrait contenir « ${attendu} »`);
    assert.ok(html.includes(attendu), `le HTML devrait contenir « ${attendu} »`);
  }
});

test("encoderEntete encode les sujets accentués", () => {
  assert.equal(encoderEntete("Nouveau depot"), "Nouveau depot");
  assert.match(encoderEntete("Dépôt de marque"), /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
});

test("construireMessage produit un message MIME valide", () => {
  const brut = construireMessage({
    de: "Veille <veille@example.org>",
    a: "allofrelons@gmail.com",
    sujet: "Test",
    texte: "Bonjour",
    html: "<p>Bonjour</p>",
    date: new Date("2026-07-28T08:00:00Z"),
  });

  assert.ok(brut.includes("\r\nTo: allofrelons@gmail.com\r\n"));
  assert.match(brut, /Content-Type: multipart\/alternative; boundary="(.+)"/);
  assert.ok(brut.includes(Buffer.from("Bonjour", "utf8").toString("base64")));
});

/** Faux serveur SMTP : rejoue un dialogue minimal et mémorise ce qu'il reçoit. */
function fauxServeurSmtp() {
  const recu = { commandes: [], message: "" };
  const serveur = net.createServer((socket) => {
    let tampon = "";
    let etat = "commande"; // commande | identifiant | motDePasse | donnees
    socket.write("220 faux-smtp prêt\r\n");
    socket.on("data", (donnees) => {
      tampon += donnees.toString("utf8");
      let i;
      while ((i = tampon.indexOf("\r\n")) !== -1) {
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);

        if (etat === "donnees") {
          if (ligne === ".") {
            etat = "commande";
            socket.write("250 message accepté\r\n");
          } else {
            // Annulation du point-stuffing (RFC 5321 §4.5.2).
            recu.message += (ligne.startsWith("..") ? ligne.slice(1) : ligne) + "\r\n";
          }
          continue;
        }

        recu.commandes.push(ligne);
        if (etat === "identifiant") {
          etat = "motDePasse";
          socket.write("334 UGFzc3dvcmQ6\r\n"); // « Password: »
        } else if (etat === "motDePasse") {
          etat = "commande";
          socket.write("235 authentification acceptée\r\n");
        } else if (/^EHLO/i.test(ligne)) {
          socket.write("250-faux-smtp\r\n250 AUTH LOGIN\r\n");
        } else if (/^AUTH LOGIN/i.test(ligne)) {
          etat = "identifiant";
          socket.write("334 VXNlcm5hbWU6\r\n"); // « Username: »
        } else if (/^DATA/i.test(ligne)) {
          etat = "donnees";
          socket.write("354 envoyez le message\r\n");
        } else if (/^QUIT/i.test(ligne)) {
          socket.write("221 au revoir\r\n");
        } else {
          socket.write("250 ok\r\n");
        }
      }
    });
  });
  return { serveur, recu };
}

test("envoyerCourriel dialogue correctement avec un serveur SMTP", async () => {
  const { serveur, recu } = fauxServeurSmtp();
  await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
  const port = serveur.address().port;

  try {
    await envoyerCourriel(
      { hote: "127.0.0.1", port, utilisateur: "veille@example.org", motDePasse: "secret", chiffrement: "aucun" },
      {
        de: "Veille INPI <veille@example.org>",
        a: "allofrelons@gmail.com",
        sujet: "Dépôt « Allo Frelons »",
        texte: "Nouveau dépôt détecté.",
        html: "<p>Nouveau dépôt détecté.</p>",
      },
    );
  } finally {
    serveur.close();
  }

  assert.ok(recu.commandes.some((c) => /^EHLO /.test(c)));
  assert.ok(recu.commandes.includes("AUTH LOGIN"));
  assert.ok(recu.commandes.includes(Buffer.from("veille@example.org").toString("base64")));
  assert.ok(recu.commandes.includes(Buffer.from("secret").toString("base64")));
  assert.ok(recu.commandes.includes("MAIL FROM:<veille@example.org>"));
  assert.ok(recu.commandes.includes("RCPT TO:<allofrelons@gmail.com>"));
  assert.ok(recu.message.includes("To: allofrelons@gmail.com"));
  assert.ok(recu.message.includes(Buffer.from("Nouveau dépôt détecté.", "utf8").toString("base64")));
});

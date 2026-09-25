/**
 * SMS de suggestion — le message que l'on envoie au dirigeant pour qu'il
 * déclare sa page comme site web sur sa fiche Google.
 *
 * Principes : une seule action demandée (répondre OUI), tout le reste est
 * pris en charge ; le lien de la page en clair pour qu'il voie ce qu'il
 * gagne ; et les trois objections levées d'emblée — c'est gratuit, sans
 * engagement, retirable quand il veut. Court : deux ou trois segments SMS.
 */

/** Préfixes français des mobiles : seuls ceux-là reçoivent un SMS. */
const MOBILE = /^(?:\+33|0)[67]\d{8}$/;

/** Numéro au format international si c'est un mobile, sinon null. */
export function numeroSms(telephone) {
  if (!telephone) return null;
  const brut = String(telephone).replace(/[^\d+]/g, "");
  const national = brut.startsWith("+33") ? "0" + brut.slice(3) : brut;
  if (!MOBILE.test(national)) return null;
  return "+33" + national.slice(1);
}

/** Texte du SMS initial. */
export function smsInitial({ nom, url, signature }) {
  return (
    `Bonjour, ${signature}. Votre page web gratuite pour ${nom} est en ligne : ${url}\n` +
    `Répondez OUI et je l'ajoute comme site web sur votre fiche Google Maps, vous n'avez rien à faire. ` +
    `Gratuit, sans engagement, retirable à tout moment.`
  );
}

/** Texte de la réponse à envoyer après un OUI. */
export function smsRelance() {
  return (
    `Merci ! C'est fait : la page est proposée comme site web de votre fiche Google. ` +
    `Si Google vous envoie une notification ou un mail « modification suggérée », validez-la : ` +
    `le lien s'affichera sous 24 à 48 h. Bonne journée !`
  );
}

/** Lien qui ouvre l'application SMS avec le destinataire et le texte pré-remplis. */
export function lienSms(numero, texte) {
  return `sms:${numero}?body=${encodeURIComponent(texte)}`;
}

/** Tout ce qu'il faut pour proposer le SMS dans un email ou une page d'aide. */
export function preparerSms(fiche, url, signature) {
  const numero = numeroSms(fiche.telephone);
  const texte = smsInitial({ nom: fiche.nom, url, signature });
  return {
    numero,
    telephone: fiche.telephone || null,
    mobile: !!numero,
    texte,
    relance: smsRelance(),
    lien: numero ? lienSms(numero, texte) : null,
  };
}

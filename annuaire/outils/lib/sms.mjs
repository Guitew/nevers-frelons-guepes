/**
 * SMS de suggestion — le message envoyé au dirigeant pour qu'il déclare
 * LUI-MÊME sa page comme site web sur sa fiche Google Business Profile.
 *
 * Seul le propriétaire de la fiche peut ajouter un site web instantanément,
 * sans examen de Google : c'est lui qu'il faut faire agir. Le message lève
 * donc toutes les frictions :
 *   • le bénéfice d'abord (page gratuite, déjà en ligne, avec ce que cherchent
 *     ses clients) ;
 *   • le chemin exact en une ligne, sur téléphone, là où il lit le SMS ;
 *   • le lien isolé en dernière ligne : un appui long suffit à le copier ;
 *   • les objections levées (gratuit, sans engagement, une minute) ;
 *   • une porte de sortie sans effort : « Une question ? Répondez ici. »
 * Court : trois segments SMS au plus.
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

/** Texte du SMS initial : le dirigeant ajoute le lien lui-même, en une minute. */
export function smsInitial({ nom, url, signature }) {
  return (
    `Bonjour, ${signature}. Votre page web gratuite pour ${nom} est en ligne (horaires, adresse, téléphone). ` +
    `Pour l'afficher sur votre fiche Google, 1 min : Google Maps > votre établissement > Modifier le profil > Site Web > collez le lien > Enregistrer. ` +
    `Gratuit, sans engagement. Une question ? Répondez ici.\n` +
    `Votre lien à coller :\n${url}`
  );
}

/** Relance, quelques jours plus tard, si le lien n'est toujours pas sur la fiche. */
export function smsRelance({ nom, url }) {
  return (
    `Bonjour, petit rappel : la page web gratuite de ${nom} est en ligne mais pas encore sur votre fiche Google ` +
    `(Google Maps > votre établissement > Modifier le profil > Site Web > coller > Enregistrer). ` +
    `Si vous préférez que je la retire, un mot suffit.\n${url}`
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
    relance: smsRelance({ nom: fiche.nom, url }),
    lien: numero ? lienSms(numero, texte) : null,
  };
}

/**
 * Alphabet GSM 03.38 (jeu de base + extension). Un seul caractère hors de cet
 * alphabet (ê, ô, œ, «, », ’…) bascule tout le SMS en UCS-2 : 70 caractères
 * par segment au lieu de 153, soit deux fois plus de segments facturés.
 */
const GSM =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà" +
  "^{}\\[~]|€";

/** Caractères du texte absents de l'alphabet GSM (vide si le SMS reste en 7 bits). */
export function horsGsm(texte) {
  return [...new Set([...String(texte)].filter((c) => !GSM.includes(c)))];
}

/** Nombre de segments SMS facturés. */
export function segments(texte) {
  const n = String(texte).length;
  if (horsGsm(texte).length) return n <= 70 ? 1 : Math.ceil(n / 67);
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

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

/** Chemin exact sur téléphone, dans l'ordre des écrans de Google Maps. */
export const CHEMIN_GMB = "Google Maps > votre établissement > Modifier le profil > Site Web > collez > Enregistrer";

/**
 * Texte du SMS initial. L'argument d'acquisition d'abord, en mots simples :
 * sur Google, les clients choisissent les fiches qui ont un site web ; sans
 * lien, l'entreprise perd des appels face aux concurrents. Puis le chemin, les
 * objections levées, la porte de sortie, et le lien seul en dernière ligne.
 */
export function smsInitial({ nom, url, signature }) {
  return (
    `Bonjour, ${signature}. Sur Google, les clients choisissent les fiches qui ont un site web : ` +
    `sans lien, ${nom} perd des appels face aux concurrents. Votre page gratuite est en ligne. ` +
    `Pour l'activer, 1 min : ${CHEMIN_GMB}. Sans engagement. Une question ? Répondez ici.\n` +
    `Lien :\n${url}`
  );
}

/** Relance, quelques jours plus tard, si le lien n'est toujours pas sur la fiche. */
export function smsRelance({ nom, url }) {
  return (
    `Bonjour, petit rappel : sans site web sur votre fiche Google, des clients partent chez un concurrent qui en a un. ` +
    `La page gratuite de ${nom} est en ligne, 1 min pour l'activer : ${CHEMIN_GMB}. ` +
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

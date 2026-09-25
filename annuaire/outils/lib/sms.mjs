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
export const CHEMIN_GMB = "Google Maps > votre établissement > Modifier le profil > Site Web > coller ce lien";

/**
 * Texte du SMS initial. Ton direct et factuel, sans formule commerciale :
 * le constat (la fiche n'a pas de bouton Site Web), ce qui a été fait (une
 * page avec les informations pratiques), ce que ça apporte concrètement (le
 * bouton Site Web sur la fiche, et une page à son nom dans les résultats
 * Google, là où les clients vérifient les horaires avant d'appeler), comment
 * faire, le prix (rien), et la sortie (répondre STOP). Le lien seul en
 * dernière ligne, copiable d'un appui long.
 *
 * Quatre segments SMS : la phrase de résultat vaut le segment de plus, et le
 * SMS est envoyé à la main, cinq fois par jour au plus.
 */
export function smsInitial({ nom, url, signature }) {
  return (
    `Bonjour, je suis ${signature}. Votre fiche Google (${nom}) n'a pas de bouton Site Web. ` +
    `J'ai mis en ligne une page avec vos horaires, adresse et téléphone.\n` +
    `Ajoutée à votre fiche, elle active le bouton Site Web et ressort sur Google à votre nom : ` +
    `c'est là que vos clients vérifient vos horaires avant d'appeler ou de passer.\n` +
    `Pour l'ajouter : ${CHEMIN_GMB}.\n` +
    `C'est gratuit.\n` +
    `Voici le lien à ajouter sur maps.\n${url}`
  );
}

/** Relance, quelques jours plus tard, si le lien n'est toujours pas sur la fiche. */
export function smsRelance({ nom, url }) {
  return (
    `Bonjour, suite à mon SMS : la page de ${nom} est toujours en ligne et votre fiche Google n'a toujours pas de site web. ` +
    `L'ajouter prend une minute : ${CHEMIN_GMB}. Pour la retirer, répondez STOP.\n${url}`
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

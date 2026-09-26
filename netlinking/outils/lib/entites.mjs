/** Décodage des entités HTML courantes (numériques et nommées usuelles en français). */

const NOMMEES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", auml: "ä", aring: "å",
  ccedil: "ç", ugrave: "ù", ucirc: "û", uuml: "ü", ocirc: "ô", ouml: "ö", ograve: "ò", oslash: "ø",
  icirc: "î", iuml: "ï", igrave: "ì", ntilde: "ñ", atilde: "ã", otilde: "õ", yuml: "ÿ", szlig: "ß",
  Eacute: "É", Egrave: "È", Ecirc: "Ê", Agrave: "À", Acirc: "Â", Ccedil: "Ç", Ugrave: "Ù", Ucirc: "Û",
  Ocirc: "Ô", Icirc: "Î", Iuml: "Ï", Euml: "Ë", Ouml: "Ö", Uuml: "Ü", Auml: "Ä", Ntilde: "Ñ",
  oelig: "œ", OElig: "Œ", aelig: "æ", AElig: "Æ",
  laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bdquo: "„", sbquo: "‚",
  hellip: "…", ndash: "–", mdash: "—", copy: "©", reg: "®", trade: "™", deg: "°", euro: "€", pound: "£",
  yen: "¥", cent: "¢", sect: "§", para: "¶", middot: "·", bull: "•", times: "×", divide: "÷", plusmn: "±",
  frac12: "½", frac14: "¼", frac34: "¾", sup2: "²", sup3: "³", micro: "µ", iexcl: "¡", iquest: "¿",
  larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔", hearts: "♥", star: "☆", check: "✓", shy: "",
  zwnj: "", zwj: "", lrm: "", rlm: "",
};

/** Codes 128-159 : positions Windows-1252 souvent utilisées à tort en numérique. */
const CP1252 = {
  128: "€", 130: "‚", 131: "ƒ", 132: "„", 133: "…", 134: "†", 135: "‡", 136: "ˆ", 137: "‰", 138: "Š",
  139: "‹", 140: "Œ", 142: "Ž", 145: "‘", 146: "’", 147: "“", 148: "”", 149: "•", 150: "–", 151: "—",
  152: "˜", 153: "™", 154: "š", 155: "›", 156: "œ", 158: "ž", 159: "Ÿ",
};

export function decoderEntites(texte) {
  const s = String(texte ?? "");
  if (s.indexOf("&") === -1) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g, (tout, corps, decalage) => {
    if (corps[0] === "#") {
      const hexa = corps[1] === "x" || corps[1] === "X";
      const code = hexa ? parseInt(corps.slice(2), 16) : parseInt(corps.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return tout;
      if (CP1252[code]) return CP1252[code];
      if (code >= 0xd800 && code <= 0xdfff) return "�";
      return String.fromCodePoint(code);
    }
    // Sans point-virgule, seules les entités nommées sûres sont acceptées (« &amp » dans une URL).
    const avecPointVirgule = s[decalage + tout.length - 1] === ";";
    if (!avecPointVirgule && !/^(amp|lt|gt|quot|nbsp)$/.test(corps)) return tout;
    if (corps in NOMMEES) return NOMMEES[corps];
    const bas = corps.toLowerCase();
    if (bas in NOMMEES) return NOMMEES[bas];
    return tout;
  });
}

<?php
/**
 * suggerer.php — Page d'aide à la suggestion de site web sur Google Maps
 *
 * Affiche pour chaque fiche : URL à copier, lien Maps, bouton « soumise ».
 * Stocke les marquages dans un fichier JSON côté serveur.
 *
 * API (synchronisation locale) :
 *   ?action=liste&t=TOKEN   → JSON des marquages
 *   ?action=vider&t=TOKEN   → vide les marquages
 *
 * Déployé dans andpro.fr/vitrine-locale/suggerer.php
 */

define('TOKEN', 'VL-s8k3m2p7');
define('DATA_FILE', __DIR__ . '/.suggestions-soumises.json');

$t = $_GET['t'] ?? '';
if ($t !== TOKEN) { http_response_code(403); die('Accès refusé.'); }

$action = $_GET['action'] ?? '';

if ($action === 'liste') {
    header('Content-Type: application/json; charset=utf-8');
    echo file_exists(DATA_FILE) ? file_get_contents(DATA_FILE) : '[]';
    exit;
}
if ($action === 'vider') {
    if (file_exists(DATA_FILE)) unlink(DATA_FILE);
    header('Content-Type: application/json');
    echo '{"ok":true}';
    exit;
}

$id       = $_GET['id'] ?? '';
$nom      = $_GET['nom'] ?? '';
$url_page = $_GET['url'] ?? '';
$tel      = preg_replace('/[^0-9+]/', '', $_GET['tel'] ?? '');
define('SIGNATURE_SMS', 'Guillaume de Vitrine Locale');
if (!$id) { http_response_code(400); die('id manquant.'); }

if ($action === 'marquer') {
    $data = file_exists(DATA_FILE) ? (json_decode(file_get_contents(DATA_FILE), true) ?: []) : [];
    $found = false;
    foreach ($data as $e) { if ($e['id'] === $id) { $found = true; break; } }
    if (!$found) {
        $data[] = ['id' => $id, 'nom' => $nom, 'date' => date('c')];
        file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
    $back = http_build_query(['id' => $id, 't' => TOKEN, 'nom' => $nom, 'url' => $url_page, 'tel' => $tel, 'ok' => 1]);
    header("Location: suggerer.php?$back", true, 302);
    exit;
}

$ok       = isset($_GET['ok']);
$nom_h    = htmlspecialchars($nom, ENT_QUOTES, 'UTF-8');
$url_h    = htmlspecialchars($url_page, ENT_QUOTES, 'UTF-8');
$maps_url = 'https://www.google.com/maps/search/?' . http_build_query([
    'api' => '1', 'query' => $nom ?: $id, 'query_place_id' => $id
]);
$marquer_url = 'suggerer.php?' . http_build_query([
    'id' => $id, 't' => TOKEN, 'nom' => $nom, 'url' => $url_page, 'tel' => $tel, 'action' => 'marquer'
]);
// Mêmes textes que outils/lib/sms.mjs : le dirigeant ajoute le lien lui-même.
$chemin = "Google Maps > votre établissement > Modifier le profil > Site Web > coller ce lien";
$sms_texte = "Bonjour, " . SIGNATURE_SMS . ". Votre fiche Google ($nom) n'a pas de bouton Site Web. "
  . "J'ai mis en ligne une page avec vos horaires, adresse et téléphone : elle peut servir de site web sur votre fiche.\n"
  . "Pour l'ajouter : $chemin.\n"
  . "C'est gratuit. Pour la retirer, répondez STOP.\n$url_page";
$sms_relance = "Bonjour, suite à mon SMS : la page de $nom est toujours en ligne et votre fiche Google n'a toujours pas de site web. "
  . "L'ajouter prend une minute : $chemin. Pour la retirer, répondez STOP.\n$url_page";
$sms_lien = $tel ? 'sms:' . $tel . '?body=' . rawurlencode($sms_texte) : '';
?>
<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Suggérer — <?= $nom_h ?></title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f0f2f5;min-height:100vh;
     display:flex;align-items:flex-start;justify-content:center;padding:24px 16px}
.card{background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.08);
      max-width:480px;width:100%;padding:32px 28px}
h1{font-size:22px;color:#1a1a1a;margin-bottom:24px;line-height:1.3}
.label{font-size:13px;color:#666;font-weight:600;margin-bottom:6px}
.url-box{display:flex;gap:8px;margin-bottom:28px}
.url-box input{flex:1;padding:12px;border:2px dashed #90caf9;border-radius:8px;
               font-family:monospace;font-size:13px;color:#1a73e8;background:#f0f6ff;outline:none}
.url-box button{padding:12px 18px;background:#1a73e8;color:#fff;border:none;
                border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;
                white-space:nowrap;transition:background .15s}
.url-box button:hover{background:#1557b0}
.url-box button.ok{background:#0d8a4a}
.btn{display:block;text-align:center;padding:16px;border-radius:10px;
     text-decoration:none;font-weight:700;font-size:16px;margin-bottom:12px;transition:opacity .15s}
.btn:hover{opacity:.85}
.btn-maps{background:#1a73e8;color:#fff}
.btn-done{background:#0d8a4a;color:#fff}
.steps{margin:24px 0 0;padding:18px;background:#f8f9fa;border-radius:10px;
       font-size:14px;color:#555;line-height:1.8}
.steps b{color:#333}
.banner{padding:16px;border-radius:10px;text-align:center;font-weight:700;
        font-size:16px;margin-bottom:20px}
.banner-ok{background:#e8f5e9;color:#2e7d32}
.sms{margin-top:24px;padding-top:20px;border-top:1px solid #eee}
.sms textarea{width:100%;min-height:150px;padding:12px;border:2px dashed #a5d6a7;border-radius:8px;
              font:inherit;font-size:14px;line-height:1.5;color:#1a1a1a;background:#f1f8f4;resize:vertical}
.sms textarea.relance{min-height:110px;border-color:#ccc;background:#f8f9fa;color:#333}
.sms .rangee{display:flex;gap:8px;margin-top:8px}
.sms .rangee button,.sms .rangee a{flex:1;text-align:center;padding:12px;border-radius:8px;border:none;
              font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
.sms .copier{background:#eee;color:#333}
.sms .envoyer{background:#0d8a4a;color:#fff}
.sms .note{font-size:13px;color:#666;margin:14px 0 6px}
</style>
</head><body>
<div class="card">
<?php if ($ok): ?>
  <div class="banner banner-ok">✓ Marquée comme soumise</div>
<?php endif; ?>
  <h1><?= $nom_h ?></h1>
  <p class="label">URL à copier :</p>
  <div class="url-box">
    <input type="text" readonly value="<?= $url_h ?>" id="u" onclick="this.select()">
    <button onclick="copier()" id="bc">Copier</button>
  </div>
  <a href="<?= htmlspecialchars($maps_url) ?>" target="_blank" rel="noopener" class="btn btn-maps">
    Ouvrir sur Google Maps →
  </a>
<?php if (!$ok): ?>
  <a href="<?= htmlspecialchars($marquer_url) ?>" class="btn btn-done">
    ✓ J'ai soumis la suggestion
  </a>
<?php endif; ?>
  <div class="sms">
    <p class="label">SMS au dirigeant<?= $tel ? ' (' . htmlspecialchars($tel) . ')' : ' — pas de mobile connu : copiez le texte' ?> :</p>
    <textarea id="sms" readonly onclick="this.select()"><?= htmlspecialchars($sms_texte, ENT_QUOTES, 'UTF-8') ?></textarea>
    <div class="rangee">
      <button type="button" class="copier" onclick="copierTexte('sms', this)">Copier le SMS</button>
<?php if ($sms_lien): ?>
      <a href="<?= htmlspecialchars($sms_lien, ENT_QUOTES, 'UTF-8') ?>" class="envoyer">Envoyer le SMS →</a>
<?php endif; ?>
    </div>
    <p class="note"><b>Relance</b>, quelques jours plus tard si le lien n'apparaît pas sur la fiche :</p>
    <textarea id="relance" class="relance" readonly onclick="this.select()"><?= htmlspecialchars($sms_relance, ENT_QUOTES, 'UTF-8') ?></textarea>
    <div class="rangee">
      <button type="button" class="copier" onclick="copierTexte('relance', this)">Copier la relance</button>
<?php if ($tel): ?>
      <a href="<?= htmlspecialchars('sms:' . $tel . '?body=' . rawurlencode($sms_relance), ENT_QUOTES, 'UTF-8') ?>" class="envoyer">Envoyer la relance →</a>
<?php endif; ?>
    </div>
  </div>
  <div class="steps">
    <b>Étapes :</b><br>
    1. <b>Copie</b> l'URL (bouton ci-dessus)<br>
    2. <b>Ouvre</b> Google Maps (bouton bleu)<br>
    3. Clique <b>« Suggérer une modification »</b><br>
    4. Colle l'URL dans <b>« Site Web »</b><br>
    5. <b>Envoie</b>, puis reviens cliquer ✓
  </div>
</div>
<script>
function copierTexte(id, bouton){
  var t=document.getElementById(id);t.select();
  navigator.clipboard.writeText(t.value).then(function(){
    var avant=bouton.textContent;bouton.textContent='✓ Copié';
    setTimeout(function(){bouton.textContent=avant},2000);
  });
}
function copier(){
  var f=document.getElementById('u');f.select();
  navigator.clipboard.writeText(f.value).then(function(){
    var b=document.getElementById('bc');b.textContent='✓';b.classList.add('ok');
    setTimeout(function(){b.textContent='Copier';b.classList.remove('ok')},2000);
  });
}
</script>
</body></html>

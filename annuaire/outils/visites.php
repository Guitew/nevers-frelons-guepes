<?php
/**
 * visites.php — mesure d'audience propre, anonyme, sans cookie.
 *
 * Les pages d'entreprise envoient une balise (main.js) à chaque visite :
 * le chemin de la page et le site d'où vient le visiteur. On compte, par
 * page et par jour, le nombre de visites et celles venues de Google
 * (recherche ou Maps). Rien d'autre : ni adresse IP, ni identifiant, ni
 * cookie. Les robots connus sont ignorés. Les compteurs de plus de 120 jours
 * sont purgés.
 *
 * Ces chiffres remplacent la Search Console quand elle n'est pas
 * branchée : une page visitée depuis Google est gardée en ligne ; une page
 * que Google n'envoie jamais est retirée passé 45 jours.
 *
 * API (cycle quotidien) :
 *   ?action=liste&t=TOKEN   → JSON { depuis, pages: { "/cat/ville/slug/": { "AAAA-MM-JJ": { t, g } } } }
 *
 * Déployé avec le site (copié à la compilation) dans andpro.fr/vitrine-locale/visites.php
 */

define('TOKEN', 'VL-v7q2x9m4');
define('DATA_FILE', __DIR__ . '/.visites.json');
define('RETENTION_JOURS', 120);
define('PAGES_MAX', 5000);

header('Cache-Control: no-store');

$action = $_GET['action'] ?? '';
if ($action === 'liste') {
    if (($_GET['t'] ?? '') !== TOKEN) { http_response_code(403); die('Accès refusé.'); }
    header('Content-Type: application/json; charset=utf-8');
    echo file_exists(DATA_FILE) ? file_get_contents(DATA_FILE) : '{"depuis":null,"pages":{}}';
    exit;
}

// ----- Enregistrement d'une visite -----
$p = $_GET['p'] ?? $_POST['p'] ?? '';
$r = $_GET['r'] ?? $_POST['r'] ?? '';
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Seules les pages d'entreprise (/catégorie/commune/entreprise/) sont comptées.
if (!preg_match('#^/[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+/$#', $p)) { http_response_code(204); exit; }
// Les robots n'exécutent en général pas la balise ; on écarte ceux qui le font.
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|preview|lighthouse|headless|python|curl|wget|facebookexternalhit|pingdom|monitor/i', $ua)) {
    http_response_code(204); exit;
}
$google = (bool) preg_match('#^https?://([a-z0-9-]+\.)*google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})(?:/|$)#i', $r);
$jour = gmdate('Y-m-d');

$fp = fopen(DATA_FILE, 'c+');
if (!$fp) { http_response_code(204); exit; }
flock($fp, LOCK_EX);
$brut = stream_get_contents($fp);
$data = $brut ? (json_decode($brut, true) ?: []) : [];
if (empty($data['depuis'])) $data['depuis'] = $jour;
if (!isset($data['pages']) || !is_array($data['pages'])) $data['pages'] = [];

if (!isset($data['pages'][$p])) {
    if (count($data['pages']) >= PAGES_MAX) { flock($fp, LOCK_UN); fclose($fp); http_response_code(204); exit; }
    $data['pages'][$p] = [];
}
if (!isset($data['pages'][$p][$jour])) $data['pages'][$p][$jour] = ['t' => 0, 'g' => 0];
$data['pages'][$p][$jour]['t']++;
if ($google) $data['pages'][$p][$jour]['g']++;

// Purge des jours trop anciens.
$limite = gmdate('Y-m-d', time() - RETENTION_JOURS * 86400);
foreach ($data['pages'] as $chemin => $jours) {
    foreach ($jours as $d => $_) if ($d < $limite) unset($data['pages'][$chemin][$d]);
    if (!$data['pages'][$chemin]) unset($data['pages'][$chemin]);
}

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($data, JSON_UNESCAPED_SLASHES));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);
http_response_code(204);

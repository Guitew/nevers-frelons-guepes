<?php
// ---------------------------------------------------------------------------
// admin-nap.php — mini administration des coordonnées locales (NAP) ALLO FRELONS
//
// Page autonome, sans base de données : les valeurs sont enregistrées dans
// /donnees/nap.json sur le serveur, et les pages du site les appliquent
// automatiquement (script /assets/js/nap-locales.js). Aucune reconstruction
// du site ni passage par GitHub n'est nécessaire.
//
// - Première visite : création du mot de passe d'administration.
// - Mot de passe oublié : supprimer le fichier donnees/nap-admin.php par FTP,
//   puis revenir sur cette page pour en définir un nouveau.
// ---------------------------------------------------------------------------

declare(strict_types=1);
session_start();
header('X-Robots-Tag: noindex, nofollow');

const DATA_DIR  = __DIR__ . '/donnees';
const DATA_FILE = DATA_DIR . '/nap.json';
const CONF_FILE = DATA_DIR . '/nap-admin.php';

$depts  = ['59' => 'Nord (59)', '62' => 'Pas-de-Calais (62)'];
$champs = [
  'raison'     => 'Raison sociale (fiche Google)',
  'adresse'    => 'Adresse (n° et rue)',
  'codePostal' => 'Code postal',
  'ville'      => 'Ville',
  'telephone'  => 'Téléphone affiché',
  'horaires'   => 'Horaires (facultatif)',
  'zone'       => "Zone d'intervention",
];

// Valeurs par défaut (identiques à src/_data/napLocales.json, compilées dans le site).
$defauts = [
  '59' => [
    'raison' => 'ALLO FRELONS 59', 'adresse' => '1 rue Bonte Pollet',
    'codePostal' => '59000', 'ville' => 'Lille', 'telephone' => '06 75 36 24 05',
    'horaires' => '', 'zone' => 'Nord (59) et alentours',
  ],
  '62' => [
    'raison' => 'ALLO FRELONS', 'adresse' => '',
    'codePostal' => '', 'ville' => '', 'telephone' => '06 75 36 24 05',
    'horaires' => '', 'zone' => 'Pas-de-Calais (62) et alentours',
  ],
];

// ------------------------------ Utilitaires --------------------------------

function preparer_dossier(): void {
  if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
  }
}

function charger_config(): ?array {
  return is_file(CONF_FILE) ? (include CONF_FILE) : null;
}

function charger_nap(array $defauts): array {
  if (is_file(DATA_FILE)) {
    $json = json_decode((string) file_get_contents(DATA_FILE), true);
    if (is_array($json)) {
      foreach ($defauts as $code => $vals) {
        if (isset($json[$code]) && is_array($json[$code])) {
          $defauts[$code] = array_merge($vals, array_intersect_key($json[$code], $vals));
        }
      }
    }
  }
  return $defauts;
}

function ecrire_atomique(string $fichier, string $contenu): bool {
  $tmp = $fichier . '.tmp';
  if (file_put_contents($tmp, $contenu, LOCK_EX) === false) return false;
  return rename($tmp, $fichier);
}

function lien_telephone(string $tel): string {
  $chiffres = preg_replace('/\D+/', '', $tel) ?? '';
  if ($chiffres === '') return '';
  if (strncmp($chiffres, '33', 2) === 0) return '+' . $chiffres;
  if ($chiffres[0] === '0') return '+33' . substr($chiffres, 1);
  return '+' . $chiffres;
}

function e(string $s): string {
  return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

// ------------------------------ Traitements --------------------------------

$config   = charger_config();
$connecte = isset($_SESSION['nap_admin']) && $_SESSION['nap_admin'] === true;
$message  = '';
$erreur   = '';

if (empty($_SESSION['csrf'])) {
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['csrf'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!hash_equals($csrf, (string) ($_POST['csrf'] ?? ''))) {
    $erreur = 'Session expirée : merci de réessayer.';
  } else {
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'installer' && $config === null) {
      $mdp1 = (string) ($_POST['mdp'] ?? '');
      $mdp2 = (string) ($_POST['mdp2'] ?? '');
      if (strlen($mdp1) < 8) {
        $erreur = 'Le mot de passe doit contenir au moins 8 caractères.';
      } elseif ($mdp1 !== $mdp2) {
        $erreur = 'Les deux mots de passe ne correspondent pas.';
      } else {
        preparer_dossier();
        $hash = password_hash($mdp1, PASSWORD_DEFAULT);
        $php  = "<?php\n// Fichier généré par admin-nap.php — ne pas modifier à la main.\nreturn ['hash' => " . var_export($hash, true) . "];\n";
        if (ecrire_atomique(CONF_FILE, $php)) {
          $config = charger_config();
          $_SESSION['nap_admin'] = true;
          $connecte = true;
          $message  = 'Mot de passe enregistré, vous êtes connecté.';
        } else {
          $erreur = "Impossible d'écrire dans le dossier « donnees/ ». Vérifiez les droits d'écriture (755/775) sur l'hébergement.";
        }
      }
    } elseif ($action === 'connexion' && $config !== null) {
      if (password_verify((string) ($_POST['mdp'] ?? ''), (string) ($config['hash'] ?? ''))) {
        session_regenerate_id(true);
        $_SESSION['nap_admin'] = true;
        $connecte = true;
      } else {
        sleep(2); // freine les essais en rafale
        $erreur = 'Mot de passe incorrect.';
      }
    } elseif ($action === 'deconnexion') {
      unset($_SESSION['nap_admin']);
      $connecte = false;
      $message  = 'Vous êtes déconnecté.';
    } elseif ($action === 'enregistrer' && $connecte) {
      preparer_dossier();
      $nouveau = [];
      foreach ($depts as $code => $nomDept) {
        foreach ($champs as $champ => $libelle) {
          $val = trim((string) ($_POST[$code . '_' . $champ] ?? ''));
          $val = strip_tags($val);
          $nouveau[$code][$champ] = mb_substr($val, 0, 160);
        }
        $nouveau[$code]['codePostalVille'] = trim($nouveau[$code]['codePostal'] . ' ' . $nouveau[$code]['ville']);
        $nouveau[$code]['telephoneLien']   = lien_telephone($nouveau[$code]['telephone']);
      }
      if (is_file(DATA_FILE)) {
        copy(DATA_FILE, DATA_FILE . '.bak'); // sauvegarde de la version précédente
      }
      $json = json_encode($nouveau, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
      if ($json !== false && ecrire_atomique(DATA_FILE, $json)) {
        $message = 'Coordonnées enregistrées : elles sont visibles immédiatement sur le site.';
      } else {
        $erreur = "Impossible d'écrire donnees/nap.json. Vérifiez les droits d'écriture sur l'hébergement.";
      }
    }
  }
}

$nap = charger_nap($defauts);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Administration NAP — ALLO FRELONS</title>
  <style>
    :root { --vert: #1d5c43; --vert-fonce: #123a2b; --orange: #e4570f; --bordure: #dbe2dc; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.6 system-ui, sans-serif; background: #f4f7f4; color: #17211c; }
    .page { max-width: 880px; margin: 0 auto; padding: 2rem 1rem 4rem; }
    h1 { font-size: 1.5rem; color: var(--vert-fonce); }
    h2 { font-size: 1.15rem; color: var(--vert-fonce); border-bottom: 2px solid var(--vert); padding-bottom: .3rem; }
    .carte { background: #fff; border: 1px solid var(--bordure); border-radius: 10px; padding: 1.2rem 1.4rem; margin: 1rem 0; }
    label { display: block; font-weight: 600; font-size: .85rem; margin: .8rem 0 .2rem; }
    input[type=text], input[type=password] { width: 100%; padding: .55rem .7rem; border: 1px solid var(--bordure); border-radius: 6px; font-size: 1rem; }
    .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1.2rem; }
    @media (max-width: 640px) { .grille { grid-template-columns: 1fr; } }
    .btn { display: inline-block; margin-top: 1.2rem; padding: .7rem 1.6rem; border: 0; border-radius: 999px; background: var(--orange); color: #fff; font-weight: 700; font-size: 1rem; cursor: pointer; }
    .btn:hover { background: #c74a0b; }
    .btn--secondaire { background: transparent; color: var(--vert-fonce); text-decoration: underline; padding: .4rem 0; }
    .ok { background: #e7f0ea; border: 1px solid #9dbfa8; color: var(--vert-fonce); padding: .7rem 1rem; border-radius: 8px; }
    .ko { background: #fdeceb; border: 1px solid #e8a29c; color: #8c1d13; padding: .7rem 1rem; border-radius: 8px; }
    .note { font-size: .85rem; color: #4c5751; }
    .entete { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
  </style>
</head>
<body>
<div class="page">
  <div class="entete">
    <h1>Administration des coordonnées locales (NAP)</h1>
    <?php if ($connecte): ?>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <input type="hidden" name="action" value="deconnexion">
      <button class="btn btn--secondaire" type="submit">Se déconnecter</button>
    </form>
    <?php endif; ?>
  </div>

  <?php if ($message): ?><p class="ok"><?= e($message) ?></p><?php endif; ?>
  <?php if ($erreur): ?><p class="ko"><?= e($erreur) ?></p><?php endif; ?>

  <?php if ($config === null && !$connecte): ?>
  <div class="carte">
    <h2>Première utilisation : créez votre mot de passe</h2>
    <p class="note">Ce mot de passe protégera cette page. Conservez-le précieusement (en cas
      d'oubli : supprimez le fichier <code>donnees/nap-admin.php</code> par FTP puis revenez ici).</p>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <input type="hidden" name="action" value="installer">
      <label for="mdp">Mot de passe (8 caractères minimum)</label>
      <input type="password" id="mdp" name="mdp" required minlength="8" autocomplete="new-password">
      <label for="mdp2">Confirmez le mot de passe</label>
      <input type="password" id="mdp2" name="mdp2" required minlength="8" autocomplete="new-password">
      <button class="btn" type="submit">Créer le mot de passe</button>
    </form>
  </div>

  <?php elseif (!$connecte): ?>
  <div class="carte">
    <h2>Connexion</h2>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <input type="hidden" name="action" value="connexion">
      <label for="mdp">Mot de passe</label>
      <input type="password" id="mdp" name="mdp" required autocomplete="current-password">
      <button class="btn" type="submit">Se connecter</button>
    </form>
  </div>

  <?php else: ?>
  <p class="note">Renseignez les valeurs <strong>exactes</strong> de la fiche d'établissement
    Google de chaque département (cohérence NAP indispensable au SEO local). Un champ laissé vide
    n'est pas affiché sur le site. Les modifications sont <strong>visibles immédiatement</strong>,
    sans reconstruction du site.</p>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <input type="hidden" name="action" value="enregistrer">
    <?php foreach ($depts as $code => $nomDept): ?>
    <div class="carte">
      <h2><?= e($nomDept) ?></h2>
      <div class="grille">
        <?php foreach ($champs as $champ => $libelle): ?>
        <div>
          <label for="<?= e($code . '_' . $champ) ?>"><?= e($libelle) ?></label>
          <input type="text" id="<?= e($code . '_' . $champ) ?>" name="<?= e($code . '_' . $champ) ?>"
                 value="<?= e((string) ($nap[$code][$champ] ?? '')) ?>">
        </div>
        <?php endforeach; ?>
      </div>
    </div>
    <?php endforeach; ?>
    <button class="btn" type="submit">Enregistrer les coordonnées</button>
  </form>
  <?php endif; ?>
</div>
</body>
</html>

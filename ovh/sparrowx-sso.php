<?php
/**
 * SparrowX <-> Pterodactyl Auto-Login SSO Bridge
 * Deployed to /var/www/pterodactyl/public/sparrowx-sso.php by ovh/fix.sh & ovh/update.sh.
 *
 * Security model:
 * - Verifies HMAC-SHA256 signature computed with shared SPARROWX_SSO_SECRET
 * - Enforces tight expiry window (120s) + single-use Laravel Cache nonce guard
 * - Boots Laravel with web session middleware so encrypted pterodactyl_session cookie is issued
 */

declare(strict_types=1);

function spxReadEnvSecret(string $envPath): string
{
    $candidates = [
        getenv('SPARROWX_SSO_SECRET'),
        getenv('PTERO_SSO_SECRET'),
        $_ENV['SPARROWX_SSO_SECRET'] ?? null,
        $_SERVER['SPARROWX_SSO_SECRET'] ?? null,
    ];
    foreach ($candidates as $c) {
        if (is_string($c) && strlen(trim($c)) >= 16) {
            return trim($c);
        }
    }
    if (!is_readable($envPath)) {
        return '';
    }
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return '';
    }
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }
        if (str_starts_with($trimmed, 'SPARROWX_SSO_SECRET=') || str_starts_with($trimmed, 'PTERO_SSO_SECRET=')) {
            [, $val] = explode('=', $trimmed, 2);
            $val = trim($val, " \t\n\r\0\x0B\"'");
            if (strlen($val) >= 16) {
                return $val;
            }
        }
    }
    return '';
}

function spxBase64UrlEncode(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function spxBase64UrlDecode(string $b64): ?string
{
    $norm = strtr($b64, '-_', '+/');
    $pad = strlen($norm) % 4;
    if ($pad > 0) {
        $norm .= str_repeat('=', 4 - $pad);
    }
    $decoded = base64_decode($norm, true);
    return $decoded === false ? null : $decoded;
}

$secret = spxReadEnvSecret(__DIR__ . '/../.env');

if (isset($_GET['health'])) {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode([
        'ok' => true,
        'sso' => 'sparrowx',
        'configured' => strlen($secret) >= 16,
    ]);
    exit;
}

$rawToken = isset($_GET['token']) && is_string($_GET['token']) ? trim($_GET['token']) : '';
if (strlen($secret) < 16 || $rawToken === '' || !str_contains($rawToken, '.')) {
    http_response_code(302);
    header('Location: /auth/login?sso_error=unconfigured');
    exit;
}

[$encoded, $providedSig] = explode('.', $rawToken, 2);
if ($encoded === '' || $providedSig === '') {
    http_response_code(302);
    header('Location: /auth/login?sso_error=invalid_token');
    exit;
}

$expectedSig = spxBase64UrlEncode(hash_hmac('sha256', $encoded, $secret, true));
if (!hash_equals($expectedSig, $providedSig)) {
    http_response_code(302);
    header('Location: /auth/login?sso_error=invalid_signature');
    exit;
}

$jsonRaw = spxBase64UrlDecode($encoded);
$payload = is_string($jsonRaw) ? json_decode($jsonRaw, true) : null;
$now = time();

if (
    !is_array($payload) ||
    empty($payload['uid']) ||
    !is_numeric($payload['uid']) ||
    empty($payload['exp']) ||
    !is_numeric($payload['exp']) ||
    (int) $payload['exp'] < $now ||
    (!empty($payload['iat']) && (int) $payload['iat'] > $now + 30)
) {
    http_response_code(302);
    header('Location: /auth/login?sso_error=expired');
    exit;
}

define('LARAVEL_START', microtime(true));
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$ssoPayload = $payload;
$app->booting(function () use ($app, $ssoPayload) {
    $app['router']->middleware('web')->get('/sparrowx-sso.php', function (\Illuminate\Http\Request $request) use ($ssoPayload) {
        $nonce = preg_replace('/[^a-fA-F0-9]/', '', (string) ($ssoPayload['nonce'] ?? ''));
        if ($nonce === '' || !\Illuminate\Support\Facades\Cache::add('spx_sso_nonce_' . $nonce, 1, 180)) {
            return redirect('/auth/login?sso_error=replayed');
        }

        $user = \Pterodactyl\Models\User::find((int) $ssoPayload['uid']);
        if (!$user && !empty($ssoPayload['email']) && is_string($ssoPayload['email'])) {
            $user = \Pterodactyl\Models\User::where('email', $ssoPayload['email'])->first();
        }
        if (!$user) {
            return redirect('/auth/login?sso_error=user_missing');
        }

        \Illuminate\Support\Facades\Auth::login($user, true);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $next = (string) ($ssoPayload['next'] ?? '/');
        if (!str_starts_with($next, '/') || str_starts_with($next, '//') || str_contains($next, '\\')) {
            $next = '/';
        }

        return redirect()->to($next);
    });
});

$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle($request = \Illuminate\Http\Request::capture());
$response->send();
$kernel->terminate($request, $response);

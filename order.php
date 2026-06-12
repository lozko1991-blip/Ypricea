<?php
/**
 * order.php — Обробка замовлень UTRADE
 * Відправляє сповіщення:
 *   1) Email через formsubmit.co
 *   2) Telegram через бота zakazutrade_bot
 *
 * Параметри (POST):
 *   type        — 'landing' або 'catalog' (для формату повідомлення)
 *   product     — назва товару (для лендінгу)
 *   price       — ціна товару
 *   name        — ім'я покупця
 *   phone       — телефон
 *   city        — місто
 *   payment     — спосіб оплати
 *   items       — JSON-рядок товарів кошика (для каталогу)
 *   total       — загальна сума (для каталогу)
 *   shop_name   — назва магазину
 *   shop_email  — email для formsubmit
 */

// ── CORS: дозволяємо запити з будь-якого поддомену ──────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

// ── Telegram config ─────────────────────────────────────────────
define('TG_BOT_TOKEN', '8767253093:AAFn4NqhiboZR-SQgMkBU9Mc_3OVej9zyWQ');
define('TG_CHAT_ID',   '5251531339');

// ── Зчитуємо параметри ──────────────────────────────────────────
$type      = trim($_POST['type']      ?? 'landing');
$product   = trim($_POST['product']   ?? '');
$price     = trim($_POST['price']     ?? '');
$name      = trim($_POST['name']      ?? '');
$phone     = trim($_POST['phone']     ?? '');
$city      = trim($_POST['city']      ?? 'не вказано');
$payment   = trim($_POST['payment']   ?? '');
$itemsRaw  = trim($_POST['items']     ?? '');
$total     = trim($_POST['total']     ?? '');
$shopName  = trim($_POST['shop_name'] ?? 'TECHNO');
$shopEmail = trim($_POST['shop_email'] ?? '');
$comment   = trim($_POST['comment']   ?? '');

// ── Час замовлення ───────────────────────────────────────────────
$time = (new DateTime('now', new DateTimeZone('Europe/Kiev')))->format('d.m.Y H:i:s');

// ── Формуємо Telegram повідомлення ──────────────────────────────
if ($type === 'catalog') {
    // Кошик з кількома товарами
    $items = [];
    if ($itemsRaw) {
        $decoded = json_decode($itemsRaw, true);
        if (is_array($decoded)) $items = $decoded;
    }
    $itemLines = '';
    $lineNum = 1;
    foreach ($items as $it) {
        $itName  = $it['name']  ?? 'Товар';
        $itQty   = $it['qty']   ?? 1;
        $itPrice = $it['sell']  ?? ($it['price'] ?? 0);
        $itSum   = round($itPrice * $itQty);
        $itemLines .= "\n  {$lineNum}. {$itName}\n     x{$itQty} × " . number_format($itPrice, 0, '.', ' ') . " ₴ = " . number_format($itSum, 0, '.', ' ') . " ₴";
        $lineNum++;
    }
    $tgMsg = "🛒 *НОВЕ ЗАМОВЛЕННЯ* — {$shopName}\n"
           . "━━━━━━━━━━━━━━━━━━━━\n"
           . "👤 Ім'я: *{$name}*\n"
           . "📞 Телефон: *{$phone}*\n"
           . "🏙 Місто: {$city}\n"
           . "💳 Оплата: {$payment}\n"
           . "━━━━━━━━━━━━━━━━━━━━\n"
           . "📦 *Товари:{$itemLines}*\n"
           . "━━━━━━━━━━━━━━━━━━━━\n"
           . "💰 *Сума: {$total} ₴*\n"
           . ($comment ? "📝 Коментар: {$comment}\n" : "")
           . "🕐 Час: {$time}";
} else {
    // Лендінг — один товар
    $tgMsg = "📄 *НОВЕ ЗАМОВЛЕННЯ* — {$shopName}\n"
           . "━━━━━━━━━━━━━━━━━━━━\n"
           . "📦 *Товар: {$product}*\n"
           . "💰 Ціна: *{$price} ₴*\n"
           . "━━━━━━━━━━━━━━━━━━━━\n"
           . "👤 Ім'я: *{$name}*\n"
           . "📞 Телефон: *{$phone}*\n"
           . "🏙 Місто: {$city}\n"
           . "💳 Оплата: {$payment}\n"
           . "🕐 Час: {$time}";
}

// ── Відправляємо в Telegram ──────────────────────────────────────
$tgResult = sendTelegram($tgMsg);

// ── Відправляємо на email через formsubmit.co ────────────────────
$emailResult = false;
if ($shopEmail) {
    $emailResult = sendEmail($shopEmail, $type, $product, $price, $name, $phone, $city, $payment, $itemsRaw, $total, $shopName, $time, $comment);
}

// ── Відповідь ────────────────────────────────────────────────────
echo json_encode([
    'ok'            => true,
    'tg_sent'       => $tgResult,
    'email_sent'    => $emailResult,
]);
exit;

// ── Функції ──────────────────────────────────────────────────────

/**
 * Надсилає повідомлення в Telegram через Bot API
 */
function sendTelegram(string $text): bool {
    $url = 'https://api.telegram.org/bot' . TG_BOT_TOKEN . '/sendMessage';
    $payload = json_encode([
        'chat_id'    => TG_CHAT_ID,
        'text'       => $text,
        'parse_mode' => 'Markdown',
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err) {
        error_log('[UTRADE order.php] Telegram curl error: ' . $err);
        return false;
    }
    $decoded = json_decode($resp, true);
    return !empty($decoded['ok']);
}

/**
 * Надсилає email через formsubmit.co (проксі-запит з сервера)
 */
function sendEmail(
    string $email, string $type, string $product, string $price,
    string $name, string $phone, string $city, string $payment,
    string $itemsRaw, string $total, string $shopName, string $time, string $comment = ''
): bool {
    $subject = ($type === 'catalog')
        ? "Замовлення з кошика — {$shopName}"
        : "Замовлення — {$product}";

    $postData = [
        '_subject'  => $subject,
        '_template' => 'table',
        '_captcha'  => 'false',
        '_next'     => 'about:blank',
        'Магазин'   => $shopName,
        "Ім'я"      => $name,
        'Телефон'   => $phone,
        'Місто'     => $city,
        'Оплата'    => $payment,
        'Час'       => $time,
    ];
    if ($comment) $postData['Коментар'] = $comment;

    if ($type === 'catalog') {
        // Розбираємо items і формуємо текстовий список
        $items = json_decode($itemsRaw, true) ?: [];
        $lines = [];
        foreach ($items as $it) {
            $itName  = $it['name']  ?? 'Товар';
            $itQty   = $it['qty']   ?? 1;
            $itPrice = $it['sell']  ?? ($it['price'] ?? 0);
            $itSum   = round($itPrice * $itQty);
            $lines[] = "{$itName} ×{$itQty} = " . number_format($itSum, 0, '.', ' ') . ' ₴';
        }
        $postData['Товари'] = implode("\n", $lines) ?: 'не вказані';
        $postData['Сума']   = $total . ' ₴';
    } else {
        $postData['Товар'] = $product;
        $postData['Ціна']  = $price . ' ₴';
    }

    $ch = curl_init("https://formsubmit.co/{$email}");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($postData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err) {
        error_log('[UTRADE order.php] Email curl error: ' . $err);
        return false;
    }
    return $code >= 200 && $code < 400;
}

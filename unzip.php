<?php
/**
 * supervisisekolah.id - Fast Deployment Unzipper for InfinityFree
 */
header('Content-Type: text/html; charset=utf-8');

$zipFile = __DIR__ . '/supervisi_deploy.zip';
$selfFile = __FILE__;
$action = $_GET['action'] ?? '';
$message = '';
$status = 'info';

if ($action === 'unzip') {
    if (!file_exists($zipFile)) {
        $message = "File <strong>supervisi_deploy.zip</strong> tidak ditemukan di folder ini! Pastikan Anda sudah mengupload supervisi_deploy.zip ke dalam folder <code>htdocs</code>.";
        $status = 'error';
    } else {
        if (!class_exists('ZipArchive')) {
            $message = "Ekstensi PHP ZipArchive tidak aktif pada server ini.";
            $status = 'error';
        } else {
            $zip = new ZipArchive;
            $res = $zip->open($zipFile);
            if ($res === TRUE) {
                $zip->extractTo(__DIR__);
                $zip->close();
                $message = "✅ <strong>Berhasil Mengekstrak Semua Berkas!</strong><br>Seluruh sistem supervisisekolah.id telah berhasil dipasang di folder htdocs.<br><br>Langkah selanjutnya: Buat database di cPanel dan import <code>supervisisekolah_id.sql</code> via phpMyAdmin.";
                $status = 'success';
            } else {
                $message = "Gagal membuka zip. Kode error: " . $res;
                $status = 'error';
            }
        }
    }
} elseif ($action === 'clean') {
    $deleted = [];
    if (file_exists($zipFile) && @unlink($zipFile)) {
        $deleted[] = 'supervisi_deploy.zip';
    }
    $message = "Pembersihan selesai. File installer zip telah dihapus.<br>Jangan lupa hapus juga file <code>unzip.php</code> ini untuk keamanan.";
    $status = 'success';
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deployment Unzipper — SupervisiSekolah.id</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .box { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 32px; max-width: 520px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); margin-bottom: 16px; }
        h1 { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #fff; }
        p { font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
        code { font-family: 'JetBrains Mono', monospace; background: #0b1120; padding: 2px 6px; border-radius: 6px; color: #38bdf8; font-size: 12px; }
        .alert { text-align: left; padding: 16px; border-radius: 12px; font-size: 13px; margin-bottom: 24px; line-height: 1.5; }
        .alert-success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #6ee7b7; }
        .alert-error { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: #fda4af; }
        .alert-info { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #bae6fd; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; cursor: pointer; border: none; transition: all 0.2s ease; margin-bottom: 10px; }
        .btn-primary { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; box-shadow: 0 4px 14px rgba(16,185,129,0.3); }
        .btn-primary:hover { opacity: 0.95; transform: translateY(-1px); }
        .btn-secondary { background: #334155; color: #e2e8f0; }
        .btn-secondary:hover { background: #475569; }
        .btn-danger { background: rgba(244, 63, 94, 0.2); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.3); }
        .btn-danger:hover { background: rgba(244, 63, 94, 0.3); }
        .footer { font-size: 11px; color: #64748b; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="box">
        <div class="badge">InfinityFree Installer</div>
        <h1>Deployment SupervisiSekolah.id</h1>
        <p>Ekstraksi otomatis paket web langsung di folder hosting <code>htdocs</code> Anda.</p>

        <?php if ($message): ?>
            <div class="alert alert-<?php echo $status; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>

        <?php if ($status === 'success' && $action === 'unzip'): ?>
            <a href="./" class="btn btn-primary">🚀 Buka Website Sekarang</a>
            <a href="?action=clean" class="btn btn-danger">🗑️ Hapus supervisi_deploy.zip</a>
        <?php else: ?>
            <a href="?action=unzip" class="btn btn-primary">⚡ Ekstrak supervisi_deploy.zip Sekarang</a>
            <?php if (file_exists($zipFile)): ?>
                <p style="font-size: 11px; color: #34d399; margin-top: 10px; margin-bottom: 0;">✓ File <code>supervisi_deploy.zip</code> terdeteksi di server (Ukuran: <?php echo round(filesize($zipFile)/1024); ?> KB)</p>
            <?php else: ?>
                <p style="font-size: 11px; color: #fb7185; margin-top: 10px; margin-bottom: 0;">⚠️ <code>supervisi_deploy.zip</code> belum ditemukan di folder ini.</p>
            <?php endif; ?>
        <?php endif; ?>

        <div class="footer">SupervisiSekolah.id &bull; Production Deployment Helper</div>
    </div>
</body>
</html>

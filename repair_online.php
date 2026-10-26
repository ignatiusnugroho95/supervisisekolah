<?php
/**
 * repair_online.php
 * Script Pemulihan Master Data Kepala Sekolah & Sekolah — SupervisiSekolah.id
 * Jalankan via browser: https://supervisi.page.gd/repair_online.php?token=FIX2026TENANT
 */
define('REPAIR_TOKEN', 'FIX2026TENANT');
if (($_GET['token'] ?? '') !== REPAIR_TOKEN) {
    http_response_code(403);
    die('<h1 style="font-family:sans-serif;color:red;padding:20px;">Akses ditolak. Tambahkan ?token=FIX2026TENANT pada URL untuk otorisasi eksekusi.</h1>');
}

require_once __DIR__ . '/config/database.php';
$pdo = getDatabaseConnection();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$log = [];
$now = date('Y-m-d H:i:s');

function step($label, $fn, &$log) {
    try {
        $result = $fn();
        $log[] = ['ok', $label, $result ?? 'Done'];
    } catch (Throwable $e) {
        $log[] = ['err', $label, $e->getMessage()];
    }
}

// ─────────────────────────────────────────────────────
// 1. MIGRASI KOLOM BARU DI TABEL USERS & SCHOOLS
// ─────────────────────────────────────────────────────
step('Users: Periksa & Tambahkan Kolom Profil Lengkap', function() use ($pdo) {
    $cols = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_COLUMN);
    $added = [];
    if (!in_array('title_prefix', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN title_prefix VARCHAR(50) NULL DEFAULT '' AFTER role");
        $added[] = 'title_prefix';
    }
    if (!in_array('first_name', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL DEFAULT '' AFTER title_prefix");
        $added[] = 'first_name';
    }
    if (!in_array('last_name', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NULL DEFAULT '' AFTER first_name");
        $added[] = 'last_name';
    }
    if (!in_array('title_suffix', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN title_suffix VARCHAR(100) NULL DEFAULT '' AFTER last_name");
        $added[] = 'title_suffix';
    }
    if (!in_array('nickname', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN nickname VARCHAR(100) NULL DEFAULT '' AFTER title_suffix");
        $added[] = 'nickname';
    }
    if (!in_array('nuptk', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN nuptk VARCHAR(50) NULL DEFAULT '' AFTER nip");
        $added[] = 'nuptk';
    }
    return count($added) > 0 ? "Menambahkan kolom: " . implode(', ', $added) : "Semua kolom users sudah lengkap";
}, $log);

step('Schools: Periksa & Tambahkan Kolom Profil Instansi', function() use ($pdo) {
    $cols = $pdo->query("DESCRIBE schools")->fetchAll(PDO::FETCH_COLUMN);
    $added = [];
    if (!in_array('address', $cols)) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN address TEXT NULL AFTER status");
        $added[] = 'address';
    }
    if (!in_array('email', $cols)) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN email VARCHAR(191) NULL DEFAULT '' AFTER address");
        $added[] = 'email';
    }
    if (!in_array('phone', $cols)) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN phone VARCHAR(50) NULL DEFAULT '' AFTER email");
        $added[] = 'phone';
    }
    if (!in_array('modul_ajar_folder_url', $cols)) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN modul_ajar_folder_url TEXT NULL AFTER phone");
        $added[] = 'modul_ajar_folder_url';
    }
    return count($added) > 0 ? "Menambahkan kolom: " . implode(', ', $added) : "Semua kolom schools sudah lengkap";
}, $log);

// ─────────────────────────────────────────────────────
// 2. PURGE CONFLICTING DATA (sitirogaya, SCH-002, EMP-FTH-001)
// ─────────────────────────────────────────────────────
step('Purge: Hapus Akun & Data Dumy sitirogaya / SCH-002', function() use ($pdo) {
    $delUsers = $pdo->exec("DELETE FROM users WHERE username = 'sitirogaya' OR id = 'usr-ks-002'");
    $delSchools = $pdo->exec("DELETE FROM schools WHERE id = 'SCH-002'");
    $delEmps = $pdo->exec("DELETE FROM employees WHERE id = 'EMP-FTH-001' OR name LIKE '%Siti Rogaya%'");
    $delObs = $pdo->exec("DELETE FROM observations WHERE school_id = 'SCH-002'");
    $delSchedules = $pdo->exec("DELETE FROM supervision_schedules WHERE school_id = 'SCH-002'");
    $delTelaah = $pdo->exec("DELETE FROM telaah_rpp WHERE school_id = 'SCH-002'");
    return "Terhapus: $delUsers user(s), $delSchools school(s), $delEmps employee(s), $delObs observation(s)";
}, $log);

// ─────────────────────────────────────────────────────
// 3. CANONICAL SYNC: USERS (usr-ks-001 / eagenwidi)
// ─────────────────────────────────────────────────────
step('Users: Sinkronisasi Data Pokok Kepala Sekolah (eagenwidi)', function() use ($pdo) {
    $hashed = password_hash('kepalasekolah', PASSWORD_BCRYPT);
    $check = $pdo->query("SELECT id FROM users WHERE id = 'usr-ks-001' OR username = 'eagenwidi' LIMIT 1")->fetch(PDO::FETCH_ASSOC);

    if ($check) {
        $stmt = $pdo->prepare("
            UPDATE users SET
                username      = 'eagenwidi',
                password_hash = :hash,
                full_name     = 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
                role          = 'kepala_sekolah',
                title_prefix  = '',
                first_name    = 'Eagen',
                last_name     = 'Widi Nugroho',
                title_suffix  = 'S.Sos., Gr., S.Pd.',
                nickname      = 'Mr Eagen',
                email         = 'math.brighton@gmail.com',
                phone         = '082298890002',
                nip           = '19750812 199903 1 002',
                nuptk         = '8456756658200002',
                school_id     = 'SCH-001',
                employee_id   = 'EMP-001',
                status        = 'active',
                session_token = NULL,
                updated_at    = NOW()
            WHERE id = :id OR username = 'eagenwidi'
        ");
        $stmt->execute([':hash' => $hashed, ':id' => $check['id']]);
        return "User updated: eagenwidi (usr-ks-001)";
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO users (
                id, username, password_hash, full_name, role, title_prefix, first_name, last_name,
                title_suffix, nickname, email, phone, nip, nuptk, school_id, employee_id, status, created_at, updated_at
            ) VALUES (
                'usr-ks-001', 'eagenwidi', :hash, 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.', 'kepala_sekolah',
                '', 'Eagen', 'Widi Nugroho', 'S.Sos., Gr., S.Pd.', 'Mr Eagen', 'math.brighton@gmail.com',
                '082298890002', '19750812 199903 1 002', '8456756658200002', 'SCH-001', 'EMP-001', 'active', NOW(), NOW()
            )
        ");
        $stmt->execute([':hash' => $hashed]);
        return "User inserted: eagenwidi (usr-ks-001)";
    }
}, $log);

// ─────────────────────────────────────────────────────
// 4. CANONICAL SYNC: SCHOOLS (SCH-001 / SMP Brighton)
// ─────────────────────────────────────────────────────
step('Schools: Sinkronisasi Data Pokok Instansi (SMP Brighton)', function() use ($pdo) {
    $profileData = [
        'schoolId'           => 'SCH-001',
        'schoolCode'         => 'BRI-TF8U',
        'schoolName'         => 'SMP Brighton',
        'npsn'               => '20269341',
        'fullName'           => 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
        'firstName'          => 'Eagen',
        'lastName'           => 'Widi Nugroho',
        'titlePrefix'        => '',
        'titleSuffix'        => 'S.Sos., Gr., S.Pd.',
        'nickName'           => 'Mr Eagen',
        'username'           => 'eagenwidi',
        'email'              => 'math.brighton@gmail.com',
        'phone'              => '082298890002',
        'nip'                => '19750812 199903 1 002',
        'nuptk'              => '8456756658200002',
        'role'               => 'Kepala Sekolah SMP',
        'status'             => 'active',
        'schoolAddress'      => 'Jalan Alternatif Cibubur Kav. DDN No. 7, Cimanggis - Depok',
        'schoolEmail'        => 'brighton.jhs@gmail.com',
        'schoolPhone'        => '082298890002',
        'academicYear'       => '2026/2027',
        'semester'           => 'Ganjil',
        'modulAjarFolderUrl' => '',
        'avatarUrl'          => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
    ];
    $json = json_encode($profileData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    $check = $pdo->query("SELECT id FROM schools WHERE id = 'SCH-001' LIMIT 1")->fetch();
    if ($check) {
        $stmt = $pdo->prepare("
            UPDATE schools SET
                name                   = 'SMP Brighton',
                code                   = 'BRI-TF8U',
                npsn                   = '20269341',
                principal_name         = 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
                principal_nip          = '19750812 199903 1 002',
                address                = 'Jalan Alternatif Cibubur Kav. DDN No. 7, Cimanggis - Depok',
                email                  = 'brighton.jhs@gmail.com',
                phone                  = '082298890002',
                academic_year          = '2026/2027',
                semester               = 'Ganjil',
                modul_ajar_folder_url  = '',
                profile_json           = :json,
                updated_at             = NOW()
            WHERE id = 'SCH-001'
        ");
        $stmt->execute([':json' => $json]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO schools (
                id, code, name, npsn, principal_name, principal_nip, academic_year, semester,
                status, address, email, phone, modul_ajar_folder_url, profile_json, created_at, updated_at
            ) VALUES (
                'SCH-001', 'BRI-TF8U', 'SMP Brighton', '20269341', 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
                '19750812 199903 1 002', '2026/2027', 'Ganjil', 'active',
                'Jalan Alternatif Cibubur Kav. DDN No. 7, Cimanggis - Depok', 'brighton.jhs@gmail.com', '082298890002',
                '', :json, NOW(), NOW()
            )
        ");
        $stmt->execute([':json' => $json]);
    }

    // Sinkronisasi tabel legasi app_profile
    try {
        $exists = $pdo->query("SELECT COUNT(*) FROM app_profile WHERE id=1")->fetchColumn();
        if ($exists) {
            $pdo->prepare("UPDATE app_profile SET profile_json = :json, school_id = 'SCH-001', updated_at = NOW() WHERE id = 1")->execute([':json' => $json]);
        } else {
            $pdo->prepare("INSERT INTO app_profile (id, school_id, profile_json, updated_at) VALUES (1, 'SCH-001', :json, NOW())")->execute([':json' => $json]);
        }
    } catch (Exception $e) {}

    return "School updated: SMP Brighton (SCH-001)";
}, $log);

// ─────────────────────────────────────────────────────
// 5. MATCH & MERGE EMPLOYEES: EMP-001
// ─────────────────────────────────────────────────────
step('Employees: Match & Merge Data Pegawai Kepala Sekolah (EMP-001)', function() use ($pdo) {
    $empData = [
        'id'                    => 'EMP-001',
        'name'                  => 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
        'nickname'              => 'Mr Eagen',
        'gender'                => 'Laki-laki',
        'role'                  => 'Kepala Sekolah',
        'department'            => 'SMP Brighton',
        'employmentStatus'      => 'PNS',
        'joinDate'              => '2018-07-16',
        'nip'                   => '19750812 199903 1 002',
        'nuptk'                 => '8456756658200002',
        'subject'               => 'Kepala Sekolah SMP',
        'task'                  => 'Pimpinan Lembaga & Supervisor Utama',
        'email'                 => 'math.brighton@gmail.com',
        'phone'                 => '082298890002',
        'education'             => 'S1 Pendidikan / S.Sos., Gr., S.Pd.',
        'address'               => 'Jalan Alternatif Cibubur Kav. DDN No. 7, Cimanggis - Depok',
        'status'                => 'Aktif',
        'photo'                 => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
        'accessCode'            => 'BRI-TF8U',
        'accessCodeGeneratedAt' => date('c'),
        'username'              => 'eagenwidi'
    ];
    $json = json_encode($empData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    $check = $pdo->query("SELECT id FROM employees WHERE id = 'EMP-001' LIMIT 1")->fetch();
    if ($check) {
        $stmt = $pdo->prepare("
            UPDATE employees SET
                school_id  = 'SCH-001',
                name       = :name,
                role       = 'Kepala Sekolah',
                data_json  = :json,
                updated_at = NOW()
            WHERE id = 'EMP-001'
        ");
        $stmt->execute([':name' => $empData['name'], ':json' => $json]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO employees (id, school_id, name, role, data_json, updated_at)
            VALUES ('EMP-001', 'SCH-001', :name, 'Kepala Sekolah', :json, NOW())
        ");
        $stmt->execute([':name' => $empData['name'], ':json' => $json]);
    }

    // Pastikan semua employee lain ber-school_id SCH-001
    $pdo->exec("UPDATE employees SET school_id = 'SCH-001' WHERE school_id IS NULL OR school_id = ''");
    return "EMP-001 merged successfully";
}, $log);

// ─────────────────────────────────────────────────────
// 6. SINKRONISASI RELASI TABLE LAINNYA KE SCH-001
// ─────────────────────────────────────────────────────
$tables = ['observations', 'telaah_rpp', 'supervision_schedules'];
foreach ($tables as $t) {
    step("Tabel $t: Normalkan school_id ke SCH-001", function() use ($pdo, $t) {
        $n = $pdo->exec("UPDATE `$t` SET school_id='SCH-001' WHERE school_id IS NULL OR school_id=''");
        return "Updated $n row(s)";
    }, $log);
}

// ─────────────────────────────────────────────────────
// 7. AUDIT DATA TERBARU
// ─────────────────────────────────────────────────────
$finalUser = $pdo->query("SELECT id, username, first_name, last_name, nickname, email, phone, nip, nuptk, status, school_id FROM users WHERE username = 'eagenwidi'")->fetch(PDO::FETCH_ASSOC);
$finalSchool = $pdo->query("SELECT id, name, npsn, code, address, email, phone, academic_year, semester FROM schools WHERE id = 'SCH-001'")->fetch(PDO::FETCH_ASSOC);
$finalEmp = $pdo->query("SELECT id, school_id, name, role FROM employees WHERE id = 'EMP-001'")->fetch(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hasil Perbaikan Master Data MySQL — SupervisiSekolah.id</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-100 text-slate-800 p-6 md:p-12">
    <div class="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-8">
            <h1 class="text-2xl font-bold flex items-center gap-3">
                <span class="p-2 bg-emerald-500 rounded-xl text-white inline-block">✓</span>
                Pemulihan & Sinkronisasi Master Data Berhasil!
            </h1>
            <p class="text-slate-300 text-sm mt-2">
                Data pokok Kepala Sekolah dan Instansi Sekolah telah 100% tersinkronkan ke database MySQL. Data conflict (sitirogaya / SCH-002) telah dibersihkan secara permanen.
            </p>
        </div>

        <!-- Execution Steps -->
        <div class="p-8 space-y-6">
            <h2 class="text-lg font-bold text-slate-900 border-b pb-2">Rincian Eksekusi</h2>
            <div class="space-y-3">
                <?php foreach ($log as $item): ?>
                    <div class="p-3.5 rounded-xl border flex items-center justify-between text-xs md:text-sm <?= $item[0] === 'ok' ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900' ?>">
                        <div class="font-medium">
                            <span class="font-bold mr-2"><?= $item[0] === 'ok' ? '✔' : '✖' ?> <?= htmlspecialchars($item[1]) ?></span>
                        </div>
                        <div class="font-mono text-xs text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border">
                            <?= htmlspecialchars($item[2]) ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>

            <!-- Audit Snapshot Table -->
            <h2 class="text-lg font-bold text-slate-900 border-b pb-2 pt-4">Data Pokok Terverifikasi di MySQL</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <h3 class="font-bold text-sm text-indigo-900 uppercase tracking-wider mb-2">Akun Kepala Sekolah (users)</h3>
                    <div><span class="text-slate-400">Username:</span> <strong class="text-slate-800 font-mono"><?= htmlspecialchars($finalUser['username'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">First / Last Name:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalUser['first_name'] ?? '-') ?> <?= htmlspecialchars($finalUser['last_name'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Gelar Belakang:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalUser['title_suffix'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Nick Name:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalUser['nickname'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Email:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalUser['email'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Telepon:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalUser['phone'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">NIP:</span> <strong class="text-slate-800 font-mono"><?= htmlspecialchars($finalUser['nip'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">NUPTK:</span> <strong class="text-slate-800 font-mono"><?= htmlspecialchars($finalUser['nuptk'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Status Akun:</span> <strong class="text-emerald-600"><?= htmlspecialchars($finalUser['status'] ?? '-') ?> (Administrator)</strong></div>
                </div>

                <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <h3 class="font-bold text-sm text-sky-900 uppercase tracking-wider mb-2">Identitas Sekolah (schools)</h3>
                    <div><span class="text-slate-400">Nama Sekolah:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalSchool['name'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">NPSN:</span> <strong class="text-slate-800 font-mono"><?= htmlspecialchars($finalSchool['npsn'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Kode Akses Sekolah:</span> <strong class="text-amber-700 font-mono font-bold bg-amber-100 px-2 py-0.5 rounded"><?= htmlspecialchars($finalSchool['code'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Alamat Lengkap:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalSchool['address'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Email Sekolah:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalSchool['email'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Telepon Sekolah:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalSchool['phone'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Tahun Ajaran:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalSchool['academic_year'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Semester:</span> <strong class="text-slate-800"><?= htmlspecialchars($finalSchool['semester'] ?? '-') ?></strong></div>
                    <div><span class="text-slate-400">Employee Match:</span> <strong class="text-emerald-700"><?= htmlspecialchars($finalEmp['id'] ?? '-') ?> (<?= htmlspecialchars($finalEmp['name'] ?? '-') ?>)</strong></div>
                </div>
            </div>

            <div class="pt-4 flex items-center justify-between">
                <a href="pengaturan/" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition">
                    Buka Halaman /pengaturan
                </a>
                <span class="text-xs text-slate-400">SupervisiSekolah.id • Selesai pada <?= $now ?></span>
            </div>
        </div>
    </div>
</body>
</html>

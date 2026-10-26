<?php
/**
 * supervisisekolah.id - Database Connection & Configuration Manager
 * Engine: MySQL / MariaDB (Supports both Local XAMPP and InfinityFree Online)
 */

// 1. Allow optional external override via config/db_config.php
if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

// 2. Auto-detect InfinityFree / Online Domain vs Local XAMPP
$serverHost = $_SERVER['HTTP_HOST'] ?? '';
$isOnlineHost = (strpos($serverHost, 'page.gd') !== false 
              || strpos($serverHost, 'infinityfree') !== false 
              || strpos($serverHost, 'epizy') !== false);

if ($isOnlineHost) {
    // Production settings for InfinityFree (supervisi.page.gd)
    if (!defined('DB_HOST')) define('DB_HOST', 'sql107.infinityfree.com');
    if (!defined('DB_PORT')) define('DB_PORT', 3306);
    if (!defined('DB_USER')) define('DB_USER', 'if0_43094083');
    if (!defined('DB_PASS')) define('DB_PASS', 'tZe14OMtb4');
    if (!defined('DB_NAME')) define('DB_NAME', 'if0_43094083_supervisi');
} else {
    // Local development settings (XAMPP default)
    if (!defined('DB_HOST')) define('DB_HOST', '127.0.0.1');
    if (!defined('DB_PORT')) define('DB_PORT', 3306);
    if (!defined('DB_USER')) define('DB_USER', 'root');
    if (!defined('DB_PASS')) define('DB_PASS', '');
    if (!defined('DB_NAME')) define('DB_NAME', 'supervisisekolah_id');
}

function getDatabaseConnection() {
    static $pdoInstance = null;
    if ($pdoInstance !== null) {
        return $pdoInstance;
    }

    try {
        // 1. Connect directly to MySQL with dbname in DSN
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => true
        ]);

        // 2. Ensure all structured tables & default users exist if not yet initialized
        initializeDatabaseTables($pdo, 'mysql');
        seedDefaultRolesAndUsers($pdo);

        $pdoInstance = $pdo;
        return $pdoInstance;
    } catch (Exception $e) {
        // Auto-create database on local MySQL if it doesn't exist yet
        if (DB_HOST === '127.0.0.1' || DB_HOST === 'localhost') {
            try {
                $rawDsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";charset=utf8mb4";
                $rawPdo = new PDO($rawDsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                $rawPdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                $rawPdo->exec("USE `" . DB_NAME . "`;");
                initializeDatabaseTables($rawPdo, 'mysql');
                seedDefaultRolesAndUsers($rawPdo);
                $pdoInstance = $rawPdo;
                return $pdoInstance;
            } catch (Exception $e2) {
                error_log("[Database Error] Failed to auto-create MySQL database: " . $e2->getMessage());
            }
        }

        // MySQL is the strict single source of truth - no fallback to SQLite
        error_log("[supervisisekolah.id Database Error] MySQL connection failed: " . $e->getMessage());
        throw new Exception("Koneksi Database MySQL gagal (" . DB_NAME . "): " . $e->getMessage());
    }
}

function initializeDatabaseTables($pdo, $driver = 'mysql') {
    $isMysql = ($driver === 'mysql');
    $tableOpt = $isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci" : "";

    $tables = [
        // 1. Multitenant Schools Directory
        "CREATE TABLE IF NOT EXISTS schools (
            id VARCHAR(50) PRIMARY KEY,
            code VARCHAR(50) UNIQUE,
            name VARCHAR(255) NOT NULL,
            npsn VARCHAR(50),
            principal_name VARCHAR(255),
            principal_nip VARCHAR(100),
            address VARCHAR(500) DEFAULT '',
            email VARCHAR(255) DEFAULT '',
            phone VARCHAR(50) DEFAULT '',
            modul_ajar_folder_url VARCHAR(1000) DEFAULT '',
            academic_year VARCHAR(50) DEFAULT '2026/2027',
            semester VARCHAR(50) DEFAULT 'Ganjil',
            profile_json LONGTEXT,
            status VARCHAR(20) DEFAULT 'active',
            created_at VARCHAR(50) NOT NULL,
            updated_at VARCHAR(50) NOT NULL
        )$tableOpt;",

        // 2. RBAC Users Table (Super Admin, Kepala Sekolah, Guru, Pengawas, Staff)
        "CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255),
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            title_prefix VARCHAR(50) DEFAULT '',
            first_name VARCHAR(100) DEFAULT '',
            last_name VARCHAR(100) DEFAULT '',
            title_suffix VARCHAR(100) DEFAULT '',
            nickname VARCHAR(100) DEFAULT '',
            gender VARCHAR(20) DEFAULT 'Laki-laki',
            role VARCHAR(50) NOT NULL,
            department VARCHAR(100) DEFAULT 'Tenaga Pendidik',
            employment_status VARCHAR(50) DEFAULT 'GTY',
            join_date VARCHAR(50) DEFAULT '',
            subject VARCHAR(255) DEFAULT '',
            task VARCHAR(255) DEFAULT '',
            education VARCHAR(255) DEFAULT '',
            address VARCHAR(500) DEFAULT '',
            access_code VARCHAR(50) DEFAULT '',
            data_json LONGTEXT,
            school_id VARCHAR(50),
            employee_id VARCHAR(191),
            nip VARCHAR(100),
            nuptk VARCHAR(50) DEFAULT '',
            phone VARCHAR(50),
            avatar_url VARCHAR(500),
            status VARCHAR(20) DEFAULT 'active',
            must_change_password TINYINT DEFAULT 0,
            last_login VARCHAR(50),
            session_token VARCHAR(255),
            created_at VARCHAR(50) NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_users_school_id (school_id),
            KEY idx_users_role (role),
            KEY idx_users_employee_id (employee_id)
        )$tableOpt;",

        // 3. Pivot Table: Pengawas Sekolah Binaan (Many-to-Many)
        "CREATE TABLE IF NOT EXISTS pengawas_schools (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pengawas_user_id VARCHAR(50) NOT NULL,
            school_id VARCHAR(50) NOT NULL,
            created_at VARCHAR(50) NOT NULL,
            UNIQUE KEY uq_pengawas_school (pengawas_user_id, school_id),
            KEY idx_ps_pengawas (pengawas_user_id),
            KEY idx_ps_school (school_id)
        )$tableOpt;",

        // 4. App Profile & Settings
        "CREATE TABLE IF NOT EXISTS app_profile (
            id INT PRIMARY KEY,
            profile_json LONGTEXT NOT NULL,
            updated_at VARCHAR(50) NOT NULL
        )$tableOpt;",

        "CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(191) PRIMARY KEY,
            setting_value LONGTEXT NOT NULL,
            updated_at VARCHAR(50) NOT NULL
        )$tableOpt;",

        // 6. Academic Observations
        "CREATE TABLE IF NOT EXISTS observations (
            id VARCHAR(191) PRIMARY KEY,
            school_id VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
            teacher_name VARCHAR(255),
            subject VARCHAR(255),
            academic_year VARCHAR(50),
            semester VARCHAR(50),
            data_json LONGTEXT NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_observations_school_id (school_id)
        )$tableOpt;",

        // 7. RPP / Modul Ajar Review
        "CREATE TABLE IF NOT EXISTS telaah_rpp (
            id VARCHAR(191) PRIMARY KEY,
            school_id VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
            teacher_name VARCHAR(255),
            subject VARCHAR(255),
            academic_year VARCHAR(50),
            semester VARCHAR(50),
            data_json LONGTEXT NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_telaah_rpp_school_id (school_id)
        )$tableOpt;",

        // 8. Yearly Performance Evaluation
        "CREATE TABLE IF NOT EXISTS evaluasi (
            id VARCHAR(191) PRIMARY KEY,
            school_id VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
            data_json LONGTEXT NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_evaluasi_school_id (school_id)
        )$tableOpt;",

        // 9. Supervision Schedules
        "CREATE TABLE IF NOT EXISTS supervision_schedules (
            id VARCHAR(191) PRIMARY KEY,
            school_id VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
            teacher_id VARCHAR(191),
            teacher_name VARCHAR(255) NOT NULL,
            subject VARCHAR(255),
            grade_class VARCHAR(100),
            rpp_date VARCHAR(50) NOT NULL,
            obs_date VARCHAR(50) NOT NULL,
            time_slot VARCHAR(150),
            status VARCHAR(50) NOT NULL DEFAULT 'Pending',
            submitted_by VARCHAR(50) NOT NULL DEFAULT 'Guru',
            notes TEXT,
            rejection_reason TEXT,
            academic_year VARCHAR(50),
            semester VARCHAR(50),
            data_json LONGTEXT NOT NULL,
            created_at VARCHAR(50) NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_schedules_school_id (school_id)
        )$tableOpt;",

        // 10. Centralized Supervision Categories & Indicators
        "CREATE TABLE IF NOT EXISTS supervision_categories (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) NOT NULL,
            description TEXT,
            color VARCHAR(50) DEFAULT 'blue',
            icon VARCHAR(50) DEFAULT 'bookmark',
            is_custom TINYINT DEFAULT 0,
            sort_order INT DEFAULT 0,
            created_at VARCHAR(50) NOT NULL,
            updated_at VARCHAR(50) NOT NULL
        )$tableOpt;",

        "CREATE TABLE IF NOT EXISTS supervision_indicators (
            id VARCHAR(50) PRIMARY KEY,
            category_id VARCHAR(50) NOT NULL,
            category_name VARCHAR(255) NOT NULL,
            stage VARCHAR(50) NOT NULL,
            number_order INT NOT NULL,
            title TEXT NOT NULL,
            focus VARCHAR(255) DEFAULT '',
            scale_min INT DEFAULT 1,
            scale_max INT DEFAULT 4,
            is_custom TINYINT DEFAULT 0,
            created_at VARCHAR(50) NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_ind_category (category_id),
            KEY idx_ind_stage (stage)
        )$tableOpt;",

        // 11. BK Supervision (Supervisi Guru BK)
        "CREATE TABLE IF NOT EXISTS supervisi_bk (
            id VARCHAR(191) PRIMARY KEY,
            school_id VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
            teacher_name VARCHAR(255),
            academic_year VARCHAR(50),
            semester VARCHAR(50),
            data_json LONGTEXT NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_supervisi_bk_school_id (school_id)
        )$tableOpt;",

        // 12. Tendik Supervision (Supervisi Tenaga Kependidikan)
        "CREATE TABLE IF NOT EXISTS supervisi_tendik (
            id VARCHAR(191) PRIMARY KEY,
            school_id VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
            employee_name VARCHAR(255),
            role VARCHAR(100),
            instrument_type VARCHAR(100),
            academic_year VARCHAR(50),
            semester VARCHAR(50),
            data_json LONGTEXT NOT NULL,
            updated_at VARCHAR(50) NOT NULL,
            KEY idx_supervisi_tendik_school_id (school_id),
            KEY idx_supervisi_tendik_emp (employee_name)
        )$tableOpt;"
    ];

    foreach ($tables as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Exception $ex) {
            error_log("[Table Init Warning] " . $ex->getMessage());
        }
    }

    // Add school_id column gracefully if existing tables don't have it and enforce NOT NULL
    $alterTables = ['observations', 'telaah_rpp', 'evaluasi', 'supervision_schedules', 'supervisi_bk', 'supervisi_tendik'];
    foreach ($alterTables as $t) {
        try {
            $check = $pdo->query("SHOW COLUMNS FROM `$t` LIKE 'school_id'")->fetch();
            if (!$check) {
                $pdo->exec("ALTER TABLE `$t` ADD COLUMN school_id VARCHAR(50) NOT NULL DEFAULT 'SCH-001' AFTER id");
                $pdo->exec("ALTER TABLE `$t` ADD INDEX `idx_{$t}_school_id` (school_id)");
            } else {
                $pdo->exec("UPDATE `$t` SET school_id = 'SCH-001' WHERE school_id IS NULL OR school_id = ''");
                $pdo->exec("ALTER TABLE `$t` MODIFY school_id VARCHAR(50) NOT NULL");
            }
        } catch (Exception $e) {}
    }

    // Add missing users columns gracefully
    $userCols = [
        'title_prefix' => "VARCHAR(50) DEFAULT ''",
        'first_name'   => "VARCHAR(100) DEFAULT ''",
        'last_name'    => "VARCHAR(100) DEFAULT ''",
        'title_suffix' => "VARCHAR(100) DEFAULT ''",
        'nickname'     => "VARCHAR(100) DEFAULT ''",
        'nuptk'        => "VARCHAR(50) DEFAULT ''"
    ];
    foreach ($userCols as $col => $colDef) {
        try {
            $check = $pdo->query("SHOW COLUMNS FROM `users` LIKE '$col'")->fetch();
            if (!$check) {
                $pdo->exec("ALTER TABLE `users` ADD COLUMN `$col` $colDef");
            }
        } catch (Exception $e) {}
    }

    // Add indexes on users if not present
    try {
        $idxCheck = $pdo->query("SHOW INDEX FROM `users` WHERE Key_name = 'idx_users_school_id'")->fetch();
        if (!$idxCheck) {
            $pdo->exec("ALTER TABLE `users` ADD INDEX idx_users_school_id (school_id)");
        }
    } catch (Exception $e) {}

    try {
        $idxCheck = $pdo->query("SHOW INDEX FROM `users` WHERE Key_name = 'idx_users_role'")->fetch();
        if (!$idxCheck) {
            $pdo->exec("ALTER TABLE `users` ADD INDEX idx_users_role (role)");
        }
    } catch (Exception $e) {}

    // Add missing schools columns gracefully
    $schoolCols = [
        'address'               => "VARCHAR(500) DEFAULT ''",
        'email'                 => "VARCHAR(255) DEFAULT ''",
        'phone'                 => "VARCHAR(50) DEFAULT ''",
        'modul_ajar_folder_url' => "VARCHAR(1000) DEFAULT ''"
    ];
    foreach ($schoolCols as $col => $colDef) {
        try {
            $check = $pdo->query("SHOW COLUMNS FROM `schools` LIKE '$col'")->fetch();
            if (!$check) {
                $pdo->exec("ALTER TABLE `schools` ADD COLUMN `$col` $colDef");
            }
        } catch (Exception $e) {}
    }
}

/**
 * Seed & Synchronize System Roles:
 * - Super Admin (Global CRUD schools, centralized templates)
 * - Kepala Sekolah (1 School = 1 Kepala Sekolah)
 * - Pengawas Pembina (Many-to-Many via pengawas_schools)
 * - Guru & Staff
 */
function seedDefaultRolesAndUsers($pdo) {
    try {
        $now = date('c');

        // 1. Seed / Sync School 1 (SCH-001) - SMP Brighton
        $sch1Id = 'SCH-001';
        $sch1Code = 'BRI-TF8U';
        $sch1Name = 'SMP Brighton';
        $sch1Npsn = '20269341';
        $sch1Address = 'Jalan Alternatif Cibubur Kav. DDN No. 7, Cimanggis - Depok';
        $sch1Email = 'brighton.jhs@gmail.com';
        $sch1Phone = '082298890002';
        $sch1Principal = 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.';
        $sch1Nip = '19750812 199903 1 002';

        $profile1Data = [
            'schoolId'           => $sch1Id,
            'schoolCode'         => $sch1Code,
            'schoolName'         => $sch1Name,
            'npsn'               => $sch1Npsn,
            'titlePrefix'        => '',
            'firstName'          => 'Eagen',
            'lastName'           => 'Widi Nugroho',
            'titleSuffix'        => 'S.Sos., Gr., S.Pd.',
            'fullName'           => $sch1Principal,
            'nickName'           => 'Mr Eagen',
            'username'           => 'eagenwidi',
            'email'              => 'math.brighton@gmail.com',
            'phone'              => '082298890002',
            'nip'                => $sch1Nip,
            'nuptk'              => '8456756658200002',
            'role'               => 'Kepala Sekolah SMP',
            'status'             => 'active',
            'schoolAddress'      => $sch1Address,
            'schoolEmail'        => $sch1Email,
            'schoolPhone'        => $sch1Phone,
            'academicYear'       => '2026/2027',
            'semester'           => 'Ganjil',
            'modulAjarFolderUrl' => '',
            'avatarUrl'          => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
        ];
        $profile1Json = json_encode($profile1Data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $pdo->prepare("INSERT INTO schools (id, code, name, npsn, principal_name, principal_nip, address, email, phone, academic_year, semester, profile_json, status, created_at, updated_at) 
                       VALUES (:id, :code, :name, :npsn, :pname, :pnip, :addr, :em, :ph, '2026/2027', 'Ganjil', :json, 'active', :cat, :uat)
                       ON DUPLICATE KEY UPDATE code=VALUES(code), name=VALUES(name), npsn=VALUES(npsn), principal_name=VALUES(principal_name), principal_nip=VALUES(principal_nip), address=VALUES(address), email=VALUES(email), phone=VALUES(phone), updated_at=VALUES(updated_at)")
            ->execute([
                ':id'    => $sch1Id,
                ':code'  => $sch1Code,
                ':name'  => $sch1Name,
                ':npsn'  => $sch1Npsn,
                ':pname' => $sch1Principal,
                ':pnip'  => $sch1Nip,
                ':addr'  => $sch1Address,
                ':em'    => $sch1Email,
                ':ph'    => $sch1Phone,
                ':json'  => $profile1Json,
                ':cat'   => $now,
                ':uat'   => $now
            ]);

        // Sync legacy app_profile (id = 1)
        try {
            $pdo->prepare("INSERT INTO app_profile (id, profile_json, updated_at) VALUES (1, :json, :now) ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), updated_at = VALUES(updated_at)")
                ->execute([':json' => $profile1Json, ':now' => $now]);
        } catch (Exception $eProf) {}

        // 2. Seed / Sync School 2 (SCH-002) - SMP Fatahillah
        $sch2Id = 'SCH-002';
        $sch2Code = 'FAT-8M2X';
        $sch2Name = 'SMP Fatahillah';
        $sch2Npsn = '20104567';
        $sch2Address = 'Jl. Raya Fatahillah No. 12, Jakarta';
        $sch2Email = 'info@smpfatahillah.sch.id';
        $sch2Phone = '081388776655';
        $sch2Principal = 'Siti Rogaya, M.Pd.';
        $sch2Nip = '19800514 200501 2 008';

        $profile2Data = [
            'schoolId'           => $sch2Id,
            'schoolCode'         => $sch2Code,
            'schoolName'         => $sch2Name,
            'npsn'               => $sch2Npsn,
            'titlePrefix'        => '',
            'firstName'          => 'Siti',
            'lastName'           => 'Rogaya',
            'titleSuffix'        => 'M.Pd.',
            'fullName'           => $sch2Principal,
            'nickName'           => 'Ibu Siti',
            'username'           => 'sitirogaya',
            'email'              => 'kepala.sekolah@smpfatahillah.sch.id',
            'phone'              => '081388776655',
            'nip'                => $sch2Nip,
            'nuptk'              => '7392810482019382',
            'role'               => 'Kepala Sekolah SMP',
            'status'             => 'active',
            'schoolAddress'      => $sch2Address,
            'schoolEmail'        => $sch2Email,
            'schoolPhone'        => $sch2Phone,
            'academicYear'       => '2026/2027',
            'semester'           => 'Ganjil',
            'modulAjarFolderUrl' => '',
            'avatarUrl'          => 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250'
        ];
        $profile2Json = json_encode($profile2Data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $pdo->prepare("INSERT INTO schools (id, code, name, npsn, principal_name, principal_nip, address, email, phone, academic_year, semester, profile_json, status, created_at, updated_at) 
                       VALUES (:id, :code, :name, :npsn, :pname, :pnip, :addr, :em, :ph, '2026/2027', 'Ganjil', :json, 'active', :cat, :uat)
                       ON DUPLICATE KEY UPDATE code=VALUES(code), name=VALUES(name), npsn=VALUES(npsn), principal_name=VALUES(principal_name), principal_nip=VALUES(principal_nip), address=VALUES(address), email=VALUES(email), phone=VALUES(phone), updated_at=VALUES(updated_at)")
            ->execute([
                ':id'    => $sch2Id,
                ':code'  => $sch2Code,
                ':name'  => $sch2Name,
                ':npsn'  => $sch2Npsn,
                ':pname' => $sch2Principal,
                ':pnip'  => $sch2Nip,
                ':addr'  => $sch2Address,
                ':em'    => $sch2Email,
                ':ph'    => $sch2Phone,
                ':json'  => $profile2Json,
                ':cat'   => $now,
                ':uat'   => $now
            ]);

        // 3. Ensure Super Admin exists
        $chkAdmin = $pdo->query("SELECT id FROM users WHERE role = 'super_admin' OR username = 'superadmin'")->fetch();
        if (!$chkAdmin) {
            $insUsr = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status, created_at, updated_at) 
                                      VALUES (:id, :username, :email, :pass, :name, 'super_admin', NULL, 'active', :cat, :uat)");
            $insUsr->execute([
                ':id' => 'usr-superadmin',
                ':username' => 'superadmin',
                ':email' => 'superadmin@supervisisekolah.id',
                ':pass' => password_hash('superadmin123', PASSWORD_BCRYPT),
                ':name' => 'Super Administrator (Yayasan / Dinas)',
                ':cat' => $now,
                ':uat' => $now
            ]);
        }

        // 4. Ensure Kepala Sekolah 1 (eagenwidi -> SCH-001) exists
        $chkKS1 = $pdo->prepare("SELECT id FROM users WHERE username = 'eagenwidi' OR (role = 'kepala_sekolah' AND school_id = 'SCH-001')");
        $chkKS1->execute();
        $existingKS1 = $chkKS1->fetch();

        if (!$existingKS1) {
            $insKS1 = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, title_prefix, first_name, last_name, title_suffix, nickname, role, school_id, employee_id, nip, nuptk, phone, avatar_url, status, created_at, updated_at) 
                                     VALUES ('usr-ks-001', 'eagenwidi', 'math.brighton@gmail.com', :pass, :name, '', 'Eagen', 'Widi Nugroho', 'S.Sos., Gr., S.Pd.', 'Mr Eagen', 'kepala_sekolah', 'SCH-001', 'EMP-001', :nip, '8456756658200002', '082298890002', :av, 'active', :cat, :uat)");
            $insKS1->execute([
                ':pass' => password_hash('kepalasekolah', PASSWORD_BCRYPT),
                ':name' => $sch1Principal,
                ':nip'  => $sch1Nip,
                ':av'   => $profile1Data['avatarUrl'],
                ':cat'  => $now,
                ':uat'  => $now
            ]);
        }

        // 5. Ensure Kepala Sekolah 2 (sitirogaya -> SCH-002) exists
        $chkKS2 = $pdo->prepare("SELECT id FROM users WHERE username = 'sitirogaya' OR (role = 'kepala_sekolah' AND school_id = 'SCH-002')");
        $chkKS2->execute();
        $existingKS2 = $chkKS2->fetch();

        if (!$existingKS2) {
            $insKS2 = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, title_prefix, first_name, last_name, title_suffix, nickname, role, school_id, employee_id, nip, nuptk, phone, avatar_url, status, created_at, updated_at) 
                                     VALUES ('usr-ks-002', 'sitirogaya', 'kepala.sekolah@smpfatahillah.sch.id', :pass, :name, '', 'Siti', 'Rogaya', 'M.Pd.', 'Ibu Siti', 'kepala_sekolah', 'SCH-002', 'EMP-FTH-001', :nip, '7392810482019382', '081388776655', :av, 'active', :cat, :uat)");
            $insKS2->execute([
                ':pass' => password_hash('kepalasekolah', PASSWORD_BCRYPT),
                ':name' => $sch2Principal,
                ':nip'  => $sch2Nip,
                ':av'   => $profile2Data['avatarUrl'],
                ':cat'  => $now,
                ':uat'  => $now
            ]);
        }

        // 6. Ensure Pengawas Pembina exists & has assigned schools
        $chkPengawas = $pdo->query("SELECT id FROM users WHERE username = 'pengawas' OR role = 'pengawas'")->fetch();
        $pengawasId = 'usr-pengawas-001';
        if (!$chkPengawas) {
            $insPengawas = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, nip, phone, status, created_at, updated_at) 
                                          VALUES (:id, 'pengawas', 'pengawas@dinas.go.id', :pass, 'Drs. H. Mulyadi, M.Pd. (Pengawas Pembina)', 'pengawas', NULL, '19680315 199303 1 004', '0812-3456-7890', 'active', :cat, :uat)");
            $insPengawas->execute([
                ':id'   => $pengawasId,
                ':pass' => password_hash('pengawas123', PASSWORD_BCRYPT),
                ':cat'  => $now,
                ':uat'  => $now
            ]);
        } else {
            $pengawasId = $chkPengawas['id'];
        }

        // Link pengawas to SCH-001 and SCH-002 in pengawas_schools
        try {
            $insPS = $pdo->prepare("INSERT INTO pengawas_schools (pengawas_user_id, school_id, created_at) VALUES (:pid, :sid, :cat) ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)");
            $insPS->execute([':pid' => $pengawasId, ':sid' => 'SCH-001', ':cat' => $now]);
            $insPS->execute([':pid' => $pengawasId, ':sid' => 'SCH-002', ':cat' => $now]);
        } catch (Exception $ePS) {}

        // 7. Ensure Supervision Categories & Indicators are Hydrated if empty
        $catCount = (int)$pdo->query("SELECT COUNT(*) FROM supervision_categories")->fetchColumn();
        if ($catCount === 0) {
            autoHydrateSupervisionIndicators($pdo);
        }

    } catch (Exception $err) {
        error_log("[supervisisekolah.id Database Warning] Seeding users failed: " . $err->getMessage());
    }
}

/**
 * Auto-hydrate supervision categories & indicators from master JSON if empty (Centralized Master Data)
 */
function autoHydrateSupervisionIndicators($pdo) {
    try {
        $masterFile = dirname(__DIR__) . '/data/supervision_indicators_master.json';
        if (!file_exists($masterFile)) return;

        $data = json_decode(file_get_contents($masterFile), true);
        if (empty($data['categories'])) return;

        $now = date('c');
        $catMap = [
            'ELE' => 'Elemen Dasar',
            'PEM' => 'Pembelajaran Mendalam',
            'DIF' => 'Diferensiasi',
            'KOM' => 'Kompetensi Sosial Emosional',
            'ENG' => 'English and Global Framework',
            'MAN' => 'Manajemen Kelas & Disiplin Positif',
            'LIT' => 'Literasi-Numerasi',
            'STE' => 'STEM'
        ];

        $insCat = $pdo->prepare("INSERT INTO supervision_categories (id, name, code, description, color, icon, is_custom, sort_order, created_at, updated_at) 
                                 VALUES (:id, :name, :code, :description, :color, :icon, 0, :sort_order, :cat, :uat)
                                 ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), color=VALUES(color), icon=VALUES(icon), sort_order=VALUES(sort_order)");

        foreach ($data['categories'] as $c) {
            $insCat->execute([
                ':id' => $c['id'],
                ':name' => $catMap[$c['id']] ?? $c['id'],
                ':code' => $c['code'] ?? $c['id'],
                ':description' => $c['description'] ?? '',
                ':color' => $c['color'] ?? 'blue',
                ':icon' => $c['icon'] ?? 'bookmark',
                ':sort_order' => $c['sort_order'] ?? 0,
                ':cat' => $now,
                ':uat' => $now
            ]);
        }

        if (!empty($data['indicators'])) {
            $insInd = $pdo->prepare("INSERT INTO supervision_indicators (id, category_id, category_name, stage, number_order, title, focus, scale_min, scale_max, is_custom, created_at, updated_at) 
                                     VALUES (:id, :cat_id, :cat_name, :stage, :norder, :title, :focus, 1, 4, 0, :cat, :uat)
                                     ON DUPLICATE KEY UPDATE title=VALUES(title), focus=VALUES(focus), stage=VALUES(stage), number_order=VALUES(number_order)");

            foreach ($data['indicators'] as $ind) {
                $insInd->execute([
                    ':id' => $ind['id'],
                    ':cat_id' => $ind['categoryId'] ?? $ind['category_id'] ?? 'ELE',
                    ':cat_name' => $ind['categoryName'] ?? $ind['category_name'] ?? 'Elemen Dasar',
                    ':stage' => $ind['stage'],
                    ':norder' => (int)($ind['numberOrder'] ?? $ind['number_order'] ?? 1),
                    ':title' => $ind['title'],
                    ':focus' => $ind['focus'] ?? '',
                    ':cat' => $now,
                    ':uat' => $now
                ]);
            }
        }

        $activeJson = json_encode($data['active_categories_default'] ?? array_values($catMap));
        $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value, updated_at) 
                       VALUES ('active_supervision_categories', :v, :now) 
                       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_at=VALUES(updated_at)")
            ->execute([':v' => $activeJson, ':now' => $now]);
    } catch (Exception $e) {
        error_log("[autoHydrateSupervisionIndicators Warning] " . $e->getMessage());
    }
}

/**
 * Legacy sync stub (employees table is fully integrated into users table)
 */
function syncAllAccountsFromEmployees($pdo, $schoolId = 'SCH-001') {
    return;
}


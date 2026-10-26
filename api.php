<?php
/**
 * supervisisekolah.id - Server-Side Database & API Endpoint
 * Engine: Single Database MySQL / MariaDB (Database: supervisisekolah_id)
 * Architecture: Multi-Tenant SaaS with Strict RBAC (Super Admin, Kepala Sekolah, Guru, Pengawas)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

require_once __DIR__ . '/config/database.php';

try {
    $pdo = getDatabaseConnection();

    // Helper function to generate clean, memorable school code
    if (!function_exists('generateSchoolCode')) {
        function generateSchoolCode($schoolName = '') {
            $prefix = 'SCH';
            $words = preg_split('/\s+/', trim($schoolName));
            if (!empty($words)) {
                foreach ($words as $w) {
                    $wClean = strtoupper(preg_replace('/[^A-Za-z]/', '', $w));
                    if (!in_array($wClean, ['SMP', 'SMA', 'SMK', 'SD', 'NEGERI', 'SWASTA', 'ISLAM', 'KRISTEN', 'KATHOLIK', 'NASIONAL', 'TERPADU']) && strlen($wClean) >= 3) {
                        $prefix = substr($wClean, 0, 3);
                        break;
                    }
                }
            }
            if (strlen($prefix) < 3) {
                $cleanAll = strtoupper(preg_replace('/[^A-Za-z]/', '', $schoolName));
                $prefix = strlen($cleanAll) >= 3 ? substr($cleanAll, 0, 3) : 'SCH';
            }
            $chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
            $rand = '';
            for ($i = 0; $i < 4; $i++) {
                $rand .= $chars[random_int(0, strlen($chars) - 1)];
            }
            return $prefix . '-' . $rand;
        }
    }

    // Helper function to extract and verify authenticated user from Bearer token or request input
    if (!function_exists('getAuthUser')) {
        function getAuthUser($pdo, $inputData = []) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
            if (empty($authHeader) && function_exists('apache_request_headers')) {
                $arh = apache_request_headers();
                $authHeader = $arh['Authorization'] ?? $arh['authorization'] ?? '';
            }
            $token = trim($inputData['token'] ?? $_GET['token'] ?? $_POST['token'] ?? $authHeader);
            $token = str_replace('Bearer ', '', $token);
            if (!empty($token)) {
                $stmt = $pdo->prepare("SELECT * FROM users WHERE session_token = :t LIMIT 1");
                $stmt->execute([':t' => $token]);
                $u = $stmt->fetch();
                if ($u) {
                    unset($u['password_hash']);
                    return $u;
                }
            }

            // Fallback 1: verify active user by auth_user_id if provided
            $reqUid = trim($inputData['auth_user_id'] ?? $_GET['auth_user_id'] ?? $_POST['auth_user_id'] ?? '');
            if (!empty($reqUid)) {
                $stmt = $pdo->prepare("SELECT * FROM users WHERE id = :id AND status = 'active' LIMIT 1");
                $stmt->execute([':id' => $reqUid]);
                $u = $stmt->fetch();
                if ($u) {
                    unset($u['password_hash']);
                    return $u;
                }
            }

            // Fallback 2: verify active user by auth_username if provided
            $reqUname = trim($inputData['auth_username'] ?? $_GET['auth_username'] ?? $_POST['auth_username'] ?? '');
            if (!empty($reqUname)) {
                $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :u AND status = 'active' LIMIT 1");
                $stmt->execute([':u' => $reqUname]);
                $u = $stmt->fetch();
                if ($u) {
                    unset($u['password_hash']);
                    return $u;
                }
            }

            return null;
        }
    }

    // Helper function to strictly resolve tenant context (school_id) with RBAC enforcement
    if (!function_exists('resolveTenantContext')) {
        function resolveTenantContext($pdo, $inputData = [], $requireWriteAccess = false) {
            $authUser = getAuthUser($pdo, $inputData);
            $requestedSid = trim($inputData['school_id'] ?? $inputData['schoolId'] ?? $_GET['school_id'] ?? $_GET['schoolId'] ?? $_POST['school_id'] ?? $_POST['schoolId'] ?? '');

            if (!$authUser) {
                // If unauthenticated (e.g. portal login, public listing), allow requested school if specified
                if (!empty($requestedSid) && $requestedSid !== 'all') {
                    return $requestedSid;
                }
                return 'SCH-001';
            }

            $role = $authUser['role'];

            // 1. Super Admin: full access to all schools
            if ($role === 'super_admin') {
                if (!empty($requestedSid) && $requestedSid !== 'all') {
                    return $requestedSid;
                }
                return 'SCH-001';
            }

            // 2. Pengawas (Supervisor):
            if ($role === 'pengawas') {
                if ($requireWriteAccess) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Akses ditolak: Pengawas Pembina hanya memiliki hak akses pantau (Read-Only).'
                    ]);
                    exit;
                }
                // Check schools assigned to this pengawas
                $psStmt = $pdo->prepare("SELECT school_id FROM pengawas_schools WHERE pengawas_user_id = :uid");
                $psStmt->execute([':uid' => $authUser['id']]);
                $allowedSchools = $psStmt->fetchAll(PDO::FETCH_COLUMN);

                if (!empty($requestedSid) && in_array($requestedSid, $allowedSchools)) {
                    return $requestedSid;
                }
                if (!empty($allowedSchools)) {
                    return $allowedSchools[0];
                }
                return $authUser['school_id'] ?: 'SCH-001';
            }

            // 3. Kepala Sekolah (1 School = 1 Kepala Sekolah): strictly bound to own school
            if ($role === 'kepala_sekolah') {
                return $authUser['school_id'] ?: 'SCH-001';
            }

            // 4. Guru & Staff: strictly bound to own school
            if ($role === 'guru' || $role === 'guru_bk' || $role === 'staff') {
                return $authUser['school_id'] ?: 'SCH-001';
            }

            return $authUser['school_id'] ?: 'SCH-001';
        }
    }

    // Backward-compatible alias resolving active school ID through RBAC context
    if (!function_exists('resolveActiveSchoolId')) {
        function resolveActiveSchoolId($pdo, $inputData = []) {
            return resolveTenantContext($pdo, $inputData, false);
        }
    }

    // Strict multi-tenant condition: only SCH-001 is allowed to match legacy NULL/empty rows
    if (!function_exists('getTenantSchoolCondition')) {
        function getTenantSchoolCondition($targetSchoolId, $col = 'school_id') {
            if ($targetSchoolId === 'SCH-001') {
                return "($col = :sid OR $col IS NULL OR $col = '')";
            }
            return "$col = :sid";
        }
    }

    // Initialize Default Profile if empty
    $stmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
    $profileRow = $stmt->fetch();

    if (!$profileRow) {
        $defaultProfile = [
            'username' => 'kepalasekolah',
            'password' => 'kepalasekolah',
            'firstName' => '',
            'lastName' => '',
            'nickName' => '',
            'fullName' => 'Kepala Sekolah',
            'titlePrefix' => '',
            'titleSuffix' => '',
            'nip' => '',
            'nuptk' => '',
            'email' => 'kepala.sekolah@smpbrighton.sch.id',
            'phone' => '0812-9988-7766',
            'role' => 'Kepala Sekolah SMP',
            'schoolName' => 'SMP Brighton',
            'npsn' => '20100123',
            'schoolAddress' => 'Jl. Raya Pendidikan No. 45, Jakarta',
            'schoolEmail' => 'info@smpbrighton.sch.id',
            'schoolPhone' => '(021) 7654321',
            'academicYear' => '2026/2027',
            'semester' => 'Ganjil',
            'schoolCode' => 'BRI-TF8U',
            'avatarUrl' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
        ];

        $ins = $pdo->prepare("INSERT INTO app_profile (id, profile_json, updated_at) VALUES (1, :json, :updated_at)");
        $ins->execute([
            ':json' => json_encode($defaultProfile, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':updated_at' => date('c')
        ]);
        $profileRow = ['profile_json' => json_encode($defaultProfile)];
    } else {
        // Ensure existing profile has schoolCode generated automatically
        $currProfile = json_decode($profileRow['profile_json'], true) ?: [];
        if (empty($currProfile['schoolCode'])) {
            $currProfile['schoolCode'] = generateSchoolCode($currProfile['schoolName'] ?? 'SMP Brighton');
            $upd = $pdo->prepare("UPDATE app_profile SET profile_json = :json, updated_at = :now WHERE id = 1");
            $now = date('c');
            $upd->execute([
                ':json' => json_encode($currProfile, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':now' => $now
            ]);
            $profileRow = ['profile_json' => json_encode($currProfile)];
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}

/**
 * UNIFIED USER & EMPLOYEE ARCHITECTURE:
 * Every employee (GTK) is a user in the `users` table.
 * All employee operations directly query and update the `users` table.
 */

if (!function_exists('formatUserAsEmployee')) {
function formatUserAsEmployee($user) {
    if (empty($user)) return null;

    $emp = [];
    if (!empty($user['data_json'])) {
        $parsed = json_decode($user['data_json'], true);
        if (is_array($parsed)) {
            $emp = $parsed;
        }
    }

    $empId = !empty($user['employee_id']) ? $user['employee_id'] : $user['id'];
    $emp['id'] = $empId;
    $emp['userId'] = $user['id'];
    $emp['name'] = $user['full_name'];
    $emp['fullName'] = $user['full_name'];
    $emp['titlePrefix'] = !empty($user['title_prefix']) ? $user['title_prefix'] : ($emp['titlePrefix'] ?? '');
    $emp['firstName'] = !empty($user['first_name']) ? $user['first_name'] : ($emp['firstName'] ?? '');
    $emp['lastName'] = !empty($user['last_name']) ? $user['last_name'] : ($emp['lastName'] ?? '');
    $emp['titleSuffix'] = !empty($user['title_suffix']) ? $user['title_suffix'] : ($emp['titleSuffix'] ?? '');
    $emp['nickname'] = !empty($user['nickname']) ? $user['nickname'] : ($emp['nickname'] ?? '');
    $emp['nickName'] = $emp['nickname'];
    $emp['gender'] = !empty($user['gender']) ? $user['gender'] : ($emp['gender'] ?? 'Laki-laki');

    // Role mapping
    $role = $user['role'];
    if ($role === 'kepala_sekolah') {
        $emp['role'] = 'Kepala Sekolah';
    } elseif ($role === 'pengawas') {
        $emp['role'] = 'Pengawas';
    } elseif ($role === 'guru_bk' || (!empty($emp['role']) && $emp['role'] === 'Guru BK')) {
        $emp['role'] = 'Guru BK';
    } elseif ($role === 'staff') {
        $emp['role'] = !empty($emp['role']) ? $emp['role'] : 'Staff';
    } else {
        $emp['role'] = 'Guru';
    }

    $emp['department'] = !empty($user['department']) ? $user['department'] : ($emp['department'] ?? '');
    $emp['schoolName'] = $emp['department'];
    $emp['employmentStatus'] = !empty($user['employment_status']) ? $user['employment_status'] : ($emp['employmentStatus'] ?? 'GTY');
    $emp['joinDate'] = !empty($user['join_date']) ? $user['join_date'] : ($emp['joinDate'] ?? '');
    $emp['nip'] = !empty($user['nip']) ? $user['nip'] : ($emp['nip'] ?? '');
    $emp['nuptk'] = !empty($user['nuptk']) ? $user['nuptk'] : ($emp['nuptk'] ?? '');
    $emp['subject'] = !empty($user['subject']) ? $user['subject'] : ($emp['subject'] ?? '');
    $emp['task'] = !empty($user['task']) ? $user['task'] : ($emp['task'] ?? '');
    $emp['email'] = !empty($user['email']) ? $user['email'] : ($emp['email'] ?? '');
    $emp['phone'] = !empty($user['phone']) ? $user['phone'] : ($emp['phone'] ?? '');
    $emp['education'] = !empty($user['education']) ? $user['education'] : ($emp['education'] ?? '');
    $emp['address'] = !empty($user['address']) ? $user['address'] : ($emp['address'] ?? '');
    $emp['status'] = (!empty($user['status']) && $user['status'] === 'inactive') ? 'Nonaktif' : 'Aktif';
    $emp['photo'] = !empty($user['avatar_url']) ? $user['avatar_url'] : ($emp['photo'] ?? '');
    $emp['accessCode'] = !empty($user['access_code']) ? $user['access_code'] : ($emp['accessCode'] ?? '');
    $emp['username'] = $user['username'] ?? ($emp['username'] ?? '');
    $emp['school_id'] = $user['school_id'] ?? 'SCH-001';
    $emp['schoolId'] = $emp['school_id'];

    return $emp;
}
}

if (!function_exists('mergeUserWithEmployee')) {
function mergeUserWithEmployee($pdo, &$user) {
    if (empty($user)) return;
    $emp = [];
    if (!empty($user['data_json'])) {
        $parsed = json_decode($user['data_json'], true);
        if (is_array($parsed)) {
            $emp = $parsed;
            foreach ($emp as $k => $v) {
                if (!isset($user[$k]) || $user[$k] === '' || $user[$k] === null) {
                    $user[$k] = $v;
                }
            }
        }
    }
    // Strict camelCase and snake_case 16-field synchronization
    $user['titlePrefix'] = !empty($user['title_prefix']) ? $user['title_prefix'] : ($emp['titlePrefix'] ?? '');
    $user['firstName'] = !empty($user['first_name']) ? $user['first_name'] : ($emp['firstName'] ?? '');
    $user['lastName'] = !empty($user['last_name']) ? $user['last_name'] : ($emp['lastName'] ?? '');
    $user['titleSuffix'] = !empty($user['title_suffix']) ? $user['title_suffix'] : ($emp['titleSuffix'] ?? '');
    $user['fullName'] = $user['full_name'];
    $user['nickName'] = !empty($user['nickname']) ? $user['nickname'] : ($emp['nickName'] ?? ($emp['nickname'] ?? ''));
    $user['nuptk'] = !empty($user['nuptk']) ? $user['nuptk'] : ($emp['nuptk'] ?? '');
    $user['employmentStatus'] = $user['employment_status'] ?? ($user['employmentStatus'] ?? 'PNS');
    $user['accessCode'] = $user['access_code'] ?? ($user['accessCode'] ?? '');
    $user['photo'] = $user['avatar_url'] ?? ($user['photo'] ?? '');
    $user['schoolName'] = $user['department'] ?? '';

    // If Kepala Sekolah, load official school details
    if ($user['role'] === 'kepala_sekolah' && !empty($user['school_id'])) {
        try {
            $schStmt = $pdo->prepare("SELECT name, code, npsn, address, email, phone, academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
            $schStmt->execute([':sid' => $user['school_id']]);
            $sch = $schStmt->fetch(PDO::FETCH_ASSOC);
            if ($sch) {
                $user['schoolName'] = $sch['name'];
                $user['schoolCode'] = $sch['code'];
                $user['npsn'] = $sch['npsn'];
                $user['schoolAddress'] = $sch['address'];
                $user['schoolEmail'] = $sch['email'];
                $user['schoolPhone'] = $sch['phone'];
                $user['academicYear'] = $sch['academic_year'] ?? '2026/2027';
                $user['semester'] = $sch['semester'] ?? 'Ganjil';
            }
        } catch (Exception $e) {}
    }
}
}

if (!function_exists('syncUserToEmployee')) {
function syncUserToEmployee($pdo, $userData) {
    if (empty($userData)) return null;
    $uid = $userData['id'] ?? '';
    $fullName = trim($userData['full_name'] ?? ($userData['name'] ?? ''));
    $role = trim($userData['role'] ?? 'guru');
    $schId = trim($userData['school_id'] ?? 'SCH-001');
    $now = date('c');

    // If Headmaster, keep school profile updated
    if ($role === 'kepala_sekolah') {
        try {
            $sStmt = $pdo->prepare("SELECT profile_json FROM schools WHERE id = :sid LIMIT 1");
            $sStmt->execute([':sid' => $schId]);
            $sProf = json_decode($sStmt->fetchColumn() ?: '{}', true);
            $sProf['fullName'] = $fullName;
            if (!empty($userData['nickname'])) $sProf['nickName'] = $userData['nickname'];
            if (!empty($userData['nip'])) $sProf['nip'] = $userData['nip'];
            if (!empty($userData['nuptk']) && $userData['nuptk'] !== '-') $sProf['nuptk'] = $userData['nuptk'];
            if (!empty($userData['email'])) $sProf['email'] = $userData['email'];
            if (!empty($userData['phone'])) $sProf['phone'] = $userData['phone'];
            if (!empty($userData['address']) && $userData['address'] !== '-') $sProf['schoolAddress'] = $userData['address'];
            $pJson = json_encode($sProf, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $pdo->prepare("UPDATE schools SET profile_json = :p, principal_name = :pn, principal_nip = :pnip, updated_at = :uat WHERE id = :sid")->execute([
                ':p' => $pJson,
                ':pn' => $fullName,
                ':pnip' => !empty($userData['nip']) ? $userData['nip'] : '',
                ':uat' => $now,
                ':sid' => $schId
            ]);
        } catch (Exception $e) {}
    }

    return $userData['employee_id'] ?? $uid;
}
}

if (!function_exists('syncEmployeeToUser')) {
function syncEmployeeToUser($pdo, $empData) {
    return $empData['userId'] ?? ($empData['id'] ?? null);
}
}

// Parse request
$action = $_GET['action'] ?? $_POST['action'] ?? 'bootstrap';
$rawInput = file_get_contents('php://input');
$inputData = (!empty($inputData) && is_array($inputData)) ? $inputData : (json_decode($rawInput, true) ?: $_POST);

switch ($action) {
    // ═══════════════════════════════════════════════════════════════════════
    // UNIVERSAL AUTHENTICATION & MULTI-ROLE RBAC DISPATCHER
    // Roles: Super Admin, Kepala Sekolah, Guru, Pengawas/Tamu
    // ═══════════════════════════════════════════════════════════════════════

    case 'login':
        $username = trim($inputData['username'] ?? $inputData['identity'] ?? '');
        $password = trim($inputData['password'] ?? '');

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Username dan kata sandi wajib diisi']);
            exit;
        }

        // Search user by username, email, or nip
        $uStmt = $pdo->prepare("SELECT * FROM users WHERE username = :u1 OR email = :u2 OR nip = :u3 LIMIT 1");
        $uStmt->execute([':u1' => $username, ':u2' => $username, ':u3' => $username]);
        $user = $uStmt->fetch();

        // If not found in users, check if an employee/guru is trying to use their NIP or name here
        if (!$user) {
            $cleanInput = preg_replace('/[^0-9]/', '', $username);
            if (!empty($cleanInput) && strlen($cleanInput) >= 6) {
                $empCheck = $pdo->prepare("SELECT full_name as name, data_json FROM users WHERE (nip LIKE :q OR username = :u) AND role IN ('guru', 'guru_bk', 'staff') LIMIT 1");
                $empCheck->execute([':q' => '%' . $cleanInput . '%', ':u' => $cleanInput]);
                $emp = $empCheck->fetch();
                if ($emp) {
                    $empData = json_decode($emp['data_json'] ?? '{}', true);
                    $displayName = $emp['name'] ?? 'Bapak/Ibu Guru';
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'isGuru' => true,
                        'error' => 'Halo ' . $displayName . ', Akun Guru tidak login melalui Universal Login Portal. Silakan gunakan Portal Khusus Guru (/guru/) dengan memilih Nama Sekolah, Kode Sekolah, dan Kode Akses Guru Anda.'
                    ]);
                    exit;
                }
            }

            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Username atau kata sandi tidak ditemukan']);
            exit;
        }

        // KHUSUS GURU: Dilarang login via Universal Login Portal
        // Guru memiliki jalur khusus 1-pintu di /guru/
        if ($user['role'] === 'guru') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'isGuru' => true,
                'error' => 'Akun Guru tidak login melalui Universal Login Portal. Silakan gunakan Portal Khusus Guru (/guru/) dengan memilih Nama Sekolah, Kode Sekolah, dan Kode Akses Personal Guru Anda.'
            ]);
            exit;
        }

        if (($user['status'] ?? 'active') !== 'active') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Akun Anda dinonaktifkan. Silakan hubungi Administrator.']);
            exit;
        }

        $isValid = password_verify($password, $user['password_hash']);
        // Fallback for legacy plain password comparison, then rehash
        if (!$isValid && $password === $user['password_hash']) {
            $isValid = true;
            $newHash = password_hash($password, PASSWORD_BCRYPT);
            $updH = $pdo->prepare("UPDATE users SET password_hash = :h WHERE id = :id");
            $updH->execute([':h' => $newHash, ':id' => $user['id']]);
        }

        if (!$isValid) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Kata sandi tidak sesuai']);
            exit;
        }

        // Generate session token
        $sessionToken = bin2hex(random_bytes(32));
        $now = date('c');
        $updToken = $pdo->prepare("UPDATE users SET session_token = :t, last_login = :ll WHERE id = :id");
        $updToken->execute([':t' => $sessionToken, ':ll' => $now, ':id' => $user['id']]);

        // Get assigned schools for Pengawas
        $assignedSchools = [];
        if ($user['role'] === 'pengawas') {
            $psStmt = $pdo->prepare("SELECT s.id, s.code, s.name, s.npsn, s.principal_name, s.academic_year, s.semester, s.status, ps.created_at as assigned_at FROM schools s JOIN pengawas_schools ps ON s.id = ps.school_id WHERE ps.pengawas_user_id = :uid ORDER BY s.name ASC");
            $psStmt->execute([':uid' => $user['id']]);
            $assignedSchools = $psStmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($user['school_id']) && !empty($assignedSchools)) {
                $user['school_id'] = $assignedSchools[0]['id'];
            }
        }

        // Get school details if assigned
        $school = null;
        if (!empty($user['school_id'])) {
            $schStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :sid LIMIT 1");
            $schStmt->execute([':sid' => $user['school_id']]);
            $school = $schStmt->fetch();
        }

        // Determine destination redirect by role (Super Admin, Kepala Sekolah, Pengawas)
        $redirectUrl = 'dashboard';
        if ($user['role'] === 'super_admin') {
            $redirectUrl = 'admin';
        } else if ($user['role'] === 'kepala_sekolah') {
            $redirectUrl = 'dashboard';
        } else if ($user['role'] === 'pengawas') {
            $redirectUrl = 'dashboard?view=pengawas';
        }

        // Safe user representation (omit password_hash)
        unset($user['password_hash']);

        echo json_encode([
            'success' => true,
            'message' => 'Login berhasil sebagai ' . ucfirst(str_replace('_', ' ', $user['role'])),
            'token' => $sessionToken,
            'user' => $user,
            'role' => $user['role'],
            'school_id' => $user['school_id'] ?? null,
            'assigned_schools' => $assignedSchools,
            'school' => $school,
            'redirect' => $redirectUrl
        ]);
        break;

    case 'check_session':
        $token = trim($inputData['token'] ?? $_GET['token'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '');
        $token = str_replace('Bearer ', '', $token);

        if (empty($token)) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Sesi tidak valid atau telah berakhir']);
            exit;
        }

        $sStmt = $pdo->prepare("SELECT * FROM users WHERE session_token = :t LIMIT 1");
        $sStmt->execute([':t' => $token]);
        $user = $sStmt->fetch();

        if (!$user || ($user['status'] ?? 'active') !== 'active') {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Sesi kedaluwarsa atau akun tidak aktif']);
            exit;
        }

        $assignedSchools = [];
        if ($user['role'] === 'pengawas') {
            $psStmt = $pdo->prepare("SELECT s.id, s.code, s.name, s.npsn, s.principal_name, s.academic_year, s.semester, s.status, ps.created_at as assigned_at FROM schools s JOIN pengawas_schools ps ON s.id = ps.school_id WHERE ps.pengawas_user_id = :uid ORDER BY s.name ASC");
            $psStmt->execute([':uid' => $user['id']]);
            $assignedSchools = $psStmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($user['school_id']) && !empty($assignedSchools)) {
                $user['school_id'] = $assignedSchools[0]['id'];
            }
        }

        $school = null;
        if (!empty($user['school_id'])) {
            $schStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :sid LIMIT 1");
            $schStmt->execute([':sid' => $user['school_id']]);
            $school = $schStmt->fetch();
        }

        unset($user['password_hash']);
        echo json_encode([
            'success' => true,
            'user' => $user,
            'role' => $user['role'],
            'school_id' => $user['school_id'] ?? null,
            'assigned_schools' => $assignedSchools,
            'school' => $school
        ]);
        break;

    case 'logout':
        $token = trim($inputData['token'] ?? $_GET['token'] ?? '');
        if (!empty($token)) {
            $pdo->prepare("UPDATE users SET session_token = NULL WHERE session_token = :t")->execute([':t' => $token]);
        }
        echo json_encode(['success' => true, 'message' => 'Sesi berhasil ditutup']);
        break;

    case 'get_users':
        $authUser = getAuthUser($pdo, $inputData);
        $schoolFilter = $_GET['school_id'] ?? $inputData['school_id'] ?? null;
        
        // Kepala Sekolah can ONLY view users belonging to their own school
        if ($authUser && $authUser['role'] === 'kepala_sekolah') {
            $schoolFilter = $authUser['school_id'];
        } elseif ($authUser && $authUser['role'] === 'pengawas') {
            // Pengawas can only filter by assigned schools
            $psStmt = $pdo->prepare("SELECT school_id FROM pengawas_schools WHERE pengawas_user_id = :uid");
            $psStmt->execute([':uid' => $authUser['id']]);
            $allowed = $psStmt->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($schoolFilter) && !in_array($schoolFilter, $allowed)) {
                $schoolFilter = !empty($allowed) ? $allowed[0] : 'NONE';
            }
        }

        if (!empty($schoolFilter) && $schoolFilter !== 'all') {
            $uStmt = $pdo->prepare("SELECT * FROM users WHERE school_id = :sid ORDER BY role ASC, full_name ASC");
            $uStmt->execute([':sid' => $schoolFilter]);
        } else {
            $uStmt = $pdo->query("SELECT * FROM users ORDER BY CASE role WHEN 'super_admin' THEN 1 WHEN 'kepala_sekolah' THEN 2 WHEN 'guru' THEN 3 ELSE 4 END, full_name ASC");
        }
        $users = $uStmt->fetchAll();

        // Fetch assigned schools mapping for pengawas
        $psStmt = $pdo->query("
            SELECT ps.pengawas_user_id, ps.school_id, s.name as school_name, s.code as school_code 
            FROM pengawas_schools ps 
            JOIN schools s ON ps.school_id = s.id 
            ORDER BY s.name ASC
        ");
        $pengawasMap = [];
        while ($r = $psStmt->fetch(PDO::FETCH_ASSOC)) {
            $pengawasMap[$r['pengawas_user_id']][] = [
                'id' => $r['school_id'],
                'name' => $r['school_name'],
                'code' => $r['school_code']
            ];
        }

        foreach ($users as &$u) {
            mergeUserWithEmployee($pdo, $u);
            if ($u['role'] === 'pengawas') {
                $u['assigned_schools'] = $pengawasMap[$u['id']] ?? [];
                $u['school_id'] = null;
            } elseif ($u['role'] === 'super_admin') {
                $u['school_id'] = null;
            }
        }
        unset($u);
        echo json_encode(['success' => true, 'users' => $users]);
        break;

    case 'get_employees':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $reqSchool = $_GET['school_id'] ?? $inputData['school_id'] ?? null;
        $authUser = getAuthUser($pdo, $inputData);

        if ($reqSchool === 'all' && $authUser && $authUser['role'] === 'super_admin') {
            $uStmt = $pdo->query("SELECT * FROM users WHERE role IN ('guru', 'guru_bk', 'staff', 'kepala_sekolah') ORDER BY full_name ASC");
        } else {
            $tenantCond = getTenantSchoolCondition($targetSchoolId, 'school_id');
            $uStmt = $pdo->prepare("SELECT * FROM users WHERE $tenantCond AND role IN ('guru', 'guru_bk', 'staff', 'kepala_sekolah') ORDER BY full_name ASC");
            $uStmt->execute([':sid' => $targetSchoolId]);
        }
        $employees = [];
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        while ($u = $uStmt->fetch(PDO::FETCH_ASSOC)) {
            $emp = formatUserAsEmployee($u);
            if ($emp) {
                if (empty($emp['accessCode'])) {
                    $c1 = ''; for ($i=0; $i<4; $i++) $c1 .= $chars[random_int(0, strlen($chars)-1)];
                    $c2 = ''; for ($i=0; $i<4; $i++) $c2 .= $chars[random_int(0, strlen($chars)-1)];
                    $emp['accessCode'] = $c1 . '-' . $c2;
                    $emp['accessCodeGeneratedAt'] = date('c');
                    $updCode = $pdo->prepare("UPDATE users SET access_code = :code WHERE id = :id");
                    $updCode->execute([':code' => $emp['accessCode'], ':id' => $u['id']]);
                }
                $employees[] = $emp;
            }
        }
        echo json_encode(['success' => true, 'employees' => $employees, 'school_id' => $targetSchoolId]);
        break;

    case 'save_user':
        $uid = trim($inputData['id'] ?? '');
        $uName = trim($inputData['username'] ?? '');
        $fullName = trim($inputData['full_name'] ?? '');
        $role = trim($inputData['role'] ?? 'guru');
        $pass = trim($inputData['password'] ?? '');
        $email = trim($inputData['email'] ?? '');
        $schId = trim($inputData['school_id'] ?? 'SCH-001');
        $nip = trim($inputData['nip'] ?? '');
        $phone = trim($inputData['phone'] ?? '');
        $status = trim($inputData['status'] ?? 'active');
        $now = date('c');

        if (empty($uName) || empty($fullName)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Username dan Nama Lengkap wajib diisi']);
            exit;
        }

        // Check duplicate username
        $chkDup = $pdo->prepare("SELECT id FROM users WHERE username = :u AND id != :id");
        $chkDup->execute([':u' => $uName, ':id' => $uid]);
        if ($chkDup->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Username sudah digunakan pengguna lain']);
            exit;
        }

        if ($role === 'super_admin' || $role === 'pengawas') {
            $schId = null;
        }

        // Enforce 1 School = 1 Kepala Sekolah rule
        if ($role === 'kepala_sekolah' && !empty($schId)) {
            $chkKS = $pdo->prepare("SELECT id, full_name FROM users WHERE school_id = :sid AND role = 'kepala_sekolah' AND id != :uid LIMIT 1");
            $chkKS->execute([':sid' => $schId, ':uid' => $uid]);
            $existingKS = $chkKS->fetch();
            if ($existingKS) {
                http_response_code(400);
                echo json_encode([
                    'success' => false, 
                    'error' => 'Sekolah ini sudah memiliki Kepala Sekolah (' . $existingKS['full_name'] . '). 1 Satuan Sekolah hanya boleh memiliki 1 Kepala Sekolah.'
                ]);
                exit;
            }
        }

        if (!empty($uid)) {
            // Update
            $titlePrefix = trim($inputData['title_prefix'] ?? ($inputData['titlePrefix'] ?? ''));
            $firstName = trim($inputData['first_name'] ?? ($inputData['firstName'] ?? ''));
            $lastName = trim($inputData['last_name'] ?? ($inputData['lastName'] ?? ''));
            $titleSuffix = trim($inputData['title_suffix'] ?? ($inputData['titleSuffix'] ?? ''));
            $nickname = trim($inputData['nickname'] ?? ($inputData['nickName'] ?? ''));
            $nuptk = trim($inputData['nuptk'] ?? '');
            $address = trim($inputData['address'] ?? '');
            $accessCode = trim($inputData['access_code'] ?? ($inputData['accessCode'] ?? ''));
            $gender = trim($inputData['gender'] ?? 'Laki-laki');
            $dept = trim($inputData['department'] ?? '');
            $empStatus = trim($inputData['employment_status'] ?? ($inputData['employmentStatus'] ?? 'PNS'));
            $subject = trim($inputData['subject'] ?? '');
            $task = trim($inputData['task'] ?? '');
            $education = trim($inputData['education'] ?? '');

            $sql = "UPDATE users SET 
                username = :u, full_name = :fn, role = :r, school_id = :sch, 
                email = :em, nip = :nip, phone = :ph, status = :st,
                title_prefix = :tp, first_name = :fnm, last_name = :lnm, title_suffix = :ts,
                nickname = :nn, nuptk = :nuptk, address = :addr, access_code = :ac,
                gender = :g, department = :dept, employment_status = :es, subject = :subj,
                task = :task, education = :edu, updated_at = :uat";
            $params = [
                ':u' => $uName, ':fn' => $fullName, ':r' => $role, ':sch' => $schId ?: null,
                ':em' => $email ?: null, ':nip' => $nip ?: null, ':ph' => $phone ?: null,
                ':st' => $status, ':tp' => $titlePrefix, ':fnm' => $firstName, ':lnm' => $lastName,
                ':ts' => $titleSuffix, ':nn' => $nickname, ':nuptk' => $nuptk ?: null,
                ':addr' => $address, ':ac' => $accessCode, ':g' => $gender, ':dept' => $dept,
                ':es' => $empStatus, ':subj' => $subject, ':task' => $task, ':edu' => $education,
                ':uat' => $now, ':id' => $uid
            ];
            if (!empty($pass)) {
                $sql .= ", password_hash = :phash";
                $params[':phash'] = password_hash($pass, PASSWORD_BCRYPT);
            }
            $sql .= " WHERE id = :id";
            $upd = $pdo->prepare($sql);
            $upd->execute($params);

            // Sync with schools table if user is kepala_sekolah
            if ($role === 'kepala_sekolah' && !empty($schId)) {
                try {
                    $pdo->prepare("UPDATE schools SET principal_name = :pname, principal_nip = :pnip, updated_at = :uat WHERE id = :sid")
                        ->execute([':pname' => $fullName, ':pnip' => $nip, ':uat' => $now, ':sid' => $schId]);
                } catch (Exception $eSch) {}
            }

            // 2-Way Sync to employees table (pass all 13 fields from inputData)
            $chkU = $pdo->prepare("SELECT * FROM users WHERE id = :id");
            $chkU->execute([':id' => $uid]);
            $updatedUser = $chkU->fetch() ?: [];
            $fullUserData = array_merge($updatedUser, $inputData, ['id' => $uid]);
            $syncedEmpId = syncUserToEmployee($pdo, $fullUserData);

            // Sync pengawas assigned schools if provided
            if ($role === 'pengawas' && isset($inputData['assigned_schools']) && is_array($inputData['assigned_schools'])) {
                $delPs = $pdo->prepare("DELETE FROM pengawas_schools WHERE pengawas_user_id = :uid");
                $delPs->execute([':uid' => $uid]);
                $insPs = $pdo->prepare("INSERT IGNORE INTO pengawas_schools (pengawas_user_id, school_id, created_at) VALUES (:uid, :sid, :cat)");
                foreach ($inputData['assigned_schools'] as $sidItem) {
                    $sidItem = trim($sidItem);
                    if (!empty($sidItem)) {
                        $insPs->execute([':uid' => $uid, ':sid' => $sidItem, ':cat' => $now]);
                    }
                }
            }

            echo json_encode(['success' => true, 'message' => 'Pengguna berhasil diperbarui', 'synced_employee_id' => $syncedEmpId]);
        } else {
            // Insert
            $newId = 'usr-' . substr(md5(uniqid()), 0, 10);
            $passHash = password_hash(!empty($pass) ? $pass : '12345678', PASSWORD_BCRYPT);
            $ins = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, nip, phone, status, must_change_password, created_at, updated_at) 
                                  VALUES (:id, :u, :em, :p, :fn, :r, :sch, :nip, :ph, :st, 0, :cat, :uat)");
            $ins->execute([
                ':id' => $newId, ':u' => $uName, ':em' => $email ?: null, ':p' => $passHash,
                ':fn' => $fullName, ':r' => $role, ':sch' => $schId ?: null,
                ':nip' => $nip ?: null, ':ph' => $phone ?: null, ':st' => $status,
                ':cat' => $now, ':uat' => $now
            ]);

            // Sync with schools table if user is kepala_sekolah
            if ($role === 'kepala_sekolah' && !empty($schId)) {
                try {
                    $pdo->prepare("UPDATE schools SET principal_name = :pname, principal_nip = :pnip, updated_at = :uat WHERE id = :sid")
                        ->execute([':pname' => $fullName, ':pnip' => $nip, ':uat' => $now, ':sid' => $schId]);
                } catch (Exception $eSch) {}
            }

            // 2-Way Sync to employees table (pass all 13 fields from inputData)
            $fullUserData = array_merge($inputData, ['id' => $newId]);
            $syncedEmpId = syncUserToEmployee($pdo, $fullUserData);

            // Sync pengawas assigned schools if provided
            if ($role === 'pengawas' && isset($inputData['assigned_schools']) && is_array($inputData['assigned_schools'])) {
                $insPs = $pdo->prepare("INSERT IGNORE INTO pengawas_schools (pengawas_user_id, school_id, created_at) VALUES (:uid, :sid, :cat)");
                foreach ($inputData['assigned_schools'] as $sidItem) {
                    $sidItem = trim($sidItem);
                    if (!empty($sidItem)) {
                        $insPs->execute([':uid' => $newId, ':sid' => $sidItem, ':cat' => $now]);
                    }
                }
            }

            echo json_encode(['success' => true, 'message' => 'Pengguna berhasil ditambahkan', 'id' => $newId, 'synced_employee_id' => $syncedEmpId]);
        }
        break;

    case 'get_pengawas_schools':
        $authUser = getAuthUser($pdo, $inputData);
        $targetUserId = trim($inputData['pengawas_user_id'] ?? $_GET['pengawas_user_id'] ?? ($authUser ? $authUser['id'] : ''));

        if (empty($targetUserId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID Pengawas wajib disertakan']);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT s.*, ps.created_at as assigned_at 
            FROM schools s 
            JOIN pengawas_schools ps ON s.id = ps.school_id 
            WHERE ps.pengawas_user_id = :uid 
            ORDER BY s.name ASC
        ");
        $stmt->execute([':uid' => $targetUserId]);
        $schools = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'schools' => $schools, 'count' => count($schools)]);
        break;

    case 'assign_pengawas_school':
        $authUser = getAuthUser($pdo, $inputData);
        if (!$authUser || $authUser['role'] !== 'super_admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Akses ditolak: Hanya Super Admin yang berhak menugaskan pengawas sekolah']);
            exit;
        }
        $pUserId = trim($inputData['pengawas_user_id'] ?? '');
        $schId = trim($inputData['school_id'] ?? '');

        if (empty($pUserId) || empty($schId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Pengawas dan Sekolah wajib dipilih']);
            exit;
        }

        $ins = $pdo->prepare("INSERT IGNORE INTO pengawas_schools (pengawas_user_id, school_id, created_at) VALUES (:uid, :sid, :cat)");
        $ins->execute([':uid' => $pUserId, ':sid' => $schId, ':cat' => date('c')]);
        echo json_encode(['success' => true, 'message' => 'Penugasan sekolah binaan pengawas berhasil disimpan']);
        break;

    case 'unassign_pengawas_school':
        $authUser = getAuthUser($pdo, $inputData);
        if (!$authUser || $authUser['role'] !== 'super_admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Akses ditolak: Hanya Super Admin yang berhak mencabut penugasan sekolah']);
            exit;
        }
        $pUserId = trim($inputData['pengawas_user_id'] ?? '');
        $schId = trim($inputData['school_id'] ?? '');

        if (empty($pUserId) || empty($schId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Pengawas dan Sekolah wajib dipilih']);
            exit;
        }

        $del = $pdo->prepare("DELETE FROM pengawas_schools WHERE pengawas_user_id = :uid AND school_id = :sid");
        $del->execute([':uid' => $pUserId, ':sid' => $schId]);
        echo json_encode(['success' => true, 'message' => 'Penugasan sekolah binaan pengawas berhasil dicabut']);
        break;

    case 'get_pengawas_dashboard':
        $authUser = getAuthUser($pdo, $inputData);
        $reqSid = trim($inputData['school_id'] ?? $_GET['school_id'] ?? '');

        // Determine accessible schools for this pengawas
        $accessibleSchools = [];
        if ($authUser && $authUser['role'] === 'super_admin') {
            $accessibleSchools = $pdo->query("SELECT id, code, name, npsn, principal_name, academic_year, semester FROM schools ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($authUser && $authUser['role'] === 'pengawas') {
            $psStmt = $pdo->prepare("SELECT s.id, s.code, s.name, s.npsn, s.principal_name, s.academic_year, s.semester FROM schools s JOIN pengawas_schools ps ON s.id = ps.school_id WHERE ps.pengawas_user_id = :uid ORDER BY s.name ASC");
            $psStmt->execute([':uid' => $authUser['id']]);
            $accessibleSchools = $psStmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Fallback for public or demo
            $accessibleSchools = $pdo->query("SELECT id, code, name, npsn, principal_name, academic_year, semester FROM schools WHERE id = 'SCH-001'")->fetchAll(PDO::FETCH_ASSOC);
        }

        $accessibleIds = array_column($accessibleSchools, 'id');
        $targetSchools = [];
        if (!empty($reqSid) && in_array($reqSid, $accessibleIds)) {
            foreach ($accessibleSchools as $as) {
                if ($as['id'] === $reqSid) {
                    $targetSchools[] = $as;
                    break;
                }
            }
        } else {
            $targetSchools = $accessibleSchools;
        }

        $schoolsRecap = [];
        $totalAllTeachers = 0;
        $totalAllObserved = 0;
        $allScores = [];

        foreach ($targetSchools as $sch) {
            $sid = $sch['id'];

            // Employees
            $eStmt = $pdo->prepare("SELECT role, data_json FROM users WHERE school_id = :sid AND role IN ('guru', 'guru_bk', 'staff', 'kepala_sekolah')");
            $eStmt->execute([':sid' => $sid]);
            $tCount = 0;
            $allEmpCount = 0;
            while ($r = $eStmt->fetch()) {
                $allEmpCount++;
                if (in_array($r['role'] ?? '', ['guru', 'guru_bk', 'kepala_sekolah'])) $tCount++;
            }

            // Observations
            $oStmt = $pdo->prepare("SELECT data_json FROM observations WHERE school_id = :sid ORDER BY updated_at DESC");
            $oStmt->execute([':sid' => $sid]);
            $observedTeachers = [];
            $scores = [];
            $obsList = [];
            while ($r = $oStmt->fetch()) {
                $obs = json_decode($r['data_json'], true);
                $obsList[] = $obs;
                $tName = $obs['teacherName'] ?? '';
                if ($tName && !in_array($tName, $observedTeachers)) {
                    $observedTeachers[] = $tName;
                }
                if (isset($obs['finalScore']) && is_numeric($obs['finalScore'])) {
                    $scores[] = (float)$obs['finalScore'];
                    $allScores[] = (float)$obs['finalScore'];
                }
            }

            // Telaah RPP
            $tStmt = $pdo->prepare("SELECT COUNT(*) FROM telaah_rpp WHERE school_id = :sid");
            $tStmt->execute([':sid' => $sid]);
            $telaahCount = (int)$tStmt->fetchColumn();

            // Schedules
            $schStmt = $pdo->prepare("SELECT status, COUNT(*) as cnt FROM supervision_schedules WHERE school_id = :sid GROUP BY status");
            $schStmt->execute([':sid' => $sid]);
            $schCounts = ['Pending' => 0, 'Disetujui' => 0, 'Ditolak' => 0];
            while ($sr = $schStmt->fetch()) {
                $schCounts[$sr['status']] = (int)$sr['cnt'];
            }

            $avg = count($scores) > 0 ? round(array_sum($scores) / count($scores), 1) : 0;
            $pct = $tCount > 0 ? round((count($observedTeachers) / $tCount) * 100, 1) : 0;

            $totalAllTeachers += $tCount;
            $totalAllObserved += count($observedTeachers);

            $schoolsRecap[] = [
                'school' => $sch,
                'totalEmployees' => $allEmpCount,
                'totalTeachers' => $tCount,
                'observedTeachersCount' => count($observedTeachers),
                'progressPercent' => $pct,
                'averageScore' => $avg,
                'totalObservations' => count($obsList),
                'totalTelaahRpp' => $telaahCount,
                'schedules' => $schCounts,
                'recentObservations' => array_slice($obsList, 0, 5)
            ];
        }

        $overallAvg = count($allScores) > 0 ? round(array_sum($allScores) / count($allScores), 1) : 0;
        $overallProgress = $totalAllTeachers > 0 ? round(($totalAllObserved / $totalAllTeachers) * 100, 1) : 0;

        echo json_encode([
            'success' => true,
            'assigned_schools' => $accessibleSchools,
            'active_school_id' => !empty($reqSid) ? $reqSid : (!empty($accessibleIds) ? $accessibleIds[0] : null),
            'summary' => [
                'totalAssignedSchools' => count($accessibleSchools),
                'totalTeachers' => $totalAllTeachers,
                'totalObservedTeachers' => $totalAllObserved,
                'overallProgressPercent' => $overallProgress,
                'overallAverageScore' => $overallAvg
            ],
            'schools_data' => $schoolsRecap
        ]);
        break;
        break;

    case 'change_password':
        $username = trim($inputData['username'] ?? '');
        $oldPass = trim($inputData['old_password'] ?? '');
        $newPass = trim($inputData['new_password'] ?? '');

        if (empty($username) || empty($newPass)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Data penggantian kata sandi tidak lengkap']);
            exit;
        }

        $uStmt = $pdo->prepare("SELECT * FROM users WHERE username = :u LIMIT 1");
        $uStmt->execute([':u' => $username]);
        $user = $uStmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Pengguna tidak ditemukan']);
            exit;
        }

        if (!empty($oldPass) && !password_verify($oldPass, $user['password_hash']) && $oldPass !== $user['password_hash']) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Kata sandi lama tidak cocok']);
            exit;
        }

        $newHash = password_hash($newPass, PASSWORD_BCRYPT);
        $upd = $pdo->prepare("UPDATE users SET password_hash = :h, must_change_password = 0, updated_at = :uat WHERE id = :id");
        $upd->execute([':h' => $newHash, ':uat' => date('c'), ':id' => $user['id']]);

        echo json_encode(['success' => true, 'message' => 'Kata sandi berhasil diperbarui']);
        break;

    case 'get_schools':
        $schStmt = $pdo->query("SELECT * FROM schools ORDER BY name ASC");
        $schools = $schStmt->fetchAll();
        echo json_encode(['success' => true, 'schools' => $schools]);
        break;

    case 'save_school':
        $authUser = getAuthUser($pdo, $inputData);
        if (!$authUser || $authUser['role'] !== 'super_admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Akses ditolak: Hanya Super Admin yang dapat mengelola data satuan sekolah']);
            exit;
        }

        $sid = trim($inputData['id'] ?? '');
        $oldId = trim($inputData['old_id'] ?? $sid);
        $code = trim($inputData['code'] ?? '');
        $name = trim($inputData['name'] ?? '');
        $npsn = trim($inputData['npsn'] ?? '');
        $pname = trim($inputData['principal_name'] ?? '');
        $pnip = trim($inputData['principal_nip'] ?? '');
        $ay = trim($inputData['academic_year'] ?? '2026/2027');
        $sem = trim($inputData['semester'] ?? 'Ganjil');
        $now = date('c');

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nama sekolah wajib diisi']);
            exit;
        }
        if (empty($sid)) {
            $stmtMax = $pdo->query("SELECT id FROM schools WHERE id LIKE 'SCH-%'");
            $maxNum = 0;
            while ($row = $stmtMax->fetch()) {
                if (preg_match('/^SCH-(\d+)$/i', $row['id'], $m)) {
                    $n = (int)$m[1];
                    if ($n > $maxNum) $maxNum = $n;
                }
            }
            $sid = sprintf("SCH-%03d", $maxNum + 1);
        }
        if (empty($code)) {
            $code = generateSchoolCode($name);
        }

        $chkCode = $pdo->prepare("SELECT id FROM schools WHERE code = :c AND id != :id AND id != :oldId");
        $chkCode->execute([':c' => $code, ':id' => $sid, ':oldId' => $oldId]);
        if ($chkCode->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Kode sekolah sudah digunakan']);
            exit;
        }

        $chk = $pdo->prepare("SELECT id, principal_name, principal_nip FROM schools WHERE id = :id");
        $chk->execute([':id' => $oldId]);
        $schoolExists = $chk->fetch();

        // If editing and principal fields were omitted (as modal has no principal inputs), preserve existing values
        if ($schoolExists) {
            if ($pname === '' && !empty($schoolExists['principal_name'])) {
                $pname = $schoolExists['principal_name'];
            }
            if ($pnip === '' && !empty($schoolExists['principal_nip'])) {
                $pnip = $schoolExists['principal_nip'];
            }
        }

        try {
            $pdo->beginTransaction();

            if ($schoolExists) {
                // If ID is changed, verify that the new ID is not already used by another school
                if (!empty($oldId) && $oldId !== $sid) {
                    $chkNew = $pdo->prepare("SELECT id FROM schools WHERE id = :id");
                    $chkNew->execute([':id' => $sid]);
                    if ($chkNew->fetch()) {
                        $pdo->rollBack();
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => "ID Satuan Pendidikan '$sid' sudah digunakan oleh sekolah lain"]);
                        exit;
                    }

                    // Cascade update to all dependent tables
                    $pdo->prepare("UPDATE users SET school_id = :nid WHERE school_id = :oid")->execute([':nid' => $sid, ':oid' => $oldId]);
                    $pdo->prepare("UPDATE observations SET school_id = :nid WHERE school_id = :oid")->execute([':nid' => $sid, ':oid' => $oldId]);
                    $pdo->prepare("UPDATE telaah_rpp SET school_id = :nid WHERE school_id = :oid")->execute([':nid' => $sid, ':oid' => $oldId]);
                    $pdo->prepare("UPDATE supervision_schedules SET school_id = :nid WHERE school_id = :oid")->execute([':nid' => $sid, ':oid' => $oldId]);
                    $pdo->prepare("UPDATE pengawas_schools SET school_id = :nid WHERE school_id = :oid")->execute([':nid' => $sid, ':oid' => $oldId]);
                    $pdo->prepare("UPDATE evaluasi SET school_id = :nid WHERE school_id = :oid")->execute([':nid' => $sid, ':oid' => $oldId]);
                    $pdo->prepare("UPDATE app_profile SET school_id = :nid WHERE school_id = :oid")->execute([':nid' => $sid, ':oid' => $oldId]);

                    $upd = $pdo->prepare("UPDATE schools SET id = :nid, code = :c, name = :n, npsn = :np, principal_name = :pn, principal_nip = :pni, academic_year = :ay, semester = :sem, updated_at = :uat WHERE id = :oid");
                    $upd->execute([':nid' => $sid, ':c' => $code, ':n' => $name, ':np' => $npsn, ':pn' => $pname, ':pni' => $pnip, ':ay' => $ay, ':sem' => $sem, ':uat' => $now, ':oid' => $oldId]);
                } else {
                    $upd = $pdo->prepare("UPDATE schools SET code = :c, name = :n, npsn = :np, principal_name = :pn, principal_nip = :pni, academic_year = :ay, semester = :sem, updated_at = :uat WHERE id = :id");
                    $upd->execute([':c' => $code, ':n' => $name, ':np' => $npsn, ':pn' => $pname, ':pni' => $pnip, ':ay' => $ay, ':sem' => $sem, ':uat' => $now, ':id' => $sid]);
                }
            } else {
                $ins = $pdo->prepare("INSERT INTO schools (id, code, name, npsn, principal_name, principal_nip, academic_year, semester, status, created_at, updated_at) VALUES (:id, :c, :n, :np, :pn, :pni, :ay, :sem, 'active', :cat, :uat)");
                $ins->execute([':id' => $sid, ':c' => $code, ':n' => $name, ':np' => $npsn, ':pn' => $pname, ':pni' => $pnip, ':ay' => $ay, ':sem' => $sem, ':cat' => $now, ':uat' => $now]);
            }

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Data sekolah berhasil disimpan', 'school_id' => $sid, 'code' => $code]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Gagal menyimpan data sekolah: ' . $e->getMessage()]);
        }
        break;

    case 'delete_school':
        $authUser = getAuthUser($pdo, $inputData);
        if (!$authUser || $authUser['role'] !== 'super_admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Akses ditolak: Hanya Super Admin yang dapat menghapus data satuan sekolah']);
            exit;
        }

        $sid = trim($inputData['id'] ?? $_GET['id'] ?? '');
        if (empty($sid)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID Sekolah wajib diisi']);
            exit;
        }

        // Must have at least 1 active school
        $countSchools = (int)$pdo->query("SELECT COUNT(*) FROM schools")->fetchColumn();
        if ($countSchools <= 1) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Tidak dapat menghapus sekolah: Sistem harus memiliki setidaknya satu (1) satuan pendidikan yang aktif']);
            exit;
        }

        $chk = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
        $chk->execute([':id' => $sid]);
        $school = $chk->fetch();
        if (!$school) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Data sekolah tidak ditemukan']);
            exit;
        }

        try {
            $pdo->beginTransaction();
            // Delete child operational data linked to this school
            $pdo->prepare("DELETE FROM observations WHERE school_id = :sid")->execute([':sid' => $sid]);
            $pdo->prepare("DELETE FROM telaah_rpp WHERE school_id = :sid")->execute([':sid' => $sid]);
            $pdo->prepare("DELETE FROM supervision_schedules WHERE school_id = :sid")->execute([':sid' => $sid]);
            $pdo->prepare("DELETE FROM pengawas_schools WHERE school_id = :sid")->execute([':sid' => $sid]);
            $pdo->prepare("DELETE FROM evaluasi WHERE school_id = :sid")->execute([':sid' => $sid]);
            $pdo->prepare("DELETE FROM app_profile WHERE school_id = :sid")->execute([':sid' => $sid]);

            // Delete users exclusively belonging to this school (exclude super_admin or pengawas)
            $pdo->prepare("DELETE FROM users WHERE school_id = :sid AND role NOT IN ('super_admin', 'pengawas')")->execute([':sid' => $sid]);

            // Delete school record
            $pdo->prepare("DELETE FROM schools WHERE id = :sid")->execute([':sid' => $sid]);

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => "Satuan sekolah {$school['name']} beserta seluruh data dan pengguna terkait berhasil dihapus"]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Gagal menghapus sekolah: ' . $e->getMessage()]);
        }
        break;

    case 'get_profile':
        $authUser = getAuthUser($pdo, $inputData);
        $reqUsername = trim($inputData['username'] ?? $_GET['username'] ?? $_POST['username'] ?? '');

        $uRow = null;
        if ($authUser) {
            $uRow = $authUser;
        } elseif (!empty($reqUsername)) {
            $uStmt = $pdo->prepare("SELECT * FROM users WHERE username = :u LIMIT 1");
            $uStmt->execute([':u' => $reqUsername]);
            $uRow = $uStmt->fetch();
            if ($uRow) {
                unset($uRow['password_hash']);
            }
        }

        $targetSchoolId = resolveActiveSchoolId($pdo, $inputData);
        if ($uRow && !empty($uRow['school_id'])) {
            $targetSchoolId = $uRow['school_id'];
        }
        if (empty($targetSchoolId) || $targetSchoolId === 'all') {
            $targetSchoolId = 'SCH-001';
        }

        // 1. Fetch School Data from MySQL
        $sStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        if (!$sRow) {
            $sStmt = $pdo->query("SELECT * FROM schools ORDER BY id ASC LIMIT 1");
            $sRow = $sStmt->fetch();
            if ($sRow) $targetSchoolId = $sRow['id'];
        }

        // 2. Fetch User Data from MySQL users table for this school if not identified yet
        if (!$uRow) {
            $uStmt = $pdo->prepare("SELECT * FROM users WHERE school_id = :sid AND role = 'kepala_sekolah' LIMIT 1");
            $uStmt->execute([':sid' => $targetSchoolId]);
            $uRow = $uStmt->fetch();
            if (!$uRow) {
                $uStmt = $pdo->prepare("SELECT * FROM users WHERE school_id = :sid ORDER BY (role = 'kepala_sekolah') DESC, id ASC LIMIT 1");
                $uStmt->execute([':sid' => $targetSchoolId]);
                $uRow = $uStmt->fetch();
            }
            if (!$uRow) {
                $uStmt = $pdo->query("SELECT * FROM users WHERE role = 'kepala_sekolah' ORDER BY id ASC LIMIT 1");
                $uRow = $uStmt->fetch();
            }
        }

        $empData = ($uRow && !empty($uRow['data_json'])) ? json_decode($uRow['data_json'], true) : [];

        // Derive clean first_name and last_name if empty but full_name is present
        $derivedFirst = !empty($uRow['first_name']) ? $uRow['first_name'] : ($empData['firstName'] ?? '');
        $derivedLast  = !empty($uRow['last_name']) ? $uRow['last_name'] : ($empData['lastName'] ?? '');
        $derivedPrefix = !empty($uRow['title_prefix']) ? $uRow['title_prefix'] : ($empData['titlePrefix'] ?? '');
        $derivedSuffix = !empty($uRow['title_suffix']) ? $uRow['title_suffix'] : ($empData['titleSuffix'] ?? '');
        $rawFullName = !empty($uRow['full_name']) ? $uRow['full_name'] : ($sRow['principal_name'] ?? '');

        if (empty($derivedFirst) && !empty($rawFullName)) {
            $cleanName = preg_replace('/^(Dr\.|Drs\.|Dra\.|Prof\.|H\.|Hj\.)\s+/i', '', $rawFullName);
            $cleanName = preg_replace('/,.*$/', '', $cleanName);
            $parts = explode(' ', trim($cleanName));
            $derivedFirst = $parts[0] ?? '';
            $derivedLast = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '';
        }

        // 3. Construct composite canonical profile strictly synced across users and schools
        $profile = [
            'schoolId'           => $targetSchoolId,
            'schoolCode'         => $sRow['code'] ?? ($uRow['access_code'] ?? ''),
            'schoolName'         => $sRow['name'] ?? ($uRow['department'] ?? ''),
            'npsn'               => $sRow['npsn'] ?? '',
            'titlePrefix'        => $derivedPrefix,
            'firstName'          => $derivedFirst,
            'lastName'           => $derivedLast,
            'titleSuffix'        => $derivedSuffix,
            'fullName'           => $rawFullName,
            'nickName'           => !empty($uRow['nickname']) ? $uRow['nickname'] : ($empData['nickname'] ?? ($empData['nickName'] ?? '')),
            'username'           => !empty($uRow['username']) ? $uRow['username'] : '',
            'email'              => !empty($uRow['email']) ? $uRow['email'] : ($empData['email'] ?? ($sRow['email'] ?? '')),
            'phone'              => !empty($uRow['phone']) ? $uRow['phone'] : ($empData['phone'] ?? ($sRow['phone'] ?? '')),
            'nip'                => !empty($uRow['nip']) ? $uRow['nip'] : ($sRow['principal_nip'] ?? ''),
            'nuptk'              => !empty($uRow['nuptk']) ? $uRow['nuptk'] : ($empData['nuptk'] ?? ''),
            'role'               => !empty($uRow['role']) ? ($uRow['role'] === 'kepala_sekolah' ? 'Kepala Sekolah SMP' : $uRow['role']) : 'Kepala Sekolah SMP',
            'status'             => !empty($uRow['status']) ? $uRow['status'] : 'active',
            'schoolAddress'      => !empty($sRow['address']) ? $sRow['address'] : ($uRow['address'] ?? ($empData['address'] ?? '')),
            'schoolEmail'        => !empty($sRow['email']) ? $sRow['email'] : '',
            'schoolPhone'        => !empty($sRow['phone']) ? $sRow['phone'] : '',
            'academicYear'                  => !empty($sRow['academic_year']) ? $sRow['academic_year'] : '2026/2027',
            'semester'                      => !empty($sRow['semester']) ? $sRow['semester'] : 'Ganjil',
            'modulAjarFolderUrl'            => $sRow['modul_ajar_folder_url'] ?? '',
            'dokumentasiObservasiFolderUrl' => $sRow['doc_observasi_folder_url'] ?? '',
            'dokumentasiPascaFolderUrl'     => $sRow['doc_pasca_folder_url'] ?? '',
            'avatarUrl'                     => $uRow['avatar_url'] ?? ($empData['photo'] ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250')
        ];

        // Merge extra properties from profile_json if present
        if ($sRow && !empty($sRow['profile_json'])) {
            $pj = json_decode($sRow['profile_json'], true) ?: [];
            if (is_array($pj)) {
                foreach ($pj as $k => $v) {
                    if ((empty($profile[$k]) || $profile[$k] === '-') && !empty($v)) {
                        $profile[$k] = $v;
                    }
                }
                if (empty($profile['schoolAddress']) && !empty($pj['schoolAddress'])) $profile['schoolAddress'] = $pj['schoolAddress'];
                if (empty($profile['schoolEmail']) && !empty($pj['schoolEmail'])) $profile['schoolEmail'] = $pj['schoolEmail'];
                if (empty($profile['schoolPhone']) && !empty($pj['schoolPhone'])) $profile['schoolPhone'] = $pj['schoolPhone'];
                if (empty($profile['nickName']) && !empty($pj['nickName'])) $profile['nickName'] = $pj['nickName'];
                if (empty($profile['modulAjarFolderUrl']) && !empty($pj['modulAjarFolderUrl'])) $profile['modulAjarFolderUrl'] = $pj['modulAjarFolderUrl'];
                if (empty($profile['dokumentasiObservasiFolderUrl']) && !empty($pj['dokumentasiObservasiFolderUrl'])) $profile['dokumentasiObservasiFolderUrl'] = $pj['dokumentasiObservasiFolderUrl'];
                if (empty($profile['dokumentasiPascaFolderUrl']) && !empty($pj['dokumentasiPascaFolderUrl'])) $profile['dokumentasiPascaFolderUrl'] = $pj['dokumentasiPascaFolderUrl'];
            }
        }

        echo json_encode([
            'success'    => true,
            'profile'    => $profile,
            'school_id'  => $targetSchoolId,
            'updated_at' => $sRow['updated_at'] ?? date('c')
        ]);
        break;

    case 'save_profile':
        if (empty($inputData)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Data profil kosong']);
            exit;
        }

        $targetSchoolId = resolveActiveSchoolId($pdo, $inputData);
        if (empty($targetSchoolId) || $targetSchoolId === 'all') {
            $targetSchoolId = 'SCH-001';
        }
        $now = date('c');

        // Extract input values
        $username      = trim($inputData['username'] ?? '');
        $status        = trim($inputData['status'] ?? 'active');
        $titlePrefix   = trim($inputData['titlePrefix'] ?? $inputData['title_prefix'] ?? '');
        $firstName     = trim($inputData['firstName'] ?? $inputData['first_name'] ?? '');
        $lastName      = trim($inputData['lastName'] ?? $inputData['last_name'] ?? '');
        $titleSuffix   = trim($inputData['titleSuffix'] ?? $inputData['title_suffix'] ?? '');
        $fullName      = trim($inputData['fullName'] ?? $inputData['full_name'] ?? '');
        $nickName      = trim($inputData['nickName'] ?? $inputData['nickname'] ?? '');
        $email         = trim($inputData['email'] ?? '');
        $phone         = trim($inputData['phone'] ?? '');
        $nip           = trim($inputData['nip'] ?? '');
        $nuptk         = trim($inputData['nuptk'] ?? '');
        $password      = trim($inputData['password'] ?? '');

        // Compose full name if empty
        if (empty($fullName) && (!empty($firstName) || !empty($lastName))) {
            $pfx = !empty($titlePrefix) ? $titlePrefix . ' ' : '';
            $sfx = !empty($titleSuffix) ? ', ' . $titleSuffix : '';
            $fullName = $pfx . trim("$firstName $lastName") . $sfx;
        }

        // Load existing school record to merge non-overridden values
        $sExStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :sid LIMIT 1");
        $sExStmt->execute([':sid' => $targetSchoolId]);
        $sExRow = $sExStmt->fetch() ?: [];

        // School Fields
        $schoolName    = trim($inputData['schoolName'] ?? $inputData['school_name'] ?? ($sExRow['name'] ?? 'SMP Brighton'));
        $npsn          = trim($inputData['npsn'] ?? ($sExRow['npsn'] ?? ''));
        $schoolCode    = trim($inputData['schoolCode'] ?? $inputData['school_code'] ?? ($sExRow['code'] ?? 'BRI-TF8U'));
        $schoolAddress = trim($inputData['schoolAddress'] ?? $inputData['school_address'] ?? $inputData['address'] ?? ($sExRow['address'] ?? ''));
        $schoolEmail   = trim($inputData['schoolEmail'] ?? $inputData['school_email'] ?? ($sExRow['email'] ?? ''));
        $schoolPhone   = trim($inputData['schoolPhone'] ?? $inputData['school_phone'] ?? ($sExRow['phone'] ?? ''));
        $academicYear  = trim($inputData['academicYear'] ?? $inputData['academic_year'] ?? ($sExRow['academic_year'] ?? '2026/2027'));
        $semester      = trim($inputData['semester'] ?? ($sExRow['semester'] ?? 'Ganjil'));
        $modulAjarFolder = trim($inputData['modulAjarFolderUrl'] ?? $inputData['modul_ajar_folder_url'] ?? ($sExRow['modul_ajar_folder_url'] ?? ''));
        $docObsFolder    = trim($inputData['dokumentasiObservasiFolderUrl'] ?? $inputData['doc_observasi_folder_url'] ?? ($sExRow['doc_observasi_folder_url'] ?? ''));
        $docPascaFolder  = trim($inputData['dokumentasiPascaFolderUrl'] ?? $inputData['doc_pasca_folder_url'] ?? ($sExRow['doc_pasca_folder_url'] ?? ''));
        $avatarUrl     = trim($inputData['avatarUrl'] ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250');

        if (empty($fullName) && !empty($sExRow['principal_name'])) {
            $fullName = $sExRow['principal_name'];
        }
        if (empty($nip) && !empty($sExRow['principal_nip'])) {
            $nip = $sExRow['principal_nip'];
        }

        // Canonical Profile for schools.profile_json
        $canonicalProfile = [
            'schoolId'                      => $targetSchoolId,
            'schoolCode'                    => $schoolCode,
            'schoolName'                    => $schoolName,
            'npsn'                          => $npsn,
            'titlePrefix'                   => $titlePrefix,
            'firstName'                     => $firstName,
            'lastName'                      => $lastName,
            'titleSuffix'                   => $titleSuffix,
            'fullName'                      => $fullName,
            'nickName'                      => $nickName,
            'username'                      => $username,
            'email'                         => $email,
            'phone'                         => $phone,
            'nip'                           => $nip,
            'nuptk'                         => $nuptk,
            'role'                          => 'Kepala Sekolah SMP',
            'status'                        => $status,
            'schoolAddress'                 => $schoolAddress,
            'schoolEmail'                   => $schoolEmail,
            'schoolPhone'                   => $schoolPhone,
            'academicYear'                  => $academicYear,
            'semester'                      => $semester,
            'modulAjarFolderUrl'            => $modulAjarFolder,
            'dokumentasiObservasiFolderUrl' => $docObsFolder,
            'dokumentasiPascaFolderUrl'     => $docPascaFolder,
            'avatarUrl'                     => $avatarUrl
        ];
        $profileJson = json_encode($canonicalProfile, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        // 1. UPDATE schools TABLE in MySQL (Ground truth for Satuan Sekolah)
        $updSch = $pdo->prepare("
            UPDATE schools SET 
                name = :name,
                code = :code,
                npsn = :npsn,
                principal_name = :pname,
                principal_nip = :pnip,
                address = :addr,
                email = :em,
                phone = :ph,
                academic_year = :ay,
                semester = :sem,
                modul_ajar_folder_url = :mf,
                doc_observasi_folder_url = :dof,
                doc_pasca_folder_url = :dpf,
                profile_json = :pj,
                updated_at = :uat
            WHERE id = :sid
        ");
        $updSch->execute([
            ':name'  => $schoolName,
            ':code'  => $schoolCode,
            ':npsn'  => $npsn,
            ':pname' => $fullName,
            ':pnip'  => $nip,
            ':addr'  => $schoolAddress,
            ':em'    => $schoolEmail,
            ':ph'    => $schoolPhone,
            ':ay'    => $academicYear,
            ':sem'   => $semester,
            ':mf'    => $modulAjarFolder,
            ':dof'   => $docObsFolder,
            ':dpf'   => $docPascaFolder,
            ':pj'    => $profileJson,
            ':uat'   => $now,
            ':sid'   => $targetSchoolId
        ]);

        // 2. UPDATE OR INSERT users TABLE for Kepala Sekolah or Authenticated User
        $authUser = getAuthUser($pdo, $inputData);
        $uRow = null;

        if ($authUser) {
            $uStmt = $pdo->prepare("
                SELECT id, employee_id, username, password_hash, gender, employment_status, join_date, subject, task, education 
                FROM users 
                WHERE id = :uid LIMIT 1
            ");
            $uStmt->execute([':uid' => $authUser['id']]);
            $uRow = $uStmt->fetch();
        }

        if (!$uRow && !empty($username)) {
            $uStmt = $pdo->prepare("
                SELECT id, employee_id, username, password_hash, gender, employment_status, join_date, subject, task, education 
                FROM users 
                WHERE username = :u LIMIT 1
            ");
            $uStmt->execute([':u' => $username]);
            $uRow = $uStmt->fetch();
        }

        if (!$uRow) {
            $uStmt = $pdo->prepare("
                SELECT id, employee_id, username, password_hash, gender, employment_status, join_date, subject, task, education 
                FROM users 
                WHERE (school_id = :sid AND role = 'kepala_sekolah') OR (school_id = :sid) 
                ORDER BY (role = 'kepala_sekolah') DESC, id ASC LIMIT 1
            ");
            $uStmt->execute([':sid' => $targetSchoolId]);
            $uRow = $uStmt->fetch();
        }

        $userId = $uRow ? $uRow['id'] : ('usr-ks-' . substr($targetSchoolId, 4));
        $empId  = $uRow ? (!empty($uRow['employee_id']) ? $uRow['employee_id'] : 'EMP-001') : 'EMP-001';
        if (empty($username)) {
            $username = $uRow ? $uRow['username'] : ($authUser ? $authUser['username'] : 'kepalasekolah');
        }

        // Build data_json so /karyawan/ formatUserAsEmployee gets 100% synchronized data
        $ksEmpData = [
            'id'               => $empId,
            'userId'           => $userId,
            'name'             => $fullName,
            'titlePrefix'      => $titlePrefix,
            'firstName'        => $firstName,
            'lastName'         => $lastName,
            'titleSuffix'      => $titleSuffix,
            'nickname'         => $nickName,
            'gender'           => $uRow['gender'] ?? 'Laki-laki',
            'role'             => 'Kepala Sekolah',
            'department'       => $schoolName,
            'employmentStatus' => $uRow['employment_status'] ?? 'PNS',
            'joinDate'         => $uRow['join_date'] ?? '2015-08-01',
            'nip'              => $nip,
            'nuptk'            => $nuptk,
            'subject'          => $uRow['subject'] ?? 'Manajemen Kepemimpinan Sekolah',
            'task'             => $uRow['task'] ?? 'Penanggung Jawab Utama & Supervisi Manajerial',
            'email'            => $email,
            'phone'            => $phone,
            'education'        => $uRow['education'] ?? 'S2 Magister Manajemen Pendidikan',
            'address'          => $schoolAddress,
            'status'           => $status === 'inactive' ? 'Nonaktif' : 'Aktif',
            'photo'            => $avatarUrl,
            'accessCode'       => $schoolCode,
            'username'         => $username,
            'school_id'        => $targetSchoolId
        ];
        $dataJsonStr = json_encode($ksEmpData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $passSql = "";
        $userParams = [
            ':u'     => $username,
            ':em'    => $email,
            ':fn'    => $fullName,
            ':tp'    => $titlePrefix,
            ':fnm'   => $firstName,
            ':lnm'   => $lastName,
            ':ts'    => $titleSuffix,
            ':nn'    => $nickName,
            ':nip'   => $nip,
            ':nuptk' => $nuptk,
            ':ph'    => $phone,
            ':addr'  => $schoolAddress,
            ':ac'    => $schoolCode,
            ':dept'  => $schoolName,
            ':av'    => $avatarUrl,
            ':st'    => $status,
            ':dj'    => $dataJsonStr,
            ':uat'   => $now,
            ':id'    => $userId
        ];
        if (!empty($password)) {
            $passSql = ", password_hash = :phash";
            $userParams[':phash'] = password_hash($password, PASSWORD_BCRYPT);
        }

        if ($uRow) {
            $updUsr = $pdo->prepare("
                UPDATE users SET 
                    username = :u, email = :em, full_name = :fn,
                    title_prefix = :tp, first_name = :fnm, last_name = :lnm,
                    title_suffix = :ts, nickname = :nn, nip = :nip,
                    nuptk = :nuptk, phone = :ph, address = :addr,
                    access_code = :ac, department = :dept, avatar_url = :av,
                    status = :st, data_json = :dj $passSql,
                    updated_at = :uat
                WHERE id = :id
            ");
            $updUsr->execute($userParams);
        } else {
            $insUsr = $pdo->prepare("
                INSERT INTO users (
                    id, username, email, password_hash, full_name,
                    title_prefix, first_name, last_name, title_suffix, nickname,
                    role, school_id, employee_id, nip, nuptk, phone,
                    address, access_code, department, avatar_url, status, data_json, created_at, updated_at
                ) VALUES (
                    :id, :u, :em, :phash, :fn,
                    :tp, :fnm, :lnm, :ts, :nn,
                    'kepala_sekolah', :sid, :empid, :nip, :nuptk, :ph,
                    :addr, :ac, :dept, :av, :st, :dj, :now, :now
                )
            ");
            $insUsr->execute([
                ':id'    => $userId,
                ':u'     => $username,
                ':em'    => $email,
                ':phash' => !empty($password) ? password_hash($password, PASSWORD_BCRYPT) : password_hash('kepalasekolah', PASSWORD_BCRYPT),
                ':fn'    => $fullName,
                ':tp'    => $titlePrefix,
                ':fnm'   => $firstName,
                ':lnm'   => $lastName,
                ':ts'    => $titleSuffix,
                ':nn'    => $nickName,
                ':sid'   => $targetSchoolId,
                ':empid' => $empId,
                ':nip'   => $nip,
                ':nuptk' => $nuptk,
                ':ph'    => $phone,
                ':addr'  => $schoolAddress,
                ':ac'    => $schoolCode,
                ':dept'  => $schoolName,
                ':av'    => $avatarUrl,
                ':st'    => $status,
                ':dj'    => $dataJsonStr,
                ':now'   => $now
            ]);
        }

        // 3. UPDATE app_profile table (id=1)
        try {
            $pdo->prepare("
                INSERT INTO app_profile (id, profile_json, updated_at)
                VALUES (1, :pj, :now)
                ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), updated_at = VALUES(updated_at)
            ")->execute([':pj' => $profileJson, ':now' => $now]);
        } catch (Exception $eP) {}

        echo json_encode([
            'success'    => true,
            'message'    => 'Data profil pokok kepala sekolah dan identitas sekolah berhasil disimpan ke database MySQL',
            'profile'    => $canonicalProfile,
            'school_id'  => $targetSchoolId,
            'updated_at' => $now
        ]);
        break;

    case 'bootstrap':
    case 'get_all':
        $targetSchoolId = resolveActiveSchoolId($pdo, $inputData);

        // Load School Profile
        $sStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $profile = ($sRow && !empty($sRow['profile_json'])) ? json_decode($sRow['profile_json'], true) : [];
        if (empty($profile) && $targetSchoolId === 'SCH-001') {
            $pStmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
            $profile = json_decode($pStmt->fetchColumn() ?: '{}', true);
        }
        if ($profile) {
            $profile['schoolId'] = $targetSchoolId;
            if ($sRow && !empty($sRow['code']))           $profile['schoolCode']  = $sRow['code'];
            if ($sRow && !empty($sRow['name']))           $profile['schoolName']  = $sRow['name'];
            if ($sRow && !empty($sRow['principal_name'])) $profile['fullName']    = $sRow['principal_name'];
            if ($sRow && !empty($sRow['principal_nip']))  $profile['nip']         = $sRow['principal_nip'];
            if ($sRow && !empty($sRow['academic_year']))  $profile['academicYear'] = $sRow['academic_year'];
            if ($sRow && !empty($sRow['semester']))       $profile['semester']    = $sRow['semester'];
            // Strip credentials
            unset($profile['password']);
        }

        // Active running cycle of this school (satuan siklus supervisi)
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        // Filter cycle: defaults to running cycle unless explicit cycle parameter or all_cycles is requested
        $reqYear = $_GET['academic_year'] ?? $inputData['academic_year'] ?? $runningYear;
        $reqSemester = $_GET['semester'] ?? $inputData['semester'] ?? $runningSemester;
        $allCycles = (!empty($_GET['all_cycles']) || $reqYear === 'all');

        // Load Employees scoped to this school directly from users table
        $tenantCondUsers = getTenantSchoolCondition($targetSchoolId, 'school_id');
        $eStmt = $pdo->prepare("SELECT * FROM users WHERE $tenantCondUsers AND role IN ('guru', 'guru_bk', 'staff', 'kepala_sekolah') ORDER BY full_name ASC");
        $eStmt->execute([':sid' => $targetSchoolId]);
        $employees = [];
        while ($row = $eStmt->fetch(PDO::FETCH_ASSOC)) {
            $emp = formatUserAsEmployee($row);
            if ($emp) $employees[] = $emp;
        }

        // Load Observations scoped to this school AND cycle
        $tenantCondObs = getTenantSchoolCondition($targetSchoolId);
        if ($allCycles) {
            $oStmt = $pdo->prepare("SELECT data_json FROM observations WHERE $tenantCondObs ORDER BY updated_at DESC");
            $oStmt->execute([':sid' => $targetSchoolId]);
        } else {
            $oStmt = $pdo->prepare("SELECT data_json FROM observations WHERE $tenantCondObs AND academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
            $oStmt->execute([':sid' => $targetSchoolId, ':ay' => $reqYear, ':sem' => $reqSemester]);
        }
        $observations = [];
        while ($row = $oStmt->fetch()) {
            $observations[] = json_decode($row['data_json'], true);
        }

        // Load Telaah RPP scoped to this school AND cycle
        if ($allCycles) {
            $tStmt = $pdo->prepare("SELECT data_json FROM telaah_rpp WHERE $tenantCondObs ORDER BY updated_at DESC");
            $tStmt->execute([':sid' => $targetSchoolId]);
        } else {
            $tStmt = $pdo->prepare("SELECT data_json FROM telaah_rpp WHERE $tenantCondObs AND academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
            $tStmt->execute([':sid' => $targetSchoolId, ':ay' => $reqYear, ':sem' => $reqSemester]);
        }
        $telaah = [];
        while ($row = $tStmt->fetch()) {
            $telaah[] = json_decode($row['data_json'], true);
        }

        // Load Schedules scoped to this school AND cycle
        if ($allCycles) {
            $schStmt = $pdo->prepare("SELECT data_json FROM supervision_schedules WHERE $tenantCondObs ORDER BY rpp_date ASC");
            $schStmt->execute([':sid' => $targetSchoolId]);
        } else {
            $schStmt = $pdo->prepare("SELECT data_json FROM supervision_schedules WHERE $tenantCondObs AND academic_year = :ay AND semester = :sem ORDER BY rpp_date ASC");
            $schStmt->execute([':sid' => $targetSchoolId, ':ay' => $reqYear, ':sem' => $reqSemester]);
        }
        $schedules = [];
        while ($row = $schStmt->fetch()) {
            $schedules[] = json_decode($row['data_json'], true);
        }

        // Distinct available cycles across database for this school
        $cyclesMap = [];
        $cyclesMap["{$runningYear}-{$runningSemester}"] = ['academic_year' => $runningYear, 'semester' => $runningSemester, 'is_running' => true];
        $cyStmt = $pdo->prepare("
            SELECT DISTINCT academic_year, semester FROM observations WHERE $tenantCondObs AND academic_year != ''
            UNION
            SELECT DISTINCT academic_year, semester FROM telaah_rpp WHERE $tenantCondObs AND academic_year != ''
            UNION
            SELECT DISTINCT academic_year, semester FROM supervision_schedules WHERE $tenantCondObs AND academic_year != ''
        ");
        $cyStmt->execute([':sid' => $targetSchoolId]);
        while ($cy = $cyStmt->fetch(PDO::FETCH_ASSOC)) {
            $k = "{$cy['academic_year']}-{$cy['semester']}";
            if (!isset($cyclesMap[$k])) {
                $cyclesMap[$k] = [
                    'academic_year' => $cy['academic_year'],
                    'semester' => $cy['semester'],
                    'is_running' => ($cy['academic_year'] === $runningYear && $cy['semester'] === $runningSemester)
                ];
            }
        }
        $availableCycles = array_values($cyclesMap);

        // Load Settings
        $sStmt = $pdo->query("SELECT setting_key, setting_value FROM app_settings");
        $settings = [];
        while ($row = $sStmt->fetch()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        echo json_encode([
            'success' => true,
            'school_id' => $targetSchoolId,
            'database' => 'MySQL (supervisisekolah_id)',
            'database_name' => 'supervisisekolah_id',
            'running_cycle' => [
                'academic_year' => $runningYear,
                'semester' => $runningSemester
            ],
            'active_cycle' => [
                'academic_year' => $reqYear,
                'semester' => $reqSemester
            ],
            'available_cycles' => $availableCycles,
            'profile' => $profile,
            'settings' => $settings,
            'employees' => $employees,
            'observations' => $observations,
            'telaah_rpp' => $telaah,
            'schedules' => $schedules
        ]);
        break;

    case 'get_observations':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $reqSchool = $_GET['school_id'] ?? $inputData['school_id'] ?? null;
        $authUser = getAuthUser($pdo, $inputData);

        if ($authUser && $authUser['role'] === 'kepala_sekolah') {
            $targetSchoolId = $authUser['school_id'] ?: 'SCH-001';
            $reqSchool = $targetSchoolId;
        }

        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $reqYear = $_GET['academic_year'] ?? $inputData['academic_year'] ?? $runningYear;
        $reqSemester = $_GET['semester'] ?? $inputData['semester'] ?? $runningSemester;
        $allCycles = (!empty($_GET['all_cycles']) || $reqYear === 'all');

        if ($reqSchool === 'all' && $authUser && $authUser['role'] === 'super_admin') {
            if ($allCycles) {
                $oStmt = $pdo->query("SELECT data_json FROM observations ORDER BY updated_at DESC");
            } else {
                $oStmt = $pdo->prepare("SELECT data_json FROM observations WHERE academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
                $oStmt->execute([':ay' => $reqYear, ':sem' => $reqSemester]);
            }
        } else {
            $tenantCond = getTenantSchoolCondition($targetSchoolId);
            if ($allCycles) {
                $oStmt = $pdo->prepare("SELECT data_json FROM observations WHERE $tenantCond ORDER BY updated_at DESC");
                $oStmt->execute([':sid' => $targetSchoolId]);
            } else {
                $oStmt = $pdo->prepare("SELECT data_json FROM observations WHERE $tenantCond AND academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
                $oStmt->execute([':sid' => $targetSchoolId, ':ay' => $reqYear, ':sem' => $reqSemester]);
            }
        }
        $observations = [];
        while ($row = $oStmt->fetch()) {
            $observations[] = json_decode($row['data_json'], true);
        }
        echo json_encode([
            'success' => true,
            'observations' => $observations,
            'school_id' => $targetSchoolId,
            'running_cycle' => ['academic_year' => $runningYear, 'semester' => $runningSemester],
            'cycle' => ['academic_year' => $reqYear, 'semester' => $reqSemester],
            'count' => count($observations)
        ]);
        break;

    case 'get_telaah_rpp':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $reqSchool = $_GET['school_id'] ?? $inputData['school_id'] ?? null;
        $authUser = getAuthUser($pdo, $inputData);

        if ($authUser && $authUser['role'] === 'kepala_sekolah') {
            $targetSchoolId = $authUser['school_id'] ?: 'SCH-001';
            $reqSchool = $targetSchoolId;
        }

        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $reqYear = $_GET['academic_year'] ?? $inputData['academic_year'] ?? $runningYear;
        $reqSemester = $_GET['semester'] ?? $inputData['semester'] ?? $runningSemester;
        $allCycles = (!empty($_GET['all_cycles']) || $reqYear === 'all');

        if ($reqSchool === 'all' && $authUser && $authUser['role'] === 'super_admin') {
            if ($allCycles) {
                $tStmt = $pdo->query("SELECT data_json FROM telaah_rpp ORDER BY updated_at DESC");
            } else {
                $tStmt = $pdo->prepare("SELECT data_json FROM telaah_rpp WHERE academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
                $tStmt->execute([':ay' => $reqYear, ':sem' => $reqSemester]);
            }
        } else {
            $tenantCond = getTenantSchoolCondition($targetSchoolId);
            if ($allCycles) {
                $tStmt = $pdo->prepare("SELECT data_json FROM telaah_rpp WHERE $tenantCond ORDER BY updated_at DESC");
                $tStmt->execute([':sid' => $targetSchoolId]);
            } else {
                $tStmt = $pdo->prepare("SELECT data_json FROM telaah_rpp WHERE $tenantCond AND academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
                $tStmt->execute([':sid' => $targetSchoolId, ':ay' => $reqYear, ':sem' => $reqSemester]);
            }
        }
        $telaah = [];
        while ($row = $tStmt->fetch()) {
            $telaah[] = json_decode($row['data_json'], true);
        }
        echo json_encode([
            'success' => true,
            'telaah_rpp' => $telaah,
            'school_id' => $targetSchoolId,
            'running_cycle' => ['academic_year' => $runningYear, 'semester' => $runningSemester],
            'cycle' => ['academic_year' => $reqYear, 'semester' => $reqSemester],
            'count' => count($telaah)
        ]);
        break;

    case 'save_observation':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        if (empty($inputData['id'])) {
            $inputData['id'] = 'OBS-' . time();
        }
        $id = $inputData['id'];
        $inputData['school_id'] = $targetSchoolId;

        // Auto default to school's active cycle if not set
        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $teacherName = $inputData['teacherName'] ?? '';
        $subject = $inputData['subject'] ?? '';
        $academicYear = !empty($inputData['academicYear']) ? $inputData['academicYear'] : $runningYear;
        $semester = !empty($inputData['semester']) ? $inputData['semester'] : $runningSemester;
        $inputData['academicYear'] = $academicYear;
        $inputData['semester'] = $semester;

        $jsonStr = json_encode($inputData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = date('c');

        $stmt = $pdo->prepare("
            INSERT INTO observations (id, school_id, teacher_name, subject, academic_year, semester, data_json, updated_at)
            VALUES (:id, :sid, :teacher, :subject, :year, :semester, :json, :now)
            ON DUPLICATE KEY UPDATE 
                school_id = VALUES(school_id),
                teacher_name = VALUES(teacher_name),
                subject = VALUES(subject),
                academic_year = VALUES(academic_year),
                semester = VALUES(semester),
                data_json = VALUES(data_json),
                updated_at = VALUES(updated_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':sid' => $targetSchoolId,
            ':teacher' => $teacherName,
            ':subject' => $subject,
            ':year' => $academicYear,
            ':semester' => $semester,
            ':json' => $jsonStr,
            ':now' => $now
        ]);

        echo json_encode([
            'success' => true,
            'id' => $id,
            'observation' => $inputData,
            'school_id' => $targetSchoolId,
            'cycle' => ['academic_year' => $academicYear, 'semester' => $semester]
        ]);
        break;

    case 'delete_observation':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $authUser = getAuthUser($pdo, $inputData);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($id) {
            if ($authUser && $authUser['role'] === 'super_admin') {
                $stmt = $pdo->prepare("DELETE FROM observations WHERE id = :id");
                $stmt->execute([':id' => $id]);
            } else {
                $stmt = $pdo->prepare("DELETE FROM observations WHERE id = :id AND school_id = :sid");
                $stmt->execute([':id' => $id, ':sid' => $targetSchoolId]);
                if ($stmt->rowCount() === 0) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Data observasi tidak ditemukan pada sekolah Anda']);
                    exit;
                }
            }
        }
        echo json_encode(['success' => true, 'deleted_id' => $id]);
        break;

    case 'save_all_observations':
        if (is_array($inputData)) {
            $now = date('c');
            $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("
                INSERT INTO observations (id, school_id, teacher_name, subject, academic_year, semester, data_json, updated_at)
                VALUES (:id, :sid, :teacher, :subject, :year, :semester, :json, :now)
                ON DUPLICATE KEY UPDATE 
                    school_id = VALUES(school_id),
                    teacher_name = VALUES(teacher_name),
                    subject = VALUES(subject),
                    academic_year = VALUES(academic_year),
                    semester = VALUES(semester),
                    data_json = VALUES(data_json),
                    updated_at = VALUES(updated_at)
            ");
            foreach ($inputData as $item) {
                if (!empty($item['id'])) {
                    $item['school_id'] = $targetSchoolId;
                    $stmt->execute([
                        ':id' => $item['id'],
                        ':sid' => $targetSchoolId,
                        ':teacher' => $item['teacherName'] ?? '',
                        ':subject' => $item['subject'] ?? '',
                        ':year' => $item['academicYear'] ?? '',
                        ':semester' => $item['semester'] ?? '',
                        ':json' => json_encode($item, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        ':now' => $now
                    ]);
                }
            }
            $pdo->commit();
        }
        echo json_encode(['success' => true, 'count' => count($inputData)]);
        break;

    case 'save_telaah_rpp':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        if (empty($inputData['id'])) {
            $inputData['id'] = 'RPP-' . time();
        }
        $id = $inputData['id'];
        $inputData['school_id'] = $targetSchoolId;

        // Auto default to school's active cycle if not set
        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $teacherName = $inputData['teacherName'] ?? '';
        $subject = $inputData['subject'] ?? '';
        $academicYear = !empty($inputData['academicYear']) ? $inputData['academicYear'] : $runningYear;
        $semester = !empty($inputData['semester']) ? $inputData['semester'] : $runningSemester;
        $inputData['academicYear'] = $academicYear;
        $inputData['semester'] = $semester;

        $jsonStr = json_encode($inputData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = date('c');

        $stmt = $pdo->prepare("
            INSERT INTO telaah_rpp (id, school_id, teacher_name, subject, academic_year, semester, data_json, updated_at)
            VALUES (:id, :sid, :teacher, :subject, :year, :semester, :json, :now)
            ON DUPLICATE KEY UPDATE 
                school_id = VALUES(school_id),
                teacher_name = VALUES(teacher_name),
                subject = VALUES(subject),
                academic_year = VALUES(academic_year),
                semester = VALUES(semester),
                data_json = VALUES(data_json),
                updated_at = VALUES(updated_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':sid' => $targetSchoolId,
            ':teacher' => $teacherName,
            ':subject' => $subject,
            ':year' => $academicYear,
            ':semester' => $semester,
            ':json' => $jsonStr,
            ':now' => $now
        ]);

        echo json_encode([
            'success' => true,
            'id' => $id,
            'telaah_rpp' => $inputData,
            'school_id' => $targetSchoolId,
            'cycle' => ['academic_year' => $academicYear, 'semester' => $semester]
        ]);
        break;

    case 'delete_telaah_rpp':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $authUser = getAuthUser($pdo, $inputData);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($id) {
            if ($authUser && $authUser['role'] === 'super_admin') {
                $stmt = $pdo->prepare("DELETE FROM telaah_rpp WHERE id = :id");
                $stmt->execute([':id' => $id]);
            } else {
                $stmt = $pdo->prepare("DELETE FROM telaah_rpp WHERE id = :id AND school_id = :sid");
                $stmt->execute([':id' => $id, ':sid' => $targetSchoolId]);
                if ($stmt->rowCount() === 0) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Data telaah RPP tidak ditemukan pada sekolah Anda']);
                    exit;
                }
            }
        }
        echo json_encode(['success' => true, 'deleted_id' => $id]);
        break;

    case 'save_all_telaah_rpp':
        if (is_array($inputData)) {
            $now = date('c');
            $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("
                INSERT INTO telaah_rpp (id, school_id, teacher_name, subject, academic_year, semester, data_json, updated_at)
                VALUES (:id, :sid, :teacher, :subject, :year, :semester, :json, :now)
                ON DUPLICATE KEY UPDATE 
                    school_id = VALUES(school_id),
                    teacher_name = VALUES(teacher_name),
                    subject = VALUES(subject),
                    academic_year = VALUES(academic_year),
                    semester = VALUES(semester),
                    data_json = VALUES(data_json),
                    updated_at = VALUES(updated_at)
            ");
            foreach ($inputData as $item) {
                if (!empty($item['id'])) {
                    $item['school_id'] = $targetSchoolId;
                    $stmt->execute([
                        ':id' => $item['id'],
                        ':sid' => $targetSchoolId,
                        ':teacher' => $item['teacherName'] ?? '',
                        ':subject' => $item['subject'] ?? '',
                        ':year' => $item['academicYear'] ?? '',
                        ':semester' => $item['semester'] ?? '',
                        ':json' => json_encode($item, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        ':now' => $now
                    ]);
                }
            }
            $pdo->commit();
        }
        echo json_encode(['success' => true, 'count' => count($inputData)]);
        break;

    case 'get_supervisi_bk':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $reqSchool = $_GET['school_id'] ?? $inputData['school_id'] ?? null;
        $authUser = getAuthUser($pdo, $inputData);

        if ($authUser && $authUser['role'] === 'kepala_sekolah') {
            $targetSchoolId = $authUser['school_id'] ?: 'SCH-001';
            $reqSchool = $targetSchoolId;
        }

        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $reqYear = $_GET['academic_year'] ?? $inputData['academic_year'] ?? $runningYear;
        $reqSemester = $_GET['semester'] ?? $inputData['semester'] ?? $runningSemester;
        $allCycles = (!empty($_GET['all_cycles']) || $reqYear === 'all');

        if ($reqSchool === 'all' && $authUser && $authUser['role'] === 'super_admin') {
            if ($allCycles) {
                $bkStmt = $pdo->query("SELECT data_json FROM supervisi_bk ORDER BY updated_at DESC");
            } else {
                $bkStmt = $pdo->prepare("SELECT data_json FROM supervisi_bk WHERE academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
                $bkStmt->execute([':ay' => $reqYear, ':sem' => $reqSemester]);
            }
        } else {
            $tenantCond = getTenantSchoolCondition($targetSchoolId);
            if ($allCycles) {
                $bkStmt = $pdo->prepare("SELECT data_json FROM supervisi_bk WHERE $tenantCond ORDER BY updated_at DESC");
                $bkStmt->execute([':sid' => $targetSchoolId]);
            } else {
                $bkStmt = $pdo->prepare("SELECT data_json FROM supervisi_bk WHERE $tenantCond AND academic_year = :ay AND semester = :sem ORDER BY updated_at DESC");
                $bkStmt->execute([':sid' => $targetSchoolId, ':ay' => $reqYear, ':sem' => $reqSemester]);
            }
        }
        $records = [];
        while ($row = $bkStmt->fetch()) {
            $records[] = json_decode($row['data_json'], true);
        }
        echo json_encode([
            'success' => true,
            'supervisi_bk' => $records,
            'school_id' => $targetSchoolId,
            'running_cycle' => ['academic_year' => $runningYear, 'semester' => $runningSemester],
            'cycle' => ['academic_year' => $reqYear, 'semester' => $reqSemester],
            'count' => count($records)
        ]);
        break;

    case 'save_supervisi_bk':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        if (empty($inputData['id'])) {
            $inputData['id'] = 'BK-' . time() . '-' . rand(100, 999);
        }
        $id = $inputData['id'];
        $inputData['school_id'] = $targetSchoolId;

        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $teacherName = $inputData['teacherName'] ?? '';
        $academicYear = !empty($inputData['academicYear']) ? $inputData['academicYear'] : $runningYear;
        $semester = !empty($inputData['semester']) ? $inputData['semester'] : $runningSemester;
        $inputData['academicYear'] = $academicYear;
        $inputData['semester'] = $semester;

        $jsonStr = json_encode($inputData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = date('c');

        $stmt = $pdo->prepare("
            INSERT INTO supervisi_bk (id, school_id, teacher_name, academic_year, semester, data_json, updated_at)
            VALUES (:id, :sid, :teacher, :year, :semester, :json, :now)
            ON DUPLICATE KEY UPDATE 
                school_id = VALUES(school_id),
                teacher_name = VALUES(teacher_name),
                academic_year = VALUES(academic_year),
                semester = VALUES(semester),
                data_json = VALUES(data_json),
                updated_at = VALUES(updated_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':sid' => $targetSchoolId,
            ':teacher' => $teacherName,
            ':year' => $academicYear,
            ':semester' => $semester,
            ':json' => $jsonStr,
            ':now' => $now
        ]);

        echo json_encode([
            'success' => true,
            'id' => $id,
            'supervisi_bk' => $inputData,
            'school_id' => $targetSchoolId,
            'cycle' => ['academic_year' => $academicYear, 'semester' => $semester]
        ]);
        break;

    case 'delete_supervisi_bk':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $authUser = getAuthUser($pdo, $inputData);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($id) {
            if ($authUser && $authUser['role'] === 'super_admin') {
                $stmt = $pdo->prepare("DELETE FROM supervisi_bk WHERE id = :id");
                $stmt->execute([':id' => $id]);
            } else {
                $stmt = $pdo->prepare("DELETE FROM supervisi_bk WHERE id = :id AND school_id = :sid");
                $stmt->execute([':id' => $id, ':sid' => $targetSchoolId]);
                if ($stmt->rowCount() === 0) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Data supervisi BK tidak ditemukan pada sekolah Anda']);
                    exit;
                }
            }
        }
        echo json_encode(['success' => true, 'deleted_id' => $id]);
        break;

    case 'get_supervisi_tendik':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $reqSchool = $_GET['school_id'] ?? $inputData['school_id'] ?? null;
        $authUser = getAuthUser($pdo, $inputData);

        if ($authUser && $authUser['role'] === 'kepala_sekolah') {
            $targetSchoolId = $authUser['school_id'] ?: 'SCH-001';
            $reqSchool = $targetSchoolId;
        }

        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $reqYear = $_GET['academic_year'] ?? $inputData['academic_year'] ?? $runningYear;
        $reqSemester = $_GET['semester'] ?? $inputData['semester'] ?? $runningSemester;
        $allCycles = (!empty($_GET['all_cycles']) || $reqYear === 'all');
        $employeeFilter = trim($_GET['employee_name'] ?? $inputData['employee_name'] ?? '');
        $instrumentFilter = trim($_GET['instrument_type'] ?? $inputData['instrument_type'] ?? '');

        $sql = "SELECT data_json FROM supervisi_tendik WHERE 1=1";
        $params = [];

        if (!($reqSchool === 'all' && $authUser && $authUser['role'] === 'super_admin')) {
            $sql .= " AND " . getTenantSchoolCondition($targetSchoolId);
            $params[':sid'] = $targetSchoolId;
        }

        if (!$allCycles) {
            $sql .= " AND academic_year = :ay AND semester = :sem";
            $params[':ay'] = $reqYear;
            $params[':sem'] = $reqSemester;
        }

        if (!empty($employeeFilter)) {
            $sql .= " AND LOWER(employee_name) = LOWER(:emp)";
            $params[':emp'] = $employeeFilter;
        }

        if (!empty($instrumentFilter)) {
            $sql .= " AND instrument_type = :inst";
            $params[':inst'] = $instrumentFilter;
        }

        $sql .= " ORDER BY updated_at DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $records = [];
        while ($row = $stmt->fetch()) {
            $records[] = json_decode($row['data_json'], true);
        }

        echo json_encode([
            'success' => true,
            'supervisi_tendik' => $records,
            'school_id' => $targetSchoolId,
            'running_cycle' => ['academic_year' => $runningYear, 'semester' => $runningSemester],
            'cycle' => ['academic_year' => $reqYear, 'semester' => $reqSemester],
            'count' => count($records)
        ]);
        break;

    case 'save_supervisi_tendik':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        if (empty($inputData['id'])) {
            $inputData['id'] = 'TDK-' . time() . '-' . rand(100, 999);
        }
        $id = $inputData['id'];
        $inputData['school_id'] = $targetSchoolId;

        $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
        $sStmt->execute([':sid' => $targetSchoolId]);
        $sRow = $sStmt->fetch();
        $runningYear = $sRow['academic_year'] ?? '2026/2027';
        $runningSemester = $sRow['semester'] ?? 'Ganjil';

        $employeeName = trim($inputData['employeeName'] ?? ($inputData['employee_name'] ?? ''));
        $role = trim($inputData['role'] ?? ($inputData['bidangTugas'] ?? 'Staff TU'));
        $instrumentType = trim($inputData['instrumentType'] ?? ($inputData['instrument_type'] ?? 'KTAS'));
        $academicYear = !empty($inputData['academicYear']) ? $inputData['academicYear'] : $runningYear;
        $semester = !empty($inputData['semester']) ? $inputData['semester'] : $runningSemester;

        $inputData['academicYear'] = $academicYear;
        $inputData['semester'] = $semester;
        $inputData['employeeName'] = $employeeName;
        $inputData['role'] = $role;
        $inputData['instrumentType'] = $instrumentType;

        $jsonStr = json_encode($inputData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = date('c');

        $stmt = $pdo->prepare("
            INSERT INTO supervisi_tendik (id, school_id, employee_name, role, instrument_type, academic_year, semester, data_json, updated_at)
            VALUES (:id, :sid, :emp, :role, :inst, :year, :semester, :json, :now)
            ON DUPLICATE KEY UPDATE 
                school_id = VALUES(school_id),
                employee_name = VALUES(employee_name),
                role = VALUES(role),
                instrument_type = VALUES(instrument_type),
                academic_year = VALUES(academic_year),
                semester = VALUES(semester),
                data_json = VALUES(data_json),
                updated_at = VALUES(updated_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':sid' => $targetSchoolId,
            ':emp' => $employeeName,
            ':role' => $role,
            ':inst' => $instrumentType,
            ':year' => $academicYear,
            ':semester' => $semester,
            ':json' => $jsonStr,
            ':now' => $now
        ]);

        echo json_encode([
            'success' => true,
            'id' => $id,
            'supervisi_tendik' => $inputData,
            'school_id' => $targetSchoolId,
            'cycle' => ['academic_year' => $academicYear, 'semester' => $semester]
        ]);
        break;

    case 'delete_supervisi_tendik':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $authUser = getAuthUser($pdo, $inputData);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($id) {
            if ($authUser && $authUser['role'] === 'super_admin') {
                $stmt = $pdo->prepare("DELETE FROM supervisi_tendik WHERE id = :id");
                $stmt->execute([':id' => $id]);
            } else {
                $stmt = $pdo->prepare("DELETE FROM supervisi_tendik WHERE id = :id AND school_id = :sid");
                $stmt->execute([':id' => $id, ':sid' => $targetSchoolId]);
                if ($stmt->rowCount() === 0) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Data supervisi Tendik tidak ditemukan pada sekolah Anda']);
                    exit;
                }
            }
        }
        echo json_encode(['success' => true, 'deleted_id' => $id]);
        break;

    case 'save_employee':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $inputData['school_id'] = $targetSchoolId;
        $authUser = getAuthUser($pdo, $inputData);

        $empId = trim($inputData['id'] ?? '');
        $name = trim($inputData['name'] ?? ($inputData['fullName'] ?? ''));
        $nip = trim($inputData['nip'] ?? '');
        $nuptk = trim($inputData['nuptk'] ?? '');
        $phone = trim($inputData['phone'] ?? '');
        $email = trim($inputData['email'] ?? '');
        $gender = trim($inputData['gender'] ?? 'Laki-laki');
        $dept = trim($inputData['department'] ?? 'Tenaga Pendidik');
        $empStatus = trim($inputData['employmentStatus'] ?? ($inputData['employment_status'] ?? 'GTY'));
        $joinDate = trim($inputData['joinDate'] ?? ($inputData['join_date'] ?? date('Y-m-d')));
        $subject = trim($inputData['subject'] ?? '');
        $task = trim($inputData['task'] ?? '');
        $education = trim($inputData['education'] ?? '');
        $address = trim($inputData['address'] ?? '');
        $status = (!empty($inputData['status']) && in_array(strtolower($inputData['status']), ['inactive', 'nonaktif'])) ? 'inactive' : 'active';
        $avatarUrl = trim($inputData['photo'] ?? ($inputData['avatar_url'] ?? ''));
        $accessCode = trim($inputData['accessCode'] ?? ($inputData['access_code'] ?? ''));
        $now = date('c');

        // Role normalization
        $inputRole = trim($inputData['role'] ?? 'Guru');
        $role = 'guru';
        if (strcasecmp($inputRole, 'kepala sekolah') === 0 || strcasecmp($inputRole, 'kepala_sekolah') === 0) {
            $role = 'kepala_sekolah';
        } elseif (strcasecmp($inputRole, 'pengawas') === 0) {
            $role = 'pengawas';
        } elseif (strcasecmp($inputRole, 'guru bk') === 0 || strcasecmp($inputRole, 'guru_bk') === 0) {
            $role = 'guru_bk';
        } elseif (in_array(strtolower($inputRole), ['staff', 'pegawai', 'karyawan', 'tata usaha', 'tu'])) {
            $role = 'staff';
        }

        // Fetch existing user in users table
        $existingUser = null;
        if (!empty($empId)) {
            $chkU = $pdo->prepare("SELECT * FROM users WHERE employee_id = :eid OR id = :uid LIMIT 1");
            $chkU->execute([':eid' => $empId, ':uid' => $empId]);
            $existingUser = $chkU->fetch(PDO::FETCH_ASSOC);

            if ($existingUser) {
                // Strict Tenant Isolation: Kepala Sekolah can ONLY manage employees of their own school!
                if ($authUser && $authUser['role'] === 'kepala_sekolah') {
                    if ($existingUser['school_id'] !== $authUser['school_id']) {
                        http_response_code(403);
                        echo json_encode([
                            'success' => false,
                            'error' => 'Akses ditolak: Anda hanya dapat mengelola data karyawan yang berada di bawah tanggung jawab sekolah Anda (' . $authUser['school_id'] . ').'
                        ]);
                        exit;
                    }
                    if ($existingUser['role'] === 'super_admin' || $existingUser['role'] === 'pengawas') {
                        http_response_code(403);
                        echo json_encode([
                            'success' => false,
                            'error' => 'Akses ditolak: Tidak dapat mengubah data akun Super Admin atau Pengawas.'
                        ]);
                        exit;
                    }
                    if ($existingUser['role'] === 'kepala_sekolah' && $existingUser['id'] !== $authUser['id']) {
                        http_response_code(403);
                        echo json_encode([
                            'success' => false,
                            'error' => 'Akses ditolak: Anda tidak dapat mengubah data akun Kepala Sekolah lain.'
                        ]);
                        exit;
                    }
                }
            }
        }
        if (!$existingUser && !empty($nip) && $nip !== '-' && strlen($nip) >= 5) {
            $chkNip = $pdo->prepare("SELECT * FROM users WHERE nip = :nip LIMIT 1");
            $chkNip->execute([':nip' => $nip]);
            $nipUser = $chkNip->fetch(PDO::FETCH_ASSOC);
            if ($nipUser) {
                if ($authUser && $authUser['role'] === 'kepala_sekolah' && $nipUser['school_id'] !== $authUser['school_id']) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Akses ditolak: NIP tersebut terdaftar pada personil di sekolah lain.'
                    ]);
                    exit;
                }
                $existingUser = $nipUser;
            }
        }

        // Role restriction for Kepala Sekolah
        if ($authUser && $authUser['role'] === 'kepala_sekolah') {
            if (in_array($role, ['super_admin', 'pengawas'])) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => 'Akses ditolak: Kepala Sekolah tidak memiliki wewenang untuk menetapkan hak akses ' . $role
                ]);
                exit;
            }
            if (!$existingUser && $role === 'kepala_sekolah') {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => 'Akses ditolak: Setiap sekolah hanya memiliki satu Kepala Sekolah.'
                ]);
                exit;
            }
        }

        if ($existingUser) {
            $uid = $existingUser['id'];
            $empId = !empty($empId) ? $empId : (!empty($existingUser['employee_id']) ? $existingUser['employee_id'] : 'EMP-' . time());
            if (empty($accessCode)) {
                $accessCode = !empty($existingUser['access_code']) ? $existingUser['access_code'] : '';
            }
        } else {
            $uid = 'usr-' . substr(md5(uniqid()), 0, 10);
            if (empty($empId)) {
                // Determine next EMP ID for this school
                $maxNum = 0;
                $existIds = $pdo->prepare("SELECT employee_id FROM users WHERE school_id = :sid");
                $existIds->execute([':sid' => $targetSchoolId]);
                while ($eid = $existIds->fetchColumn()) {
                    if (preg_match('/EMP-(\d+)/', $eid, $m)) $maxNum = max($maxNum, (int)$m[1]);
                }
                $empId = 'EMP-' . str_pad($maxNum + 1, 3, '0', STR_PAD_LEFT);
            }
        }

        // Auto-generate access code if missing for teacher, staff/tendik, or principal
        if (empty($accessCode) && in_array($role, ['guru', 'guru_bk', 'kepala_sekolah', 'staff'])) {
            $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            $c1 = ''; for ($i=0; $i<4; $i++) $c1 .= $chars[random_int(0, strlen($chars)-1)];
            $c2 = ''; for ($i=0; $i<4; $i++) $c2 .= $chars[random_int(0, strlen($chars)-1)];
            $accessCode = $c1 . '-' . $c2;
        }

        // Prepare JSON payload for frontend compatibility
        $existingDataJson = (!empty($existingUser['data_json'])) ? json_decode($existingUser['data_json'], true) : [];
        if (!is_array($existingDataJson)) $existingDataJson = [];

        $mergedEmpData = array_merge($existingDataJson, $inputData, [
            'id' => $empId,
            'school_id' => $targetSchoolId,
            'name' => $name,
            'role' => ($role === 'kepala_sekolah' ? 'Kepala Sekolah' : ($role === 'guru_bk' ? 'Guru BK' : ($role === 'staff' ? 'Staff' : 'Guru'))),
            'gender' => $gender,
            'employmentStatus' => $empStatus,
            'joinDate' => $joinDate,
            'nip' => $nip,
            'nuptk' => $nuptk,
            'subject' => $subject,
            'task' => $task,
            'email' => $email,
            'phone' => $phone,
            'education' => $education,
            'address' => $address,
            'department' => $dept,
            'status' => ($status === 'active' ? 'Aktif' : 'Nonaktif'),
            'photo' => $avatarUrl,
            'accessCode' => $accessCode,
            'user_id' => $uid
        ]);
        $jsonStr = json_encode($mergedEmpData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($existingUser) {
            // Update users table
            $updSql = "UPDATE users SET 
                full_name = :fn, gender = :g, role = :r, department = :dept,
                employment_status = :es, join_date = :jd, subject = :subj, task = :task,
                education = :edu, address = :addr, access_code = :ac, data_json = :json,
                employee_id = :empid, nip = :nip, nuptk = :nuptk, phone = :ph, email = :em,
                avatar_url = :photo, status = :st, updated_at = :now
                WHERE id = :uid";
            $pdo->prepare($updSql)->execute([
                ':fn' => $name, ':g' => $gender, ':r' => $role, ':dept' => $dept,
                ':es' => $empStatus, ':jd' => $joinDate, ':subj' => $subject, ':task' => $task,
                ':edu' => $education, ':addr' => $address, ':ac' => $accessCode, ':json' => $jsonStr,
                ':empid' => $empId, ':nip' => $nip ?: null, ':nuptk' => $nuptk ?: null, ':ph' => $phone ?: null,
                ':em' => $email ?: null, ':photo' => $avatarUrl ?: null, ':st' => $status, ':now' => $now,
                ':uid' => $uid
            ]);
        } else {
            // Insert into users table
            $uName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', !empty($inputData['nickname']) ? $inputData['nickname'] : $name));
            if (empty($uName)) $uName = strtolower(str_replace('-', '', $empId));
            $chkUn = $pdo->prepare("SELECT id FROM users WHERE username = :u LIMIT 1");
            $chkUn->execute([':u' => $uName]);
            if ($chkUn->fetch()) {
                $uName .= rand(10, 99);
            }
            $passHash = password_hash('12345678', PASSWORD_BCRYPT);

            $insSql = "INSERT INTO users (
                id, username, email, password_hash, full_name, gender, role, department,
                employment_status, join_date, subject, task, education, address, access_code,
                data_json, school_id, employee_id, nip, nuptk, phone, avatar_url, status,
                must_change_password, created_at, updated_at
            ) VALUES (
                :id, :u, :em, :p, :fn, :g, :r, :dept,
                :es, :jd, :subj, :task, :edu, :addr, :ac,
                :json, :sid, :empid, :nip, :nuptk, :ph, :photo, :st,
                0, :cat, :uat
            )";
            $pdo->prepare($insSql)->execute([
                ':id' => $uid, ':u' => $uName, ':em' => $email ?: null, ':p' => $passHash,
                ':fn' => $name, ':g' => $gender, ':r' => $role, ':dept' => $dept,
                ':es' => $empStatus, ':jd' => $joinDate, ':subj' => $subject, ':task' => $task,
                ':edu' => $education, ':addr' => $address, ':ac' => $accessCode,
                ':json' => $jsonStr, ':sid' => $targetSchoolId, ':empid' => $empId,
                ':nip' => $nip ?: null, ':nuptk' => $nuptk ?: null, ':ph' => $phone ?: null,
                ':photo' => $avatarUrl ?: null, ':st' => $status, ':cat' => $now, ':uat' => $now
            ]);
        }

        // Propagate name change to related tables if employee name was updated
        if ($existingUser && !empty($existingUser['full_name']) && !empty($name) && $existingUser['full_name'] !== $name) {
            $oldName = $existingUser['full_name'];
            $pdo->prepare("UPDATE supervision_schedules SET teacher_name = :n WHERE LOWER(teacher_name) = LOWER(:o) AND school_id = :sid")->execute([':n' => $name, ':o' => $oldName, ':sid' => $targetSchoolId]);
            $pdo->prepare("UPDATE observations SET teacher_name = :n WHERE LOWER(teacher_name) = LOWER(:o) AND school_id = :sid")->execute([':n' => $name, ':o' => $oldName, ':sid' => $targetSchoolId]);
            $pdo->prepare("UPDATE telaah_rpp SET teacher_name = :n WHERE LOWER(teacher_name) = LOWER(:o) AND school_id = :sid")->execute([':n' => $name, ':o' => $oldName, ':sid' => $targetSchoolId]);
        }

        // Update school profile if this is the Headmaster
        if ($role === 'kepala_sekolah') {
            try {
                $sStmt = $pdo->prepare("SELECT profile_json FROM schools WHERE id = :sid LIMIT 1");
                $sStmt->execute([':sid' => $targetSchoolId]);
                $curProf = json_decode($sStmt->fetchColumn() ?: '{}', true);
                $curProf['fullName'] = $name;
                if (!empty($inputData['nickname'])) $curProf['nickName'] = $inputData['nickname'];
                if (!empty($nip) && $nip !== '-') $curProf['nip'] = $nip;
                if (!empty($nuptk) && $nuptk !== '-') $curProf['nuptk'] = $nuptk;
                if (!empty($email)) $curProf['email'] = $email;
                if (!empty($phone)) $curProf['phone'] = $phone;
                if (!empty($address) && $address !== '-') $curProf['schoolAddress'] = $address;
                $pJson = json_encode($curProf, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                $pdo->prepare("UPDATE schools SET profile_json = :p, principal_name = :pn, principal_nip = :pnip, updated_at = :uat WHERE id = :sid")->execute([
                    ':p' => $pJson, ':pn' => $name, ':pnip' => $nip, ':uat' => $now, ':sid' => $targetSchoolId
                ]);
                if ($targetSchoolId === 'SCH-001') {
                    $pdo->prepare("UPDATE app_profile SET profile_json = :p, updated_at = :uat WHERE id = 1")->execute([':p' => $pJson, ':uat' => $now]);
                }
            } catch (Exception $e) {}
        }

        echo json_encode([
            'success' => true,
            'id' => $empId,
            'employee' => $mergedEmpData,
            'school_id' => $targetSchoolId,
            'user_id' => $uid
        ]);
        break;

    case 'delete_employee':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $authUser = getAuthUser($pdo, $inputData);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($id) {
            $chkTarget = $pdo->prepare("SELECT * FROM users WHERE employee_id = :id OR id = :id2 LIMIT 1");
            $chkTarget->execute([':id' => $id, ':id2' => $id]);
            $targetUser = $chkTarget->fetch(PDO::FETCH_ASSOC);

            if (!$targetUser) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Data guru/karyawan tidak ditemukan.']);
                exit;
            }

            // Cross-school security check: Kepala Sekolah can ONLY delete employees of their own school!
            if ($authUser && $authUser['role'] === 'kepala_sekolah') {
                if ($targetUser['school_id'] !== $authUser['school_id']) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Akses ditolak: Anda hanya dapat menghapus karyawan yang berada di bawah sekolah Anda.']);
                    exit;
                }
                if (in_array($targetUser['role'], ['super_admin', 'kepala_sekolah', 'pengawas'])) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Akun Kepala Sekolah, Pengawas, atau Super Admin tidak dapat dihapus melalui menu ini.']);
                    exit;
                }
            } else if ($authUser && $authUser['role'] !== 'super_admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Akses ditolak.']);
                exit;
            }

            $delU = $pdo->prepare("DELETE FROM users WHERE id = :uid");
            $delU->execute([':uid' => $targetUser['id']]);
        }
        echo json_encode(['success' => true, 'deleted_id' => $id]);
        break;

    case 'save_all_employees':
        if (is_array($inputData)) {
            $now = date('c');
            $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
            $authUser = getAuthUser($pdo, $inputData);
            $pdo->beginTransaction();
            foreach ($inputData as $item) {
                if (!empty($item['id']) || !empty($item['name'])) {
                    $itemSid = ($authUser && $authUser['role'] === 'kepala_sekolah') ? $authUser['school_id'] : (!empty($item['school_id']) ? $item['school_id'] : $targetSchoolId);
                    $item['school_id'] = $itemSid;
                    $empId = $item['id'] ?? ('EMP-' . time());
                    $name = trim($item['name'] ?? '');
                    $inputRole = trim($item['role'] ?? 'Guru');
                    $role = (strcasecmp($inputRole, 'kepala sekolah') === 0 || strcasecmp($inputRole, 'kepala_sekolah') === 0) ? 'kepala_sekolah' : (in_array(strtolower($inputRole), ['guru bk', 'guru_bk']) ? 'guru_bk' : (in_array(strtolower($inputRole), ['staff', 'tu', 'pegawai']) ? 'staff' : 'guru'));

                    // Check if user exists
                    $chkU = $pdo->prepare("SELECT id FROM users WHERE (employee_id = :eid OR id = :uid) AND school_id = :sid LIMIT 1");
                    $chkU->execute([':eid' => $empId, ':uid' => $empId, ':sid' => $itemSid]);
                    $existingUid = $chkU->fetchColumn();

                    $jsonStr = json_encode($item, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

                    if ($existingUid) {
                        $pdo->prepare("UPDATE users SET full_name = :fn, role = :r, department = :dept, employment_status = :es, subject = :subj, nip = :nip, nuptk = :nuptk, phone = :ph, email = :em, access_code = :ac, data_json = :json, updated_at = :now WHERE id = :uid")->execute([
                            ':fn' => $name, ':r' => $role, ':dept' => $item['department'] ?? 'Tenaga Pendidik',
                            ':es' => $item['employmentStatus'] ?? 'GTY', ':subj' => $item['subject'] ?? '',
                            ':nip' => $item['nip'] ?? null, ':nuptk' => $item['nuptk'] ?? null,
                            ':ph' => $item['phone'] ?? null, ':em' => $item['email'] ?? null,
                            ':ac' => $item['accessCode'] ?? null, ':json' => $jsonStr, ':now' => $now,
                            ':uid' => $existingUid
                        ]);
                    } else {
                        $newUid = 'usr-' . substr(md5(uniqid()), 0, 10);
                        $uName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', !empty($item['nickname']) ? $item['nickname'] : $name));
                        if (empty($uName)) $uName = strtolower(str_replace('-', '', $empId));
                        $passHash = password_hash('12345678', PASSWORD_BCRYPT);
                        $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, role, department, employment_status, subject, data_json, school_id, employee_id, nip, nuptk, phone, access_code, status, must_change_password, created_at, updated_at) VALUES (:id, :u, :em, :p, :fn, :r, :dept, :es, :subj, :json, :sid, :empid, :nip, :nuptk, :ph, :ac, 'active', 0, :cat, :uat)")->execute([
                            ':id' => $newUid, ':u' => $uName, ':em' => $item['email'] ?? null, ':p' => $passHash,
                            ':fn' => $name, ':r' => $role, ':dept' => $item['department'] ?? 'Tenaga Pendidik',
                            ':es' => $item['employmentStatus'] ?? 'GTY', ':subj' => $item['subject'] ?? '',
                            ':json' => $jsonStr, ':sid' => $itemSid, ':empid' => $empId,
                            ':nip' => $item['nip'] ?? null, ':nuptk' => $item['nuptk'] ?? null,
                            ':ph' => $item['phone'] ?? null, ':ac' => $item['accessCode'] ?? null,
                            ':cat' => $now, ':uat' => $now
                        ]);
                    }
                }
            }
            $pdo->commit();
            echo json_encode(['success' => true, 'count' => count($inputData), 'school_id' => $targetSchoolId]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Data tidak valid']);
        }
        break;

    case 'get_schedules':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $reqSchool = $_GET['school_id'] ?? $inputData['school_id'] ?? null;
        $authUser = getAuthUser($pdo, $inputData);
        if ($authUser && $authUser['role'] === 'kepala_sekolah') {
            $targetSchoolId = $authUser['school_id'] ?: 'SCH-001';
            $reqSchool = $targetSchoolId;
        }
        $teacherName = trim($_GET['teacherName'] ?? $inputData['teacherName'] ?? '');
        $status = trim($_GET['status'] ?? $inputData['status'] ?? '');
        $academicYear = trim($_GET['academicYear'] ?? $inputData['academicYear'] ?? '');
        $semester = trim($_GET['semester'] ?? $inputData['semester'] ?? '');

        // Default to active running cycle if omitted and not all_cycles
        if (empty($academicYear) && empty($_GET['all_cycles']) && $reqSchool !== 'all') {
            $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
            $sStmt->execute([':sid' => $targetSchoolId]);
            $sRow = $sStmt->fetch();
            if ($sRow) {
                $academicYear = $sRow['academic_year'] ?? '2026/2027';
                if (empty($semester)) $semester = $sRow['semester'] ?? 'Ganjil';
            }
        }

        $sql = "SELECT data_json FROM supervision_schedules WHERE 1=1";
        $params = [];

        if ($reqSchool !== 'all') {
            $sql .= ' AND ' . getTenantSchoolCondition($targetSchoolId);
            $params[':sid'] = $targetSchoolId;
        }
        if (!empty($teacherName)) {
            $sql .= " AND LOWER(teacher_name) = LOWER(:teacher)";
            $params[':teacher'] = $teacherName;
        }
        if (!empty($status)) {
            $sql .= " AND LOWER(status) = LOWER(:status)";
            $params[':status'] = $status;
        }
        if (!empty($academicYear)) {
            $sql .= " AND academic_year = :year";
            $params[':year'] = $academicYear;
        }
        if (!empty($semester)) {
            $sql .= " AND semester = :semester";
            $params[':semester'] = $semester;
        }

        $sql .= " ORDER BY rpp_date ASC, obs_date ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $schedules = [];
        while ($row = $stmt->fetch()) {
            $schedules[] = json_decode($row['data_json'], true);
        }

        echo json_encode([
            'success' => true,
            'count' => count($schedules),
            'school_id' => $targetSchoolId,
            'schedules' => $schedules
        ]);
        break;

    case 'save_schedule':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        if (empty($inputData['id'])) {
            $inputData['id'] = 'SCH-' . time() . '-' . rand(100, 999);
        }
        $id = $inputData['id'];
        $inputData['school_id'] = $targetSchoolId;
        $teacherId = $inputData['teacherId'] ?? '';
        $teacherName = trim($inputData['teacherName'] ?? '');
        $subject = trim($inputData['subject'] ?? '');
        $gradeClass = trim($inputData['gradeClass'] ?? '');
        $rppDate = trim($inputData['rppDate'] ?? '');
        $obsDate = trim($inputData['obsDate'] ?? '');
        $timeSlot = trim($inputData['timeSlot'] ?? '');
        $submittedBy = trim($inputData['submittedBy'] ?? 'Guru');
        $notes = trim($inputData['notes'] ?? '');
        $academicYear = trim($inputData['academicYear'] ?? '2026/2027');
        $semester = trim($inputData['semester'] ?? 'Ganjil');

        if (empty($teacherName)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nama guru wajib diisi.']);
            break;
        }
        if (empty($rppDate) || empty($obsDate)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Jadwal telaah RPP dan jadwal observasi kelas wajib diisi.']);
            break;
        }

        // Rule validation: Jadwal observasi hanya bisa diset pada hari telaah RPP atau setelahnya, tidak bisa sebelumnya!
        if (strcmp($obsDate, $rppDate) < 0) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Jadwal observasi hanya bisa diset pada hari telaah RPP atau hari-hari setelahnya, tidak bisa sebelumnya.'
            ]);
            break;
        }

        // Check if existing record
        $checkStmt = $pdo->prepare("SELECT status, data_json, created_at FROM supervision_schedules WHERE id = :id");
        $checkStmt->execute([':id' => $id]);
        $existingRow = $checkStmt->fetch();

        // Determine status
        if ($submittedBy === 'Kepala Sekolah') {
            $status = 'Disetujui';
        } else {
            // Submitted by Guru: if existing was already approved, keep it unless date changed significantly
            if ($existingRow && !empty($existingRow['status']) && $existingRow['status'] === 'Disetujui') {
                $status = 'Disetujui';
            } else {
                $status = 'Pending';
            }
        }

        // Merge full schedule item
        $scheduleData = array_merge($inputData, [
            'id' => $id,
            'school_id' => $targetSchoolId,
            'teacherId' => $teacherId,
            'teacherName' => $teacherName,
            'subject' => $subject,
            'gradeClass' => $gradeClass,
            'rppDate' => $rppDate,
            'obsDate' => $obsDate,
            'timeSlot' => $timeSlot,
            'status' => $status,
            'submittedBy' => $submittedBy,
            'notes' => $notes,
            'academicYear' => $academicYear,
            'semester' => $semester,
            'updatedAt' => date('c')
        ]);
        if (!$existingRow) {
            $scheduleData['createdAt'] = date('c');
        }

        $jsonStr = json_encode($scheduleData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = date('c');

        if ($existingRow) {
            $stmt = $pdo->prepare("
                UPDATE supervision_schedules SET
                    school_id = :sid,
                    teacher_id = :teacher_id,
                    teacher_name = :teacher_name,
                    subject = :subject,
                    grade_class = :grade_class,
                    rpp_date = :rpp_date,
                    obs_date = :obs_date,
                    time_slot = :time_slot,
                    status = :status,
                    submitted_by = :submitted_by,
                    notes = :notes,
                    academic_year = :year,
                    semester = :semester,
                    data_json = :json,
                    updated_at = :updated_at
                WHERE id = :id
            ");
            $stmt->execute([
                ':id' => $id,
                ':sid' => $targetSchoolId,
                ':teacher_id' => $teacherId,
                ':teacher_name' => $teacherName,
                ':subject' => $subject,
                ':grade_class' => $gradeClass,
                ':rpp_date' => $rppDate,
                ':obs_date' => $obsDate,
                ':time_slot' => $timeSlot,
                ':status' => $status,
                ':submitted_by' => $submittedBy,
                ':notes' => $notes,
                ':year' => $academicYear,
                ':semester' => $semester,
                ':json' => $jsonStr,
                ':updated_at' => $now
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO supervision_schedules (
                    id, school_id, teacher_id, teacher_name, subject, grade_class, rpp_date, obs_date,
                    time_slot, status, submitted_by, notes, academic_year, semester, data_json,
                    created_at, updated_at
                ) VALUES (
                    :id, :sid, :teacher_id, :teacher_name, :subject, :grade_class, :rpp_date, :obs_date,
                    :time_slot, :status, :submitted_by, :notes, :year, :semester, :json,
                    :created_at, :updated_at
                )
            ");
            $stmt->execute([
                ':id' => $id,
                ':sid' => $targetSchoolId,
                ':teacher_id' => $teacherId,
                ':teacher_name' => $teacherName,
                ':subject' => $subject,
                ':grade_class' => $gradeClass,
                ':rpp_date' => $rppDate,
                ':obs_date' => $obsDate,
                ':time_slot' => $timeSlot,
                ':status' => $status,
                ':submitted_by' => $submittedBy,
                ':notes' => $notes,
                ':year' => $academicYear,
                ':semester' => $semester,
                ':json' => $jsonStr,
                ':created_at' => $now,
                ':updated_at' => $now
            ]);
        }

        echo json_encode([
            'success' => true,
            'message' => ($status === 'Pending')
                ? 'Jadwal supervisi berhasil diajukan dan sedang menunggu persetujuan Kepala Sekolah.'
                : 'Jadwal supervisi berhasil disimpan dan disetujui.',
            'schedule' => $scheduleData
        ]);
        break;

    case 'approve_schedule':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID jadwal wajib disertakan.']);
            break;
        }

        $authUser = getAuthUser($pdo, $inputData);
        if ($authUser && $authUser['role'] === 'super_admin') {
            $stmt = $pdo->prepare("SELECT data_json FROM supervision_schedules WHERE id = :id");
            $stmt->execute([':id' => $id]);
        } else {
            $stmt = $pdo->prepare("SELECT data_json FROM supervision_schedules WHERE id = :id AND school_id = :sid");
            $stmt->execute([':id' => $id, ':sid' => $targetSchoolId]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Jadwal tidak ditemukan pada sekolah Anda.']);
            break;
        }

        $sch = json_decode($row['data_json'], true);
        $sch['status'] = 'Disetujui';
        $sch['rejectionReason'] = null;
        $sch['approvedAt'] = date('c');
        $sch['updatedAt'] = date('c');
        $jsonStr = json_encode($sch, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $upd = $pdo->prepare("
            UPDATE supervision_schedules
            SET status = 'Disetujui', rejection_reason = NULL, data_json = :json, updated_at = :now
            WHERE id = :id
        ");
        $upd->execute([':json' => $jsonStr, ':now' => date('c'), ':id' => $id]);
        echo json_encode([
            'success' => true,
            'message' => 'Jadwal supervisi berhasil disetujui oleh Kepala Sekolah.',
            'schedule' => $sch
        ]);
        break;

    case 'reject_schedule':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        $reason = trim($inputData['reason'] ?? $_GET['reason'] ?? 'Perlu penyesuaian jadwal.');
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID jadwal wajib disertakan.']);
            break;
        }

        $authUser = getAuthUser($pdo, $inputData);
        if ($authUser && $authUser['role'] === 'super_admin') {
            $stmt = $pdo->prepare("SELECT data_json FROM supervision_schedules WHERE id = :id");
            $stmt->execute([':id' => $id]);
        } else {
            $stmt = $pdo->prepare("SELECT data_json FROM supervision_schedules WHERE id = :id AND school_id = :sid");
            $stmt->execute([':id' => $id, ':sid' => $targetSchoolId]);
        }
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Jadwal tidak ditemukan pada sekolah Anda.']);
            break;
        }

        $sch = json_decode($row['data_json'], true);
        $sch['status'] = 'Ditolak';
        $sch['rejectionReason'] = $reason;
        $sch['rejectedAt'] = date('c');
        $sch['updatedAt'] = date('c');
        $jsonStr = json_encode($sch, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $upd = $pdo->prepare("
            UPDATE supervision_schedules
            SET status = 'Ditolak', rejection_reason = :reason, data_json = :json, updated_at = :now
            WHERE id = :id
        ");
        $upd->execute([':reason' => $reason, ':json' => $jsonStr, ':now' => date('c'), ':id' => $id]);
        echo json_encode([
            'success' => true,
            'message' => 'Pengajuan jadwal supervisi telah ditolak / diminta penyesuaian.',
            'schedule' => $sch
        ]);
        break;

    case 'delete_schedule':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $authUser = getAuthUser($pdo, $inputData);
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($id) {
            if ($authUser && $authUser['role'] === 'super_admin') {
                $stmt = $pdo->prepare("DELETE FROM supervision_schedules WHERE id = :id");
                $stmt->execute([':id' => $id]);
            } else {
                $stmt = $pdo->prepare("DELETE FROM supervision_schedules WHERE id = :id AND school_id = :sid");
                $stmt->execute([':id' => $id, ':sid' => $targetSchoolId]);
                if ($stmt->rowCount() === 0) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Data jadwal supervisi tidak ditemukan pada sekolah Anda']);
                    exit;
                }
            }
        }
        echo json_encode(['success' => true, 'deleted_id' => $id]);
        break;

    case 'save_setting':
        $key = $inputData['key'] ?? null;
        $val = $inputData['value'] ?? '';
        if ($key) {
            $stmt = $pdo->prepare("
                INSERT INTO app_settings (setting_key, setting_value, updated_at)
                VALUES (:k, :v, :now)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)
            ");
            $stmt->execute([':k' => $key, ':v' => $val, ':now' => date('c')]);
        }
        echo json_encode(['success' => true, 'key' => $key]);
        break;

    case 'get_supervision_config':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $academicYear = $inputData['academicYear'] ?? $_GET['academicYear'] ?? null;
        $semester = $inputData['semester'] ?? $_GET['semester'] ?? null;

        // If not specified, get from school table for this principal's school
        if (!$academicYear || !$semester) {
            $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
            $sStmt->execute([':sid' => $targetSchoolId]);
            $sRow = $sStmt->fetch();
            if ($sRow) {
                if (!$academicYear) $academicYear = $sRow['academic_year'] ?? '2026/2027';
                if (!$semester) $semester = $sRow['semester'] ?? 'Ganjil';
            } else {
                $pStmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
                $prof = json_decode($pStmt->fetchColumn() ?: '{}', true);
                if (!$academicYear) $academicYear = $prof['academicYear'] ?? '2026/2027';
                if (!$semester) $semester = $prof['semester'] ?? 'Ganjil';
            }
        }

        // Fetch categories with counts per stage
        $catStmt = $pdo->query("SELECT * FROM supervision_categories ORDER BY sort_order ASC, name ASC");
        $categories = $catStmt->fetchAll();

        // Get indicator counts per category and stage
        $countsStmt = $pdo->query("
            SELECT category_name, stage, COUNT(*) as cnt 
            FROM supervision_indicators 
            GROUP BY category_name, stage
        ");
        $countsMap = [];
        while ($cRow = $countsStmt->fetch()) {
            $countsMap[$cRow['category_name']][$cRow['stage']] = (int)$cRow['cnt'];
        }

        foreach ($categories as &$c) {
            $c['counts'] = [
                '1TelaahModulAjar' => $countsMap[$c['name']]['1TelaahModulAjar'] ?? 0,
                '2PraObs'          => $countsMap[$c['name']]['2PraObs'] ?? 0,
                '3Observasi'       => $countsMap[$c['name']]['3Observasi'] ?? 0,
                '4PostObs'         => $countsMap[$c['name']]['4PostObs'] ?? 0,
                'total'            => ($countsMap[$c['name']]['1TelaahModulAjar'] ?? 0) +
                                      ($countsMap[$c['name']]['2PraObs'] ?? 0) +
                                      ($countsMap[$c['name']]['3Observasi'] ?? 0) +
                                      ($countsMap[$c['name']]['4PostObs'] ?? 0)
            ];
        }
        unset($c);

        // Fetch active categories for this school, academic year and semester
        $settingKeySchool = "active_categories_{$targetSchoolId}_{$academicYear}_{$semester}";
        $settingKeyGeneral = "active_categories_{$academicYear}_{$semester}";
        $sStmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = :k1 LIMIT 1");
        $sStmt->execute([':k1' => $settingKeySchool]);
        $activeJson = $sStmt->fetchColumn();

        if (!$activeJson) {
            $sStmt2 = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = :k2 LIMIT 1");
            $sStmt2->execute([':k2' => $settingKeyGeneral]);
            $activeJson = $sStmt2->fetchColumn();
        }

        if (!$activeJson) {
            // Check fallback global setting
            $gStmt = $pdo->query("SELECT setting_value FROM app_settings WHERE setting_key = 'active_supervision_categories'");
            $activeJson = $gStmt->fetchColumn();
        }

        $allNames = array_column($categories, 'name');
        $activeCategories = $activeJson ? json_decode($activeJson, true) : $allNames;
        if (!is_array($activeCategories) || empty($activeCategories)) {
            $activeCategories = $allNames;
        }

        // Fetch all indicators with category sort order
        $indStmt = $pdo->query("
            SELECT i.*, c.sort_order as cat_sort_order, c.color as cat_color, c.icon as cat_icon
            FROM supervision_indicators i
            LEFT JOIN supervision_categories c ON i.category_name = c.name
            ORDER BY i.stage ASC, c.sort_order ASC, i.number_order ASC
        ");
        $indicators = $indStmt->fetchAll();

        echo json_encode([
            'success' => true,
            'school_id' => $targetSchoolId,
            'academicYear' => $academicYear,
            'semester' => $semester,
            'active_categories' => $activeCategories,
            'categories' => $categories,
            'indicators' => $indicators
        ]);
        break;

    case 'save_active_categories':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $academicYear = $inputData['academicYear'] ?? '2026/2027';
        $semester = $inputData['semester'] ?? 'Ganjil';
        $activeList = $inputData['categories'] ?? $inputData['active_categories'] ?? [];

        if (!is_array($activeList)) {
            $activeList = [];
        }

        $jsonVal = json_encode($activeList, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = date('c');

        // Save school and semester-specific key
        $settingKeySchool = "active_categories_{$targetSchoolId}_{$academicYear}_{$semester}";
        $settingKeyGeneral = "active_categories_{$academicYear}_{$semester}";
        $stmt = $pdo->prepare("
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES (:k, :v, :now)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)
        ");
        $stmt->execute([':k' => $settingKeySchool, ':v' => $jsonVal, ':now' => $now]);
        $stmt->execute([':k' => $settingKeyGeneral, ':v' => $jsonVal, ':now' => $now]);
        if ($targetSchoolId === 'SCH-001') {
            $stmt->execute([':k' => 'active_supervision_categories', ':v' => $jsonVal, ':now' => $now]);
        }

        echo json_encode([
            'success' => true,
            'message' => "Kategori supervisi aktif untuk Semester {$semester} {$academicYear} berhasil disimpan.",
            'academicYear' => $academicYear,
            'semester' => $semester,
            'active_categories' => $activeList
        ]);
        break;

    case 'get_supervision_bk_config':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, false);
        $academicYear = $inputData['academicYear'] ?? $_GET['academicYear'] ?? null;
        $semester = $inputData['semester'] ?? $_GET['semester'] ?? null;

        if (!$academicYear || !$semester) {
            $sStmt = $pdo->prepare("SELECT academic_year, semester FROM schools WHERE id = :sid LIMIT 1");
            $sStmt->execute([':sid' => $targetSchoolId]);
            $sRow = $sStmt->fetch();
            if ($sRow) {
                if (!$academicYear) $academicYear = $sRow['academic_year'] ?? '2026/2027';
                if (!$semester) $semester = $sRow['semester'] ?? 'Ganjil';
            } else {
                $pStmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
                $prof = json_decode($pStmt->fetchColumn() ?: '{}', true);
                if (!$academicYear) $academicYear = $prof['academicYear'] ?? '2026/2027';
                if (!$semester) $semester = $prof['semester'] ?? 'Ganjil';
            }
        }

        // Load master JSON
        $masterFile = __DIR__ . '/data/supervisi_bk_master.json';
        $masterData = [];
        if (file_exists($masterFile)) {
            $rawJson = file_get_contents($masterFile);
            if (substr($rawJson, 0, 3) === "\xEF\xBB\xBF") {
                $rawJson = substr($rawJson, 3);
            }
            $masterData = json_decode($rawJson, true) ?: [];
        }

        // Check active categories
        $settingKeySchool = "active_bk_categories_{$targetSchoolId}_{$academicYear}_{$semester}";
        $settingKeyGeneral = "active_bk_categories_{$academicYear}_{$semester}";
        $sStmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = :k1 LIMIT 1");
        $sStmt->execute([':k1' => $settingKeySchool]);
        $activeJson = $sStmt->fetchColumn();

        if (!$activeJson) {
            $sStmt2 = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = :k2 LIMIT 1");
            $sStmt2->execute([':k2' => $settingKeyGeneral]);
            $activeJson = $sStmt2->fetchColumn();
        }

        if (!$activeJson) {
            $gStmt = $pdo->query("SELECT setting_value FROM app_settings WHERE setting_key = 'active_supervision_bk_categories'");
            $activeJson = $gStmt->fetchColumn();
        }

        $allNames = ['Indikator Dasar', 'Deep Learning', 'Literasi Numerasi'];
        $activeCategories = $activeJson ? json_decode($activeJson, true) : $allNames;
        if (!is_array($activeCategories) || empty($activeCategories)) {
            $activeCategories = $allNames;
        }

        echo json_encode([
            'success' => true,
            'school_id' => $targetSchoolId,
            'academicYear' => $academicYear,
            'semester' => $semester,
            'active_categories' => $activeCategories,
            'categories' => $masterData['categories'] ?? [],
            'supervisi_indicators' => $masterData['supervisi_indicators'] ?? [],
            'rpl_indicators' => $masterData['rpl_indicators'] ?? [],
            'coaching_tirta' => $masterData['coaching_tirta'] ?? [],
            'coaching_examples' => $masterData['coaching_examples'] ?? [],
            'coaching_refleksi' => $masterData['coaching_refleksi'] ?? []
        ]);
        break;

    case 'save_active_bk_categories':
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $academicYear = $inputData['academicYear'] ?? '2026/2027';
        $semester = $inputData['semester'] ?? 'Ganjil';
        $activeList = $inputData['categories'] ?? $inputData['active_categories'] ?? [];

        if (!is_array($activeList)) {
            $activeList = [];
        }

        $jsonVal = json_encode($activeList, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = date('c');

        $settingKeySchool = "active_bk_categories_{$targetSchoolId}_{$academicYear}_{$semester}";
        $settingKeyGeneral = "active_bk_categories_{$academicYear}_{$semester}";
        $stmt = $pdo->prepare("
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES (:k, :v, :now)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)
        ");
        $stmt->execute([':k' => $settingKeySchool, ':v' => $jsonVal, ':now' => $now]);
        $stmt->execute([':k' => $settingKeyGeneral, ':v' => $jsonVal, ':now' => $now]);
        if ($targetSchoolId === 'SCH-001') {
            $stmt->execute([':k' => 'active_supervision_bk_categories', ':v' => $jsonVal, ':now' => $now]);
        }

        echo json_encode([
            'success' => true,
            'message' => "Kategori supervisi BK aktif untuk Semester {$semester} {$academicYear} berhasil disimpan.",
            'academicYear' => $academicYear,
            'semester' => $semester,
            'active_categories' => $activeList
        ]);
        break;

    case 'add_category':
        $name = trim($inputData['name'] ?? '');
        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nama kategori tidak boleh kosong.']);
            break;
        }
        $code = strtoupper(trim($inputData['code'] ?? substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 3)));
        $id = 'CAT-' . strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
        $desc = trim($inputData['description'] ?? '');
        $color = trim($inputData['color'] ?? 'teal');
        $icon = trim($inputData['icon'] ?? 'bookmark');
        $now = date('c');

        // Calculate sort order
        $maxOrder = (int)$pdo->query("SELECT MAX(sort_order) FROM supervision_categories")->fetchColumn();
        $sortOrder = $maxOrder + 1;

        $stmt = $pdo->prepare("
            INSERT INTO supervision_categories (id, name, code, description, color, icon, is_custom, sort_order, created_at, updated_at)
            VALUES (:id, :name, :code, :desc, :color, :icon, 1, :sort_order, :created_at, :updated_at)
            ON DUPLICATE KEY UPDATE 
                name = VALUES(name),
                code = VALUES(code),
                description = VALUES(description),
                color = VALUES(color),
                icon = VALUES(icon),
                updated_at = VALUES(updated_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':name' => $name,
            ':code' => $code,
            ':desc' => $desc,
            ':color' => $color,
            ':icon' => $icon,
            ':sort_order' => $sortOrder,
            ':created_at' => $now,
            ':updated_at' => $now
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Kategori {$name} berhasil ditambahkan.",
            'category' => [
                'id' => $id,
                'name' => $name,
                'code' => $code,
                'description' => $desc,
                'color' => $color,
                'icon' => $icon,
                'is_custom' => 1
            ]
        ]);
        break;

    case 'delete_category':
        $catId = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($catId) {
            $cat = $pdo->query("SELECT * FROM supervision_categories WHERE id = " . $pdo->quote($catId))->fetch();
            if ($cat && !empty($cat['is_custom'])) {
                // Delete associated custom indicators
                $delInd = $pdo->prepare("DELETE FROM supervision_indicators WHERE category_id = :id");
                $delInd->execute([':id' => $catId]);
                // Delete category
                $delCat = $pdo->prepare("DELETE FROM supervision_categories WHERE id = :id");
                $delCat->execute([':id' => $catId]);
                echo json_encode(['success' => true, 'message' => "Kategori {$cat['name']} berhasil dihapus."]);
                break;
            } else {
                echo json_encode(['success' => false, 'error' => 'Kategori standar sistem tidak dapat dihapus.']);
                break;
            }
        }
        echo json_encode(['success' => false, 'error' => 'ID kategori tidak ditemukan.']);
        break;

    case 'add_indicator':
        $catId = trim($inputData['categoryId'] ?? '');
        $catName = trim($inputData['categoryName'] ?? '');
        $stage = trim($inputData['stage'] ?? '1TelaahModulAjar');
        $title = trim($inputData['title'] ?? '');
        $focus = trim($inputData['focus'] ?? '');

        if (empty($title)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Teks indikator tidak boleh kosong.']);
            break;
        }

        // If categoryId missing, look up by categoryName
        if (empty($catId) && !empty($catName)) {
            $stmtC = $pdo->prepare("SELECT id FROM supervision_categories WHERE name = :name");
            $stmtC->execute([':name' => $catName]);
            $catId = $stmtC->fetchColumn() ?: 'CUS';
        }

        // Calculate next number_order in that category and stage
        $stmtMax = $pdo->prepare("SELECT MAX(number_order) FROM supervision_indicators WHERE category_name = :name AND stage = :stage");
        $stmtMax->execute([':name' => $catName, ':stage' => $stage]);
        $nextNum = ((int)$stmtMax->fetchColumn()) + 1;

        $indId = strtoupper($catId) . '-' . substr($stage, 0, 2) . '-' . str_pad($nextNum, 2, '0', STR_PAD_LEFT);
        $now = date('c');

        $stmt = $pdo->prepare("
            INSERT INTO supervision_indicators (
                id, category_id, category_name, stage, number_order, title, focus,
                scale_min, scale_max, is_custom, created_at, updated_at
            ) VALUES (
                :id, :cat_id, :cat_name, :stage, :num, :title, :focus,
                1, 4, 1, :created_at, :updated_at
            ) ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                focus = VALUES(focus),
                updated_at = VALUES(updated_at)
        ");
        $stmt->execute([
            ':id' => $indId,
            ':cat_id' => $catId,
            ':cat_name' => $catName,
            ':stage' => $stage,
            ':num' => $nextNum,
            ':title' => $title,
            ':focus' => $focus,
            ':created_at' => $now,
            ':updated_at' => $now
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Indikator baru berhasil ditambahkan.',
            'indicator' => [
                'id' => $indId,
                'categoryId' => $catId,
                'categoryName' => $catName,
                'stage' => $stage,
                'numberOrder' => $nextNum,
                'title' => $title,
                'focus' => $focus,
                'isCustom' => 1
            ]
        ]);
        break;

    case 'delete_indicator':
        $id = $inputData['id'] ?? $_GET['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM supervision_indicators WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'deleted_id' => $id]);
            break;
        }
        echo json_encode(['success' => false, 'error' => 'ID indikator tidak valid.']);
        break;

    case 'parse_rpp_file':
        // ==============================================================
        // Parse uploaded file (DOCX / PDF) or URL, extract plain text
        // ==============================================================

        // --- 1. URL-based extraction (Google Docs / direct link) ---
        if (!empty($inputData['url'])) {
            $url = trim($inputData['url']);

            // Convert Google Docs share URL to plain-text export URL
            if (preg_match('#docs\.google\.com/document/d/([^/]+)#', $url, $m)) {
                $docId = $m[1];
                $url = "https://docs.google.com/document/d/{$docId}/export?format=txt";
            }

            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'URL tidak valid.']);
                break;
            }

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
            curl_setopt($ch, CURLOPT_TIMEOUT, 20);
            curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; supervisisekolah.id-RPP-Parser/1.0)');
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $body = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr  = curl_error($ch);
            curl_close($ch);

            if ($body === false || $httpCode >= 400) {
                http_response_code(502);
                echo json_encode(['success' => false, 'error' => "Gagal mengambil URL (HTTP {$httpCode}). {$curlErr}"]);
                break;
            }

            // Strip HTML tags if the response is HTML
            $contentType = '';
            if (strpos($body, '<html') !== false || strpos($body, '<!DOCTYPE') !== false) {
                $body = strip_tags($body);
                $body = preg_replace('/\s+/', ' ', $body);
                $body = trim($body);
            }

            echo json_encode(['success' => true, 'text' => $body, 'source' => 'url']);
            break;
        }

        // --- 2. File upload extraction ---
        if (empty($_FILES['rpp_file'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Tidak ada file yang dikirim.']);
            break;
        }

        $file     = $_FILES['rpp_file'];
        $tmpPath  = $file['tmp_name'];
        $origName = strtolower($file['name'] ?? '');
        $ext      = pathinfo($origName, PATHINFO_EXTENSION);

        if ($file['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Upload gagal, kode error: ' . $file['error']]);
            break;
        }

        $maxBytes = 15 * 1024 * 1024; // 15 MB limit
        if ($file['size'] > $maxBytes) {
            http_response_code(413);
            echo json_encode(['success' => false, 'error' => 'Ukuran file terlalu besar (maks. 15 MB).']);
            break;
        }

        $extractedText = '';

        if ($ext === 'docx') {
            // --- DOCX: Extract word/document.xml via ZipArchive ---
            if (!class_exists('ZipArchive')) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'ZipArchive PHP extension tidak tersedia.']);
                break;
            }

            $zip = new ZipArchive();
            if ($zip->open($tmpPath) !== true) {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'File DOCX tidak dapat dibuka (mungkin rusak atau terenkripsi).']);
                break;
            }

            $xmlContent = $zip->getFromName('word/document.xml');
            $zip->close();

            if ($xmlContent === false) {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'Konten XML tidak ditemukan di dalam file DOCX.']);
                break;
            }

            // Remove XML tags, keeping text content with spacing
            $cleaned = preg_replace('/<w:br[^>]*\/>/', "\n", $xmlContent);
            $cleaned = preg_replace('/<\/w:p>/', "\n", $cleaned);
            $cleaned = preg_replace('/<[^>]+>/', '', $cleaned);
            $cleaned = html_entity_decode($cleaned, ENT_QUOTES | ENT_XML1, 'UTF-8');
            $cleaned = preg_replace('/\n{3,}/', "\n\n", $cleaned);
            $extractedText = trim($cleaned);
            $source = 'docx';

        } elseif ($ext === 'pdf') {
            // --- PDF: Binary text extraction (heuristic, works for text-based PDFs) ---
            $pdfBinary = file_get_contents($tmpPath);
            if ($pdfBinary === false) {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'Gagal membaca file PDF.']);
                break;
            }

            // Extract text from BT ... ET blocks in PDF stream
            $extracted = '';
            // Match text stream objects
            preg_match_all('/BT(.+?)ET/s', $pdfBinary, $matches);
            foreach ($matches[1] as $block) {
                // Extract text from Tj / TJ operators
                preg_match_all('/\(((?:[^)\\\\]|\\\\.)*)\)\s*Tj/s', $block, $tjMatches);
                foreach ($tjMatches[1] as $t) {
                    $extracted .= stripslashes($t) . ' ';
                }
                preg_match_all('/\[(.*?)\]\s*TJ/s', $block, $tjArrMatches);
                foreach ($tjArrMatches[1] as $t) {
                    preg_match_all('/\(((?:[^)\\\\]|\\\\.)*)\)/s', $t, $subMatches);
                    foreach ($subMatches[1] as $s) {
                        $extracted .= stripslashes($s);
                    }
                    $extracted .= ' ';
                }
            }

            // Fallback: look for readable ASCII sequences
            if (strlen(trim($extracted)) < 100) {
                preg_match_all('/[A-Za-z0-9\s\.\,\:\;\!\?\-\(\)\/\&\%\@\#\[\]\{\}\+\=]{10,}/u', $pdfBinary, $fallback);
                $extracted = implode(' ', $fallback[0]);
            }

            $extracted = preg_replace('/\s+/', ' ', $extracted);
            $extractedText = trim($extracted);
            $source = 'pdf';

            // If still empty, inform user that this PDF might be scanned/image-based
            if (strlen($extractedText) < 50) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'error' => 'Teks tidak dapat diekstrak dari PDF ini. PDF kemungkinan berisi gambar/scan. Silakan salin teks secara manual dari dokumen tersebut.'
                ]);
                break;
            }

        } elseif ($ext === 'txt') {
            $extractedText = file_get_contents($tmpPath);
            $extractedText = mb_convert_encoding($extractedText, 'UTF-8', 'auto');
            // Strip UTF-8 BOM if present
            if (substr($extractedText, 0, 3) === "\xEF\xBB\xBF") {
                $extractedText = substr($extractedText, 3);
            }
            $extractedText = trim($extractedText);
            $source = 'txt';
        } else {
            http_response_code(415);
            echo json_encode(['success' => false, 'error' => "Format file '{$ext}' tidak didukung. Gunakan DOCX, PDF, atau TXT."]);
            break;
        }

        if (empty($extractedText)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Tidak ada teks yang dapat diekstrak dari file ini.']);
            break;
        }

        // Limit to 25000 chars to avoid overwhelming the AI
        if (strlen($extractedText) > 25000) {
            $extractedText = substr($extractedText, 0, 25000) . "\n\n[... Teks dipotong karena melebihi batas analisis AI ...]";
        }

        echo json_encode(['success' => true, 'text' => $extractedText, 'source' => $source, 'chars' => strlen($extractedText)]);
        break;

    case 'get_employees_public':
        // Public endpoint — returns teachers & principals for portal use directly from users table
        $schoolFilter = trim($_GET['school_id'] ?? $_GET['school_code'] ?? $_GET['school_name'] ?? $inputData['school_id'] ?? $inputData['school_name'] ?? '');
        $targetSchoolId = null;
        if (!empty($schoolFilter)) {
            $sStmt = $pdo->prepare("SELECT id FROM schools WHERE id = :q1 OR code = :q2 OR LOWER(name) = LOWER(:q3) LIMIT 1");
            $sStmt->execute([':q1' => $schoolFilter, ':q2' => $schoolFilter, ':q3' => $schoolFilter]);
            $targetSchoolId = $sStmt->fetchColumn();
        }

        $includeStaff = !empty($_GET['include_staff']) || !empty($_GET['tendik']) || !empty($inputData['tendik']) || !empty($_GET['all_roles']);
        $roleList = $includeStaff ? "('guru', 'guru_bk', 'staff', 'kepala_sekolah')" : "('guru', 'guru_bk', 'kepala_sekolah')";

        if ($targetSchoolId) {
            $uStmt = $pdo->prepare("SELECT * FROM users WHERE school_id = :sid AND role IN $roleList ORDER BY full_name ASC");
            $uStmt->execute([':sid' => $targetSchoolId]);
        } else {
            $uStmt = $pdo->query("SELECT * FROM users WHERE role IN $roleList ORDER BY full_name ASC");
        }

        $publicList = [];
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        while ($row = $uStmt->fetch(PDO::FETCH_ASSOC)) {
            $emp = formatUserAsEmployee($row);
            if (!empty($emp)) {
                // Auto generate access code if missing so teachers are never excluded
                if (empty($emp['accessCode'])) {
                    $c1 = ''; for ($i=0; $i<4; $i++) $c1 .= $chars[random_int(0, strlen($chars)-1)];
                    $c2 = ''; for ($i=0; $i<4; $i++) $c2 .= $chars[random_int(0, strlen($chars)-1)];
                    $emp['accessCode'] = $c1 . '-' . $c2;
                    $emp['accessCodeGeneratedAt'] = date('c');
                    $updCode = $pdo->prepare("UPDATE users SET access_code = :code, data_json = :json WHERE id = :id");
                    $updCode->execute([':code' => $emp['accessCode'], ':json' => json_encode($emp, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), ':id' => $row['id']]);
                }
                $publicList[] = [
                    'id'               => $emp['id'],
                    'school_id'        => $emp['school_id'] ?? '',
                    'name'             => $emp['name'] ?? '',
                    'nickname'         => $emp['nickname'] ?? '',
                    'role'             => $emp['role'] ?? 'Guru',
                    'gender'           => $emp['gender'] ?? 'Laki-laki',
                    'employmentStatus' => $emp['employmentStatus'] ?? 'PNS',
                    'nip'              => $emp['nip'] ?? '-',
                    'nuptk'            => $emp['nuptk'] ?? '-',
                    'subject'          => $emp['subject'] ?? '',
                    'task'             => $emp['task'] ?? '',
                    'email'            => $emp['email'] ?? '',
                    'phone'            => $emp['phone'] ?? '',
                    'education'        => $emp['education'] ?? '',
                    'address'          => $emp['address'] ?? '',
                    'photo'            => $emp['photo'] ?? ('https://ui-avatars.com/api/?name=' . urlencode($emp['name'] ?? 'Guru') . '&background=0284c7&color=fff&size=250'),
                    'accessCode'       => $emp['accessCode'],
                    'department'       => $emp['department'] ?? 'Tenaga Pendidik',
                ];
            }
        }
        echo json_encode(['success' => true, 'employees' => $publicList, 'school_id' => $targetSchoolId]);
        break;

    case 'upload_photo':
        // Upload employee photo — max 500KB, JPG or PNG only
        $empId = $_POST['empId'] ?? '';
        if (empty($empId)) {
            echo json_encode(['success' => false, 'error' => 'ID karyawan tidak ditemukan.']);
            break;
        }
        if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['success' => false, 'error' => 'File foto tidak valid atau gagal diunggah.']);
            break;
        }
        $file = $_FILES['photo'];
        // Validate size: max 500KB
        if ($file['size'] > 512000) {
            echo json_encode(['success' => false, 'error' => 'Ukuran foto melebihi 500 KB. Silakan kompres foto terlebih dahulu.']);
            break;
        }
        // Validate type: JPG or PNG only
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/jpg' => 'jpg'];
        if (!array_key_exists($mime, $allowed)) {
            echo json_encode(['success' => false, 'error' => 'Format foto tidak didukung. Hanya JPG dan PNG yang diizinkan.']);
            break;
        }
        // Save to data/photos/
        $photosDir = $dataDir . '/photos';
        if (!is_dir($photosDir)) {
            mkdir($photosDir, 0755, true);
            // Protect directory listing
            file_put_contents($photosDir . '/.htaccess', "Options -Indexes\n");
        }
        $ext      = $allowed[$mime];
        $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $empId) . '.' . $ext;
        $destPath = $photosDir . '/' . $filename;
        // Remove old photo files (any extension) for this employee
        foreach (['jpg','jpeg','png'] as $oldExt) {
            $old = $photosDir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $empId) . '.' . $oldExt;
            if (file_exists($old) && $old !== $destPath) @unlink($old);
        }
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            echo json_encode(['success' => false, 'error' => 'Gagal menyimpan foto ke server.']);
            break;
        }
        // Determine public URL for the saved photo
        $scriptUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
                   . '://' . $_SERVER['HTTP_HOST']
                   . rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
        $photoUrl = $scriptUrl . '/data/photos/' . $filename;

        // Update employee record with new photo URL
        $stmt = $pdo->prepare("SELECT id, school_id, data_json FROM users WHERE employee_id = :id OR id = :id2 LIMIT 1");
        $stmt->execute([':id' => $empId, ':id2' => $empId]);
        $userRow = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($userRow) {
            $authUser = getAuthUser($pdo, $_POST);
            if ($authUser && $authUser['role'] === 'kepala_sekolah' && $userRow['school_id'] !== $authUser['school_id']) {
                echo json_encode(['success' => false, 'error' => 'Akses ditolak: Anda hanya dapat mengunggah foto karyawan di sekolah Anda.']);
                break;
            }
            $empData = !empty($userRow['data_json']) ? json_decode($userRow['data_json'], true) : [];
            $empData['photo'] = $photoUrl;
            $now = date('c');
            $upd = $pdo->prepare("UPDATE users SET avatar_url = :photo, data_json = :json, updated_at = :now WHERE id = :id");
            $upd->execute([':photo' => $photoUrl, ':json' => json_encode($empData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), ':now' => $now, ':id' => $userRow['id']]);
        }
        echo json_encode(['success' => true, 'photoUrl' => $photoUrl, 'empId' => $empId]);
        break;

    case 'bulk_import_employees':
        // Bulk import employees directly into users table from parsed XLSX data
        if (!is_array($inputData) || empty($inputData)) {
            echo json_encode(['success' => false, 'error' => 'Data impor kosong atau tidak valid.']);
            break;
        }
        $targetSchoolId = resolveTenantContext($pdo, $inputData, true);
        $now = date('c');

        // Get current max numeric ID in users for this school
        $existStmt = $pdo->prepare("SELECT employee_id FROM users WHERE school_id = :sid");
        $existStmt->execute([':sid' => $targetSchoolId]);
        $existIds = $existStmt->fetchAll(PDO::FETCH_COLUMN);
        $maxNum = 0;
        foreach ($existIds as $eid) {
            if (preg_match('/EMP-(\d+)/', $eid, $m)) $maxNum = max($maxNum, (int)$m[1]);
        }

        $inserted = 0; $updated = 0; $errors = [];
        $pdo->beginTransaction();

        foreach ($inputData as $row) {
            $name = trim($row['name'] ?? '');
            if (empty($name)) { $errors[] = 'Baris kosong (nama tidak ada), dilewati.'; continue; }

            $empId = trim($row['id'] ?? '');
            $isNew = false;
            if (empty($empId) || !in_array($empId, $existIds)) {
                $maxNum++;
                $empId = 'EMP-' . str_pad($maxNum, 3, '0', STR_PAD_LEFT);
                $isNew = true;
                $inserted++;
            } else {
                $updated++;
            }

            $inputRole = trim($row['role'] ?? 'Guru');
            $role = (strcasecmp($inputRole, 'kepala sekolah') === 0 || strcasecmp($inputRole, 'kepala_sekolah') === 0) ? 'kepala_sekolah' : (in_array(strtolower($inputRole), ['staff', 'tu', 'pegawai']) ? 'staff' : 'guru');

            $gender = $row['gender'] ?? 'Laki-laki';
            $empStatus = $row['employmentStatus'] ?? 'GTT / Kontrak';
            $nip = $row['nip'] ?? '-';
            $nuptk = $row['nuptk'] ?? '-';
            $subject = $row['subject'] ?? '';
            $task = $row['task'] ?? '';
            $email = $row['email'] ?? '';
            $phone = $row['phone'] ?? '';
            $education = $row['education'] ?? '';
            $address = $row['address'] ?? '';
            $dept = $row['department'] ?? 'Tenaga Pendidik';
            $joinDate = $row['joinDate'] ?? date('Y-m-d');
            $status = ($row['status'] ?? 'Aktif') === 'Aktif' ? 'active' : 'inactive';
            $photo = $row['photo'] ?? ('https://ui-avatars.com/api/?name=' . urlencode($name) . '&background=475569&color=fff&size=200');

            $empData = [
                'id' => $empId, 'school_id' => $targetSchoolId, 'name' => $name,
                'nickname' => $row['nickname'] ?? '', 'role' => $inputRole, 'gender' => $gender,
                'employmentStatus' => $empStatus, 'nip' => $nip, 'nuptk' => $nuptk,
                'subject' => $subject, 'task' => $task, 'email' => $email, 'phone' => $phone,
                'education' => $education, 'address' => $address, 'department' => $dept,
                'joinDate' => $joinDate, 'status' => ($status === 'active' ? 'Aktif' : 'Nonaktif'),
                'photo' => $photo
            ];
            $jsonStr = json_encode($empData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if (!$isNew) {
                $pdo->prepare("UPDATE users SET 
                    full_name = :fn, gender = :g, role = :r, department = :dept,
                    employment_status = :es, join_date = :jd, subject = :subj, task = :task,
                    education = :edu, address = :addr, data_json = :json, nip = :nip,
                    nuptk = :nuptk, phone = :ph, email = :em, avatar_url = :photo, status = :st, updated_at = :now
                    WHERE employee_id = :empid AND school_id = :sid")->execute([
                    ':fn' => $name, ':g' => $gender, ':r' => $role, ':dept' => $dept,
                    ':es' => $empStatus, ':jd' => $joinDate, ':subj' => $subject, ':task' => $task,
                    ':edu' => $education, ':addr' => $address, ':json' => $jsonStr,
                    ':nip' => $nip ?: null, ':nuptk' => $nuptk ?: null, ':ph' => $phone ?: null,
                    ':em' => $email ?: null, ':photo' => $photo ?: null, ':st' => $status, ':now' => $now,
                    ':empid' => $empId, ':sid' => $targetSchoolId
                ]);
            } else {
                $newUid = 'usr-' . substr(md5(uniqid()), 0, 10);
                $uName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', !empty($row['nickname']) ? $row['nickname'] : $name));
                if (empty($uName)) $uName = strtolower(str_replace('-', '', $empId));
                $passHash = password_hash('12345678', PASSWORD_BCRYPT);
                $pdo->prepare("INSERT INTO users (
                    id, username, email, password_hash, full_name, gender, role, department,
                    employment_status, join_date, subject, task, education, address,
                    data_json, school_id, employee_id, nip, nuptk, phone, avatar_url, status,
                    must_change_password, created_at, updated_at
                ) VALUES (
                    :id, :u, :em, :p, :fn, :g, :r, :dept,
                    :es, :jd, :subj, :task, :edu, :addr,
                    :json, :sid, :empid, :nip, :nuptk, :ph, :photo, :st,
                    0, :cat, :uat
                )")->execute([
                    ':id' => $newUid, ':u' => $uName, ':em' => $email ?: null, ':p' => $passHash,
                    ':fn' => $name, ':g' => $gender, ':r' => $role, ':dept' => $dept,
                    ':es' => $empStatus, ':jd' => $joinDate, ':subj' => $subject, ':task' => $task,
                    ':edu' => $education, ':addr' => $address, ':json' => $jsonStr,
                    ':sid' => $targetSchoolId, ':empid' => $empId, ':nip' => $nip ?: null,
                    ':nuptk' => $nuptk ?: null, ':ph' => $phone ?: null, ':photo' => $photo ?: null,
                    ':st' => $status, ':cat' => $now, ':uat' => $now
                ]);
            }
        }
        $pdo->commit();
        echo json_encode(['success' => true, 'inserted' => $inserted, 'updated' => $updated, 'school_id' => $targetSchoolId, 'errors' => $errors]);
        break;

    case 'regenerate_school_code':
        $stmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
        $prof = json_decode($stmt->fetchColumn() ?: '{}', true);
        $newCode = generateSchoolCode($prof['schoolName'] ?? 'SMP Brighton');
        $prof['schoolCode'] = $newCode;
        $now = date('c');
        $upd = $pdo->prepare("UPDATE app_profile SET profile_json = :json, updated_at = :now WHERE id = 1");
        $upd->execute([
            ':json' => json_encode($prof, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':now' => $now
        ]);
        echo json_encode([
            'success' => true,
            'schoolCode' => $newCode,
            'message' => 'Kode sekolah berhasil diperbarui.'
        ]);
        break;

    case 'get_public_schools':
        $schools = [];
        $addedNames = [];
        try {
            $sStmt = $pdo->query("SELECT id, name, npsn, code, academic_year, semester FROM schools WHERE status = 'active' ORDER BY name ASC");
            $dbSchools = $sStmt->fetchAll();
            foreach ($dbSchools as $sch) {
                if (!empty($sch['name'])) {
                    $key = strtolower(trim($sch['name']));
                    if (!isset($addedNames[$key])) {
                        $addedNames[$key] = true;
                        $schools[] = [
                            'id' => $sch['id'],
                            'name' => $sch['name'],
                            'npsn' => $sch['npsn'] ?? '',
                            'academicYear' => $sch['academic_year'] ?? '2026/2027',
                            'semester' => $sch['semester'] ?? 'Ganjil'
                        ];
                    }
                }
            }
        } catch (Exception $e) {}

        // Fallback / include profile school if not yet in list
        $pStmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
        $prof = json_decode($pStmt->fetchColumn() ?: '{}', true);
        if (!empty($prof['schoolName'])) {
            $key = strtolower(trim($prof['schoolName']));
            if (!isset($addedNames[$key])) {
                $addedNames[$key] = true;
                array_unshift($schools, [
                    'id' => 'SCH-001',
                    'name' => $prof['schoolName'],
                    'npsn' => $prof['npsn'] ?? '',
                    'academicYear' => $prof['academicYear'] ?? '2026/2027',
                    'semester' => $prof['semester'] ?? 'Ganjil'
                ]);
            }
        }
        echo json_encode(['success' => true, 'schools' => $schools]);
        break;

    case 'verify_school_code':
        $reqName = trim($inputData['schoolName'] ?? $_GET['schoolName'] ?? '');
        $reqCode = trim($inputData['schoolCode'] ?? $_GET['schoolCode'] ?? '');
        if (empty($reqName) || empty($reqCode)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nama sekolah dan kode sekolah wajib diisi.']);
            break;
        }

        $normReqCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $reqCode));

        // 1. Try finding in schools table
        $foundSchool = null;
        try {
            $schStmt = $pdo->prepare("SELECT * FROM schools WHERE LOWER(name) = LOWER(:name) OR name LIKE :nameLike LIMIT 1");
            $schStmt->execute([':name' => $reqName, ':nameLike' => '%' . $reqName . '%']);
            $foundSchool = $schStmt->fetch();
        } catch (Exception $e) {}

        $stmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
        $prof = json_decode($stmt->fetchColumn() ?: '{}', true);

        $matched = false;
        $matchedSchool = null;

        if ($foundSchool) {
            $normDbCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $foundSchool['code'] ?? ''));
            if (!empty($normDbCode) && $normReqCode === $normDbCode) {
                $matched = true;
                $matchedSchool = [
                    'id' => $foundSchool['id'],
                    'name' => $foundSchool['name'],
                    'npsn' => $foundSchool['npsn'] ?? '',
                    'address' => $prof['schoolAddress'] ?? '',
                    'email' => $prof['schoolEmail'] ?? '',
                    'phone' => $prof['schoolPhone'] ?? '',
                    'academicYear' => $foundSchool['academic_year'] ?? '2026/2027',
                    'semester' => $foundSchool['semester'] ?? 'Ganjil',
                    'principalName' => $foundSchool['principal_name'] ?? ($prof['fullName'] ?? ''),
                    'principalNip' => $foundSchool['principal_nip'] ?? ($prof['nip'] ?? ''),
                    'schoolCode' => $foundSchool['code'],
                    'modulAjarFolderUrl' => $prof['modulAjarFolderUrl'] ?? ''
                ];
            }
        }

        if (!$matched && !empty($prof['schoolCode'])) {
            $normDbCode  = strtoupper(preg_replace('/[^A-Z0-9]/', '', $prof['schoolCode'] ?? ''));
            $cleanReqName = strtolower(trim(preg_replace('/[^A-Za-z0-9]/', '', $reqName)));
            $cleanDbName  = strtolower(trim(preg_replace('/[^A-Za-z0-9]/', '', $prof['schoolName'] ?? '')));
            $nameMatch = (stripos($cleanDbName, $cleanReqName) !== false) || (stripos($cleanReqName, $cleanDbName) !== false);

            if ($nameMatch && !empty($normDbCode) && $normReqCode === $normDbCode) {
                $matched = true;
                $matchedSchool = [
                    'id' => $prof['schoolId'] ?? 'SCH-001',
                    'name' => $prof['schoolName'],
                    'npsn' => $prof['npsn'] ?? '',
                    'address' => $prof['schoolAddress'] ?? '',
                    'email' => $prof['schoolEmail'] ?? '',
                    'phone' => $prof['schoolPhone'] ?? '',
                    'academicYear' => $prof['academicYear'] ?? '',
                    'semester' => $prof['semester'] ?? '',
                    'principalName' => $prof['fullName'] ?? '',
                    'principalNip' => $prof['nip'] ?? '',
                    'schoolCode' => $prof['schoolCode'],
                    'modulAjarFolderUrl' => $prof['modulAjarFolderUrl'] ?? ''
                ];
            }
        }

        if ($matched && $matchedSchool) {
            echo json_encode([
                'success' => true,
                'message' => 'Autentikasi kode sekolah berhasil.',
                'school' => $matchedSchool
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Nama sekolah atau kode sekolah tidak cocok. Silakan tanyakan kode sekolah ke Kepala Sekolah.']);
        }
        break;

    case 'tendik_portal_login':
    case 'get_tendik_personal_data':
    case 'guru_portal_login':
    case 'get_guru_personal_data':
        $reqSchoolName  = trim($inputData['schoolName'] ?? $_GET['schoolName'] ?? '');
        $reqSchoolCode  = trim($inputData['schoolCode'] ?? $_GET['schoolCode'] ?? '');
        $reqTeacherName = trim($inputData['teacherName'] ?? ($inputData['employeeName'] ?? ($_GET['teacherName'] ?? ($_GET['employeeName'] ?? ''))));
        $reqTeacherId   = trim($inputData['teacherId'] ?? ($inputData['employeeId'] ?? ($_GET['teacherId'] ?? ($_GET['employeeId'] ?? ''))));
        $reqTeacherCode = trim($inputData['teacherCode'] ?? ($inputData['accessCode'] ?? ($_GET['teacherCode'] ?? ($_GET['accessCode'] ?? ''))));

        if (empty($reqSchoolCode)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Kode sekolah wajib diisi.']);
            break;
        }

        // 1. Verify school
        $normReqCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $reqSchoolCode));
        $foundSchool = null;
        if (!empty($reqSchoolName)) {
            try {
                $schStmt = $pdo->prepare("SELECT * FROM schools WHERE LOWER(name) = LOWER(:name) OR name LIKE :nameLike LIMIT 1");
                $schStmt->execute([':name' => $reqSchoolName, ':nameLike' => '%' . $reqSchoolName . '%']);
                $foundSchool = $schStmt->fetch();
            } catch (Exception $e) {}
        }

        $stmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
        $prof = json_decode($stmt->fetchColumn() ?: '{}', true);

        $isValidSchool = false;
        $activeSchoolData = null;

        if ($foundSchool) {
            $normDbCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $foundSchool['code'] ?? ''));
            if (!empty($normDbCode) && $normReqCode === $normDbCode) {
                $isValidSchool = true;
                $schProf = !empty($foundSchool['profile_json']) ? json_decode($foundSchool['profile_json'], true) : [];
                $activeSchoolData = [
                    'id'            => $foundSchool['id'],
                    'name'          => $foundSchool['name'],
                    'npsn'          => $foundSchool['npsn'] ?? ($schProf['npsn'] ?? ''),
                    'address'       => $schProf['schoolAddress'] ?? ($prof['schoolAddress'] ?? ''),
                    'email'         => $schProf['schoolEmail'] ?? ($prof['schoolEmail'] ?? ''),
                    'phone'         => $schProf['schoolPhone'] ?? ($prof['schoolPhone'] ?? ''),
                    'academicYear'  => $foundSchool['academic_year'] ?? ($schProf['academicYear'] ?? '2026/2027'),
                    'semester'      => $foundSchool['semester'] ?? ($schProf['semester'] ?? 'Ganjil'),
                    'principalName' => $foundSchool['principal_name'] ?? ($schProf['fullName'] ?? ($prof['fullName'] ?? '')),
                    'principalNip'  => $foundSchool['principal_nip'] ?? ($schProf['nip'] ?? ($prof['nip'] ?? '-')),
                    'schoolCode'    => $foundSchool['code'],
                    'modulAjarFolderUrl' => $schProf['modulAjarFolderUrl'] ?? ($prof['modulAjarFolderUrl'] ?? '')
                ];
            }
        }

        if (!$isValidSchool && !empty($prof['schoolCode'])) {
            $normDbCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $prof['schoolCode'] ?? ''));
            if ($normReqCode === $normDbCode) {
                $isValidSchool = true;
                $activeSchoolData = [
                    'id'            => $prof['schoolId'] ?? 'SCH-001',
                    'name'          => $prof['schoolName'] ?? 'SMP Brighton',
                    'npsn'          => $prof['npsn'] ?? '',
                    'address'       => $prof['schoolAddress'] ?? '',
                    'email'         => $prof['schoolEmail'] ?? '',
                    'phone'         => $prof['schoolPhone'] ?? '',
                    'academicYear'  => $prof['academicYear'] ?? '2026/2027',
                    'semester'      => $prof['semester'] ?? 'Ganjil',
                    'principalName' => $prof['fullName'] ?? '',
                    'principalNip'  => $prof['nip'] ?? '-',
                    'schoolCode'    => $prof['schoolCode'] ?? '',
                    'modulAjarFolderUrl' => $prof['modulAjarFolderUrl'] ?? ''
                ];
            }
        }

        if (!$isValidSchool) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Kode sekolah tidak valid untuk ' . ($reqSchoolName ?: 'sekolah ini') . '.']);
            break;
        }

        // 2. Verify teacher/employee
        if (empty($reqTeacherName) && empty($reqTeacherId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Silakan pilih Nama Guru / Tendik.']);
            break;
        }

        $activeSchoolId = $activeSchoolData['id'] ?? ($foundSchool['id'] ?? 'SCH-001');
        $empTenantCond = getTenantSchoolCondition($activeSchoolId, 'school_id');
        $empSql = "SELECT * FROM users WHERE $empTenantCond AND role IN ('guru', 'guru_bk', 'staff', 'kepala_sekolah') ORDER BY full_name ASC";
        $eStmt = $pdo->prepare($empSql);
        $eStmt->execute([':sid' => $activeSchoolId]);
        $foundEmployee = null;
        $foundUserRow = null;
        while ($row = $eStmt->fetch(PDO::FETCH_ASSOC)) {
            $emp = formatUserAsEmployee($row);
            if (!empty($reqTeacherId) && (($emp['id'] ?? '') === $reqTeacherId || $row['id'] === $reqTeacherId || ($row['employee_id'] ?? '') === $reqTeacherId)) {
                $foundEmployee = $emp;
                $foundUserRow = $row;
                break;
            }
            if (!empty($reqTeacherName) && strcasecmp(trim($emp['name'] ?? ''), trim($reqTeacherName)) === 0) {
                $foundEmployee = $emp;
                $foundUserRow = $row;
                break;
            }
            $cleanReqDigits = preg_replace('/[^0-9]/', '', $reqTeacherName);
            $cleanEmpDigits = preg_replace('/[^0-9]/', '', $emp['nip'] ?? '');
            if (strlen($cleanReqDigits) >= 5 && strlen($cleanEmpDigits) >= 5 && $cleanEmpDigits === $cleanReqDigits) {
                $foundEmployee = $emp;
                $foundUserRow = $row;
                break;
            }
        }

        if (!$foundEmployee || !$foundUserRow) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Data guru tidak ditemukan di database sekolah ini.']);
            break;
        }

        // Auto-generate access code if missing so teacher is never locked out
        if (empty($foundEmployee['accessCode'])) {
            $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            $c1 = ''; for ($i=0; $i<4; $i++) $c1 .= $chars[random_int(0, strlen($chars)-1)];
            $c2 = ''; for ($i=0; $i<4; $i++) $c2 .= $chars[random_int(0, strlen($chars)-1)];
            $foundEmployee['accessCode'] = $c1 . '-' . $c2;
            $foundEmployee['accessCodeGeneratedAt'] = date('c');
            $pdo->prepare("UPDATE users SET access_code = :ac, data_json = :j WHERE id = :id")->execute([
                ':ac' => $foundEmployee['accessCode'],
                ':j' => json_encode($foundEmployee, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':id' => $foundUserRow['id']
            ]);
        }

        // Validate teacher access code (if action is guru_portal_login or if teacherCode was provided)
        $normReqTeacherCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $reqTeacherCode));
        $normDbTeacherCode  = strtoupper(preg_replace('/[^A-Z0-9]/', '', $foundEmployee['accessCode'] ?? ''));

        if (!empty($reqTeacherCode) || $action === 'guru_portal_login') {
            if (empty($normDbTeacherCode) || $normReqTeacherCode !== $normDbTeacherCode) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'Kode akses guru untuk ' . $foundEmployee['name'] . ' tidak cocok. Silakan periksa kartu akses Anda.'
                ]);
                break;
            }
        }

        // 3. Fetch personal records scoped to school and teacher
        $tName = $foundEmployee['name'];

        // Schedules
        $portalTenantCond = getTenantSchoolCondition($activeSchoolId);
        $schStmt = $pdo->prepare("SELECT data_json FROM supervision_schedules WHERE $portalTenantCond AND LOWER(teacher_name) = LOWER(:tname) ORDER BY rpp_date DESC, obs_date DESC");
        $schStmt->execute([':sid' => $activeSchoolId, ':tname' => $tName]);
        $schedules = [];
        while ($row = $schStmt->fetch()) {
            $schedules[] = json_decode($row['data_json'], true);
        }

        // Observations
        $obsStmt = $pdo->prepare("SELECT data_json FROM observations WHERE $portalTenantCond AND LOWER(teacher_name) = LOWER(:tname) ORDER BY updated_at DESC");
        $obsStmt->execute([':sid' => $activeSchoolId, ':tname' => $tName]);
        $observations = [];
        while ($row = $obsStmt->fetch()) {
            $observations[] = json_decode($row['data_json'], true);
        }

        // Telaah RPP
        $telStmt = $pdo->prepare("SELECT data_json FROM telaah_rpp WHERE $portalTenantCond AND LOWER(teacher_name) = LOWER(:tname) ORDER BY updated_at DESC");
        $telStmt->execute([':sid' => $activeSchoolId, ':tname' => $tName]);
        $telaahList = [];
        while ($row = $telStmt->fetch()) {
            $telaahList[] = json_decode($row['data_json'], true);
        }

        // Supervisi BK
        $bkStmt = $pdo->prepare("SELECT data_json FROM supervisi_bk WHERE $portalTenantCond AND LOWER(teacher_name) = LOWER(:tname) ORDER BY updated_at DESC");
        $bkStmt->execute([':sid' => $activeSchoolId, ':tname' => $tName]);
        $supervisiBkList = [];
        while ($row = $bkStmt->fetch()) {
            $supervisiBkList[] = json_decode($row['data_json'], true);
        }

        // Supervisi Tendik (Tenaga Kependidikan)
        $tdkStmt = $pdo->prepare("SELECT data_json FROM supervisi_tendik WHERE $portalTenantCond AND LOWER(employee_name) = LOWER(:tname) ORDER BY updated_at DESC");
        $tdkStmt->execute([':sid' => $activeSchoolId, ':tname' => $tName]);
        $supervisiTendikList = [];
        while ($row = $tdkStmt->fetch()) {
            $supervisiTendikList[] = json_decode($row['data_json'], true);
        }

        $latestObs = $observations[0] ?? null;
        $latestRpp = $telaahList[0] ?? null;
        $latestBk  = $supervisiBkList[0] ?? null;
        $latestTendik = $supervisiTendikList[0] ?? null;

        echo json_encode([
            'success' => true,
            'message' => 'Autentikasi personal guru/tendik berhasil.',
            'teacher' => [
                'id'               => $foundEmployee['id'],
                'name'             => $foundEmployee['name'],
                'nickname'         => $foundEmployee['nickname'] ?? '',
                'nip'              => $foundEmployee['nip'] ?? '-',
                'nuptk'            => $foundEmployee['nuptk'] ?? '-',
                'role'             => $foundEmployee['role'] ?? 'Guru',
                'gender'           => $foundEmployee['gender'] ?? 'Laki-laki',
                'subject'          => $foundEmployee['subject'] ?? '',
                'department'       => $foundEmployee['department'] ?? '',
                'employmentStatus' => $foundEmployee['employmentStatus'] ?? 'GTT / Kontrak',
                'photo'            => $foundEmployee['photo'] ?? ('https://ui-avatars.com/api/?name=' . urlencode($foundEmployee['name'])),
                'accessCode'       => $foundEmployee['accessCode'] ?? '',
                'email'            => $foundEmployee['email'] ?? '',
                'phone'            => $foundEmployee['phone'] ?? '',
                'education'        => $foundEmployee['education'] ?? '',
                'address'          => $foundEmployee['address'] ?? '',
                'task'             => $foundEmployee['task'] ?? ''
            ],
            'school' => $activeSchoolData,
            'schedules' => $schedules,
            'observations' => $observations,
            'telaahRpp' => $telaahList,
            'supervisiBk' => $supervisiBkList,
            'supervisiTendik' => $supervisiTendikList,
            'summary' => [
                'totalObservations' => count($observations),
                'latestObservation' => $latestObs,
                'totalTelaahRpp'    => count($telaahList),
                'latestTelaahRpp'   => $latestRpp,
                'totalSupervisiBk'  => count($supervisiBkList),
                'latestSupervisiBk' => $latestBk,
                'totalSupervisiTendik' => count($supervisiTendikList),
                'latestSupervisiTendik' => $latestTendik,
                'totalSchedules'    => count($schedules)
            ]
        ]);
        break;

    case 'get_guru_dashboard_data':
        $reqName = trim($inputData['schoolName'] ?? $_GET['schoolName'] ?? '');
        $reqCode = trim($inputData['schoolCode'] ?? $_GET['schoolCode'] ?? '');

        $stmt = $pdo->query("SELECT profile_json FROM app_profile WHERE id = 1");
        $prof = json_decode($stmt->fetchColumn() ?: '{}', true);

        // Require school code
        if (empty($reqCode)) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Kode sekolah wajib diisi untuk melihat statistik dashboard guru.']);
            break;
        }

        $normReqCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $reqCode));

        // 1. Try finding in schools table
        $foundSchool = null;
        if (!empty($reqName)) {
            try {
                $schStmt = $pdo->prepare("SELECT * FROM schools WHERE LOWER(name) = LOWER(:name) OR name LIKE :nameLike LIMIT 1");
                $schStmt->execute([':name' => $reqName, ':nameLike' => '%' . $reqName . '%']);
                $foundSchool = $schStmt->fetch();
            } catch (Exception $e) {}
        }

        $isValidCode = false;
        $activeSchoolData = null;

        if ($foundSchool) {
            $normDbCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $foundSchool['code'] ?? ''));
            if (!empty($normDbCode) && $normReqCode === $normDbCode) {
                $isValidCode = true;
                $activeSchoolData = [
                    'name' => $foundSchool['name'],
                    'npsn' => $foundSchool['npsn'] ?? '',
                    'address' => $prof['schoolAddress'] ?? '',
                    'academicYear' => $foundSchool['academic_year'] ?? '2026/2027',
                    'semester' => $foundSchool['semester'] ?? 'Ganjil',
                    'principalName' => $foundSchool['principal_name'] ?? ($prof['fullName'] ?? ''),
                    'principalNip' => $foundSchool['principal_nip'] ?? ($prof['nip'] ?? '-'),
                    'schoolCode' => $foundSchool['code'],
                    'modulAjarFolderUrl' => $prof['modulAjarFolderUrl'] ?? ''
                ];
            }
        }

        if (!$isValidCode) {
            $normDbCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $prof['schoolCode'] ?? ''));
            if ($normReqCode === $normDbCode) {
                if (!empty($reqName)) {
                    $cleanReqName = strtolower(trim(preg_replace('/[^A-Za-z0-9]/', '', $reqName)));
                    $cleanDbName  = strtolower(trim(preg_replace('/[^A-Za-z0-9]/', '', $prof['schoolName'] ?? '')));
                    $nameMatch = (stripos($cleanDbName, $cleanReqName) !== false) || (stripos($cleanReqName, $cleanDbName) !== false);
                    if ($nameMatch) {
                        $isValidCode = true;
                    }
                } else {
                    $isValidCode = true;
                }
                if ($isValidCode) {
                    $activeSchoolData = [
                        'name' => $prof['schoolName'] ?? 'SMP Brighton',
                        'npsn' => $prof['npsn'] ?? '',
                        'address' => $prof['schoolAddress'] ?? '',
                        'academicYear' => $prof['academicYear'] ?? '2026/2027',
                        'semester' => $prof['semester'] ?? 'Ganjil',
                        'principalName' => $prof['fullName'] ?? '',
                        'principalNip' => $prof['nip'] ?? '-',
                        'schoolCode' => $prof['schoolCode'] ?? '',
                        'modulAjarFolderUrl' => $prof['modulAjarFolderUrl'] ?? ''
                    ];
                }
            }
        }

        if (!$isValidCode) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Nama sekolah atau kode sekolah tidak valid. Silakan tanyakan ke Kepala Sekolah.']);
            break;
        }
        
        $activeSchoolId = $foundSchool ? $foundSchool['id'] : ($prof['schoolId'] ?? 'SCH-001');
        $tenantCond = getTenantSchoolCondition($activeSchoolId);

        // Fetch employees scoped to this school directly from users table
        $tenantCondUsers = getTenantSchoolCondition($activeSchoolId, 'school_id');
        $eStmt = $pdo->prepare("SELECT * FROM users WHERE $tenantCondUsers AND role IN ('guru', 'guru_bk', 'staff', 'kepala_sekolah') ORDER BY full_name ASC");
        $eStmt->execute([':sid' => $activeSchoolId]);
        $allEmp = [];
        $teachers = [];
        while ($row = $eStmt->fetch(PDO::FETCH_ASSOC)) {
            $emp = formatUserAsEmployee($row);
            if ($emp) {
                $allEmp[] = $emp;
                if (in_array($row['role'], ['guru', 'guru_bk', 'kepala_sekolah'])) {
                    $teachers[] = $emp;
                }
            }
        }
        
        // Fetch observations scoped to this school
        $oStmt = $pdo->prepare("SELECT data_json FROM observations WHERE $tenantCond ORDER BY updated_at DESC");
        $oStmt->execute([':sid' => $activeSchoolId]);
        $observations = [];
        while ($row = $oStmt->fetch()) {
            $obs = json_decode($row['data_json'], true);
            $observations[] = $obs;
        }
        
        // Fetch telaah RPP scoped to this school
        $tStmt = $pdo->prepare("SELECT data_json FROM telaah_rpp WHERE $tenantCond ORDER BY updated_at DESC");
        $tStmt->execute([':sid' => $activeSchoolId]);
        $telaah = [];
        while ($row = $tStmt->fetch()) {
            $telaah[] = json_decode($row['data_json'], true);
        }
        
        // Calculate statistics
        $totalTeachers = count($teachers);
        $totalEmployees = count($allEmp);
        $observedTeacherNames = [];
        $scores = [];
        $predicateCounts = [
            'Amat Baik' => 0,
            'Baik' => 0,
            'Cukup' => 0,
            'Sedang' => 0,
            'Kurang' => 0
        ];
        
        // Map latest observation per teacher
        $teacherLatestObs = [];
        foreach ($observations as $obs) {
            $tName = $obs['teacherName'] ?? '';
            if (!$tName) continue;
            if (!in_array($tName, $observedTeacherNames)) {
                $observedTeacherNames[] = $tName;
            }
            if (isset($obs['finalScore']) && is_numeric($obs['finalScore'])) {
                $scores[] = (float)$obs['finalScore'];
            }
            if (!empty($obs['predicate'])) {
                $pred = trim($obs['predicate']);
                if (isset($predicateCounts[$pred])) {
                    $predicateCounts[$pred]++;
                } elseif (stripos($pred, 'amat') !== false || stripos($pred, 'sangat') !== false) {
                    $predicateCounts['Amat Baik']++;
                } elseif (stripos($pred, 'baik') !== false) {
                    $predicateCounts['Baik']++;
                } else {
                    $predicateCounts['Cukup']++;
                }
            }
            if (!isset($teacherLatestObs[$tName])) {
                $teacherLatestObs[$tName] = $obs;
            }
        }
        
        $totalObserved = count($observedTeacherNames);
        $progressPct = $totalTeachers > 0 ? round(($totalObserved / $totalTeachers) * 100, 1) : 0;
        $avgScore = count($scores) > 0 ? round(array_sum($scores) / count($scores), 1) : 0;
        
        // Overall School Predicate
        $schoolPredicate = '—';
        if ($avgScore >= 90) $schoolPredicate = 'Amat Baik (A)';
        elseif ($avgScore >= 80) $schoolPredicate = 'Baik (B)';
        elseif ($avgScore >= 70) $schoolPredicate = 'Cukup (C)';
        elseif ($avgScore > 0) $schoolPredicate = 'Perlu Peningkatan (D)';
        
        // Build Teacher Directory for display
        $teachersList = [];
        foreach ($teachers as $t) {
            $tName = $t['name'] ?? '';
            $latest = $teacherLatestObs[$tName] ?? null;
            $hasAccess = !empty($t['accessCode']);
            $teachersList[] = [
                'id' => $t['id'] ?? '',
                'name' => $tName,
                'role' => $t['role'] ?? 'Guru',
                'subject' => $t['subject'] ?? ($t['role'] ?? 'Mata Pelajaran'),
                'nip' => $t['nip'] ?? '-',
                'photo' => $t['photo'] ?? ('https://ui-avatars.com/api/?name=' . urlencode($tName) . '&background=475569&color=fff&size=100'),
                'department' => $t['department'] ?? '',
                'hasAccessCode' => $hasAccess,
                'isObserved' => $latest !== null,
                'latestScore' => $latest ? ($latest['finalScore'] ?? null) : null,
                'latestPredicate' => $latest ? ($latest['predicate'] ?? null) : null,
                'latestDate' => $latest ? ($latest['date'] ?? $latest['updatedAt'] ?? null) : null,
            ];
        }
        
        echo json_encode([
            'success' => true,
            'school' => $activeSchoolData ?: [
                'name' => $prof['schoolName'] ?? 'SMP Brighton',
                'npsn' => $prof['npsn'] ?? '',
                'address' => $prof['schoolAddress'] ?? '',
                'academicYear' => $prof['academicYear'] ?? '2026/2027',
                'semester' => $prof['semester'] ?? 'Ganjil',
                'principalName' => $prof['fullName'] ?? '',
                'principalNip' => $prof['nip'] ?? '-',
                'schoolCode' => $prof['schoolCode'] ?? '',
                'modulAjarFolderUrl' => $prof['modulAjarFolderUrl'] ?? ''
            ],
            'statistics' => [
                'totalEmployees' => $totalEmployees,
                'totalTeachers' => $totalTeachers,
                'totalObserved' => $totalObserved,
                'observationProgressPercent' => $progressPct,
                'averageScore' => $avgScore,
                'schoolPredicate' => $schoolPredicate,
                'totalTelaahRpp' => count($telaah),
                'predicateCounts' => $predicateCounts
            ],
            'teachers' => $teachersList
        ]);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Action tidak dikenali: ' . $action]);
}


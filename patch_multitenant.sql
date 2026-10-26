-- ==============================================
-- PATCH: Multi-Tenant Database Fix
-- supervisisekolah.id | Generated: 2026-10-07 13:21:42
-- JALANKAN di phpMyAdmin → SQL tab
-- ==============================================

-- 1. Fix SCH-001 name dan profile
UPDATE schools
SET
    name           = 'SMP Brighton',
    principal_name = 'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
    profile_json   = '{\n    "schoolId": "SCH-001",\n    "schoolCode": "BRI-TF8U",\n    "schoolName": "SMP Brighton",\n    "npsn": "20100123",\n    "fullName": "Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.",\n    "firstName": "Ignasius Widi",\n    "lastName": "Nugroho",\n    "nickName": "Pak Widi",\n    "titlePrefix": "",\n    "titleSuffix": "S.Sos., Gr., S.Pd.",\n    "nip": "19750812 199903 1 002",\n    "nuptk": "8493750284019283",\n    "email": "kepala.sekolah@smpbrighton.sch.id",\n    "phone": "0812-9889-0002",\n    "role": "Kepala Sekolah SMP",\n    "academicYear": "2026/2027",\n    "semester": "Ganjil",\n    "schoolAddress": "",\n    "modulAjarFolderUrl": "",\n    "username": "eagenwidi",\n    "school_id": "SCH-001",\n    "token": "e3f27b8f666b20e4c591af30b18bf3cf52d8b3490b201d2c92695b6245864a89"\n}',
    updated_at     = '2026-10-07 13:21:42'
WHERE id = 'SCH-001';

-- 2. Fix SCH-002 profile
UPDATE schools
SET
    principal_name = 'Siti Rogaya, M.Pd.',
    profile_json   = '{\n    "schoolId": "SCH-002",\n    "schoolCode": "FAT-8M2X",\n    "schoolName": "SMP Fatahillah",\n    "npsn": "20104567",\n    "fullName": "Siti Rogaya, M.Pd.",\n    "firstName": "Siti",\n    "lastName": "Rogaya",\n    "nickName": "Ibu Siti",\n    "titlePrefix": "",\n    "titleSuffix": "M.Pd.",\n    "nip": "19800514 200501 2 008",\n    "nuptk": "7392810482019382",\n    "email": "kepala.sekolah@smpfatahillah.sch.id",\n    "phone": "0813-8877-6655",\n    "role": "Kepala Sekolah SMP",\n    "academicYear": "2026/2027",\n    "semester": "Ganjil",\n    "schoolAddress": "",\n    "modulAjarFolderUrl": "",\n    "username": "sitirogaya",\n    "school_id": "SCH-002",\n    "token": "1d1ae905e42710c781bc9caea519fab0bcb741e2a2c213a68e9024997a0f38c3"\n}',
    updated_at     = '2026-10-07 13:21:42'
WHERE id = 'SCH-002';

-- 3. Sync app_profile (legacy)
INSERT INTO app_profile (id, school_id, profile_json, updated_at)
VALUES (1, 'SCH-001', '{\n    "schoolId": "SCH-001",\n    "schoolCode": "BRI-TF8U",\n    "schoolName": "SMP Brighton",\n    "npsn": "20100123",\n    "fullName": "Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.",\n    "firstName": "Ignasius Widi",\n    "lastName": "Nugroho",\n    "nickName": "Pak Widi",\n    "titlePrefix": "",\n    "titleSuffix": "S.Sos., Gr., S.Pd.",\n    "nip": "19750812 199903 1 002",\n    "nuptk": "8493750284019283",\n    "email": "kepala.sekolah@smpbrighton.sch.id",\n    "phone": "0812-9889-0002",\n    "role": "Kepala Sekolah SMP",\n    "academicYear": "2026/2027",\n    "semester": "Ganjil",\n    "schoolAddress": "",\n    "modulAjarFolderUrl": "",\n    "username": "eagenwidi",\n    "school_id": "SCH-001",\n    "token": "e3f27b8f666b20e4c591af30b18bf3cf52d8b3490b201d2c92695b6245864a89"\n}', '2026-10-07 13:21:42')
ON DUPLICATE KEY UPDATE
    profile_json = VALUES(profile_json),
    school_id    = 'SCH-001',
    updated_at   = VALUES(updated_at);

-- 4. Assign SCH-001 ke semua baris yang belum punya school_id
UPDATE employees            SET school_id = 'SCH-001' WHERE school_id IS NULL OR school_id = '';
UPDATE observations         SET school_id = 'SCH-001' WHERE school_id IS NULL OR school_id = '';
UPDATE telaah_rpp           SET school_id = 'SCH-001' WHERE school_id IS NULL OR school_id = '';
UPDATE supervision_schedules SET school_id = 'SCH-001' WHERE school_id IS NULL OR school_id = '';

-- 5. Fix users
UPDATE users SET school_id = 'SCH-001', role = 'kepala_sekolah', employee_id = 'EMP-001'     WHERE username = 'eagenwidi';
UPDATE users SET school_id = 'SCH-002', role = 'kepala_sekolah', employee_id = 'EMP-FTH-001' WHERE username = 'sitirogaya';
UPDATE users SET school_id = 'SCH-001' WHERE (school_id IS NULL OR school_id = '') AND username <> 'sitirogaya';

-- 6. Clear semua session (paksa login ulang bersih)
UPDATE users SET session_token = NULL;

-- ==============================================
-- SELESAI
-- ==============================================

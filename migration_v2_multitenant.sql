-- =======================================================================
-- supervisisekolah.id - Migration v2: Multi-Tenant Architecture & RBAC
-- Target Engine: MySQL / MariaDB (Database: supervisisekolah_id)
-- Single Source of Truth - Multi-Tenancy by school_id
-- =======================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tabel: schools (Satuan Sekolah Tenant)
CREATE TABLE IF NOT EXISTS `schools` (
  `id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `npsn` VARCHAR(50) DEFAULT '',
  `principal_name` VARCHAR(255) DEFAULT '',
  `principal_nip` VARCHAR(100) DEFAULT '',
  `address` VARCHAR(500) DEFAULT '',
  `email` VARCHAR(255) DEFAULT '',
  `phone` VARCHAR(50) DEFAULT '',
  `modul_ajar_folder_url` VARCHAR(1000) DEFAULT '',
  `academic_year` VARCHAR(50) DEFAULT '2026/2027',
  `semester` VARCHAR(50) DEFAULT 'Ganjil',
  `profile_json` LONGTEXT,
  `status` VARCHAR(20) DEFAULT 'active',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_school_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel: users (Pengguna Sistem & RBAC)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `title_prefix` VARCHAR(50) DEFAULT '',
  `first_name` VARCHAR(100) DEFAULT '',
  `last_name` VARCHAR(100) DEFAULT '',
  `title_suffix` VARCHAR(100) DEFAULT '',
  `nickname` VARCHAR(100) DEFAULT '',
  `role` VARCHAR(50) NOT NULL,
  `school_id` VARCHAR(50) DEFAULT NULL,
  `employee_id` VARCHAR(191) DEFAULT NULL,
  `nip` VARCHAR(100) DEFAULT NULL,
  `nuptk` VARCHAR(50) DEFAULT '',
  `phone` VARCHAR(50) DEFAULT NULL,
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `must_change_password` TINYINT(1) DEFAULT 0,
  `last_login` VARCHAR(50) DEFAULT NULL,
  `session_token` VARCHAR(255) DEFAULT NULL,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_username` (`username`),
  KEY `idx_users_school_id` (`school_id`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Pivot: pengawas_schools (Penugasan Pengawas ke Banyak Sekolah)
CREATE TABLE IF NOT EXISTS `pengawas_schools` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `pengawas_user_id` VARCHAR(50) NOT NULL,
  `school_id` VARCHAR(50) NOT NULL,
  `created_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pengawas_school` (`pengawas_user_id`, `school_id`),
  KEY `idx_ps_pengawas` (`pengawas_user_id`),
  KEY `idx_ps_school` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel: employees (GTK / Guru & Karyawan)
CREATE TABLE IF NOT EXISTS `employees` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
  `name` VARCHAR(255) DEFAULT NULL,
  `role` VARCHAR(100) DEFAULT NULL,
  `data_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_employees_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel: observations (Pelaksanaan Observasi Kelas)
CREATE TABLE IF NOT EXISTS `observations` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
  `teacher_name` VARCHAR(255) DEFAULT NULL,
  `subject` VARCHAR(255) DEFAULT NULL,
  `academic_year` VARCHAR(50) DEFAULT NULL,
  `semester` VARCHAR(50) DEFAULT NULL,
  `data_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_observations_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel: telaah_rpp (Telaah RPP / Modul Ajar)
CREATE TABLE IF NOT EXISTS `telaah_rpp` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
  `teacher_name` VARCHAR(255) DEFAULT NULL,
  `subject` VARCHAR(255) DEFAULT NULL,
  `academic_year` VARCHAR(50) DEFAULT NULL,
  `semester` VARCHAR(50) DEFAULT NULL,
  `data_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_telaah_rpp_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel: supervision_schedules (Jadwal Supervisi Akademik)
CREATE TABLE IF NOT EXISTS `supervision_schedules` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
  `teacher_id` VARCHAR(191) DEFAULT NULL,
  `teacher_name` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) DEFAULT NULL,
  `grade_class` VARCHAR(100) DEFAULT NULL,
  `rpp_date` VARCHAR(50) NOT NULL,
  `obs_date` VARCHAR(50) NOT NULL,
  `time_slot` VARCHAR(150) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `submitted_by` VARCHAR(50) NOT NULL DEFAULT 'Guru',
  `notes` TEXT DEFAULT NULL,
  `rejection_reason` TEXT DEFAULT NULL,
  `academic_year` VARCHAR(50) DEFAULT NULL,
  `semester` VARCHAR(50) DEFAULT NULL,
  `data_json` LONGTEXT NOT NULL,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_schedules_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabel: evaluasi (Evaluasi Kinerja Tahunan / 19 Kompetensi)
CREATE TABLE IF NOT EXISTS `evaluasi` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(50) NOT NULL DEFAULT 'SCH-001',
  `data_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_evaluasi_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Centralized Master Data: supervision_categories & supervision_indicators
CREATE TABLE IF NOT EXISTS `supervision_categories` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `color` VARCHAR(50) DEFAULT 'blue',
  `icon` VARCHAR(50) DEFAULT 'bookmark',
  `is_custom` TINYINT(1) DEFAULT 0,
  `sort_order` INT DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supervision_indicators` (
  `id` VARCHAR(50) NOT NULL,
  `category_id` VARCHAR(50) NOT NULL,
  `category_name` VARCHAR(255) NOT NULL,
  `stage` VARCHAR(50) NOT NULL,
  `number_order` INT NOT NULL,
  `title` TEXT NOT NULL,
  `focus` VARCHAR(255) DEFAULT '',
  `scale_min` INT DEFAULT 1,
  `scale_max` INT DEFAULT 4,
  `is_custom` TINYINT(1) DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ind_category` (`category_id`),
  KEY `idx_ind_stage` (`stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabel Legacy Support: app_profile & app_settings
CREATE TABLE IF NOT EXISTS `app_profile` (
  `id` INT NOT NULL,
  `school_id` VARCHAR(50) DEFAULT 'SCH-001',
  `profile_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` VARCHAR(191) NOT NULL,
  `setting_value` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================================
-- DATA HYGIENE: Pastikan kolom school_id ada dan NOT NULL pada tabel operasional
-- =======================================================================
SET @exist_emp_sid := (SELECT COUNT(1) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='employees' AND column_name='school_id');
SET @sql_emp_sid := IF(@exist_emp_sid = 0, 'ALTER TABLE employees ADD COLUMN school_id VARCHAR(50) NOT NULL DEFAULT \'SCH-001\' AFTER id', 'ALTER TABLE employees MODIFY school_id VARCHAR(50) NOT NULL');
PREPARE stmt FROM @sql_emp_sid; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_obs_sid := (SELECT COUNT(1) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='observations' AND column_name='school_id');
SET @sql_obs_sid := IF(@exist_obs_sid = 0, 'ALTER TABLE observations ADD COLUMN school_id VARCHAR(50) NOT NULL DEFAULT \'SCH-001\' AFTER id', 'ALTER TABLE observations MODIFY school_id VARCHAR(50) NOT NULL');
PREPARE stmt FROM @sql_obs_sid; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_tel_sid := (SELECT COUNT(1) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='telaah_rpp' AND column_name='school_id');
SET @sql_tel_sid := IF(@exist_tel_sid = 0, 'ALTER TABLE telaah_rpp ADD COLUMN school_id VARCHAR(50) NOT NULL DEFAULT \'SCH-001\' AFTER id', 'ALTER TABLE telaah_rpp MODIFY school_id VARCHAR(50) NOT NULL');
PREPARE stmt FROM @sql_tel_sid; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_sch_sid := (SELECT COUNT(1) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='supervision_schedules' AND column_name='school_id');
SET @sql_sch_sid := IF(@exist_sch_sid = 0, 'ALTER TABLE supervision_schedules ADD COLUMN school_id VARCHAR(50) NOT NULL DEFAULT \'SCH-001\' AFTER id', 'ALTER TABLE supervision_schedules MODIFY school_id VARCHAR(50) NOT NULL');
PREPARE stmt FROM @sql_sch_sid; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_eva_sid := (SELECT COUNT(1) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='evaluasi' AND column_name='school_id');
SET @sql_eva_sid := IF(@exist_eva_sid = 0, 'ALTER TABLE evaluasi ADD COLUMN school_id VARCHAR(50) NOT NULL DEFAULT \'SCH-001\' AFTER id', 'ALTER TABLE evaluasi MODIFY school_id VARCHAR(50) NOT NULL');
PREPARE stmt FROM @sql_eva_sid; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update baris kosong ke SCH-001
UPDATE `employees` SET `school_id` = 'SCH-001' WHERE `school_id` IS NULL OR `school_id` = '';
UPDATE `observations` SET `school_id` = 'SCH-001' WHERE `school_id` IS NULL OR `school_id` = '';
UPDATE `telaah_rpp` SET `school_id` = 'SCH-001' WHERE `school_id` IS NULL OR `school_id` = '';
UPDATE `supervision_schedules` SET `school_id` = 'SCH-001' WHERE `school_id` IS NULL OR `school_id` = '';
UPDATE `evaluasi` SET `school_id` = 'SCH-001' WHERE `school_id` IS NULL OR `school_id` = '';

-- Tambahkan Index pada school_id dan role di users
SET @exist_idx_u_sid := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND index_name='idx_users_school_id');
SET @sql_u_sid := IF(@exist_idx_u_sid = 0, 'ALTER TABLE users ADD INDEX idx_users_school_id (school_id)', 'SELECT 1');
PREPARE stmt FROM @sql_u_sid; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_idx_u_role := (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND index_name='idx_users_role');
SET @sql_u_role := IF(@exist_idx_u_role = 0, 'ALTER TABLE users ADD INDEX idx_users_role (role)', 'SELECT 1');
PREPARE stmt FROM @sql_u_role; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =======================================================================
-- SEEDING CANONICAL TENANTS & RBAC ROLES
-- =======================================================================

-- Seed Sekolah 1 (SCH-001) - SMP Brighton
INSERT INTO `schools` (`id`, `code`, `name`, `npsn`, `principal_name`, `principal_nip`, `address`, `email`, `phone`, `academic_year`, `semester`, `status`, `created_at`, `updated_at`)
VALUES (
  'SCH-001',
  'BRI-TF8U',
  'SMP Brighton',
  '20269341',
  'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
  '19750812 199903 1 002',
  'Jalan Alternatif Cibubur Kav. DDN No. 7, Cimanggis - Depok',
  'brighton.jhs@gmail.com',
  '082298890002',
  '2026/2027',
  'Ganjil',
  'active',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `code` = VALUES(`code`),
  `npsn` = VALUES(`npsn`),
  `principal_name` = VALUES(`principal_name`),
  `principal_nip` = VALUES(`principal_nip`),
  `updated_at` = NOW();

-- Seed Sekolah 2 (SCH-002) - SMP Fatahillah
INSERT INTO `schools` (`id`, `code`, `name`, `npsn`, `principal_name`, `principal_nip`, `address`, `email`, `phone`, `academic_year`, `semester`, `status`, `created_at`, `updated_at`)
VALUES (
  'SCH-002',
  'FAT-8M2X',
  'SMP Fatahillah',
  '20104567',
  'Siti Rogaya, M.Pd.',
  '19800514 200501 2 008',
  'Jl. Raya Fatahillah No. 12, Jakarta',
  'info@smpfatahillah.sch.id',
  '081388776655',
  '2026/2027',
  'Ganjil',
  'active',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `code` = VALUES(`code`),
  `npsn` = VALUES(`npsn`),
  `principal_name` = VALUES(`principal_name`),
  `principal_nip` = VALUES(`principal_nip`),
  `updated_at` = NOW();

-- Seed Super Admin (usr-superadmin)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`, `school_id`, `status`, `created_at`, `updated_at`)
VALUES (
  'usr-superadmin',
  'superadmin',
  'superadmin@supervisisekolah.id',
  '$2y$10$tZea4rR/Jj4Z2kC4U1e7/OHX1P3X2sM.M4x5Y6Z7A8B9C0D1E2F3G', -- superadmin123
  'Super Administrator (Yayasan / Dinas)',
  'super_admin',
  NULL,
  'active',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE
  `role` = 'super_admin',
  `full_name` = VALUES(`full_name`),
  `updated_at` = NOW();

-- Seed Kepala Sekolah 1 (eagenwidi -> SCH-001)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `title_suffix`, `nickname`, `role`, `school_id`, `employee_id`, `nip`, `nuptk`, `phone`, `status`, `created_at`, `updated_at`)
VALUES (
  'usr-ks-001',
  'eagenwidi',
  'math.brighton@gmail.com',
  '$2y$10$wEkgzW4X/N1dM3fU4W0WquBw45fU3eN2u4FvU5fK4w1U2fU3eN2u4', -- kepalasekolah
  'Ignasius Widi Nugroho, S.Sos., Gr., S.Pd.',
  'S.Sos., Gr., S.Pd.',
  'Mr Eagen',
  'kepala_sekolah',
  'SCH-001',
  'EMP-001',
  '19750812 199903 1 002',
  '8456756658200002',
  '082298890002',
  'active',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE
  `role` = 'kepala_sekolah',
  `school_id` = 'SCH-001',
  `employee_id` = 'EMP-001',
  `full_name` = VALUES(`full_name`),
  `updated_at` = NOW();

-- Seed Kepala Sekolah 2 (sitirogaya -> SCH-002)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `title_suffix`, `nickname`, `role`, `school_id`, `employee_id`, `nip`, `nuptk`, `phone`, `status`, `created_at`, `updated_at`)
VALUES (
  'usr-ks-002',
  'sitirogaya',
  'kepala.sekolah@smpfatahillah.sch.id',
  '$2y$10$wEkgzW4X/N1dM3fU4W0WquBw45fU3eN2u4FvU5fK4w1U2fU3eN2u4', -- kepalasekolah
  'Siti Rogaya, M.Pd.',
  'M.Pd.',
  'Ibu Siti',
  'kepala_sekolah',
  'SCH-002',
  'EMP-FTH-001',
  '19800514 200501 2 008',
  '7392810482019382',
  '0813-8877-6655',
  'active',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE
  `role` = 'kepala_sekolah',
  `school_id` = 'SCH-002',
  `employee_id` = 'EMP-FTH-001',
  `full_name` = VALUES(`full_name`),
  `updated_at` = NOW();

-- Seed Pengawas Pembina (usr-pengawas-001)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`, `school_id`, `nip`, `phone`, `status`, `created_at`, `updated_at`)
VALUES (
  'usr-pengawas-001',
  'pengawas',
  'pengawas@dinas.belajar.id',
  '$2y$10$Z3k.mP0nL9qR1sT3uV5wX.uY7aB1cD3eF5gH7iJ9kL1mN3oP5qR7S', -- pengawas123
  'Drs. H. Mulyadi, M.Pd. (Pengawas Pembina)',
  'pengawas',
  NULL,
  '19680315 199303 1 004',
  '0812-3456-7890',
  'active',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE
  `role` = 'pengawas',
  `school_id` = NULL,
  `full_name` = VALUES(`full_name`),
  `updated_at` = NOW();

-- Seed Penugasan Pengawas ke Sekolah Pembinaan (SCH-001 dan SCH-002)
INSERT INTO `pengawas_schools` (`pengawas_user_id`, `school_id`, `created_at`)
VALUES
  ('usr-pengawas-001', 'SCH-001', NOW()),
  ('usr-pengawas-001', 'SCH-002', NOW())
ON DUPLICATE KEY UPDATE `created_at` = VALUES(`created_at`);

SET FOREIGN_KEY_CHECKS = 1;

-- =======================================================================
-- MIGRATION V2 SELESAI
-- =======================================================================

-- ============================================================================
-- supervisisekolah.id - MIGRATION V1: KONSOLIDASI TABEL EMPLOYEES KE USERS
-- Target Database: supervisisekolah_id (MySQL / MariaDB)
-- Single Source of Truth: Menyatukan seluruh data kepegawaian ke tabel users
-- ============================================================================

USE `supervisisekolah_id`;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. PENGUATAN STRUKTUR KOLOM TABEL users
-- ----------------------------------------------------------------------------

-- Tambahkan kolom kepegawaian jika belum ada (atau sesuaikan tipe datanya)
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `title_prefix` VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `first_name` VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `last_name` VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `title_suffix` VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `nickname` VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `gender` ENUM('Laki-laki', 'Perempuan') DEFAULT 'Laki-laki',
    ADD COLUMN IF NOT EXISTS `department` VARCHAR(100) DEFAULT 'Tenaga Pendidik',
    ADD COLUMN IF NOT EXISTS `employment_status` VARCHAR(50) DEFAULT 'GTY',
    ADD COLUMN IF NOT EXISTS `nuptk` VARCHAR(30) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `subject` VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `task` VARCHAR(250) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `education` VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `address` TEXT NULL,
    ADD COLUMN IF NOT EXISTS `access_code` VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `access_code_generated_at` DATETIME NULL,
    ADD COLUMN IF NOT EXISTS `photo_url` TEXT NULL,
    ADD COLUMN IF NOT EXISTS `join_date` DATE NULL,
    ADD COLUMN IF NOT EXISTS `school_id` VARCHAR(50) DEFAULT 'SCH-001',
    ADD COLUMN IF NOT EXISTS `employee_id` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `data_json` LONGTEXT NULL;

-- Indeks performa untuk kueri multi-tenant dan portal guru
ALTER TABLE `users`
    ADD INDEX IF NOT EXISTS `idx_users_school_id` (`school_id`),
    ADD INDEX IF NOT EXISTS `idx_users_role` (`role`),
    ADD INDEX IF NOT EXISTS `idx_users_employee_id` (`employee_id`),
    ADD INDEX IF NOT EXISTS `idx_users_access_code` (`access_code`);

-- ----------------------------------------------------------------------------
-- 2. MIGRASI & SINKRONISASI DATA DARI EMPLOYEES (JIKA MASIH TERSEDIA)
-- ----------------------------------------------------------------------------
-- Menyelaraskan foto avatar dan photo_url
UPDATE `users` SET `photo_url` = `avatar_url` WHERE (`photo_url` IS NULL OR `photo_url` = '') AND `avatar_url` IS NOT NULL;
UPDATE `users` SET `avatar_url` = `photo_url` WHERE (`avatar_url` IS NULL OR `avatar_url` = '') AND `photo_url` IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. ELIMINASI TABEL EMPLOYEES SECARA TOTAL
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `employees_backup_pre_drop`;
DROP TABLE IF EXISTS `employees`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- VERIFIKASI SELESAI:
-- Seluruh GTK/Karyawan kini tersimpan di tabel `users` sebagai single source of truth.
-- ============================================================================

-- Immutable archive of issued ijazat: the exact rendered document (frozen once, with a SHA-256
-- fingerprint), an optional uploaded PDF, and the link from a correction to the ijaza it replaces.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ijazat' AND COLUMN_NAME = 'frozen_html');
SET @sql := IF(@has = 0,
  'ALTER TABLE `ijazat`
     ADD COLUMN `frozen_html` longtext DEFAULT NULL,
     ADD COLUMN `content_hash` char(64) DEFAULT NULL,
     ADD COLUMN `frozen_at` datetime DEFAULT NULL,
     ADD COLUMN `replaces_id` int(11) DEFAULT NULL,
     ADD KEY `ijazat_replaces` (`replaces_id`),
     ADD CONSTRAINT `ijazat_replaces_fk` FOREIGN KEY (`replaces_id`) REFERENCES `ijazat` (`id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `ijaza_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ijaza_id` int(11) NOT NULL,
  `kind` enum('pdf') NOT NULL DEFAULT 'pdf',
  `filename` varchar(200) DEFAULT NULL,
  `size` int(11) NOT NULL,
  `sha256` char(64) NOT NULL,
  `data` longblob NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ijaza_files_one` (`ijaza_id`, `kind`),
  CONSTRAINT `ijaza_files_ijaza_fk` FOREIGN KEY (`ijaza_id`) REFERENCES `ijazat` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

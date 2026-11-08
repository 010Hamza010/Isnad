-- Public verification of issued ijazat (QR code): an unguessable token for the link, a short
-- human code printed under the QR, revocation and a scan counter. Re-runnable.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ijazat' AND COLUMN_NAME = 'public_token');
SET @sql := IF(@has = 0,
  'ALTER TABLE `ijazat`
     ADD COLUMN `public_token` varchar(32) DEFAULT NULL,
     ADD COLUMN `short_code` varchar(16) DEFAULT NULL,
     ADD COLUMN `revoked_at` datetime DEFAULT NULL,
     ADD COLUMN `revoke_reason` varchar(255) DEFAULT NULL,
     ADD COLUMN `scan_count` int(11) NOT NULL DEFAULT 0,
     ADD COLUMN `last_scanned_at` datetime DEFAULT NULL,
     ADD UNIQUE KEY `ijazat_public_token` (`public_token`),
     ADD UNIQUE KEY `ijazat_short_code` (`short_code`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

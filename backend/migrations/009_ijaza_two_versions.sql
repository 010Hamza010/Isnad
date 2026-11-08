-- Each ijaza is issued in two versions: normal (printed, one page) and detailed (footnotes + tree,
-- sent as PDF). The normal original stays in frozen_html; the detailed one gets its own columns,
-- and ijaza_files gains a kind for the detailed PDF. Re-runnable.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ijazat' AND COLUMN_NAME = 'detailed_html');
SET @sql := IF(@has = 0,
  'ALTER TABLE `ijazat`
     ADD COLUMN `detailed_html` longtext DEFAULT NULL,
     ADD COLUMN `detailed_hash` char(64) DEFAULT NULL,
     ADD COLUMN `detailed_frozen_at` datetime DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `ijaza_files` MODIFY `kind` enum('pdf','pdf_detailed') NOT NULL DEFAULT 'pdf';

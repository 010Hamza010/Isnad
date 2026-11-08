-- 1. New transmission type: the shaykh was read to by someone else while I listened.
INSERT IGNORE INTO `transmission_types` (`id`, `name_ar`, `name_en`, `description`, `applies_to`)
VALUES (10, 'قراءة عليه وأنا أسمع', 'Qira''a by another, while listening', NULL, 'both');

-- 2. Ijaza style (normal / detailed) and a JSON snapshot of notes + chains for the detailed one.
--    MySQL has no ADD COLUMN IF NOT EXISTS, so check information_schema to stay re-runnable.
SET @has_style := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ijazat' AND COLUMN_NAME = 'style');
SET @sql := IF(@has_style = 0,
  'ALTER TABLE `ijazat` ADD COLUMN `style` enum(''normal'',''detailed'') NOT NULL DEFAULT ''normal'' AFTER `module`, ADD COLUMN `details` longtext DEFAULT NULL AFTER `body`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

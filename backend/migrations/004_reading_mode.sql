-- Reading from memory («حفظاً») or from the text («نظراً») on a connection where the student read.
-- Re-runnable: MySQL has no ADD COLUMN IF NOT EXISTS.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matn_connections' AND COLUMN_NAME = 'reading_mode');
SET @sql := IF(@has = 0,
  'ALTER TABLE `matn_connections` ADD COLUMN `reading_mode` enum(''heart'',''looking'') DEFAULT NULL AFTER `is_general_ijaza`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quran_connections' AND COLUMN_NAME = 'reading_mode');
SET @sql := IF(@has = 0,
  'ALTER TABLE `quran_connections` ADD COLUMN `reading_mode` enum(''heart'',''looking'') DEFAULT NULL AFTER `meeting_mode`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

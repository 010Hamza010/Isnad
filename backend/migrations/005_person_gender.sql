-- Gender of a person (M / F), used for pronouns and verb agreement in isnad and ijaza texts.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons' AND COLUMN_NAME = 'gender');
SET @sql := IF(@has = 0,
  'ALTER TABLE `persons` ADD COLUMN `gender` enum(''M'',''F'') NOT NULL DEFAULT ''M'' AFTER `name_latin`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Each transmission type gets an optional `kind` (its meaning: sama, qiraa, ijaza_general…).
-- When empty, the app guesses it from the name. Ids differ between databases, so logic uses kinds.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transmission_types' AND COLUMN_NAME = 'kind');
SET @sql := IF(@has = 0,
  'ALTER TABLE `transmission_types` ADD COLUMN `kind` varchar(20) DEFAULT NULL AFTER `name_en`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add «قراءة عليه وأنا أسمع» unless a type for it already exists (003 could not add it where id 10 was taken).
INSERT INTO `transmission_types` (`name_ar`, `name_en`, `kind`, `applies_to`)
SELECT 'قراءة عليه وأنا أسمع', 'Qira''a by another, while listening', 'sama_reading', 'both'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `transmission_types` WHERE `kind` = 'sama_reading' OR `name_ar` LIKE '%وأنا أسمع%' OR `name_ar` LIKE '%وانا اسمع%'
);

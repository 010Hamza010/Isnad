-- persons.primary_qiraa_id («إمام قراءة» on the person) was never filled and is no longer read:
-- who is an imam or a rawi comes from qiraat.imam_id and riwayat.rawi_id. Drop it with its foreign
-- key and index. Re-runnable.
SET @fk := (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons' AND COLUMN_NAME = 'primary_qiraa_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @sql := IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `persons` DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT INDEX_NAME FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons' AND COLUMN_NAME = 'primary_qiraa_id' LIMIT 1);
SET @sql := IF(@idx IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `persons` DROP INDEX `', @idx, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons' AND COLUMN_NAME = 'primary_qiraa_id');
SET @sql := IF(@has = 0, 'SELECT 1', 'ALTER TABLE `persons` DROP COLUMN `primary_qiraa_id`');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

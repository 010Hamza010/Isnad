-- «عام — كل القراءات» on a Quran link above mine: that shaykh read everything on his shaykh.
-- Every link names what was read or is general; links above mine that named nothing were treated as
-- general so far and become general explicitly. My own links must always name what I read. Re-runnable.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quran_connections' AND COLUMN_NAME = 'is_general');
SET @sql := IF(@has = 0,
  'ALTER TABLE `quran_connections` ADD COLUMN `is_general` tinyint(1) NOT NULL DEFAULT 0 AFTER `to_person_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `quran_connections` qc SET qc.`is_general` = 1
WHERE qc.`from_person_id` <> 0 AND qc.`is_general` = 0
  AND NOT EXISTS (SELECT 1 FROM `quran_connection_items` i WHERE i.`connection_id` = qc.`id`);

-- Sharing an isnad between instances: every person gets a permanent code (uid) that travels in
-- the shared file; person_links remembers which local person another instance's code is, so the
-- next import from there matches without asking. Re-runnable.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons' AND COLUMN_NAME = 'uid');
SET @sql := IF(@has = 0,
  'ALTER TABLE `persons` ADD COLUMN `uid` varchar(36) DEFAULT NULL, ADD UNIQUE KEY `persons_uid` (`uid`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `person_links` (
  `uid` varchar(36) NOT NULL,
  `person_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`uid`),
  KEY `person_links_person` (`person_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

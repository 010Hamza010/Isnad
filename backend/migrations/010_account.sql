-- Account: one user per instance. token_version signs out every other device (password change,
-- «sign out other devices»); the two login times show «previous login». Re-runnable.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version');
SET @sql := IF(@has = 0,
  'ALTER TABLE `users`
     ADD COLUMN `token_version` int(11) NOT NULL DEFAULT 0,
     ADD COLUMN `last_login_at` datetime DEFAULT NULL,
     ADD COLUMN `previous_login_at` datetime DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Per-user settings (JSON stored as text so it works on MySQL 8 and MariaDB).
-- First use: isnad_text (keywords and style for chain ↔ text).
CREATE TABLE IF NOT EXISTS `user_settings` (
  `user_id` int(11) NOT NULL,
  `setting_key` varchar(64) NOT NULL,
  `value` longtext NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`, `setting_key`),
  CONSTRAINT `user_settings_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

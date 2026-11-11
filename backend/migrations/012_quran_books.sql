-- The books whose content was read on a Quran link («قرأتُ … بمضمن الشاطبية»). Shown with the
-- isnad; it does not change the chain. Re-runnable.
CREATE TABLE IF NOT EXISTS `quran_connection_books` (
  `connection_id` int(11) NOT NULL,
  `matn_id` int(11) NOT NULL,
  PRIMARY KEY (`connection_id`, `matn_id`),
  KEY `quran_connection_books_matn` (`matn_id`),
  CONSTRAINT `quran_connection_books_conn_fk` FOREIGN KEY (`connection_id`) REFERENCES `quran_connections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quran_connection_books_matn_fk` FOREIGN KEY (`matn_id`) REFERENCES `mutoon` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

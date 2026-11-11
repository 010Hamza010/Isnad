-- Groups of qiraat / riwayat («العشر الصغرى», «الحرميان», «سما»…): picked as one on a Quran link,
-- expanded into their members for the routes, and named as a whole in the text («قرأ القراءات العشر
-- الصغرى على …»). A link stores the group itself. Re-runnable.
CREATE TABLE IF NOT EXISTS `quran_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name_ar` varchar(150) NOT NULL,
  `text_ar` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quran_group_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `qiraa_id` int(11) DEFAULT NULL,
  `riwaya_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `quran_group_items_group` (`group_id`),
  CONSTRAINT `quran_group_items_group_fk` FOREIGN KEY (`group_id`) REFERENCES `quran_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quran_group_items_qiraa_fk` FOREIGN KEY (`qiraa_id`) REFERENCES `qiraat` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quran_group_items_riwaya_fk` FOREIGN KEY (`riwaya_id`) REFERENCES `riwayat` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quran_group_books` (
  `group_id` int(11) NOT NULL,
  `matn_id` int(11) NOT NULL,
  PRIMARY KEY (`group_id`, `matn_id`),
  CONSTRAINT `quran_group_books_group_fk` FOREIGN KEY (`group_id`) REFERENCES `quran_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quran_group_books_matn_fk` FOREIGN KEY (`matn_id`) REFERENCES `mutoon` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quran_connection_groups` (
  `connection_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`connection_id`, `group_id`),
  KEY `quran_connection_groups_group` (`group_id`),
  CONSTRAINT `quran_connection_groups_conn_fk` FOREIGN KEY (`connection_id`) REFERENCES `quran_connections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quran_connection_groups_group_fk` FOREIGN KEY (`group_id`) REFERENCES `quran_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

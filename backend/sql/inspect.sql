-- Read-only queries to look into the database (nothing here changes data).
-- Run one block at a time, e.g. in the mysql client:  mysql -u root -p isnad_db
-- or paste into phpMyAdmin / DBeaver / MySQL Workbench.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;  -- run first: avoids «Illegal mix of collations» with the @variables

-- Person id 0 is «أنا» (you): it has no row in `persons`.
-- LIKE matches the name as written: search a short part without tashkeel («الجزري», not «الجَزَرِيّ»).

-- ── 1. Find a person (to get their id) ───────────────────────────────────
SET @name = 'الجزري';
SELECT id, name_ar, kunya, death_year, century, region
FROM persons WHERE name_ar LIKE CONCAT('%', @name, '%') OR kunya LIKE CONCAT('%', @name, '%')
ORDER BY name_ar;

-- ── 2. Matn links, person → person, readable (latest first) ──────────────
-- «من» = the student, «على» = the shaykh. Filter with the WHERE lines at the bottom.
SET @from = '';          -- part of the student's name, '' = any  (use 'أنا' for your own links)
SET @to   = '';          -- part of the shaykh's name,  '' = any
SELECT mc.id,
       IF(mc.from_person_id = 0, 'أنا', pf.name_ar) AS `من`,
       pt.name_ar                                   AS `على`,
       m.title                                      AS `المتن`,
       tt.name_ar                                   AS `طريقة التحمل`,
       IF(mc.is_general_ijaza, 'عامة', '')          AS `إجازة عامة`,
       mc.reading_mode, mc.description, mc.created_at,
       mc.from_person_id, mc.to_person_id, mc.matn_id
FROM matn_connections mc
LEFT JOIN persons pf ON pf.id = mc.from_person_id
LEFT JOIN persons pt ON pt.id = mc.to_person_id
LEFT JOIN mutoon  m  ON m.id  = mc.matn_id
LEFT JOIN transmission_types tt ON tt.id = mc.transmission_type_id
WHERE (@from = '' OR IF(mc.from_person_id = 0, 'أنا', pf.name_ar) LIKE CONCAT('%', @from, '%'))
  AND (@to   = '' OR pt.name_ar LIKE CONCAT('%', @to, '%'))
ORDER BY mc.created_at DESC, mc.id DESC
LIMIT 200;

-- ── 3. Quran links, person → person, with what was read ──────────────────
SELECT qc.id,
       IF(qc.from_person_id = 0, 'أنا', pf.name_ar) AS `من`,
       pt.name_ar                                   AS `على`,
       IF(qc.is_general, 'عام — كل القراءات', '')   AS `عام`,
       GROUP_CONCAT(DISTINCT COALESCE(rw.name_ar, q.name_ar) SEPARATOR '، ') AS `ما قُرئ`,
       GROUP_CONCAT(DISTINCT g.name_ar SEPARATOR '، ')                       AS `المجموعات`,
       qc.created_at, qc.from_person_id, qc.to_person_id
FROM quran_connections qc
LEFT JOIN persons pf ON pf.id = qc.from_person_id
LEFT JOIN persons pt ON pt.id = qc.to_person_id
LEFT JOIN quran_connection_items  i  ON i.connection_id = qc.id
LEFT JOIN riwayat rw ON rw.id = i.riwaya_id
LEFT JOIN qiraat  q  ON q.id  = i.qiraa_id
LEFT JOIN quran_connection_groups cg ON cg.connection_id = qc.id
LEFT JOIN quran_groups g ON g.id = cg.group_id
WHERE (@from = '' OR IF(qc.from_person_id = 0, 'أنا', pf.name_ar) LIKE CONCAT('%', @from, '%'))
  AND (@to   = '' OR pt.name_ar LIKE CONCAT('%', @to, '%'))
GROUP BY qc.id
ORDER BY qc.created_at DESC, qc.id DESC
LIMIT 200;

-- ── 4. Everything around one person (their shaykhs and their students) ───
SET @pid = 0;            -- a person id from query 1 (0 = you)
SELECT 'شيخه' AS `الصلة`, mc.id, pt.name_ar AS `الشخص`, m.title AS `المتن`, mc.created_at
FROM matn_connections mc LEFT JOIN persons pt ON pt.id = mc.to_person_id LEFT JOIN mutoon m ON m.id = mc.matn_id
WHERE mc.from_person_id = @pid
UNION ALL
SELECT 'تلميذه', mc.id, IF(mc.from_person_id = 0, 'أنا', pf.name_ar), m.title, mc.created_at
FROM matn_connections mc LEFT JOIN persons pf ON pf.id = mc.from_person_id LEFT JOIN mutoon m ON m.id = mc.matn_id
WHERE mc.to_person_id = @pid
ORDER BY 1, 3;

-- ── 5. The chains going up from a person, for one matn (MySQL 8) ─────────
-- Shows every path upward; if it never reaches the matn's author, the isnad page has nothing to show.
SET @pid = 0, @matn = NULL;   -- @matn: a matn id, or NULL for links of any matn
WITH RECURSIVE up (depth, person_id, ids, path) AS (
  SELECT 0, @pid, CAST(@pid AS CHAR(2000)),
         CAST(IF(@pid = 0, 'أنا', (SELECT name_ar FROM persons WHERE id = @pid)) AS CHAR(8000))
  UNION ALL
  SELECT u.depth + 1, mc.to_person_id, CONCAT(u.ids, ',', mc.to_person_id), CONCAT(u.path, ' ← ', p.name_ar)
  FROM up u
  JOIN matn_connections mc ON mc.from_person_id = u.person_id
                          AND (@matn IS NULL OR mc.matn_id = @matn OR mc.matn_id IS NULL)
  JOIN persons p ON p.id = mc.to_person_id
  WHERE u.depth < 40 AND FIND_IN_SET(mc.to_person_id, u.ids) = 0   -- stop on a loop
)
SELECT depth, path FROM up ORDER BY depth DESC, path LIMIT 300;

-- ── 6. Mutoon with their author and how many links they have ─────────────
SELECT m.id, m.title, a.name_ar AS `المؤلف`, COUNT(mc.id) AS `الاتصالات`
FROM mutoon m
LEFT JOIN persons a ON a.id = m.author_id
LEFT JOIN matn_connections mc ON mc.matn_id = m.id
GROUP BY m.id ORDER BY m.title;

-- ── 7. Links added in the last day (e.g. right after an import) ──────────
SELECT 'متن' AS `النوع`, mc.id, IF(mc.from_person_id = 0, 'أنا', pf.name_ar) AS `من`, pt.name_ar AS `على`, m.title AS `المتن`, mc.created_at
FROM matn_connections mc
LEFT JOIN persons pf ON pf.id = mc.from_person_id LEFT JOIN persons pt ON pt.id = mc.to_person_id
LEFT JOIN mutoon m ON m.id = mc.matn_id
WHERE mc.created_at >= NOW() - INTERVAL 1 DAY
UNION ALL
SELECT 'قرآن', qc.id, IF(qc.from_person_id = 0, 'أنا', pf.name_ar), pt.name_ar, NULL, qc.created_at
FROM quran_connections qc
LEFT JOIN persons pf ON pf.id = qc.from_person_id LEFT JOIN persons pt ON pt.id = qc.to_person_id
WHERE qc.created_at >= NOW() - INTERVAL 1 DAY
ORDER BY created_at DESC;

-- ── 8. Persons added in the last day ─────────────────────────────────────
SELECT id, name_ar, death_year, created_at FROM persons
WHERE created_at >= NOW() - INTERVAL 1 DAY ORDER BY created_at DESC;

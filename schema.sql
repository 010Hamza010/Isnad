-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Apr 23, 2026 at 08:14 AM
-- Server version: 11.7.2-MariaDB-ubu2404
-- PHP Version: 8.3.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `isnad_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `matn_connections`
--

CREATE TABLE `matn_connections` (
  `id` int(11) NOT NULL,
  `from_person_id` int(11) NOT NULL,
  `to_person_id` int(11) NOT NULL,
  `matn_id` int(11) DEFAULT NULL,
  `transmission_type_id` int(11) DEFAULT NULL,
  `is_general_ijaza` tinyint(1) DEFAULT 0,
  `reading_mode` enum('heart','looking') DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `matn_connections`
--

INSERT INTO `matn_connections` (`id`, `from_person_id`, `to_person_id`, `matn_id`, `transmission_type_id`, `is_general_ijaza`, `description`, `created_at`) VALUES
(15, 0, 223, 10, 2, 0, 'في دمشق', '2026-04-22 13:20:21'),
(16, 223, 210, NULL, NULL, 1, NULL, '2026-04-22 13:21:14');

-- --------------------------------------------------------

--
-- Table structure for table `mutoon`
--

CREATE TABLE `mutoon` (
  `id` int(11) NOT NULL,
  `title` varchar(300) NOT NULL,
  `author_id` int(11) DEFAULT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `mutoon`
--

INSERT INTO `mutoon` (`id`, `title`, `author_id`, `subject`, `description`, `created_at`) VALUES
(1, 'تحفة الأطفال', 203, 'تجويد', '61 بيتاً في أحكام التجويد لحفص عن عاصم، للجمزوري', '2026-04-21 10:32:09'),
(2, 'الجزرية', 201, 'تجويد', 'مقدمة ابن الجزري في التجويد، 107 أبيات', '2026-04-21 10:32:09'),
(3, 'الشاطبية', 202, 'قراءات', 'حرز الأماني ووجه التهاني في القراءات السبع، 1173 بيتاً', '2026-04-21 10:32:09'),
(4, 'طيبة النشر', 201, 'قراءات', 'منظومة في القراءات العشر الكبرى، 1014 بيتاً لابن الجزري', '2026-04-21 10:32:09'),
(5, 'الدرة المضية', 201, 'قراءات', 'منظومة في القراءات الثلاث المتممة للعشر، لابن الجزري', '2026-04-21 10:32:09'),
(6, 'مورد الظمآن', 205, 'رسم', 'منظومة في رسم المصحف وضبطه، للخراز', '2026-04-21 10:32:09'),
(10, 'الأربعون النووية', 210, 'حديث', '42 حديثاً نبوياً في مختلف أبواب الدين، للنووي', '2026-04-21 10:32:09'),
(11, 'بلوغ المرام', 211, 'حديث', 'أحاديث الأحكام من كتب الأئمة الأعلام، لابن حجر العسقلاني', '2026-04-21 10:32:09'),
(12, 'عمدة الأحكام', NULL, 'حديث', 'متن في أحاديث الأحكام الفقهية، للحافظ عبد الغني المقدسي', '2026-04-21 10:32:09'),
(13, 'الألفية في مصطلح الحديث', 215, 'مصطلح', 'ألفية العراقي في علوم الحديث، 1000 بيت', '2026-04-21 10:32:09'),
(14, 'نخبة الفكر', 211, 'مصطلح', 'متن في مصطلح الحديث لابن حجر العسقلاني', '2026-04-21 10:32:09'),
(20, 'متن الآجرومية', 227, 'نحو', 'مقدمة الصنهاجي في النحو، من أشهر المتون المبتدئة', '2026-04-21 10:32:09'),
(21, 'رسالة ابن أبي زيد', 226, 'فقه', 'الرسالة القيروانية في فقه المالكية للمبتدئين', '2026-04-21 10:32:09'),
(22, 'مختصر خليل', 225, 'فقه', 'المختصر الفقهي المالكي الشهير، متن مركزي في الفقه المالكي', '2026-04-21 10:32:09'),
(23, 'المرشد المعين', 224, 'فقه', 'منظومة في الفقه والعقيدة والتصوف على مذهب الإمام مالك، لابن عاشر', '2026-04-21 10:32:09'),
(24, 'عمدة الفقه', 223, 'فقه', 'متن فقهي حنبلي للمبتدئين، لابن قدامة المقدسي', '2026-04-21 10:32:09'),
(25, 'زاد المستقنع', NULL, 'فقه', 'مختصر المقنع في الفقه الحنبلي، للحجاوي', '2026-04-21 10:32:09'),
(26, 'متن الورقات', NULL, 'أصول', 'مقدمة في أصول الفقه للجويني، من أهم متون الأصول', '2026-04-21 10:32:09'),
(30, 'ألفية ابن مالك', 230, 'نحو', 'ألفية في النحو والصرف، 1002 بيت، أشمل المتون النحوية', '2026-04-21 10:32:09'),
(31, 'قطر الندى', 231, 'نحو', 'متن ابن هشام في النحو، شرحه المؤلف نفسه', '2026-04-21 10:32:09'),
(32, 'ملحة الإعراب', 232, 'نحو', 'منظومة في النحو للحريري، مناسبة للمبتدئين', '2026-04-21 10:32:09'),
(41, 'العقيدة الطحاوية', 241, 'عقيدة', 'متن في عقيدة أهل السنة والجماعة، للطحاوي', '2026-04-21 10:32:09'),
(42, 'لمعة الاعتقاد', NULL, 'عقيدة', 'متن في العقيدة الحنبلية لابن قدامة المقدسي', '2026-04-21 10:32:09'),
(43, 'الواسطية', NULL, 'عقيدة', 'متن في العقيدة السلفية لشيخ الإسلام ابن تيمية', '2026-04-21 10:32:09'),
(44, 'الحموية', NULL, 'عقيدة', 'رسالة في الصفات لابن تيمية', '2026-04-21 10:32:09'),
(50, 'البردة', 250, 'سيرة', 'قصيدة البردة للبوصيري في مدح النبي ﷺ، 160 بيتاً', '2026-04-21 10:32:09'),
(51, 'الهمزية', 250, 'سيرة', 'قصيدة الهمزية للبوصيري في السيرة النبوية', '2026-04-21 10:32:09');

-- --------------------------------------------------------

--
-- Table structure for table `persons`
--

CREATE TABLE `persons` (
  `id` int(11) NOT NULL,
  `name_ar` varchar(200) NOT NULL,
  `name_latin` varchar(200) DEFAULT NULL,
  `gender` enum('M','F') NOT NULL DEFAULT 'M',
  `kunya` varchar(100) DEFAULT NULL,
  `nisba` varchar(150) DEFAULT NULL,
  `century` tinyint(4) DEFAULT NULL,
  `death_year` varchar(20) DEFAULT NULL,
  `region` varchar(150) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `primary_qiraa_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `persons`
--

INSERT INTO `persons` (`id`, `name_ar`, `name_latin`, `kunya`, `nisba`, `century`, `death_year`, `region`, `description`, `created_at`, `primary_qiraa_id`) VALUES
(-3, 'رب العزة', 'Allah (The Almighty)', NULL, NULL, NULL, NULL, NULL, 'الله جل جلاله، كلامه القرآن الكريم، منه بدأ وإليه ينتهي', '2026-04-22 13:35:23', NULL),
(-2, 'جبريل عليه السلام', 'Jibril (Gabriel) AS', NULL, NULL, NULL, NULL, NULL, 'الأمين على الوحي، نزل بالقرآن على النبي ﷺ بأمر ربه', '2026-04-22 13:35:23', NULL),
(-1, 'النبي ﷺ', 'The Prophet ﷺ', NULL, NULL, NULL, NULL, NULL, 'محمد بن عبد الله ﷺ، خاتم الأنبياء والمرسلين، تلقى القرآن عن جبريل عليه السلام', '2026-04-22 13:35:23', NULL),
(101, 'نافع بن أبي نعيم', 'Nafi\' ibn Abi Nu\'aym', NULL, 'الليثي المدني', 2, '169هـ', 'المدينة', 'إمام أهل المدينة في القراءة، أحد القراء السبعة', '2026-04-21 10:27:13', NULL),
(102, 'عبد الله بن كثير', 'Ibn Kathir al-Makki', NULL, 'المكي', 2, '120هـ', 'مكة', 'إمام أهل مكة في القراءة، أحد القراء السبعة', '2026-04-21 10:27:13', NULL),
(103, 'أبو عمرو بن العلاء', 'Abu Amr ibn al-Ala', 'أبو عمرو', 'البصري', 2, '154هـ', 'البصرة', 'إمام أهل البصرة في القراءة، أحد القراء السبعة', '2026-04-21 10:27:13', NULL),
(104, 'عبد الله بن عامر', 'Ibn Amir al-Yahsubi', NULL, 'اليحصبي الشامي', 2, '118هـ', 'الشام', 'إمام أهل الشام في القراءة، أحد القراء السبعة', '2026-04-21 10:27:13', NULL),
(105, 'عاصم بن أبي النجود', 'Asim ibn Abi al-Najud', NULL, 'الكوفي', 2, '127هـ', 'الكوفة', 'إمام الكوفة في القراءة، أحد القراء السبعة', '2026-04-21 10:27:13', NULL),
(106, 'حمزة بن حبيب الزيات', 'Hamza ibn Habib', NULL, 'الكوفي', 2, '156هـ', 'الكوفة', 'أحد القراء السبعة، إمام الكوفيين في القراءة', '2026-04-21 10:27:13', NULL),
(107, 'علي بن حمزة الكسائي', 'al-Kisai', 'أبو الحسن', 'الكوفي', 2, '189هـ', 'الكوفة', 'إمام النحو والقراءة، أحد القراء السبعة', '2026-04-21 10:27:13', NULL),
(108, 'أبو جعفر يزيد بن القعقاع', 'Abu Jafar al-Madani', 'أبو جعفر', 'المدني', 2, '130هـ', 'المدينة', 'أحد القراء العشرة، تلميذ ابن عباس وأبي هريرة', '2026-04-21 10:27:13', NULL),
(109, 'يعقوب بن إسحاق الحضرمي', 'Yaqub al-Hadrami', 'أبو محمد', 'البصري', 3, '205هـ', 'البصرة', 'أحد القراء العشرة، إمام أهل البصرة في عصره', '2026-04-21 10:27:13', NULL),
(110, 'خلف بن هشام', 'Khalaf ibn Hisham', 'أبو محمد', 'البزار', 3, '229هـ', 'بغداد', 'أحد القراء العشرة، اختار قراءة مستقلة عن رواية حمزة', '2026-04-21 10:27:13', NULL),
(111, 'قالون', 'Qalun', NULL, 'المدني', 3, '220هـ', 'المدينة', 'عيسى بن مينا، راوي نافع الأول', '2026-04-21 10:27:13', NULL),
(112, 'ورش', 'Warsh', 'أبو سعيد', 'المصري', 2, '197هـ', 'مصر', 'عثمان بن سعيد، راوي نافع الثاني، أضبط الرواة', '2026-04-21 10:27:13', NULL),
(113, 'البزي', 'al-Bazzi', 'أبو الحسن', 'المكي', 3, '250هـ', 'مكة', 'أحمد بن محمد البزي، راوي ابن كثير الأول', '2026-04-21 10:27:13', NULL),
(114, 'قنبل', 'Qunbul', NULL, 'المكي', 3, '291هـ', 'مكة', 'محمد بن عبد الرحمن، راوي ابن كثير الثاني', '2026-04-21 10:27:13', NULL),
(115, 'الدوري', 'al-Duri', 'أبو عمر', 'البغدادي', 3, '246هـ', 'بغداد', 'حفص بن عمر الدوري، راوي أبي عمرو الأول، أول من جمع القراءات', '2026-04-21 10:27:13', NULL),
(116, 'السوسي', 'al-Susi', 'أبو شعيب', 'السوسي', 3, '261هـ', 'المغرب', 'صالح بن زياد السوسي، راوي أبي عمرو الثاني', '2026-04-21 10:27:13', NULL),
(117, 'هشام', 'Hisham', 'أبو الوليد', 'الشامي', 3, '245هـ', 'الشام', 'هشام بن عمار، راوي ابن عامر الأول', '2026-04-21 10:27:13', NULL),
(118, 'ابن ذكوان', 'Ibn Dhakwan', 'أبو عمرو', 'الشامي', 3, '242هـ', 'الشام', 'عبد الله بن أحمد ابن ذكوان، راوي ابن عامر الثاني', '2026-04-21 10:27:13', NULL),
(119, 'حفص', 'Hafs', 'أبو عمر', 'الأسدي الكوفي', 2, '180هـ', 'الكوفة', 'حفص بن سليمان، راوي عاصم الأول، أكثر الروايات انتشاراً', '2026-04-21 10:27:13', NULL),
(120, 'شعبة', 'Shu\'ba', 'أبو بكر', 'الكوفي', 2, '193هـ', 'الكوفة', 'شعبة بن عياش، راوي عاصم الثاني', '2026-04-21 10:27:13', NULL),
(121, 'خلاد', 'Khallad', NULL, 'الكوفي', 3, '220هـ', 'الكوفة', 'خلاد بن خالد، راوي حمزة الأول', '2026-04-21 10:27:13', NULL),
(122, 'خلف عن حمزة', 'Khalaf (rawi of Hamza)', NULL, 'الكوفي', 3, '229هـ', 'بغداد', 'خلف بن هشام بوصفه راوياً لحمزة', '2026-04-21 10:27:13', NULL),
(123, 'أبو الحارث', 'Abu al-Harith', 'أبو الحارث', 'البغدادي', 3, '240هـ', 'بغداد', 'الليث بن خالد، راوي الكسائي الأول', '2026-04-21 10:27:13', NULL),
(124, 'الدوري عن الكسائي', 'al-Duri (rawi of Kisai)', 'أبو عمر', 'البغدادي', 3, '246هـ', 'بغداد', 'حفص الدوري بوصفه راوياً للكسائي أيضاً', '2026-04-21 10:27:13', NULL),
(125, 'ابن وردان', 'Ibn Wardan', NULL, 'المدني', 3, '160هـ', 'المدينة', 'عيسى بن وردان، راوي أبي جعفر الأول', '2026-04-21 10:27:13', NULL),
(126, 'ابن جماز', 'Ibn Jammaz', NULL, 'المدني', 3, '170هـ', 'المدينة', 'سليمان بن مسلم ابن جماز، راوي أبي جعفر الثاني', '2026-04-21 10:27:13', NULL),
(127, 'رويس', 'Ruwais', NULL, 'البصري', 3, '238هـ', 'البصرة', 'محمد بن المتوكل، راوي يعقوب الأول', '2026-04-21 10:27:13', NULL),
(128, 'روح', 'Rawh', NULL, 'البصري', 3, '234هـ', 'البصرة', 'روح بن عبد المؤمن، راوي يعقوب الثاني', '2026-04-21 10:27:13', NULL),
(129, 'إسحاق', 'Ishaq', NULL, 'الوراق', 3, '286هـ', 'بغداد', 'إسحاق بن إبراهيم الوراق، راوي خلف العاشر الأول', '2026-04-21 10:27:13', NULL),
(130, 'إدريس', 'Idris', NULL, 'الحداد', 3, '292هـ', 'بغداد', 'إدريس بن عبد الكريم الحداد، راوي خلف العاشر الثاني', '2026-04-21 10:27:13', NULL),
(201, 'ابن الجزري', 'Ibn al-Jazari', 'أبو الخير', 'الدمشقي', 8, '833هـ', 'دمشق', 'محمد بن محمد الجزري، إمام القراء في عصره، صاحب النشر والطيبة والجزرية', '2026-04-21 10:32:09', NULL),
(202, 'القاسم الشاطبي', 'al-Shaṭibī', 'أبو القاسم', 'الشاطبي الأندلسي', 6, '590هـ', 'الأندلس', 'قاسم بن فيره، ناظم الشاطبية وحرز الأماني، إمام القراءات', '2026-04-21 10:32:09', NULL),
(203, 'الجمزوري', 'al-Jamzuri', NULL, 'الجمزوري', 13, '1198هـ', 'مصر', 'سليمان بن حسين الجمزوري، ناظم تحفة الأطفال', '2026-04-21 10:32:09', NULL),
(204, 'أبو عمرو الداني', 'Abu Amr al-Dani', 'أبو عمرو', 'الأندلسي', 5, '444هـ', 'الأندلس', 'عثمان بن سعيد الداني، صاحب التيسير والمقنع، إمام في علوم القرآن', '2026-04-21 10:32:09', NULL),
(205, 'الخراز', 'al-Kharraz', NULL, 'المغربي', 8, 'ق8', 'المغرب', 'محمد بن محمد الخراز، ناظم مورد الظمآن في رسم القرآن', '2026-04-21 10:32:09', NULL),
(210, 'الإمام النووي', 'al-Nawawi', 'أبو زكريا', 'النووي الشافعي', 7, '676هـ', 'الشام', 'يحيى بن شرف النووي، من أكابر فقهاء الشافعية، صاحب الأربعين والمنهاج', '2026-04-21 10:32:09', NULL),
(211, 'الحافظ ابن حجر', 'Ibn Hajar al-Asqalani', 'أبو الفضل', 'العسقلاني', 9, '852هـ', 'مصر', 'أحمد بن علي بن حجر، حافظ الإسلام، صاحب فتح الباري وبلوغ المرام', '2026-04-21 10:32:09', NULL),
(212, 'الإمام البخاري', 'al-Bukhari', 'أبو عبد الله', 'البخاري', 3, '256هـ', 'خراسان', 'محمد بن إسماعيل البخاري، إمام المحدثين، صاحب الجامع الصحيح', '2026-04-21 10:32:09', NULL),
(213, 'الإمام مسلم', 'Imam Muslim', 'أبو الحسين', 'النيسابوري', 3, '261هـ', 'نيسابور', 'مسلم بن الحجاج، صاحب الصحيح، أحد أئمة الحديث', '2026-04-21 10:32:09', NULL),
(214, 'الإمام ابن ماجه', 'Ibn Majah', 'أبو عبد الله', 'القزويني', 3, '273هـ', 'قزوين', 'محمد بن يزيد ابن ماجه، صاحب السنن', '2026-04-21 10:32:09', NULL),
(215, 'الحافظ العراقي', 'al-Iraqi', 'أبو الفضل', 'العراقي', 8, '806هـ', 'مصر', 'عبد الرحيم بن الحسين العراقي، ناظم الألفية في مصطلح الحديث', '2026-04-21 10:32:09', NULL),
(220, 'الإمام الشافعي', 'al-Shafi\'i', 'أبو عبد الله', 'القرشي المكي', 2, '204هـ', 'مصر', 'محمد بن إدريس الشافعي، إمام المذهب الشافعي ومؤسس علم أصول الفقه', '2026-04-21 10:32:09', NULL),
(221, 'الإمام مالك', 'Imam Malik', 'أبو عبد الله', 'المدني', 2, '179هـ', 'المدينة', 'مالك بن أنس، إمام دار الهجرة، صاحب الموطأ', '2026-04-21 10:32:09', NULL),
(222, 'الإمام أحمد بن حنبل', 'Ahmad ibn Hanbal', 'أبو عبد الله', 'الشيباني', 3, '241هـ', 'بغداد', 'إمام المذهب الحنبلي، صاحب المسند، إمام أهل السنة', '2026-04-21 10:32:09', NULL),
(223, 'ابن قدامة المقدسي', 'Ibn Qudama', 'أبو محمد', 'المقدسي الحنبلي', 7, '620هـ', 'الشام', 'عبد الله بن أحمد، صاحب المغني والعمدة وروضة الناظر', '2026-04-21 10:32:09', NULL),
(224, 'الإمام ابن عاشر', 'Ibn Ashir', NULL, 'الأندلسي', 11, '1040هـ', 'المغرب', 'عبد الواحد بن عاشر، ناظم المرشد المعين على الضروري من علوم الدين', '2026-04-21 10:32:09', NULL),
(225, 'خليل بن إسحاق', 'Khalil ibn Ishaq', 'أبو المودة', 'الجندي المالكي', 8, '776هـ', 'مصر', 'صاحب مختصر خليل في فقه المالكية', '2026-04-21 10:32:09', NULL),
(226, 'ابن أبي زيد القيرواني', 'Ibn Abi Zayd', 'أبو محمد', 'القيرواني', 4, '386هـ', 'القيروان', 'صاحب الرسالة الفقهية المشهورة في المذهب المالكي', '2026-04-21 10:32:09', NULL),
(227, 'ابن آجروم', 'Ibn Ajurrum', NULL, 'الصنهاجي', 8, '723هـ', 'المغرب', 'محمد بن محمد الصنهاجي، ناظم الآجرومية في النحو', '2026-04-21 10:32:09', NULL),
(230, 'ابن مالك', 'Ibn Malik', 'أبو عبد الله', 'الأندلسي', 7, '672هـ', 'الشام', 'محمد بن عبد الله بن مالك، ناظم الألفية في النحو والصرف', '2026-04-21 10:32:09', NULL),
(231, 'ابن هشام الأنصاري', 'Ibn Hisham', 'أبو محمد', 'الأنصاري', 8, '761هـ', 'مصر', 'جمال الدين ابن هشام، صاحب قطر الندى وشرح الشذور', '2026-04-21 10:32:09', NULL),
(232, 'الحريري', 'al-Hariri', 'أبو محمد', 'البصري', 6, '516هـ', 'البصرة', 'القاسم بن علي الحريري، صاحب الملحة في النحو والمقامات', '2026-04-21 10:32:09', NULL),
(240, 'الإمام السنوسي', 'al-Sanusi', 'أبو عبد الله', 'التلمساني', 9, '895هـ', 'تلمسان', 'محمد بن يوسف السنوسي، ناظم أم البراهين في علم التوحيد', '2026-04-21 10:32:09', NULL),
(241, 'الإمام أبو جعفر الطحاوي', 'al-Tahawi', 'أبو جعفر', 'الطحاوي', 3, '321هـ', 'مصر', 'أحمد بن محمد الطحاوي، صاحب العقيدة الطحاوية', '2026-04-21 10:32:09', NULL),
(242, 'ابن عثيمين', 'Ibn Uthaymin', 'أبو عبد الله', 'التميمي', 15, '1421هـ', 'السعودية', 'محمد بن صالح العثيمين، عالم كبير وشارح متون العقيدة والفقه', '2026-04-21 10:32:09', NULL),
(250, 'الإمام البوصيري', 'al-Busiri', 'أبو عبد الله', 'الصنهاجي', 7, '696هـ', 'مصر', 'محمد بن سعيد البوصيري، ناظم البردة والهمزية في مدح النبي ﷺ', '2026-04-21 10:32:09', NULL),
(251, 'ابن كثير الدمشقي', 'Ibn Kathir', 'أبو الفداء', 'الدمشقي', 8, '774هـ', 'دمشق', 'إسماعيل بن عمر، صاحب البداية والنهاية وتفسير القرآن العظيم', '2026-04-21 10:32:09', NULL),
(260, 'الإمام ابن القيم', 'Ibn al-Qayyim', 'أبو عبد الله', 'الجوزية', 8, '751هـ', 'دمشق', 'محمد بن أبي بكر ابن قيم الجوزية، صاحب مدارج السالكين وزاد المعاد', '2026-04-21 10:32:09', NULL),
(261, 'الإمام الغزالي', 'al-Ghazali', 'أبو حامد', 'الطوسي', 5, '505هـ', 'خراسان', 'محمد بن محمد الغزالي، حجة الإسلام، صاحب إحياء علوم الدين', '2026-04-21 10:32:09', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `qiraat`
--

CREATE TABLE `qiraat` (
  `id` int(11) NOT NULL,
  `name_ar` varchar(150) NOT NULL,
  `imam_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `qiraat`
--

INSERT INTO `qiraat` (`id`, `name_ar`, `imam_id`, `description`) VALUES
(1, 'قراءة نافع', 101, 'من القراءات السبع المتواترة، إمامها نافع بن عبد الرحمن بن أبي نعيم المدني'),
(2, 'قراءة ابن كثير', 102, 'من القراءات السبع المتواترة، إمامها عبد الله بن كثير المكي'),
(3, 'قراءة أبي عمرو', 103, 'من القراءات السبع المتواترة، إمامها أبو عمرو بن العلاء البصري'),
(4, 'قراءة ابن عامر', 104, 'من القراءات السبع المتواترة، إمامها عبد الله بن عامر الشامي'),
(5, 'قراءة عاصم', 105, 'من القراءات السبع المتواترة، إمامها عاصم بن أبي النجود الكوفي'),
(6, 'قراءة حمزة', 106, 'من القراءات السبع المتواترة، إمامها حمزة بن حبيب الزيات الكوفي'),
(7, 'قراءة الكسائي', 107, 'من القراءات السبع المتواترة، إمامها علي بن حمزة الكسائي الكوفي'),
(8, 'قراءة أبي جعفر', 108, 'من القراءات العشر، إمامها أبو جعفر يزيد بن القعقاع المدني'),
(9, 'قراءة يعقوب', 109, 'من القراءات العشر، إمامها يعقوب بن إسحاق الحضرمي البصري'),
(10, 'قراءة خلف العاشر', 110, 'من القراءات العشر، إمامها خلف بن هشام البزار البغدادي');

-- --------------------------------------------------------

--
-- Table structure for table `quran_connections`
--

CREATE TABLE `quran_connections` (
  `id` int(11) NOT NULL,
  `from_person_id` int(11) NOT NULL,
  `to_person_id` int(11) NOT NULL,
  `transmission_type_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `khatmat_count` int(11) DEFAULT 1 COMMENT 'عدد الختمات',
  `ijaza_date` varchar(20) DEFAULT NULL COMMENT 'تاريخ الإجازة هجري',
  `meeting_mode` enum('حضوراً','عن بُعد','مختلط') DEFAULT 'حضوراً' COMMENT 'الوسيلة',
  `reading_mode` enum('heart','looking') DEFAULT NULL COMMENT 'حفظاً / نظراً',
  `notes` text DEFAULT NULL COMMENT 'ملاحظات التلاوة',
  `user_id` int(11) NOT NULL DEFAULT 1 COMMENT 'FK to users table'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `quran_connections`
--

INSERT INTO `quran_connections` (`id`, `from_person_id`, `to_person_id`, `transmission_type_id`, `description`, `created_at`, `khatmat_count`, `ijaza_date`, `meeting_mode`, `notes`, `user_id`) VALUES
(28, 0, 223, NULL, NULL, '2026-04-22 14:24:26', 1, NULL, 'حضوراً', NULL, 1),
(29, 223, 106, NULL, NULL, '2026-04-22 14:25:06', 1, NULL, 'حضوراً', NULL, 1),
(30, 106, -1, NULL, NULL, '2026-04-22 14:25:29', 1, NULL, 'حضوراً', NULL, 1),
(31, -1, -2, NULL, NULL, '2026-04-22 14:25:44', 1, NULL, 'حضوراً', NULL, 1),
(32, -2, -3, NULL, NULL, '2026-04-22 14:25:55', 1, NULL, 'حضوراً', NULL, 1),
(33, 223, 101, NULL, NULL, '2026-04-22 14:36:37', 1, NULL, 'حضوراً', NULL, 1),
(34, 101, -1, NULL, NULL, '2026-04-22 14:36:49', 1, NULL, 'حضوراً', NULL, 1),
(35, 0, 227, NULL, NULL, '2026-04-22 14:38:35', 1, NULL, 'حضوراً', NULL, 1),
(36, 227, 223, NULL, NULL, '2026-04-22 14:39:19', 1, NULL, 'حضوراً', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `quran_connection_items`
--

CREATE TABLE `quran_connection_items` (
  `id` int(11) NOT NULL,
  `connection_id` int(11) NOT NULL,
  `qiraa_id` int(11) DEFAULT NULL,
  `riwaya_id` int(11) DEFAULT NULL,
  `tariq_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `quran_connection_items`
--

INSERT INTO `quran_connection_items` (`id`, `connection_id`, `qiraa_id`, `riwaya_id`, `tariq_id`) VALUES
(4, 28, 1, NULL, NULL),
(5, 28, 6, NULL, NULL),
(6, 29, 6, NULL, NULL),
(7, 33, 1, NULL, NULL),
(9, 36, 1, NULL, NULL),
(11, 35, NULL, 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `riwayat`
--

CREATE TABLE `riwayat` (
  `id` int(11) NOT NULL,
  `name_ar` varchar(150) NOT NULL,
  `qiraa_id` int(11) NOT NULL,
  `rawi_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `riwayat`
--

INSERT INTO `riwayat` (`id`, `name_ar`, `qiraa_id`, `rawi_id`, `description`) VALUES
(1, 'قالون عن نافع', 1, 111, 'أكثر الروايات انتشاراً في العالم الإسلامي اليوم'),
(2, 'ورش عن نافع', 1, 112, 'الرواية الثانية لعاصم، منتشرة في بعض مناطق المغرب'),
(3, 'البزي عن ابن كثير', 2, 113, 'أكثر روايات نافع انتشاراً في المغرب العربي وأفريقيا'),
(4, 'قنبل عن ابن كثير', 2, 114, 'منتشرة في ليبيا وتونس وبعض مناطق المغرب'),
(5, 'الدوري عن أبي عمرو', 3, 115, 'منتشرة في السودان وأجزاء من أفريقيا'),
(6, 'السوسي عن أبي عمرو', 3, 116, 'الرواية الثانية لأبي عمرو'),
(7, 'هشام عن ابن عامر', 4, 117, 'الرواية الأولى لابن عامر'),
(8, 'ابن ذكوان عن ابن عامر', 4, 118, 'الرواية الثانية لابن عامر'),
(9, 'حفص عن عاصم', 5, 119, 'أكثر الروايات انتشاراً في العالم الإسلامي اليوم'),
(10, 'شعبة عن عاصم', 5, 120, 'الرواية الثانية لعاصم، منتشرة في بعض مناطق المغرب'),
(11, 'خلاد عن حمزة', 6, 121, 'الرواية الأولى لحمزة'),
(12, 'خلف عن حمزة', 6, 122, 'الرواية الثانية لحمزة'),
(13, 'أبو الحارث عن الكسائي', 7, 123, 'الرواية الأولى للكسائي'),
(14, 'الدوري عن الكسائي', 7, 124, 'الرواية الثانية للكسائي'),
(15, 'ابن وردان عن أبي جعفر', 8, 125, 'الرواية الأولى لأبي جعفر'),
(16, 'ابن جماز عن أبي جعفر', 8, 126, 'الرواية الثانية لأبي جعفر'),
(17, 'رويس عن يعقوب', 9, 127, 'الرواية الأولى ليعقوب'),
(18, 'روح عن يعقوب', 9, 128, 'الرواية الثانية ليعقوب'),
(19, 'إسحاق عن خلف', 10, 129, 'الرواية الأولى لخلف العاشر'),
(20, 'إدريس عن خلف', 10, 130, 'الرواية الثانية لخلف العاشر');

-- --------------------------------------------------------

--
-- Table structure for table `transmission_types`
--

CREATE TABLE `transmission_types` (
  `id` int(11) NOT NULL,
  `name_ar` varchar(80) NOT NULL,
  `name_en` varchar(80) DEFAULT NULL,
  `kind` varchar(20) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `applies_to` enum('both','mutoon','quran') DEFAULT 'both'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `transmission_types`
--

INSERT INTO `transmission_types` (`id`, `name_ar`, `name_en`, `description`, `applies_to`) VALUES
(1, 'سماع', 'Sama\'', NULL, 'both'),
(2, 'قراءة على الشيخ', 'Qira\'a', NULL, 'both'),
(3, 'إجازة', 'Ijaza', NULL, 'both'),
(4, 'إجازة عامة', 'General Ijaza', NULL, 'both'),
(5, 'مناولة', 'Munawala', NULL, 'mutoon'),
(6, 'كتابة', 'Kitaba', NULL, 'mutoon'),
(7, 'وجادة', 'Wijada', NULL, 'mutoon'),
(8, 'إعلام', 'I\'lam', NULL, 'mutoon'),
(9, 'عرض', 'Ard', NULL, 'quran'),
(10, 'قراءة عليه وأنا أسمع', 'Qira''a by another, while listening', NULL, 'both');

-- --------------------------------------------------------

--
-- Table structure for table `turuq`
--

CREATE TABLE `turuq` (
  `id` int(11) NOT NULL,
  `name_ar` varchar(150) NOT NULL,
  `riwaya_id` int(11) DEFAULT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `turuq`
--

INSERT INTO `turuq` (`id`, `name_ar`, `riwaya_id`, `parent_id`, `description`) VALUES
(1, 'طريق الشاطبية', 1, NULL, 'طريق حفص من الشاطبية — أشهر الطرق وأوسعها تداولاً'),
(2, 'طريق الطيبة', 1, NULL, 'طريق حفص من طيبة النشر لابن الجزري'),
(3, 'طريق الشاطبية', 2, NULL, 'طريق شعبة من الشاطبية'),
(4, 'طريق الأزرق', 3, NULL, 'طريق ورش من طريق أبي بكر الأزرق — أشهر طرق ورش'),
(5, 'طريق الأصبهاني', 3, NULL, 'طريق ورش من طريق الأصبهاني'),
(6, 'طريق أبي نشيط', 4, NULL, 'طريق قالون من طريق أبي نشيط'),
(101, 'طريق الشاطبية', 1, NULL, 'من الشاطبية — حرز الأماني لأبي القاسم الشاطبي'),
(102, 'طريق التيسير', 1, NULL, 'من التيسير — كتاب أبي عمرو الداني'),
(103, 'طريق الطيبة', 1, NULL, 'من طيبة النشر لابن الجزري'),
(201, 'طريق الشاطبية', 2, NULL, 'من الشاطبية'),
(202, 'طريق التيسير', 2, NULL, 'من التيسير'),
(203, 'طريق الطيبة', 2, NULL, 'من طيبة النشر'),
(301, 'طريق الشاطبية', 3, NULL, 'من الشاطبية'),
(302, 'طريق التيسير', 3, NULL, 'من التيسير'),
(303, 'طريق الطيبة', 3, NULL, 'من طيبة النشر'),
(401, 'طريق الشاطبية', 4, NULL, 'من الشاطبية'),
(402, 'طريق التيسير', 4, NULL, 'من التيسير'),
(403, 'طريق الطيبة', 4, NULL, 'من طيبة النشر'),
(501, 'طريق الشاطبية', 5, NULL, 'من الشاطبية'),
(502, 'طريق التيسير', 5, NULL, 'من التيسير'),
(503, 'طريق الطيبة', 5, NULL, 'من طيبة النشر'),
(601, 'طريق الشاطبية', 6, NULL, 'من الشاطبية'),
(602, 'طريق التيسير', 6, NULL, 'من التيسير'),
(603, 'طريق الطيبة', 6, NULL, 'من طيبة النشر'),
(701, 'طريق الشاطبية', 7, NULL, 'من الشاطبية'),
(702, 'طريق التيسير', 7, NULL, 'من التيسير'),
(703, 'طريق الطيبة', 7, NULL, 'من طيبة النشر'),
(801, 'طريق الشاطبية', 8, NULL, 'من الشاطبية'),
(802, 'طريق التيسير', 8, NULL, 'من التيسير'),
(803, 'طريق الطيبة', 8, NULL, 'من طيبة النشر'),
(901, 'طريق الشاطبية', 9, NULL, 'من الشاطبية — الأشهر والأوسع انتشاراً'),
(902, 'طريق التيسير', 9, NULL, 'من التيسير'),
(903, 'طريق الطيبة', 9, NULL, 'من طيبة النشر'),
(1001, 'طريق الشاطبية', 10, NULL, 'من الشاطبية'),
(1002, 'طريق التيسير', 10, NULL, 'من التيسير'),
(1003, 'طريق الطيبة', 10, NULL, 'من طيبة النشر'),
(1101, 'طريق الشاطبية', 11, NULL, 'من الشاطبية'),
(1102, 'طريق التيسير', 11, NULL, 'من التيسير'),
(1103, 'طريق الطيبة', 11, NULL, 'من طيبة النشر'),
(1201, 'طريق الشاطبية', 12, NULL, 'من الشاطبية'),
(1202, 'طريق التيسير', 12, NULL, 'من التيسير'),
(1203, 'طريق الطيبة', 12, NULL, 'من طيبة النشر'),
(1301, 'طريق الشاطبية', 13, NULL, 'من الشاطبية'),
(1302, 'طريق التيسير', 13, NULL, 'من التيسير'),
(1303, 'طريق الطيبة', 13, NULL, 'من طيبة النشر'),
(1401, 'طريق الشاطبية', 14, NULL, 'من الشاطبية'),
(1402, 'طريق التيسير', 14, NULL, 'من التيسير'),
(1403, 'طريق الطيبة', 14, NULL, 'من طيبة النشر'),
(1501, 'طريق الدرة', 15, NULL, 'من الدرة المضية لابن الجزري — مختصة بالثلاث الزوائد'),
(1502, 'طريق الطيبة', 15, NULL, 'من طيبة النشر'),
(1601, 'طريق الدرة', 16, NULL, 'من الدرة المضية'),
(1602, 'طريق الطيبة', 16, NULL, 'من طيبة النشر'),
(1701, 'طريق الدرة', 17, NULL, 'من الدرة المضية'),
(1702, 'طريق الطيبة', 17, NULL, 'من طيبة النشر'),
(1801, 'طريق الدرة', 18, NULL, 'من الدرة المضية'),
(1802, 'طريق الطيبة', 18, NULL, 'من طيبة النشر'),
(1901, 'طريق الدرة', 19, NULL, 'من الدرة المضية'),
(1902, 'طريق الطيبة', 19, NULL, 'من طيبة النشر'),
(2001, 'طريق الدرة', 20, NULL, 'من الدرة المضية'),
(2002, 'طريق الطيبة', 20, NULL, 'من طيبة النشر');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(80) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--


--
-- Indexes for dumped tables
--

--
-- Indexes for table `matn_connections`
--
ALTER TABLE `matn_connections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `to_person_id` (`to_person_id`),
  ADD KEY `matn_id` (`matn_id`),
  ADD KEY `transmission_type_id` (`transmission_type_id`);

--
-- Indexes for table `mutoon`
--
ALTER TABLE `mutoon`
  ADD PRIMARY KEY (`id`),
  ADD KEY `author_id` (`author_id`);

--
-- Indexes for table `persons`
--
ALTER TABLE `persons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `primary_qiraa_id` (`primary_qiraa_id`);

--
-- Indexes for table `qiraat`
--
ALTER TABLE `qiraat`
  ADD PRIMARY KEY (`id`),
  ADD KEY `imam_id` (`imam_id`);

--
-- Indexes for table `quran_connections`
--
ALTER TABLE `quran_connections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `to_person_id` (`to_person_id`),
  ADD KEY `transmission_type_id` (`transmission_type_id`);

--
-- Indexes for table `quran_connection_items`
--
ALTER TABLE `quran_connection_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `connection_id` (`connection_id`),
  ADD KEY `qiraa_id` (`qiraa_id`),
  ADD KEY `riwaya_id` (`riwaya_id`),
  ADD KEY `tariq_id` (`tariq_id`);

--
-- Indexes for table `riwayat`
--
ALTER TABLE `riwayat`
  ADD PRIMARY KEY (`id`),
  ADD KEY `qiraa_id` (`qiraa_id`),
  ADD KEY `rawi_id` (`rawi_id`);

--
-- Indexes for table `transmission_types`
--
ALTER TABLE `transmission_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `turuq`
--
ALTER TABLE `turuq`
  ADD PRIMARY KEY (`id`),
  ADD KEY `riwaya_id` (`riwaya_id`),
  ADD KEY `parent_id` (`parent_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `matn_connections`
--
ALTER TABLE `matn_connections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `mutoon`
--
ALTER TABLE `mutoon`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=52;

--
-- AUTO_INCREMENT for table `persons`
--
ALTER TABLE `persons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=265;

--
-- AUTO_INCREMENT for table `qiraat`
--
ALTER TABLE `qiraat`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `quran_connections`
--
ALTER TABLE `quran_connections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `quran_connection_items`
--
ALTER TABLE `quran_connection_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `riwayat`
--
ALTER TABLE `riwayat`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `transmission_types`
--
ALTER TABLE `transmission_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `turuq`
--
ALTER TABLE `turuq`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2003;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `matn_connections`
--
ALTER TABLE `matn_connections`
  ADD CONSTRAINT `matn_connections_ibfk_1` FOREIGN KEY (`to_person_id`) REFERENCES `persons` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `matn_connections_ibfk_2` FOREIGN KEY (`matn_id`) REFERENCES `mutoon` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `matn_connections_ibfk_3` FOREIGN KEY (`transmission_type_id`) REFERENCES `transmission_types` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `mutoon`
--
ALTER TABLE `mutoon`
  ADD CONSTRAINT `mutoon_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `persons` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `persons`
--
ALTER TABLE `persons`
  ADD CONSTRAINT `persons_ibfk_1` FOREIGN KEY (`primary_qiraa_id`) REFERENCES `qiraat` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `qiraat`
--
ALTER TABLE `qiraat`
  ADD CONSTRAINT `qiraat_ibfk_1` FOREIGN KEY (`imam_id`) REFERENCES `persons` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `quran_connections`
--
ALTER TABLE `quran_connections`
  ADD CONSTRAINT `quran_connections_ibfk_1` FOREIGN KEY (`to_person_id`) REFERENCES `persons` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quran_connections_ibfk_5` FOREIGN KEY (`transmission_type_id`) REFERENCES `transmission_types` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `quran_connection_items`
--
ALTER TABLE `quran_connection_items`
  ADD CONSTRAINT `quran_connection_items_ibfk_1` FOREIGN KEY (`connection_id`) REFERENCES `quran_connections` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quran_connection_items_ibfk_2` FOREIGN KEY (`qiraa_id`) REFERENCES `qiraat` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `quran_connection_items_ibfk_3` FOREIGN KEY (`riwaya_id`) REFERENCES `riwayat` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `quran_connection_items_ibfk_4` FOREIGN KEY (`tariq_id`) REFERENCES `turuq` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `riwayat`
--
ALTER TABLE `riwayat`
  ADD CONSTRAINT `riwayat_ibfk_1` FOREIGN KEY (`qiraa_id`) REFERENCES `qiraat` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `riwayat_ibfk_2` FOREIGN KEY (`rawi_id`) REFERENCES `persons` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `turuq`
--
ALTER TABLE `turuq`
  ADD CONSTRAINT `turuq_ibfk_1` FOREIGN KEY (`riwaya_id`) REFERENCES `riwayat` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `turuq_ibfk_2` FOREIGN KEY (`parent_id`) REFERENCES `turuq` (`id`) ON DELETE SET NULL;

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


-- Register of ijazat issued by a user (the rendered text is stored as a snapshot).
CREATE TABLE IF NOT EXISTS `ijazat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `student_name` varchar(200) NOT NULL,
  `module` enum('mutoon','quran','general') NOT NULL,
  `style` enum('normal','detailed') NOT NULL DEFAULT 'normal',
  `matn_id` int(11) DEFAULT NULL,
  `qiraa_id` int(11) DEFAULT NULL,
  `riwaya_id` int(11) DEFAULT NULL,
  `tariq_id` int(11) DEFAULT NULL,
  `transmission_type_id` int(11) DEFAULT NULL,
  `title` varchar(300) DEFAULT NULL,
  `body` longtext NOT NULL,
  `details` longtext DEFAULT NULL,
  `issued_at` date NOT NULL,
  `issued_hijri` varchar(60) DEFAULT NULL,
  `place` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `public_token` varchar(32) DEFAULT NULL,
  `short_code` varchar(16) DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoke_reason` varchar(255) DEFAULT NULL,
  `scan_count` int(11) NOT NULL DEFAULT 0,
  `last_scanned_at` datetime DEFAULT NULL,
  `frozen_html` longtext DEFAULT NULL,
  `content_hash` char(64) DEFAULT NULL,
  `frozen_at` datetime DEFAULT NULL,
  `detailed_html` longtext DEFAULT NULL,
  `detailed_hash` char(64) DEFAULT NULL,
  `detailed_frozen_at` datetime DEFAULT NULL,
  `replaces_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ijazat_replaces` (`replaces_id`),
  UNIQUE KEY `ijazat_public_token` (`public_token`),
  UNIQUE KEY `ijazat_short_code` (`short_code`),
  KEY `ijazat_user` (`user_id`, `issued_at`),
  CONSTRAINT `ijazat_user_fk`   FOREIGN KEY (`user_id`)   REFERENCES `users` (`id`)   ON DELETE CASCADE,
  CONSTRAINT `ijazat_matn_fk`   FOREIGN KEY (`matn_id`)   REFERENCES `mutoon` (`id`)  ON DELETE SET NULL,
  CONSTRAINT `ijazat_qiraa_fk`  FOREIGN KEY (`qiraa_id`)  REFERENCES `qiraat` (`id`)  ON DELETE SET NULL,
  CONSTRAINT `ijazat_riwaya_fk` FOREIGN KEY (`riwaya_id`) REFERENCES `riwayat` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ijazat_tariq_fk`  FOREIGN KEY (`tariq_id`)  REFERENCES `turuq` (`id`)   ON DELETE SET NULL,
  CONSTRAINT `ijazat_tx_fk`     FOREIGN KEY (`transmission_type_id`) REFERENCES `transmission_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ijazat_replaces_fk` FOREIGN KEY (`replaces_id`) REFERENCES `ijazat` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `ijaza_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ijaza_id` int(11) NOT NULL,
  `kind` enum('pdf','pdf_detailed') NOT NULL DEFAULT 'pdf',
  `filename` varchar(200) DEFAULT NULL,
  `size` int(11) NOT NULL,
  `sha256` char(64) NOT NULL,
  `data` longblob NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ijaza_files_one` (`ijaza_id`, `kind`),
  CONSTRAINT `ijaza_files_ijaza_fk` FOREIGN KEY (`ijaza_id`) REFERENCES `ijazat` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

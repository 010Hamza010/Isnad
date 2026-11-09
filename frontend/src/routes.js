// Single source of truth for navigation, page titles and subtitles.
export const NAV = [
  { section: null, items: [
    { path: '/', icon: 'home', label: 'الرئيسية', title: 'الرئيسية', sub: 'نظرة عامة على أسانيدك' },
    { path: '/fast-entry', icon: 'text', label: 'إدخال سريع', title: 'إدخال سريع من نص', sub: 'الصق إسناداً، راجع الأسماء، وتُحفظ الأشخاص والاتصالات دفعة واحدة' },
  ]},
  { section: 'المتون', items: [
    { path: '/mutoon/isnads',      icon: 'chain', label: 'أسانيد المتون', title: 'أسانيد المتون', sub: 'اختر متناً لعرض سلسلة إسنادك إلى مؤلفه' },
    { path: '/mutoon/connections', icon: 'link',  label: 'الاتصالات', stat: 'matnConns', title: 'اتصالات المتون', sub: 'أدخل الاتصالات المباشرة فقط، وتُبنى الأسانيد تلقائياً' },
    { path: '/mutoon/list',        icon: 'books', label: 'المتون', stat: 'mutoon', title: 'المتون', sub: 'الكتب والمتون العلمية ومؤلفوها' },
  ]},
  { section: 'القرآن الكريم', items: [
    { path: '/quran/isnads',       icon: 'quran',  label: 'أسانيد القرآن', title: 'أسانيد القرآن', sub: 'سلسلة إسنادك بالقراءات والروايات إلى النبي ﷺ' },
    { path: '/quran/connections',  icon: 'link',   label: 'الاتصالات', stat: 'quranConns', title: 'اتصالات القرآن', sub: 'من قرأتَ عليه، وبأي قراءة ورواية وطريق' },
    { path: '/quran/master',       icon: 'layers', label: 'القراءات والروايات', title: 'القراءات والروايات والطرق', sub: 'البيانات المرجعية للقراءات' },
  ]},
  { section: 'الإجازات', items: [
    { path: '/ijazat', icon: 'award', label: 'إجازة لطالب', title: 'الإجازات', sub: 'أنشئ إجازة بإسنادك، اطبعها، واحفظها في السجل' },
    { path: '/verify', icon: 'check', label: 'التحقق من إجازة', title: 'التحقق من إجازة', sub: 'امسح رمز QR أو الصق بياناته للتأكد من صحتها' },
  ]},
  { section: 'عام', items: [
    { path: '/persons', icon: 'users',   label: 'الأعلام', stat: 'persons', title: 'الأعلام', sub: 'الشيوخ والرواة والمؤلفون — ملف واحد لكل شخص' },
    { path: '/graph',   icon: 'network', label: 'شبكة الإسناد', title: 'شبكة الإسناد', sub: 'الشبكة الكاملة للاتصالات' },
    { path: '/profile', icon: 'user', label: 'الملف الشخصي', title: 'الملف الشخصي', sub: 'اسمك الكامل والمختصر وجنسك ومكانك — تستعملها الإجازات والأسانيد' },
    { path: '/settings', icon: 'settings', label: 'الإعدادات', title: 'الإعدادات', sub: 'صيغ الأداء وأسلوب كتابة الأسانيد' },
  ]},
];

export const routeMeta = path => NAV.flatMap(g => g.items).find(i => i.path === path);

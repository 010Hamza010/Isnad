// Map API rows to Combobox/Select option shapes.
export const personOptions = (persons, { includeMe = false } = {}) => [
  ...(includeMe ? [{ value: 0, label: 'أنا' }] : []),
  ...persons.map(p => ({
    value: p.id,
    label: p.name_ar,
    sub: [p.death_year && `ت ${p.death_year}`, p.region].filter(Boolean).join(' · ') || undefined,
  })),
];

export const rowOptions = (rows, label = 'name_ar') => rows.map(r => ({ value: r.id, label: r[label] }));

export const SUBJECTS = ['فقه', 'نحو', 'تجويد', 'قراءات', 'عقيدة', 'حديث', 'تفسير', 'أصول', 'بلاغة', 'سيرة', 'أخرى'];

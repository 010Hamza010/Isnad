// Filtering, sorting and paging of the «الأعلام» page, done in the browser on the full list.
import { matches, normalizeArabic, nameForm } from './text.js';
import { hasRole } from './personRoles.js';

export const PAGE_SIZE = 50;

const deathNumber = p => {
  const m = String(p.death_year ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
};
const isFixed = p => Number(p.id) <= 0; // رب العزة، جبريل، النبي ﷺ
const regionKey = r => normalizeArabic(r);

// What a person lacks, for «يحتاج إكمالاً»: no death year, no century, or no link to anyone.
export function missing(p) {
  if (isFixed(p)) return [];
  return [
    !p.death_year && 'سنة الوفاة',
    !p.century && 'القرن',
    !Number(p.links_count) && 'الروابط',
  ].filter(Boolean);
}

export function inKind(p, kind, roles) {
  if (!kind || kind === 'all') return true;
  if (kind === 'others') return !roles.has(Number(p.id));
  return hasRole(roles, p.id, kind);
}

const SORTS = {
  name: (a, b) => String(a.name_ar).localeCompare(String(b.name_ar), 'ar'),
  death: (a, b) => {
    const x = deathNumber(a), y = deathNumber(b);
    if (x == null || y == null) return x == null ? (y == null ? SORTS.name(a, b) : 1) : -1;
    return x - y || SORTS.name(a, b);
  },
  links: (a, b) => (Number(b.links_count) || 0) - (Number(a.links_count) || 0) || SORTS.name(a, b),
};

// Everything but the kind: the kind tabs count what the other filters leave.
function baseFilter(persons, { q, century, region, incomplete }) {
  return persons.filter(p =>
    (!century || String(p.century ?? '') === String(century)) &&
    (!region || regionKey(p.region) === regionKey(region)) &&
    (!incomplete || missing(p).length > 0) &&
    matches(q, p.name_ar, p.name_latin, p.kunya, p.nisba, p.region));
}

export function filterPersons(persons, roles, f = {}) {
  return baseFilter(persons, f)
    .filter(p => inKind(p, f.kind, roles))
    .sort(SORTS[f.sort] || SORTS.name);
}

export function kindCounts(persons, roles, f = {}) {
  const base = baseFilter(persons, f);
  return Object.fromEntries(['all', 'imam', 'rawi', 'others'].map(k => [k, base.filter(p => inKind(p, k, roles)).length]));
}

// Centuries and regions present, with their counts (regions merged across spelling variants).
export function facets(persons) {
  const centuries = new Map(), regions = new Map();
  persons.forEach(p => {
    if (p.century) centuries.set(Number(p.century), (centuries.get(Number(p.century)) || 0) + 1);
    const r = String(p.region ?? '').trim();
    if (r) {
      const k = regionKey(r);
      const cur = regions.get(k) || { label: r, count: 0 };
      cur.count++; regions.set(k, cur);
    }
  });
  return {
    centuries: [...centuries].sort((a, b) => a[0] - b[0]).map(([c, count]) => ({ value: String(c), count })),
    regions: [...regions.values()].sort((a, b) => a.label.localeCompare(b.label, 'ar')).map(r => ({ value: r.label, count: r.count })),
  };
}

export function paginate(list, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const cur = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (cur - 1) * size;
  return { items: list.slice(start, start + size), page: cur, pages, from: list.length ? start + 1 : 0, to: Math.min(start + size, list.length), total: list.length };
}

// 1 … 4 5 [6] 7 8 … 25
export function pageNumbers(page, pages) {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= pages));
  const out = [];
  [...keep].sort((a, b) => a - b).forEach((n, i, arr) => {
    if (i && n - arr[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

// Hijri century of a death year: «852هـ» → 9, «100» → 1, «٨٥٢» → 9. A year marked «م» (Gregorian)
// or with no number gives null: the century field is hijri.
export function centuryOf(deathYear) {
  const s = String(deathYear ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  if (/\d\s*م/.test(s) || /\bAD\b|\bCE\b/i.test(s)) return null;
  const m = s.match(/\d+/);
  const y = m ? Number(m[0]) : 0;
  return y > 0 && y < 2000 ? Math.ceil(y / 100) : null;
}

// Typing a death year fills the century, unless it was set by hand (differs from the old year's).
export function withDeathYear(form, deathYear) {
  const next = { ...form, death_year: deathYear };
  const auto = centuryOf(deathYear);
  const wasAuto = !form.century || String(form.century) === String(centuryOf(form.death_year) ?? '');
  if (wasAuto) next.century = auto != null ? String(auto) : centuryOf(form.death_year) != null ? '' : form.century;
  return next;
}

// Persons that may be the same as `person`, best first: the same name once «ابن» = «بن» and
// tashkeel are ignored (1), or every word of the shorter name (2 words at least) in the longer one (0.7).
export function likelyDuplicates(person, persons) {
  const words = s => nameForm(s).split(' ').filter(Boolean);
  const mine = words(person.name_ar);
  return persons
    .filter(p => Number(p.id) !== Number(person.id) && Number(p.id) > 0)
    .map(p => {
      const theirs = words(p.name_ar);
      if (mine.join(' ') === theirs.join(' ')) return { person: p, score: 1 };
      const [short, long] = mine.length <= theirs.length ? [mine, theirs] : [theirs, mine];
      return { person: p, score: short.length >= 2 && short.every(w => long.includes(w)) ? 0.7 : 0 };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || String(a.person.name_ar).localeCompare(String(b.person.name_ar), 'ar'));
}

// What a merge (dry run) will do, as short Arabic lines.
export function mergeSummary(r, dropName) {
  if (!r) return [];
  return [
    r.matn_moved && `يُنقل ${r.matn_moved} اتصال متن`,
    r.quran_moved && `يُنقل ${r.quran_moved} اتصال قرآن`,
    (r.matn_removed + r.quran_removed) > 0 && `يُحذف ${r.matn_removed + r.quran_removed} اتصال مكرر أو يصل العلَم بنفسه`,
    r.mutoon && `${r.mutoon} متن يصير مؤلفه العلَم المُبقى`,
    (r.qiraat + r.riwayat) > 0 && `${r.qiraat + r.riwayat} قراءة أو رواية يصير إمامها أو راويها العلَم المُبقى`,
    r.filled?.length && `تُكمَل من بياناته: ${r.filled.map(f => FIELD_LABELS[f] || f).join('، ')}`,
    `ثم يُحذف «${dropName}»`,
  ].filter(Boolean);
}
const FIELD_LABELS = { name_latin: 'الاسم اللاتيني', kunya: 'الكنية', nisba: 'النسبة', century: 'القرن', death_year: 'سنة الوفاة', region: 'البلد', description: 'الترجمة' };

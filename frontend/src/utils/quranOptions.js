import { isMe } from './text.js';

/**
 * Every distinct (qiraa, riwaya, tariq) I hold directly from one of my shuyukh,
 * grouped by qiraa label: [[qiraaLabel, [option]]].
 */
export function quranOptions(conns, { qiraat, riwayat, turuq }) {
  const qMap = new Map(qiraat.map(q => [Number(q.id), q]));
  const rMap = new Map(riwayat.map(r => [Number(r.id), r]));
  const tMap = new Map(turuq.map(t => [Number(t.id), t]));
  const seen = new Map();

  conns.filter(c => isMe(c.from_person_id)).forEach(conn => {
    const items = conn.items?.length ? conn.items : [{}];
    items.forEach(it => {
      const riwaya   = it.riwaya_id ? rMap.get(Number(it.riwaya_id)) : null;
      const qiraa_id = riwaya?.qiraa_id || it.qiraa_id || null;
      const key = `q${qiraa_id}-r${it.riwaya_id || null}-t${it.tariq_id || null}`;
      if (!seen.has(key)) seen.set(key, {
        key, qiraa_id, riwaya_id: it.riwaya_id || null, tariq_id: it.tariq_id || null,
        qiraaLabel:  qiraa_id ? qMap.get(Number(qiraa_id))?.name_ar : 'مطلق',
        riwayaLabel: riwaya?.name_ar || null,
        tariqLabel:  it.tariq_id ? tMap.get(Number(it.tariq_id))?.name_ar : null,
        teachers: [],
      });
      const opt = seen.get(key);
      if (!opt.teachers.includes(conn.to_name)) opt.teachers.push(conn.to_name);
    });
  });

  const grouped = new Map();
  seen.forEach(o => { if (!grouped.has(o.qiraaLabel)) grouped.set(o.qiraaLabel, []); grouped.get(o.qiraaLabel).push(o); });
  return [...grouped.entries()];
}

/** Query string for /graph/quran/paths. */
export function quranPathParams(opt) {
  const p = new URLSearchParams();
  if (opt.riwaya_id) p.append('riwaya_id', opt.riwaya_id);
  if (opt.tariq_id)  p.append('tariq_id', opt.tariq_id);
  if (!opt.riwaya_id && opt.qiraa_id) p.append('qiraa_id', opt.qiraa_id);
  return p.toString();
}

/** Flatten /graph/*\/paths groups into full chains for the text renderer. */
export const groupsToChains = groups =>
  groups.flatMap(g => (g.chains.length ? g.chains.map(c => [g.firstEdge, ...c]) : [[g.firstEdge]]));

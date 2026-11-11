import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './src/styles/globals.css';
import IsnadSky from './src/components/home/IsnadSky';
const names = ['الشيخ أحمد', 'الشيخ محمد', 'الشيخ عبد الله', 'الشيخ إبراهيم', 'الشيخ يوسف', 'الشيخ علي', 'الشيخ عمر', 'الشيخ صالح', 'الشيخ حسن', 'الشيخ سليمان'];
const persons = [], matnEdges = [], quranEdges = [];
let id = 1;
const add = n => { persons.push({ id, name_ar: n }); return id++; };
const shaykhs = [add('الشيخ عبد الرحمن'), add('الشيخ محمود'), add('الشيخ خالد')];
shaykhs.forEach(s => matnEdges.push({ from_person_id: 0, to_person_id: s }));
let layer = shaykhs;
for (let d = 0; d < 11; d++) {
  const next = [];
  layer.forEach((p, i) => { const k = d < 3 ? 2 : (i % 3 === 0 ? 2 : 1); for (let j = 0; j < k && next.length < 9; j++) { const q = add(names[(d * 3 + i + j) % names.length] + ' ' + (d + 1)); next.push(q); matnEdges.push({ from_person_id: p, to_person_id: q }); } });
  layer = next;
}
const jazari = add('ابن الجزري'), shatibi = add('الشاطبي'), nafi = add('نافع');
layer.forEach((p, i) => matnEdges.push({ from_person_id: p, to_person_id: [jazari, shatibi, nafi][i % 3] }));
quranEdges.push({ from_person_id: nafi, to_person_id: -1 });
createRoot(document.getElementById('root')).render(
  <div className="hero hero-sky">
    <Suspense fallback={null}><IsnadSky data={{ persons, matnEdges, quranEdges }} onPick={p => console.log('pick', p)} /></Suspense>
    <div className="hero-sky-text"><div className="hero-sub">السلام عليكم</div><div className="hero-title">admin</div>
      <p className="hero-sky-caption">سماء إسنادك: أنت في الأسفل، وكل خيط نورٍ اتصالٌ يصعد بك إلى شيوخك ومَن فوقهم.</p></div>
  </div>);

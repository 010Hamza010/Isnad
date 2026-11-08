import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import IsnadTree from './IsnadTree';
import { roleMatcher, bodyToParagraphs, numberNotes, chainNames, designVars } from '../../utils/certificate';
import { shortBio } from '../../utils/isnadTree';
import QRCode from 'qrcode';

const PAGE_WIDTH_PX = 794; // 210mm at 96dpi
const deathLabel = d => (d ? ` (ت ${/^\d+$/.test(String(d)) ? `${d}هـ` : d})` : '');

/* ── DOM builders (used for measuring; the measured HTML is what gets displayed) ── */

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text; // textContent: user text is never parsed as HTML
  return n;
};

function atomNode(a, numbers) {
  switch (a.type) {
    case 'role': return el('span', `r-${a.role}`, a.text);
    case 'tahwil': return el('span', 'tahwil', 'ح');
    case 'placeholder': return el('span', 'ph', a.text);
    case 'note': return numbers.has(a.id) ? el('sup', 'note-ref', String(numbers.get(a.id))) : null;
    default: return document.createTextNode(a.text);
  }
}

function paragraphNode(atoms, from, to, cls, numbers) {
  const p = el('p', cls);
  for (let i = from; i < to; i++) {
    const node = atomNode(atoms[i], numbers);
    if (node) p.appendChild(node);
    // a note marker hugs the name; otherwise restore the source spacing
    if (atoms[i].space && i < to - 1 && atoms[i + 1]?.type !== 'note') p.appendChild(document.createTextNode(' '));
  }
  return p;
}

function noteNode(id, note, n) {
  const d = el('div', 'cert-note');
  d.appendChild(el('span', 'n', String(n)));
  d.appendChild(el('b', null, note.name));
  d.appendChild(document.createTextNode(`${deathLabel(note.death_year)}: ${shortBio(note.description)}`));
  return d;
}

function pageSkeleton(first, title, ornament) {
  const page = el('div', 'cert-page');
  const inner = el('div', 'cert-inner');
  page.appendChild(inner);
  if (first) {
    const head = el('header', 'cert-head');
    if (ornament) head.appendChild(el('div', 'cert-ornament', ornament));
    head.appendChild(el('div', 'cert-title', title || 'إجازة'));
    inner.appendChild(head);
  }
  const flow = el('div', 'cert-flow');
  inner.appendChild(flow);
  return { page, inner, flow };
}

/**
 * Lay the paragraphs out on A4 pages inside `root` (an off-screen element carrying the design).
 * Each page holds as much text as fits together with the footnotes it references.
 */
// Verification block after the signature: the QR (SVG from the qrcode library) and the short code.
function verifyNode(v) {
  const box = el('div', `cert-verify${v.placeholder ? ' placeholder' : ''}`);
  const qr = el('div', 'cert-qr');
  if (v.svg) qr.innerHTML = v.svg; // generated locally by the qrcode library from our own URL
  else qr.appendChild(el('span', null, 'QR'));
  box.appendChild(qr);
  const txt = el('div', 'cert-verify-text');
  txt.appendChild(el('div', 'cert-verify-title', 'رمز الإجازة'));
  txt.appendChild(el('div', 'cert-verify-code', v.placeholder ? 'يُضاف بعد الحفظ' : v.code));
  box.appendChild(txt);
  return box;
}

function paginate(root, { paragraphs, numbers, notes, title, ornament, verify }) {
  const done = [];
  let cur = null;

  const open = () => {
    root.replaceChildren();
    const s = pageSkeleton(done.length === 0, title, ornament);
    root.appendChild(s.page);
    cur = { ...s, notesBox: null, noted: new Set(), empty: true };
  };
  const close = () => { done.push(cur.page.cloneNode(true)); };
  // the measuring copy is laid out as plain blocks without margins (see .cert-measure in CSS)
  const used = () => [...cur.inner.children].reduce((h, c) => h + c.offsetHeight, 0);
  const fits = () => used() <= cur.inner.clientHeight + 0.5;

  // try to place atoms[from, to) of paragraph pi; keep it if it fits (or always, when forced)
  const tryPlace = (atoms, pi, from, to, commit, force = false) => {
    const cls = [pi === 0 && 'p-first', pi === paragraphs.length - 1 && 'p-last', to < atoms.length && 'split-next']
      .filter(Boolean).join(' ');
    const p = paragraphNode(atoms, from, to, cls, numbers);
    cur.flow.appendChild(p);
    const added = [];
    for (let i = from; i < to; i++) {
      const a = atoms[i];
      if (a.type !== 'note' || !numbers.has(a.id) || cur.noted.has(a.id)) continue;
      if (!cur.notesBox) { cur.notesBox = el('div', 'cert-notes'); cur.notesBox.appendChild(el('div', 'cert-rule')); cur.inner.appendChild(cur.notesBox); }
      const n = noteNode(a.id, notes[a.id], numbers.get(a.id));
      cur.notesBox.appendChild(n);
      added.push([a.id, n]);
    }
    const ok = force || fits();
    if (ok && commit) { added.forEach(([id]) => cur.noted.add(id)); cur.empty = false; return true; }
    p.remove();
    added.forEach(([, n]) => n.remove());
    if (cur.notesBox && cur.notesBox.children.length === 1) { cur.notesBox.remove(); cur.notesBox = null; }
    return ok;
  };

  open();
  paragraphs.forEach((atoms, pi) => {
    let from = 0;
    while (from < atoms.length) {
      if (tryPlace(atoms, pi, from, atoms.length, true)) break;
      // largest prefix that fits (never end a page right before its note marker)
      let lo = from, hi = atoms.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (tryPlace(atoms, pi, from, mid, false)) lo = mid; else hi = mid - 1;
      }
      let to = lo;
      while (to > from && atoms[to]?.type === 'note') to--;
      let force = false;
      if (to === from) {
        if (!cur.empty) { close(); open(); continue; }
        to = from + 1; force = true; // a single atom taller than an empty page: place it anyway
      }
      tryPlace(atoms, pi, from, to, true, force);
      from = to;
      close(); open();
    }
  });
  // the verification QR goes after the signature; if it does not fit, it starts a new page
  if (verify) {
    const node = verifyNode(verify);
    cur.flow.appendChild(node);
    if (!fits() && !cur.empty) { node.remove(); close(); open(); cur.flow.appendChild(verifyNode(verify)); }
    cur.empty = false;
  }
  if (!cur.empty || done.length === 0) close();
  root.replaceChildren();

  if (done.length > 1) done.forEach((pg, i) => pg.appendChild(el('div', 'page-no', `${i + 1} / ${done.length}`)));
  return done.map(pg => pg.outerHTML);
}

async function fontsReady(design) {
  if (!document.fonts) return;
  const families = [...new Set(Object.values(design.fonts).map(f => f.family))];
  await Promise.all(families.map(f => document.fonts.load(`16px "${f}"`).catch(() => {})));
  await document.fonts.ready;
}

/* ── Components ── */

function useZoom(ref) {
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setZoom(Math.min(1, e.contentRect.width / PAGE_WIDTH_PX)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return zoom;
}

/**
 * The ijaza as real A4 pages.
 *   variant 'normal'   — text pages.
 *   variant 'detailed' — footnotes (biographies) at the bottom of each page + a tree page.
 * people: { student, shaykh } names to colour.
 */
/**
 * verification: { payload, code } of a saved ijaza — the QR encodes the signed payload text (student,
 * subject, date-time, code), verified in the dashboard — or { placeholder: true } before saving.
 */
export default function Certificate({ title, body, variant = 'normal', notes = {}, chains = [], design: d, people = {}, verification = null, onRendered }) {
  const detailed = variant === 'detailed';
  const measureRef = useRef(null);
  const wrapRef = useRef(null);
  const zoom = useZoom(wrapRef);
  const [pages, setPages] = useState([]);

  const namesKey = (people.names || []).join('|');
  const matcher = useMemo(() => {
    const fromChains = chainNames(chains);
    return roleMatcher({ ...people, ...fromChains, names: [...fromChains.names, ...(people.names || [])] });
  }, [people.student, people.shaykh, namesKey, chains]);
  const paragraphs = useMemo(() => bodyToParagraphs(body, matcher), [body, matcher]);
  const numbers = useMemo(() => (detailed ? numberNotes(paragraphs, notes) : new Map()), [detailed, paragraphs, notes]);
  const vars = useMemo(() => designVars(d), [d]);
  const rootClass = `cert-root frame-${d.frame.style}`;

  // QR as SVG in the design's text colour, transparent background
  const showQr = verification && d.qr?.show !== false;
  const [qrSvg, setQrSvg] = useState(null);
  useEffect(() => {
    setQrSvg(null);
    if (!showQr || !verification.payload) return;
    let alive = true;
    // level L: the payload is small and printed on paper (not scratched outdoors), so prefer larger modules
    QRCode.toString(verification.payload, { type: 'svg', errorCorrectionLevel: 'L', margin: 0, color: { dark: d.colors.text, light: '#0000' } })
      .then(svg => alive && setQrSvg(svg))
      .catch(() => {});
    return () => { alive = false; };
  }, [showQr, verification?.payload, d.colors.text]);
  const verify = useMemo(() => {
    if (!showQr) return null;
    if (verification.placeholder) return { placeholder: true };
    return qrSvg ? { svg: qrSvg, code: verification.code } : null;
  }, [showQr, verification?.placeholder, verification?.code, qrSvg]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      await fontsReady(d);
      if (!alive || !measureRef.current) return;
      setPages(paginate(measureRef.current, { paragraphs, numbers, notes, title, ornament: d.frame.ornament, verify }));
    }, 120);
    return () => { alive = false; clearTimeout(t); };
  }, [paragraphs, numbers, notes, title, d, verify]);

  // tell the parent once the pages (and QR) are laid out, so it can archive them exactly as shown
  const sheetsRef = useRef(null);
  const waitingForQr = showQr && !verification.placeholder && !qrSvg;
  useEffect(() => {
    if (!onRendered || !pages.length || waitingForQr) return;
    const t = setTimeout(() => sheetsRef.current && onRendered(sheetsRef.current), 600); // tree fonts settle
    return () => clearTimeout(t);
  }, [pages, waitingForQr]);

  const tree = detailed && chains.length > 0 && (
    <div className="cert-page tree-page">
      <div className="cert-inner">
        <header className="cert-head">
          {d.frame.ornament && <div className="cert-ornament">{d.frame.ornament}</div>}
          <div className="cert-title">شجرة الإسناد</div>
          {title && <div className="cert-sub">{title}</div>}
        </header>
        <IsnadTree chains={chains} design={d} meName={people.me || people.shaykh} />
      </div>
    </div>
  );

  const sheets = (
    <>
      {pages.map((html, i) => <div key={i} className="cert-page-wrap" dangerouslySetInnerHTML={{ __html: html }} />)}
      {tree}
    </>
  );

  const printRoot = document.getElementById('print-root');
  return (
    <div ref={wrapRef} className="cert-preview">
      <div className={rootClass} style={vars}>
        <div ref={measureRef} className="cert-measure" aria-hidden="true" />
      </div>
      <div ref={sheetsRef} className={`${rootClass} cert-sheets`} style={{ ...vars, zoom }} dir="rtl">
        {pages.length ? sheets : <div className="cert-page"><div className="skeleton" style={{ height: '100%' }} /></div>}
      </div>
      {printRoot && createPortal(<div className={`${rootClass} cert-sheets`} style={vars} dir="rtl">{sheets}</div>, printRoot)}
    </div>
  );
}

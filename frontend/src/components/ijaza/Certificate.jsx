import React from 'react';
import { createPortal } from 'react-dom';
import IsnadProse from '../isnad/IsnadProse';
import IsnadTree from './IsnadTree';
import { shortBio } from '../../utils/isnadTree';

const deathLabel = d => (d ? ` (ت ${/^\d+$/.test(String(d)) ? `${d}هـ` : d})` : '');

/**
 * The printable ijaza.
 *  variant 'normal'   — text only.
 *  variant 'detailed' — margin notes for every [[id]] marker (from `notes`) + a tree sheet from `chains`.
 */
export function CertificateSheet({ title, body, variant = 'normal', notes = {}, chains = [] }) {
  const detailed = variant === 'detailed';
  const paragraphs = String(body || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  let n = 0; // note numbers in reading order

  const renderNote = id => {
    const note = notes[id];
    if (!detailed || !note) return null;
    n += 1;
    return (
      <>
        <sup className="note-ref">{n}</sup>
        <span className="sidenote" role="note">
          <span className="note-num">{n}</span>
          <strong>{note.name}</strong>{deathLabel(note.death_year)}: {shortBio(note.description)}
        </span>
      </>
    );
  };

  return (
    <>
      <article className={`certificate${detailed ? ' detailed' : ''}`} dir="rtl">
        <header className="cert-head">
          <div className="cert-ornament">❁ ❁ ❁</div>
          <div className="cert-title">{title || 'إجازة'}</div>
        </header>
        <div className="cert-body">
          {paragraphs.map((p, i) => <p key={i}><IsnadProse text={p} renderNote={renderNote} /></p>)}
        </div>
      </article>
      {detailed && chains.length > 0 && (
        <article className="certificate tree-sheet" dir="rtl">
          <header className="cert-head">
            <div className="cert-ornament">❁ ❁ ❁</div>
            <div className="cert-title">شجرة الإسناد</div>
            {title && <div className="cert-sub">{title}</div>}
          </header>
          <IsnadTree chains={chains} />
        </article>
      )}
    </>
  );
}

/** On screen: the sheet(s). In print: a copy rendered outside the app shell (see #print-root in CSS). */
export default function Certificate(props) {
  const printRoot = document.getElementById('print-root');
  return (
    <div className="stack" style={{ gap: 20 }}>
      <CertificateSheet {...props} />
      {printRoot && createPortal(<CertificateSheet {...props} />, printRoot)}
    </div>
  );
}

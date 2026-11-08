import React from 'react';

// Split isnad prose into text, the تحويل mark «ح» (rubricated), note markers [[id]] and {placeholders}.
const TOKEN = /(\[\[-?\d+\]\]|\{[^{}\n]{1,40}\}|(?<=^|\s)ح(?=\s|$))/g;

export function proseParts(text) {
  return String(text ?? '').split(TOKEN).filter(p => p !== '' && p != null).map(p => {
    if (p === 'ح') return { type: 'tahwil' };
    const note = p.match(/^\[\[(-?\d+)\]\]$/);
    if (note) return { type: 'note', id: Number(note[1]) };
    if (/^\{.*\}$/.test(p)) return { type: 'placeholder', text: p };
    return { type: 'text', text: p };
  });
}

/** Inline isnad prose with ح highlighted. `renderNote(id)` handles [[id]] markers (default: hidden). */
export default function IsnadProse({ text, renderNote = () => null }) {
  return proseParts(text).map((p, i) => {
    if (p.type === 'tahwil') return <span key={i} className="tahwil" title="تحويل">ح</span>;
    if (p.type === 'note') return <React.Fragment key={i}>{renderNote(p.id)}</React.Fragment>;
    if (p.type === 'placeholder') return <span key={i} className="ph">{p.text}</span>;
    return <React.Fragment key={i}>{p.text}</React.Fragment>;
  });
}

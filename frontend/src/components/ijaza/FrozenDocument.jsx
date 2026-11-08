import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const PAGE_PX = 794 + 36; // A4 width at 96 dpi + the desk margin

/**
 * The archived ijaza, shown exactly as issued. Rendered in a sandboxed frame: scripts can never
 * run in it (sandbox without allow-scripts); same-origin only so we can fit and print it.
 */
const FrozenDocument = forwardRef(function FrozenDocument({ html, onReady }, ref) {
  const frame = useRef(null);

  const fit = useCallback(() => {
    const f = frame.current;
    const doc = f?.contentDocument;
    if (!doc?.body) return;
    const zoom = Math.min(1, f.clientWidth / PAGE_PX);
    doc.body.style.zoom = zoom;
    f.style.height = `${Math.ceil(doc.documentElement.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const ro = new ResizeObserver(fit);
    ro.observe(f);
    return () => ro.disconnect();
  }, [fit]);

  useImperativeHandle(ref, () => ({
    /**
     * The archived pages as an A4 PDF: each page drawn at 2× (≈190 dpi) and placed as one image per
     * page. Libraries are loaded only when needed.
     */
    toPdf: async () => {
      const doc = frame.current?.contentDocument;
      const pages = [...(doc?.querySelectorAll('.cert-page') || [])];
      if (!pages.length) throw new Error('no pages');
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      await doc.fonts?.ready;
      const zoom = doc.body.style.zoom;
      doc.body.style.zoom = 1;                       // capture at real size
      try {
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i], {
            scale: 2, backgroundColor: null, useCORS: true, logging: false,
            windowWidth: pages[i].scrollWidth + 40, windowHeight: pages[i].scrollHeight + 40,
          });
          if (i > 0) pdf.addPage('a4', 'portrait');
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        }
        return pdf.output('blob');
      } finally {
        doc.body.style.zoom = zoom;
        fit();
      }
    },
    print: () => {
      const w = frame.current?.contentWindow;
      if (!w) return;
      w.document.body.style.zoom = 1;   // print at real size
      w.focus(); w.print();
      fit();
    },
  }), [fit]);

  return (
    <iframe ref={frame} title="الإجازة كما صدرت" className="frozen-doc" sandbox="allow-same-origin allow-modals"
      srcDoc={html} onLoad={() => { fit(); setTimeout(fit, 400); onReady?.(); }} />
  );
});

export default FrozenDocument;

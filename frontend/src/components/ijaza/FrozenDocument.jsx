import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const PAGE_PX = 794 + 36; // A4 width at 96 dpi + the desk margin

/**
 * The archived ijaza, shown exactly as issued. Rendered in a sandboxed frame: scripts can never
 * run in it (sandbox without allow-scripts); same-origin only so we can fit and print it.
 */
const FrozenDocument = forwardRef(function FrozenDocument({ html }, ref) {
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
      srcDoc={html} onLoad={() => { fit(); setTimeout(fit, 400); }} />
  );
});

export default FrozenDocument;

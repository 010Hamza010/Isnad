import React, { useEffect, useRef } from 'react';
import Icon from './Icon';

export default function Modal({ title, onClose, children, footer, size = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // focus first field for fast keyboard entry
    const first = ref.current?.querySelector('input, select, textarea');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق" title="إغلاق"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Standard form modal: Enter in a text input submits, footer has cancel/save.
export function FormModal({ title, onClose, onSubmit, saving, submitLabel = 'حفظ', size, children }) {
  const submit = e => { e.preventDefault(); if (!saving) onSubmit(); };
  return (
    <Modal title={title} onClose={onClose} size={size}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
        <button type="submit" form="modal-form" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="spinner" /> : <Icon name="check" size={16} />} {submitLabel}
        </button>
      </>}>
      <form id="modal-form" onSubmit={submit}>{children}</form>
    </Modal>
  );
}

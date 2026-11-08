import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';

const Ctx = createContext(null);

export const errorMessage = err => {
  const msg = err?.response?.data?.error;
  if (!err?.response) return 'تعذّر الاتصال بالخادم';
  if (/Missing fields/.test(msg || '')) return 'يرجى ملء الحقول المطلوبة';
  if (err.response.status === 409) return msg || 'العنصر موجود مسبقاً';
  return msg && err.response.status < 500 ? msg : 'حدث خطأ غير متوقع';
};

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const seq = useRef(0);

  const toast = useCallback((text, kind = 'info') => {
    const id = ++seq.current;
    setToasts(t => [...t, { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const notifyError = useCallback(err => toast(errorMessage(err), 'error'), [toast]);

  // Promise-based replacement for window.confirm
  const confirm = useCallback((opts) => new Promise(resolve => {
    setDialog({ ...opts, resolve });
  }), []);

  const close = ok => { dialog?.resolve(ok); setDialog(null); };

  return (
    <Ctx.Provider value={{ toast, notifyError, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'error' ? 'alert' : 'check'} size={16} /> {t.text}
          </div>
        ))}
      </div>
      {dialog && (
        <Modal title={dialog.title || 'تأكيد'} size="sm" onClose={() => close(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => close(false)}>إلغاء</button>
            <button className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
              {dialog.confirmLabel || 'تأكيد'}
            </button>
          </>}>
          <p className="muted" style={{ paddingBottom: 8 }}>{dialog.message}</p>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export const useUI = () => useContext(Ctx);

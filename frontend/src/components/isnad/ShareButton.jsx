import React, { useState } from 'react';
import { useUI } from '../ui/UIProvider';
import Icon from '../ui/Icon';
import { downloadFrom } from '../../utils/download';

/** Download this matn's / riwaya's enabled routes as a file another instance can import. */
export default function ShareButton({ url, disabled }) {
  const { toast, notifyError } = useUI();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await downloadFrom(url, 'isnad-share.json'); toast('نُزّل ملف الإسناد — يستورده المستلم من الإعدادات ← النسخ والنقل'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  return (
    <button className="btn btn-secondary btn-sm" onClick={run} disabled={busy || disabled}
      title="ملف بالطرق المفعّلة وأسماء رجالها، لمن أجزته أو لنسخة أخرى من «إسناد»">
      {busy ? <span className="spinner" /> : <><Icon name="arrow" size={14} /> تصدير للمشاركة</>}
    </button>
  );
}

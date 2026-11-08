import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useUI } from '../ui/UIProvider';
import Icon from '../ui/Icon';
import IsnadProse from './IsnadProse';

/** Rendered prose of one path group, with copy. Uses the user's saved keyword settings. */
export default function IsnadText({ group }) {
  const { toast, notifyError } = useUI();
  const [text, setText] = useState(null);

  useEffect(() => {
    let alive = true;
    api.post('/isnad-text/render', { group })
      .then(r => alive && setText(r.data.text))
      .catch(e => alive && notifyError(e));
    return () => { alive = false; };
  }, [group]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('تم نسخ نص الإسناد'); }
    catch { toast('تعذّر النسخ — حدّد النص يدوياً', 'error'); }
  };

  return (
    <div className="isnad-panel">
      {text == null ? <div className="skeleton" style={{ height: 70 }} /> : <div className="isnad-text"><IsnadProse text={text} /></div>}
      <div className="row" style={{ marginTop: 8 }}>
        <span className="small muted spacer">الصيغ تُضبط من <Link to="/settings">الإعدادات</Link></span>
        <button className="btn btn-secondary btn-sm" onClick={copy} disabled={!text}><Icon name="copy" size={14} /> نسخ</button>
      </div>
    </div>
  );
}

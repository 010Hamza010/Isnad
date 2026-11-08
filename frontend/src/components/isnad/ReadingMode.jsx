import React from 'react';
import Segmented from '../ui/Segmented';

// transmission types where the student read: قراءة على الشيخ (2)، عرض (9)
export const isReadingTx = tx => [2, 9].includes(Number(tx));
export const READING_LABELS = { heart: 'غيباً', looking: 'نظراً' };

/** «حفظاً / نظراً» — shown only for reading connections. */
export default function ReadingModeField({ tx, value, onChange }) {
  if (!isReadingTx(tx)) return null;
  return (
    <div className="field">
      <span className="field-label">طريقة القراءة</span>
      <Segmented value={value || ''} onChange={onChange} options={[
        { value: 'heart', label: 'غيباً من حفظي' },
        { value: 'looking', label: 'نظراً (من الكتاب)' },
        { value: '', label: 'غير محدد' },
      ]} />
      <span className="field-hint">يُكتب في الإجازة: «قرأتُ على شيخنا فلان غيباً من حفظي» (العبارة تُعدّل من الإعدادات)</span>
    </div>
  );
}

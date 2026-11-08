import React from 'react';
import Segmented from '../ui/Segmented';

// transmission kinds where the student read: قراءة على الشيخ، عرض
export const isReadingKind = kind => kind === 'qiraa' || kind === 'ard';
export const READING_LABELS = { heart: 'غيباً', looking: 'نظراً' };

/** «حفظاً / نظراً» — shown only for reading connections. */
export default function ReadingModeField({ kind, value, onChange }) {
  if (!isReadingKind(kind)) return null;
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

import React, { useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import Segmented from '../../components/ui/Segmented';
import NewIjaza from './NewIjaza';
import IjazaRegister from './IjazaRegister';
import IjazaTemplates from './IjazaTemplates';
import IjazaDesigns from './IjazaDesigns';

export default function Ijazat() {
  const [tab, setTab] = useState('new');
  const { data, setData, loading } = useLoad(() => api.get('/ijazat/settings').then(r => r.data), [], null);
  const settings = data?.settings;
  const setSettings = s => setData(d => ({ ...d, settings: s }));
  const [registerKey, setRegisterKey] = useState(0);
  const [openId, setOpenId] = useState(null); // just-issued ijaza to open for printing
  const [correction, setCorrection] = useState(null); // issued ijaza being corrected

  return (
    <>
      <div className="toolbar">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'new', label: 'إجازة جديدة' },
          { value: 'register', label: 'سجل الإجازات' },
          { value: 'templates', label: 'القوالب' },
          { value: 'designs', label: 'التصميم' },
        ]} />
      </div>
      {loading || !settings ? <div className="skeleton" style={{ height: 400 }} /> : <>
        {tab === 'new' && (
          <NewIjaza key={correction?.id || 'new'} settings={settings} correction={correction} onCancelCorrection={() => setCorrection(null)}
            onSaved={row => { setCorrection(null); setOpenId(row?.id ?? null); setRegisterKey(k => k + 1); setTab('register'); }}
            onEditTemplates={() => setTab('templates')} />
        )}
        {tab === 'register' && <IjazaRegister key={registerKey} settings={settings} openId={openId} onOpened={() => setOpenId(null)}
          onCorrect={row => { setCorrection(row); setTab('new'); }} />}
        {tab === 'templates' && <IjazaTemplates settings={settings} onSaved={setSettings} />}
        {tab === 'designs' && <IjazaDesigns settings={settings} options={data.designOptions} onSaved={setSettings} />}
      </>}
    </>
  );
}

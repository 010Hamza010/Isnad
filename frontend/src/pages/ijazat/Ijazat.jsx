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
          <NewIjaza settings={settings} onSaved={() => { setRegisterKey(k => k + 1); setTab('register'); }}
            onEditTemplates={() => setTab('templates')} />
        )}
        {tab === 'register' && <IjazaRegister key={registerKey} settings={settings} />}
        {tab === 'templates' && <IjazaTemplates settings={settings} onSaved={setSettings} />}
        {tab === 'designs' && <IjazaDesigns settings={settings} options={data.designOptions} onSaved={setSettings} />}
      </>}
    </>
  );
}

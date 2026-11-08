import React, { useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import Segmented from '../../components/ui/Segmented';
import NewIjaza from './NewIjaza';
import IjazaRegister from './IjazaRegister';
import IjazaTemplates from './IjazaTemplates';

export default function Ijazat() {
  const [tab, setTab] = useState('new');
  const { data: settings, setData: setSettings, loading } =
    useLoad(() => api.get('/ijazat/settings').then(r => r.data.settings), [], null);
  const [registerKey, setRegisterKey] = useState(0);

  return (
    <>
      <div className="toolbar">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'new', label: 'إجازة جديدة' },
          { value: 'register', label: 'سجل الإجازات' },
          { value: 'templates', label: 'القوالب' },
        ]} />
      </div>
      {loading || !settings ? <div className="skeleton" style={{ height: 400 }} /> : <>
        {tab === 'new' && (
          <NewIjaza settings={settings} onSaved={() => { setRegisterKey(k => k + 1); setTab('register'); }}
            onEditTemplates={() => setTab('templates')} />
        )}
        {tab === 'register' && <IjazaRegister key={registerKey} />}
        {tab === 'templates' && <IjazaTemplates settings={settings} onSaved={setSettings} />}
      </>}
    </>
  );
}

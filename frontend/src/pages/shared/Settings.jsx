import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Segmented from '../../components/ui/Segmented';
import Account from './Account';
import Profile from './Profile';
import IsnadTextSettings from './IsnadTextSettings';
import DataTransfer from './DataTransfer';

export const SETTINGS_TABS = [
  { value: 'account', label: 'الحساب' },
  { value: 'profile', label: 'الملف الشخصي' },
  { value: 'isnad',   label: 'صيغ الإسناد' },
  { value: 'data',    label: 'النسخ والنقل' },
];

/** All settings in one page; the tab is in the URL (?tab=) so links and the back button work. */
export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = SETTINGS_TABS.some(t => t.value === params.get('tab')) ? params.get('tab') : 'isnad';
  return (
    <>
      <div className="toolbar"><Segmented value={tab} onChange={v => setParams({ tab: v })} options={SETTINGS_TABS} /></div>
      {tab === 'account' && <Account />}
      {tab === 'profile' && <Profile />}
      {tab === 'isnad' && <IsnadTextSettings />}
      {tab === 'data' && <DataTransfer />}
    </>
  );
}

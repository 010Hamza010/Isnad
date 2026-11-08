import { useCallback, useEffect, useState } from 'react';
import { useUI } from '../components/ui/UIProvider';

/** Run an async loader on mount (and when deps change); errors become toasts. */
export default function useLoad(loader, deps = [], initial = null) {
  const { notifyError } = useUI();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await loader()); }
    catch (err) { notifyError(err); }
    finally { setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [reload]);
  return { data, setData, loading, reload };
}

// The login token: in localStorage when «تذكرني» was ticked (survives closing the browser),
// otherwise in sessionStorage (ends with the tab). Storage can throw in private modes.
const stores = () => { try { return [localStorage, sessionStorage]; } catch { return []; } };
const read = k => { for (const s of stores()) { try { const v = s.getItem(k); if (v != null) return v; } catch { /* blocked */ } } return null; };

export const getToken = () => read('token');
export const getUsername = () => read('username');
export const isRemembered = () => { try { return localStorage.getItem('token') != null; } catch { return false; } };

export function saveSession(token, username, remember = isRemembered()) {
  clearSession();
  try {
    const s = remember ? localStorage : sessionStorage;
    s.setItem('token', token);
    if (username != null) s.setItem('username', username);
  } catch { /* blocked: the session lives in memory only */ }
}

export function clearSession() {
  stores().forEach(s => { try { s.removeItem('token'); s.removeItem('username'); } catch { /* blocked */ } });
}

import React, { createContext, useContext, useState } from 'react';
import { getToken, getUsername, saveSession, clearSession, isRemembered } from '../utils/session';
const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken);
  const [username, setUsername] = useState(getUsername);
  const login = (tok, user, remember) => {
    saveSession(tok, user, remember);
    setToken(tok); setUsername(user);
  };
  // a new token (password change, rename, other devices signed out) keeps «remember me» as it was
  const refresh = (tok, user = username) => login(tok || token, user, isRemembered());
  const logout = () => {
    clearSession(); setToken(null); setUsername(null);
  };
  return <Ctx.Provider value={{ token, username, login, refresh, logout, isAuth: !!token }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);

import React, { createContext, useContext, useState } from 'react';
const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [username, setUsername] = useState(() => sessionStorage.getItem('username'));
  const login = (tok, user) => {
    sessionStorage.setItem('token', tok);
    sessionStorage.setItem('username', user);
    setToken(tok); setUsername(user);
  };
  const logout = () => {
    sessionStorage.clear(); setToken(null); setUsername(null);
  };
  return <Ctx.Provider value={{ token, username, login, logout, isAuth: !!token }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);

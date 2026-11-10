import axios from 'axios';
import { getToken, clearSession } from './session';
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  // A 401 from login is a wrong password, not an expired session — let the form show it.
  const isLoginCall = /^\/auth\/(login|setup)/.test(err.config?.url || '');
  if (err.response?.status === 401 && !isLoginCall) {
    clearSession();
    window.location.href = '/login';
  }
  return Promise.reject(err);
});
export default api;

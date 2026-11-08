import axios from 'axios';
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  // A 401 from /auth/login is a wrong password, not an expired session — let the form show it.
  const isAuthCall = err.config?.url?.startsWith('/auth/');
  if (err.response?.status === 401 && !isAuthCall) {
    sessionStorage.removeItem('token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});
export default api;

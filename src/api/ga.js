import axios from 'axios';

const gaClient = axios.create({ baseURL: '/api/ga' });

gaClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('masterToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function fetchUsageTime({ from, to } = {}) {
  return gaClient.get('/usage-time', { params: { from, to } }).then((res) => res.data);
}

export function fetchAppScreens({ from, to } = {}) {
  return gaClient.get('/app-screens', { params: { from, to } }).then((res) => res.data);
}

import axios from 'axios';
import { API_BASE_URL } from '../config/env';

const client = axios.create({
  baseURL: API_BASE_URL,
});

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('masterToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      sessionStorage.removeItem('masterToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;

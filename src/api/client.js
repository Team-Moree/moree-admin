import axios from 'axios';
import { API_BASE_URL } from '../config/env';

const client = axios.create({
  baseURL: API_BASE_URL,
  // 배열 파라미터(예: categoryIds)를 'categoryIds[]=1'이 아니라 'categoryIds=1&categoryIds=2'로
  // 보낸다 — 스프링 @RequestParam List<Long> 이 후자만 인식한다.
  paramsSerializer: { indexes: null },
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

import axios from 'axios';

// GA 프록시와 동일한 이유로 별도 axios 인스턴스를 둔다 — 이 앱의 Vercel 서버리스 함수
// (`/api/metrics/*`)를 same-origin 으로 호출하고, 백엔드(api.moree.app) client 는 안 쓴다.
const metricsClient = axios.create({ baseURL: '/api/metrics' });

metricsClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('masterToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// rangeHours 생략 시 함수가 최근 6시간으로 기본 처리한다.
export function fetchMetricsOverview({ rangeHours } = {}) {
  return metricsClient.get('/overview', { params: { rangeHours } }).then((res) => res.data);
}

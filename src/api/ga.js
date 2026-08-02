import axios from 'axios';

// GA 프록시는 백엔드(api.moree.app)가 아니라 이 앱의 Vercel 서버리스 함수(`/api/ga/*`)를
// same-origin 으로 호출한다. 그래서 백엔드용 client(baseURL '/api' | '/api-beta')를 재사용하지
// 않고 별도 인스턴스를 둔다. (프로필과 무관하게 함수 경로는 항상 `/api/ga`)
const gaClient = axios.create({ baseURL: '/api/ga' });

gaClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('masterToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// startDate/endDate 는 'YYYY-MM-DD'. 생략 시 함수가 최근 28일로 기본 처리한다.
export function fetchGaOverview({ startDate, endDate } = {}) {
  return gaClient
    .get('/overview', { params: { startDate, endDate } })
    .then((res) => res.data);
}

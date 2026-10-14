import client from './client';

// DB 기준 가입자 통계 (백엔드 집계). GA4 의 기기 단위 "사용자" 와 달리 계정 단위라
// GA 분석 화면에서 두 수치를 나란히 보여 주는 데 쓴다.
// startDate/endDate 는 'YYYY-MM-DD'. 생략 시 서버가 어제까지 최근 28일로 기본 처리한다.
export function fetchUserStats({ startDate, endDate } = {}) {
  return client
    .get('/admin/dashboard/users', { params: { startDate, endDate } })
    .then((res) => res.data);
}

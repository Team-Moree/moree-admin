// ⚠️ 목업(데모) 데이터 — 실제 GA 데이터가 아니다.
// 그래프 모양 확인용. 이 파일 + Analytics.jsx 의 목업 토글은 한 커밋으로 묶여 있어
// `git revert` 로 통째로 제거할 수 있다. (fetchGaOverview 응답과 동일한 스키마)
import dayjs from 'dayjs';

export function buildMockOverview(range) {
  const [start, end] = range || [];
  const s = start || dayjs().subtract(28, 'day');
  const e = end || dayjs().subtract(1, 'day');
  const days = Math.min(Math.max(e.diff(s, 'day') + 1, 1), 90);

  // 일별 추이: 완만한 상승 + 사인 파동 (렌더마다 흔들리지 않도록 인덱스 기반 결정적 생성)
  const dailyUsers = Array.from({ length: days }, (_, i) => {
    const activeUsers = Math.max(80, Math.round(320 + i * 5 + Math.sin(i / 3) * 55));
    const newUsers = Math.max(20, Math.round(activeUsers * 0.22 + Math.cos(i / 4) * 14));
    return { date: s.add(i, 'day').format('YYYY-MM-DD'), activeUsers, newUsers };
  });

  return {
    dateRange: { startDate: s.format('YYYY-MM-DD'), endDate: e.format('YYYY-MM-DD') },
    userTotals: { activeUsers: 3120, newUsers: 940, totalUsers: 5280, sessions: 8760 },
    keyEventCounts: { first_open: 940, sign_up: 512, login: 3180, review_submit: 128 },
    topEvents: [
      { eventName: 'screen_view', eventCount: 18420 },
      { eventName: 'session_start', eventCount: 8760 },
      { eventName: 'tap', eventCount: 7340 },
      { eventName: 'impression', eventCount: 5210 },
      { eventName: 'login', eventCount: 3180 },
      { eventName: 'view_item', eventCount: 2960 },
      { eventName: 'first_open', eventCount: 940 },
      { eventName: 'search', eventCount: 640 },
      { eventName: 'store_share', eventCount: 214 },
      { eventName: 'review_submit', eventCount: 128 },
    ],
    dailyUsers,
    platforms: [
      { platform: 'iOS', activeUsers: 1780, newUsers: 520 },
      { platform: 'Android', activeUsers: 1340, newUsers: 420 },
    ],
    topScreens: [
      { screenName: 'store_list', views: 6240 },
      { screenName: 'store_detail', views: 4380 },
      { screenName: 'home', views: 3120 },
      { screenName: 'store_search', views: 1520 },
      { screenName: 'my_page', views: 980 },
      { screenName: 'review_write', views: 410 },
      { screenName: 'bookmark', views: 320 },
    ],
    retention: { totalUsers: 940, d1: 44.2, d7: 19.6, d30: 8.3, error: null },
    searchTerms: [
      { searchTerm: '가챠팝', eventCount: 312 },
      { searchTerm: '산리오', eventCount: 208 },
      { searchTerm: '짱구', eventCount: 176 },
      { searchTerm: '치이카와', eventCount: 142 },
      { searchTerm: '포켓몬', eventCount: 120 },
      { searchTerm: '다이소', eventCount: 95 },
    ],
    searchTermsError: null,
    byStore: {
      rows: [
        { name: '가챠팝 홍대점', count: 482 },
        { name: '다이소 성수', count: 351 },
        { name: '산리오 팝업', count: 298 },
        { name: '치이카와 카페', count: 244 },
        { name: '포켓몬 스토어', count: 187 },
      ],
      error: null,
    },
    byLocation: {
      rows: [
        { name: '홍대', count: 628 },
        { name: '성수', count: 541 },
        { name: '용산', count: 402 },
        { name: '강남', count: 377 },
        { name: '건대', count: 213 },
      ],
      error: null,
    },
    byEventType: {
      rows: [
        { name: '팝업', count: 912 },
        { name: '콜라보카페', count: 548 },
        { name: '전시', count: 321 },
      ],
      error: null,
    },
    byStatus: {
      rows: [
        { name: '진행 중', count: 1102 },
        { name: '오픈 예정', count: 428 },
        { name: '종료', count: 276 },
      ],
      error: null,
    },
  };
}

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
    // 인사이트(의사결정용) — 앱 계측 후 실데이터로 대체될 자리
    insights: {
      funnel: [
        { stage: '설치 (first_open)', value: 940 },
        { stage: '가입 (sign_up)', value: 512 },
        { stage: '첫 로그인 (login)', value: 430 },
      ],
      searchFail: {
        total: 640,
        failed: 156,
        failRate: 24.4,
        terms: [
          { name: '무직타이거', count: 42 },
          { name: '망그러진곰', count: 31 },
          { name: '쿠로미 팝업', count: 24 },
          { name: '올리브영 콜라보', count: 19 },
          { name: '괴발개발', count: 14 },
        ],
      },
      contentConversion: [
        { name: '가챠팝 홍대점', views: 482, bookmarks: 96, shares: 41 },
        { name: '치이카와 카페', views: 244, bookmarks: 61, shares: 28 },
        { name: '산리오 팝업', views: 298, bookmarks: 72, shares: 33 },
        { name: '다이소 성수', views: 351, bookmarks: 38, shares: 12 },
        { name: '포켓몬 스토어', views: 187, bookmarks: 21, shares: 7 },
      ],
      segmentRetention: [
        { name: 'iOS', d1: 46.8, d7: 21.2, d30: 9.4 },
        { name: 'Android', d1: 41.0, d7: 17.4, d30: 7.1 },
        { name: '팝업', d1: 49.2, d7: 24.0, d30: 11.0 },
        { name: '콜라보카페', d1: 43.5, d7: 18.9, d30: 8.2 },
        { name: '전시', d1: 38.1, d7: 14.2, d30: 5.5 },
      ],
      wow: [
        { metric: '활성 사용자', current: 3120, prev: 2640, deltaPct: 18.2 },
        { metric: '신규 사용자', current: 940, prev: 1020, deltaPct: -7.8 },
        { metric: '세션', current: 8760, prev: 7980, deltaPct: 9.8 },
        { metric: '가입(sign_up)', current: 512, prev: 430, deltaPct: 19.1 },
      ],
    },
  };
}

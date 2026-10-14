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

  const rollingDaily = dailyUsers.map((d, i) => ({
    date: d.date,
    dau: Math.round(d.activeUsers * 0.35),
    wau: Math.round(d.activeUsers * 1.6 + i * 3),
    mau: Math.round(d.activeUsers * 4.2 + i * 9),
  }));
  const lastRolling = rollingDaily[rollingDaily.length - 1];
  const dailySignUps = dailyUsers.map((d) => ({ date: d.date, count: Math.max(0, Math.round(d.newUsers * 0.3)) }));
  const mockNewUsers = dailySignUps.reduce((a, d) => a + d.count, 0);

  return {
    // [MOCK] 백엔드 /admin/dashboard/users 응답과 같은 스키마
    mockUserStats: {
      startDate: s.format('YYYY-MM-DD'),
      endDate: e.format('YYYY-MM-DD'),
      activeUsers: 1480,
      withdrawalPendingUsers: 6,
      newUsers: mockNewUsers,
      previousNewUsers: Math.round(mockNewUsers * 0.86),
      withdrawnUsers: 11,
      dailySignUps,
      signUpMethods: [
        { provider: 'APPLE', count: Math.round(mockNewUsers * 0.55) },
        { provider: 'GOOGLE', count: Math.round(mockNewUsers * 0.38) },
        { provider: 'X', count: Math.round(mockNewUsers * 0.07) },
      ],
    },
    channels: [
      { channel: 'Direct', sessions: 4210, activeUsers: 1620, newUsers: 380 },
      { channel: 'Organic Social', sessions: 2140, activeUsers: 880, newUsers: 310 },
      { channel: 'Referral', sessions: 1290, activeUsers: 470, newUsers: 160 },
      { channel: 'Organic Search', sessions: 820, activeUsers: 340, newUsers: 90 },
    ],
    activeUsersRolling: {
      asOf: lastRolling.date,
      dau: lastRolling.dau,
      wau: lastRolling.wau,
      mau: lastRolling.mau,
      stickiness: Number(((lastRolling.dau / lastRolling.mau) * 100).toFixed(1)),
      daily: rollingDaily,
    },
    dateRange: { startDate: s.format('YYYY-MM-DD'), endDate: e.format('YYYY-MM-DD') },
    userTotals: { activeUsers: 3120, newUsers: 940, totalUsers: 5280, sessions: 8760 },
    keyEventCounts: { first_open: 940, screen_view: 9620, tap: 1880, search: 640, sign_up: 0, login: 0, guest_login: 0, add_bookmark: 0, review_submit: 0, push_open: 0 },
    pendingEvents: ['sign_up', 'login', 'guest_login', 'add_bookmark', 'review_submit', 'push_open'],
    appEventCounts: { firstOpen: 940, explorationViews: 5240, storeDetailViews: 4380, search: 640, searchResultTaps: 1460, shareTaps: 420 },
    topEvents: [
      { eventName: 'user_engagement', eventCount: 21400 },
      { eventName: 'screen_view', eventCount: 9620 },
      { eventName: 'session_start', eventCount: 8760 },
      { eventName: 'tap', eventCount: 1880 },
      { eventName: 'first_open', eventCount: 940 },
      { eventName: 'search', eventCount: 640 },
    ],
    dailyUsers,
    platforms: [
      { platform: 'iOS', activeUsers: 1780, newUsers: 520 },
      { platform: 'Android', activeUsers: 1340, newUsers: 420 },
    ],
    topScreens: [
      { screenName: 'exploration', views: 5240, users: 2310 },
      { screenName: 'store_detail', views: 4380, users: 1540 },
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
        { name: '찌꼬뽀꼬 연남2호점', count: 351 },
        { name: '산리오 팝업 성수', count: 298 },
        { name: '치이카와 랜드 용산', count: 244 },
        { name: '포켓몬 가챠 강남', count: 187 },
      ],
      error: null,
    },
    byStatus: {
      rows: [
        { name: 'OPEN', count: 2620 },
        { name: 'PRE_OPEN', count: 840 },
        { name: 'BEFORE_HOURS', count: 510 },
        { name: 'CLOSED', count: 330 },
        { name: 'PERMANENTLY_CLOSED', count: 80 },
      ],
      error: null,
    },
    byElement: {
      rows: [
        { name: 'search_result_item', count: 1460 },
        { name: 'share_button', count: 420 },
      ],
      error: null,
    },
    landing: {
      views: 3820,
      viewUsers: 3010,
      downloads: 690,
      downloadUsers: 602,
      bySource: [
        { source: 'instagram / social', views: 1840, downloads: 412 },
        { source: 'moree_landing / website', views: 1120, downloads: 154 },
        { source: 'google / organic', views: 560, downloads: 88 },
        { source: 'x / social', views: 300, downloads: 36 },
      ],
      byStore: { rows: [{ name: 'ios', count: 402 }, { name: 'android', count: 288 }], error: null },
    },
    // 인사이트(의사결정용) — 앱 계측 후 실데이터로 대체될 자리
    insights: {
      funnel: [
        { stage: '설치 (first_open)', event: 'first_open', value: 940 },
        { stage: '탐색 화면 진입', event: 'screen_view:exploration', value: 860 },
        { stage: '매장 상세 조회', event: 'screen_view:store_detail', value: 610 },
        { stage: '공유 버튼 탭', event: 'tap:share_button', value: 140 },
      ],
      pushOpen: {
        total: 530,
        byType: [
          { name: 'BOOKMARK_STORE_OPEN', count: 214 },
          { name: 'FOLLOW', count: 142 },
          { name: 'REVIEW_LIKE', count: 98 },
          { name: 'NOTICE', count: 76 },
        ],
      },
      searchFail: {
        total: 640,
        failed: 156,
        failRate: 24.4,
        resultClickRate: 30.2,
        terms: [
          { name: '무직타이거', count: 42 },
          { name: '망그러진곰', count: 31 },
          { name: '쿠로미 팝업', count: 24 },
          { name: '올리브영 콜라보', count: 19 },
          { name: '괴발개발', count: 14 },
        ],
      },
      contentConversion: [
        { name: '가챠팝 홍대점', views: 482, shares: 41 },
        { name: '찌꼬뽀꼬 연남2호점', views: 351, shares: 12 },
        { name: '산리오 팝업 성수', views: 298, shares: 33 },
        { name: '치이카와 랜드 용산', views: 244, shares: 28 },
        { name: '포켓몬 가챠 강남', views: 187, shares: 7 },
      ],
      segmentRetention: [
        { name: 'iOS', d1: 46.8, d7: 21.2, d30: 9.4 },
        { name: 'Android', d1: 41.0, d7: 17.4, d30: 7.1 },
        { name: 'web', d1: 22.3, d7: 8.1, d30: 3.0 },
      ],
      wow: [
        { metric: '활성 사용자', current: 3120, prev: 2640, deltaPct: 18.2 },
        { metric: '신규 사용자', current: 940, prev: 1020, deltaPct: -7.8 },
        { metric: '세션', current: 8760, prev: 7980, deltaPct: 9.8 },
        { metric: '매장 상세 조회', current: 4380, prev: 3910, deltaPct: 12.0 },
        { metric: '검색 (search)', current: 640, prev: 702, deltaPct: -8.8 },
        { metric: '설치 (first_open)', current: 940, prev: 1020, deltaPct: -7.8 },
      ],
    },
  };
}

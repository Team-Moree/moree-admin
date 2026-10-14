// Vercel Serverless Function — GA4(Firebase Analytics) 리포트 프록시
//
// 왜 서버리스 함수인가:
//   GA4 Data API 는 서비스 계정(private key) 자격증명이 필요하다. 이 값은 브라우저(SPA)에
//   노출될 수 없으므로, 자격증명을 서버(Vercel env)에만 두고 이 함수가 대신 호출한다.
//
// 라우팅 주의(vercel.json):
//   rewrites 는 "파일시스템(정적 파일 + 서버리스 함수)"을 먼저 확인한 뒤, 매칭이 없을 때만
//   적용된다. 따라서 실제 함수 파일이 존재하는 `/api/ga/overview` 는 백엔드 프록시 rewrite
//   (`/api/:path*` → api.moree.app)보다 우선한다. (그 rewrite 는 함수가 없는 `/api/admin/*`
//   등에만 적용됨)
//
// 로컬 개발 주의:
//   `npm start`(vite dev)는 서버리스 함수를 실행하지 못한다. 이 함수를 로컬에서 확인하려면
//   `vercel dev` 를 사용하거나 Vercel Preview 배포로 검증한다.
//
// 필요한 서버 env (Vercel Project Settings → Environment Variables):
//   GA4_PROPERTY_ID   GA4 속성 ID (숫자만, 예: 123456789)
//   GA_CLIENT_EMAIL   서비스 계정 이메일
//   GA_PRIVATE_KEY    서비스 계정 private key (PEM; 개행은 \n 로 저장돼도 자동 복원)
//
// env 가 채워지기 전에는 GA_NOT_CONFIGURED(503) 로 명확히 응답한다(빈/에러 상태).
//
// 지표 해석 주의:
//   GA4 의 "사용자"는 로그인 여부와 무관한 기기(client ID) 단위다. 계정 단위 가입자 수는
//   백엔드 `/admin/dashboard/users` 가 DB 에서 집계하며, 화면에서 두 수치를 나란히 보여 준다.

import pkg from '@google-analytics/data';

const { BetaAnalyticsDataClient } = pkg;

// 이벤트 탭 카드. 앱이 아직 안 쏘는 이벤트는 0 으로 내려간다.
// 이벤트 명세: docs/GA-계측-우선순위.md
const KEY_EVENTS = [
  'first_open',
  'screen_view',
  'tap',
  'search',
  'sign_up',
  'login',
  'guest_login',
  'add_bookmark',
  'review_submit',
  'push_open',
];

const PENDING_EVENTS = ['sign_up', 'login', 'guest_login', 'add_bookmark', 'review_submit', 'push_open'];

const SCREEN = { exploration: 'exploration', storeDetail: 'store_detail' };
const ELEMENT = { share: 'share_button', searchResult: 'search_result_item' };
const FALSE_VALUES = ['false', '0'];

const LANDING_EVENTS = ['landing_view', 'click_download'];

const DEFAULT_RANGE_DAYS = 28;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function getBearer(req) {
  const raw = req.headers['authorization'] || req.headers['Authorization'];
  if (!raw || Array.isArray(raw)) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}

// 인증: 이 함수는 로그인된 admin SPA 에서 same-origin 으로만 호출되고 반환값도
// 집계 지표뿐이라, 토큰 "존재" 여부만 확인한다.
// (백엔드 재검증은 환경 커플링만 유발해 제거했다 — beta 토큰을 운영 API 로 검증하면
//  INVALID_TOKEN 이 나는 문제가 있었다. 더 강한 인증이 필요하면 여기에 추가한다.)
function assertAuthorized(req) {
  const token = getBearer(req);
  if (!token) throw new HttpError(401, 'MISSING_TOKEN', '인증 토큰이 없습니다.');
}

function readGaConfig() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientEmail = process.env.GA_CLIENT_EMAIL;
  let privateKey = process.env.GA_PRIVATE_KEY;

  if (!propertyId || !clientEmail || !privateKey) {
    throw new HttpError(
      503,
      'GA_NOT_CONFIGURED',
      'GA4 환경변수(GA4_PROPERTY_ID / GA_CLIENT_EMAIL / GA_PRIVATE_KEY)가 설정되지 않았습니다.'
    );
  }
  // Vercel env 에 저장 시 개행이 리터럴 "\n" 으로 들어오는 경우 복원
  privateKey = privateKey.replace(/\\n/g, '\n');
  return { propertyId, clientEmail, privateKey };
}

let cachedClient = null;
function getClient({ clientEmail, privateKey }) {
  if (cachedClient) return cachedClient;
  cachedClient = new BetaAnalyticsDataClient({
    credentials: { client_email: clientEmail, private_key: privateKey },
  });
  return cachedClient;
}

// GA4 리포트 응답(rows)을 [{ [dimName]: value, ... , [metricName]: number }] 로 정규화
function normalizeRows(report) {
  const dimHeaders = (report?.dimensionHeaders || []).map((h) => h.name);
  const metHeaders = (report?.metricHeaders || []).map((h) => h.name);
  return (report?.rows || []).map((row) => {
    const out = {};
    dimHeaders.forEach((name, i) => {
      out[name] = row.dimensionValues?.[i]?.value ?? null;
    });
    metHeaders.forEach((name, i) => {
      out[name] = Number(row.metricValues?.[i]?.value ?? 0);
    });
    return out;
  });
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ── 날짜 유틸 (GA4 는 속성 시간대 기준 일자. 모리 속성은 Asia/Seoul) ──
function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}
function parseIsoDate(s) {
  return new Date(`${s}T00:00:00Z`);
}
function addDays(d, n) {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}
function todayInSeoul() {
  const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return new Date(Date.UTC(seoul.getFullYear(), seoul.getMonth(), seoul.getDate()));
}
function normalizeDate(d) {
  const s = String(d || '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
}

// 선택 구간과 같은 길이의 직전 구간. WoW 비교용.
function resolveRanges(query) {
  const today = todayInSeoul();
  const end = isValidDate(query?.endDate) ? parseIsoDate(query.endDate) : addDays(today, -1);
  const start = isValidDate(query?.startDate)
    ? parseIsoDate(query.startDate)
    : addDays(end, -(DEFAULT_RANGE_DAYS - 1));
  if (start > end) throw new HttpError(400, 'INVALID_RANGE', 'startDate 는 endDate 보다 앞서야 합니다.');

  const days = Math.round((end - start) / 86400000) + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    prevStartDate: toIsoDate(prevStart),
    prevEndDate: toIsoDate(prevEnd),
    days,
  };
}

function pct(curr, prev) {
  if (!prev) return curr ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

// 맞춤 측정기준(customEvent:*) 리포트 — GA4 콘솔 등록 + 앱 계측이 선행돼야 데이터가 나온다.
// 미등록이면 API 가 에러를 던지므로 격리해 {rows, error} 로 반환한다.
// filters: [{ field, value }] 를 AND 로 묶는다 (예: eventName=search AND customEvent:has_result=false)
async function customDimReport(client, property, dateRanges, { dim, eventName, filters = [], limit = 10 }) {
  try {
    const request = {
      property,
      dateRanges,
      dimensions: [{ name: dim }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit,
    };
    const dimensionFilter = buildFilter(eventName, filters);
    if (dimensionFilter) request.dimensionFilter = dimensionFilter;

    const [resp] = await client.runReport(request);
    const rows = normalizeRows(resp)
      .map((r) => ({ name: r[dim], count: r.eventCount }))
      .filter((r) => r.name && r.name !== '(not set)');
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: e?.message || '맞춤 측정기준 미등록으로 조회 불가' };
  }
}

function buildFilter(eventName, filters = []) {
  const expressions = [];
  if (eventName) {
    expressions.push({ filter: { fieldName: 'eventName', stringFilter: { value: eventName } } });
  }
  for (const f of filters) {
    expressions.push({
      filter: {
        fieldName: f.field,
        ...(Array.isArray(f.values)
          ? { inListFilter: { values: f.values.map(String) } }
          : { stringFilter: { value: String(f.value) } }),
      },
    });
  }
  if (expressions.length === 0) return null;
  if (expressions.length === 1) return expressions[0];
  return { andGroup: { expressions } };
}

async function usersReport(client, property, dateRanges, { eventName, filters = [] }) {
  try {
    const [resp] = await client.runReport({
      property,
      dateRanges,
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: buildFilter(eventName, filters),
    });
    return { value: normalizeRows(resp)[0]?.totalUsers ?? 0, error: null };
  } catch (e) {
    return { value: null, error: e?.message || '조회 실패' };
  }
}

async function screenCounts(client, property, dateRanges) {
  try {
    const [resp] = await client.runReport({
      property,
      dateRanges,
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'screen_view' } } },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20,
    });
    return normalizeRows(resp)
      .map((r) => ({ screenName: r.unifiedScreenName, views: r.eventCount, users: r.totalUsers }))
      .filter((r) => r.screenName && r.screenName !== '(not set)');
  } catch {
    return [];
  }
}

const screenViews = (rows, name) => rows.find((r) => r.screenName === name)?.views ?? 0;
const sumCounts = (rows) => rows.reduce((a, r) => a + r.count, 0);

// 재방문율(D1/D7/D30) — cohortSpec 기반. 선택 기간을 하나의 코호트로 보고 산출.
// (cohortSpec 은 dateRanges 와 함께 못 쓴다) 최근 가입자는 아직 D30 에 도달 못해 과소집계될 수 있다.
// segmentDim 을 주면(예: platform) 세그먼트별로 쪼개서 돌려준다.
async function runRetention(client, property, startDate, endDate, segmentDim = null) {
  const dimensions = [{ name: 'cohortNthDay' }];
  if (segmentDim) dimensions.push({ name: segmentDim });
  try {
    const [resp] = await client.runReport({
      property,
      dimensions,
      metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
      cohortSpec: {
        cohorts: [{ name: 'cohort', dimension: 'firstSessionDate', dateRange: { startDate, endDate } }],
        cohortsRange: { granularity: 'DAILY', startOffset: 0, endOffset: 30 },
      },
    });

    // segment → { byDay, total }
    const segments = {};
    for (const r of normalizeRows(resp)) {
      const key = segmentDim ? r[segmentDim] : 'all';
      if (!key || key === '(not set)') continue;
      const seg = (segments[key] ||= { byDay: {}, total: 0 });
      seg.byDay[Number(r.cohortNthDay)] = r.cohortActiveUsers;
      seg.total = Math.max(seg.total, r.cohortTotalUsers || 0);
    }
    const toRates = ({ byDay, total }) => {
      const rate = (n) =>
        total > 0 && byDay[n] != null ? Number(((byDay[n] / total) * 100).toFixed(1)) : null;
      return { totalUsers: total, d1: rate(1), d7: rate(7), d30: rate(30), error: null };
    };

    if (!segmentDim) return toRates(segments.all || { byDay: {}, total: 0 });
    return Object.entries(segments)
      .map(([name, seg]) => ({ name, ...toRates(seg) }))
      .sort((a, b) => b.totalUsers - a.totalUsers);
  } catch (e) {
    if (segmentDim) return [];
    return { totalUsers: 0, d1: null, d7: null, d30: null, error: e?.message || '재방문율 조회 실패' };
  }
}

function eventCountMap(report, names) {
  const out = names.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
  for (const r of normalizeRows(report)) {
    if (r.eventName in out) out[r.eventName] = r.eventCount;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 만 허용됩니다.' });
  }

  try {
    assertAuthorized(req);

    const { startDate, endDate, prevStartDate, prevEndDate, days } = resolveRanges(req.query);
    const dateRanges = [{ startDate, endDate }];
    const prevRanges = [{ startDate: prevStartDate, endDate: prevEndDate }];

    const { propertyId, clientEmail, privateKey } = readGaConfig();
    const client = getClient({ clientEmail, privateKey });
    const property = `properties/${propertyId}`;

    const totalsRequest = (ranges) => ({
      dateRanges: ranges,
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'totalUsers' },
        { name: 'sessions' },
      ],
    });
    const keyEventsRequest = (ranges) => ({
      dateRanges: ranges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: KEY_EVENTS } } },
    });

    // 내장 차원 리포트는 batch 로 (GA4 batchRunReports 는 요청당 최대 5개 → 두 묶음을 병렬로)
    const batchAP = client.batchRunReports({
      property,
      requests: [
        // 0) 사용자 총계
        totalsRequest(dateRanges),
        // 1) 핵심 이벤트 카운트
        keyEventsRequest(dateRanges),
        // 2) Top 이벤트 (최대 10)
        {
          dateRanges,
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 10,
        },
        // 3) 일별 사용자 추이 (활성/신규)
        {
          dateRanges,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
        // 4) 플랫폼별 (web/iOS/Android) — 내장 platform 차원
        {
          dateRanges,
          dimensions: [{ name: 'platform' }],
          metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        },
      ],
    });

    const batchBP = client.batchRunReports({
      property,
      requests: [
        // 0) 직전 구간 총계 (WoW)
        totalsRequest(prevRanges),
        // 1) 직전 구간 핵심 이벤트 (WoW)
        keyEventsRequest(prevRanges),
        // 2) 유입 채널 (GA4 기본 채널 그룹: Direct / Organic Search / Referral / Paid …)
        {
          dateRanges,
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        },
        // 3) 롤링 활성 사용자 (DAU/WAU/MAU) — 일별로 받아 마지막 날 값을 "현재" 로 쓴다
        {
          dateRanges,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'active1DayUsers' }, { name: 'active7DayUsers' }, { name: 'active28DayUsers' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
        {
          dateRanges,
          dimensions: [{ name: 'eventName' }, { name: 'sessionSourceMedium' }],
          metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
          dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: LANDING_EVENTS } } },
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 50,
        },
      ],
    });

    const screensP = screenCounts(client, property, dateRanges);
    const prevScreensP = screenCounts(client, property, prevRanges);

    const retentionP = runRetention(client, property, startDate, endDate);
    const platformRetentionP = runRetention(client, property, startDate, endDate, 'platform');

    const onStoreDetail = [{ field: 'unifiedScreenName', value: SCREEN.storeDetail }];
    const onElement = (name) => [{ field: 'customEvent:element_name', value: name }];

    const funnelP = Promise.all([
      usersReport(client, property, dateRanges, { eventName: 'first_open' }),
      usersReport(client, property, dateRanges, {
        eventName: 'screen_view',
        filters: [{ field: 'unifiedScreenName', value: SCREEN.exploration }],
      }),
      usersReport(client, property, dateRanges, { eventName: 'screen_view', filters: onStoreDetail }),
      usersReport(client, property, dateRanges, { eventName: 'tap', filters: onElement(ELEMENT.share) }),
    ]);

    // B그룹: 맞춤 측정기준. 등록 전엔 {rows:[], error} 로 반환.
    const dim = (opts) => customDimReport(client, property, dateRanges, opts);
    const searchP = dim({ dim: 'customEvent:search_term', eventName: 'search' });
    const storeP = dim({ dim: 'customEvent:store_name', eventName: 'screen_view', filters: onStoreDetail, limit: 50 });
    const statusP = dim({ dim: 'customEvent:status', eventName: 'screen_view', filters: onStoreDetail });
    const elementP = dim({ dim: 'customEvent:element_name', eventName: 'tap' });
    const hasResultP = dim({ dim: 'customEvent:has_result', eventName: 'search' });
    const failedTermsP = dim({
      dim: 'customEvent:search_term',
      eventName: 'search',
      filters: [{ field: 'customEvent:has_result', values: FALSE_VALUES }],
    });
    const shareByStoreP = dim({
      dim: 'customEvent:store_name',
      eventName: 'tap',
      filters: onElement(ELEMENT.share),
      limit: 50,
    });
    const downloadByStoreP = dim({ dim: 'customEvent:store', eventName: 'click_download' });
    const pushOpenP = dim({ dim: 'customEvent:notification_type', eventName: 'push_open' });

    const [
      [batchA],
      [batchB],
      topScreens,
      prevScreens,
      retention,
      platformRetention,
      funnelUsers,
      searchRes,
      storeRes,
      statusRes,
      elementRes,
      hasResultRes,
      failedTermsRes,
      shareByStore,
      downloadByStore,
      pushOpenRes,
    ] = await Promise.all([
      batchAP,
      batchBP,
      screensP,
      prevScreensP,
      retentionP,
      platformRetentionP,
      funnelP,
      searchP,
      storeP,
      statusP,
      elementP,
      hasResultP,
      failedTermsP,
      shareByStoreP,
      downloadByStoreP,
      pushOpenP,
    ]);

    const [userReport, keyEventReport, topEventReport, dailyReport, platformReport] = batchA.reports || [];
    const [prevUserReport, prevKeyEventReport, channelReport, rollingReport, landingReport] = batchB.reports || [];

    const toTotals = (report) => {
      const row = normalizeRows(report)[0] || {};
      return {
        activeUsers: row.activeUsers ?? 0,
        newUsers: row.newUsers ?? 0,
        totalUsers: row.totalUsers ?? 0,
        sessions: row.sessions ?? 0,
      };
    };
    const userTotals = toTotals(userReport);
    const prevUserTotals = toTotals(prevUserReport);

    const keyEventCounts = eventCountMap(keyEventReport, KEY_EVENTS);
    const prevKeyEventCounts = eventCountMap(prevKeyEventReport, KEY_EVENTS);

    const elementCount = (name) => elementRes.rows.find((r) => r.name === name)?.count ?? null;
    const appEventCounts = {
      explorationViews: screenViews(topScreens, SCREEN.exploration),
      storeDetailViews: screenViews(topScreens, SCREEN.storeDetail),
      shareTaps: elementRes.error ? null : elementCount(ELEMENT.share) ?? 0,
      searchResultTaps: elementRes.error ? null : elementCount(ELEMENT.searchResult) ?? 0,
      search: keyEventCounts.search,
      firstOpen: keyEventCounts.first_open,
    };

    const topEvents = normalizeRows(topEventReport).map((r) => ({
      eventName: r.eventName,
      eventCount: r.eventCount,
    }));

    // 일별 추이: GA4 date 는 'YYYYMMDD' → 'YYYY-MM-DD' 로 정규화 (이미 날짜순 정렬됨)
    const dailyUsers = normalizeRows(dailyReport).map((r) => ({
      date: normalizeDate(r.date),
      activeUsers: r.activeUsers,
      newUsers: r.newUsers,
    }));

    const platforms = normalizeRows(platformReport)
      .map((r) => ({ platform: r.platform, activeUsers: r.activeUsers, newUsers: r.newUsers }))
      .filter((r) => r.platform && r.platform !== '(not set)');

    const channels = normalizeRows(channelReport)
      .map((r) => ({
        channel: r.sessionDefaultChannelGroup,
        sessions: r.sessions,
        activeUsers: r.activeUsers,
        newUsers: r.newUsers,
      }))
      .filter((r) => r.channel && r.channel !== '(not set)');

    // DAU/WAU/MAU: 구간 마지막 날 기준 롤링 값. 스티키니스 = DAU/MAU.
    const rollingRows = normalizeRows(rollingReport);
    const lastRolling = rollingRows[rollingRows.length - 1] || {};
    const dau = lastRolling.active1DayUsers ?? 0;
    const wau = lastRolling.active7DayUsers ?? 0;
    const mau = lastRolling.active28DayUsers ?? 0;
    const activeUsersRolling = {
      asOf: normalizeDate(lastRolling.date) || endDate,
      dau,
      wau,
      mau,
      stickiness: mau ? Number(((dau / mau) * 100).toFixed(1)) : null,
      daily: rollingRows.map((r) => ({
        date: normalizeDate(r.date),
        dau: r.active1DayUsers,
        wau: r.active7DayUsers,
        mau: r.active28DayUsers,
      })),
    };

    const [fOpen, fExplore, fDetail, fShare] = funnelUsers;
    const funnel = [
      { stage: '설치 (first_open)', event: 'first_open', value: fOpen.value ?? 0 },
      { stage: '탐색 화면 진입', event: 'screen_view:exploration', value: fExplore.value ?? 0 },
      { stage: '매장 상세 조회', event: 'screen_view:store_detail', value: fDetail.value ?? 0 },
      { stage: '공유 버튼 탭', event: 'tap:share_button', value: fShare.value ?? 0, error: fShare.error },
    ];

    const prevStoreDetailViews = screenViews(prevScreens, SCREEN.storeDetail);
    const wow = [
      { metric: '활성 사용자', current: userTotals.activeUsers, prev: prevUserTotals.activeUsers },
      { metric: '신규 사용자', current: userTotals.newUsers, prev: prevUserTotals.newUsers },
      { metric: '세션', current: userTotals.sessions, prev: prevUserTotals.sessions },
      { metric: '매장 상세 조회', current: appEventCounts.storeDetailViews, prev: prevStoreDetailViews },
      { metric: '검색 (search)', current: keyEventCounts.search, prev: prevKeyEventCounts.search },
      { metric: '설치 (first_open)', current: keyEventCounts.first_open, prev: prevKeyEventCounts.first_open },
    ].map((m) => ({ ...m, deltaPct: pct(m.current, m.prev) }));

    let searchFail = null;
    if (!hasResultRes.error && hasResultRes.rows.length > 0) {
      const total = sumCounts(hasResultRes.rows);
      const failed = sumCounts(hasResultRes.rows.filter((r) => FALSE_VALUES.includes(String(r.name).toLowerCase())));
      const succeeded = total - failed;
      searchFail = {
        total,
        failed,
        failRate: total ? Number(((failed / total) * 100).toFixed(1)) : 0,
        resultClickRate:
          succeeded && appEventCounts.searchResultTaps != null
            ? Number(((appEventCounts.searchResultTaps / succeeded) * 100).toFixed(1))
            : null,
        terms: failedTermsRes.rows,
      };
    }

    let contentConversion = null;
    if (!storeRes.error && storeRes.rows.length > 0) {
      const byName = {};
      for (const r of storeRes.rows) byName[r.name] = { name: r.name, views: r.count, shares: 0 };
      for (const r of shareByStore.rows) if (byName[r.name]) byName[r.name].shares = r.count;
      contentConversion = Object.values(byName);
    }

    const landingRows = normalizeRows(landingReport);
    const landingSum = (event, metric) =>
      landingRows.filter((r) => r.eventName === event).reduce((a, r) => a + (r[metric] || 0), 0);
    const landingBySource = {};
    for (const r of landingRows) {
      const key = r.sessionSourceMedium || '(not set)';
      const row = (landingBySource[key] ||= { source: key, views: 0, downloads: 0 });
      if (r.eventName === 'landing_view') row.views += r.eventCount;
      if (r.eventName === 'click_download') row.downloads += r.eventCount;
    }
    const landingViews = landingSum('landing_view', 'eventCount');
    const landingDownloads = landingSum('click_download', 'eventCount');
    const landing =
      landingViews === 0 && landingDownloads === 0
        ? null
        : {
            views: landingViews,
            viewUsers: landingSum('landing_view', 'totalUsers'),
            downloads: landingDownloads,
            downloadUsers: landingSum('click_download', 'totalUsers'),
            bySource: Object.values(landingBySource).sort((a, b) => b.views - a.views).slice(0, 10),
            byStore: downloadByStore,
          };

    const pushOpen = pushOpenRes.error
      ? null
      : {
          total: keyEventCounts.push_open,
          byType: pushOpenRes.rows,
        };

    return res.status(200).json({
      dateRange: { startDate, endDate, days },
      previousDateRange: { startDate: prevStartDate, endDate: prevEndDate },
      userTotals,
      previousUserTotals: prevUserTotals,
      keyEventCounts,
      previousKeyEventCounts: prevKeyEventCounts,
      pendingEvents: PENDING_EVENTS,
      appEventCounts,
      topEvents,
      dailyUsers,
      platforms,
      channels,
      activeUsersRolling,
      topScreens,
      retention,
      // 검색어(B그룹) — 하위호환 위해 기존 키 유지
      searchTerms: searchRes.rows.map((r) => ({ searchTerm: r.name, eventCount: r.count })),
      searchTermsError: searchRes.error,
      byStore: storeRes,
      byStatus: statusRes,
      byElement: elementRes,
      landing,
      // 인사이트. 계측·등록이 안 된 항목은 null 로 내려가고 화면이 "계측 대기" 로 표시한다.
      insights: {
        wow,
        funnel,
        searchFail,
        contentConversion,
        segmentRetention: platformRetention.length > 0 ? platformRetention : null,
        pushOpen,
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    // GA API 등 예기치 못한 오류
    return res.status(502).json({
      code: 'GA_REQUEST_FAILED',
      message: err?.message || 'GA 리포트 요청에 실패했습니다.',
    });
  }
}

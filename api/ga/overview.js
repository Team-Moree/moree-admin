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
//   MOREE_API_BASE    (선택) 설정 시 요청의 masterToken 을 이 백엔드로 검증
//
// env 가 채워지기 전에는 GA_NOT_CONFIGURED(503) 로 명확히 응답한다(빈/에러 상태).

import pkg from '@google-analytics/data';

const { BetaAnalyticsDataClient } = pkg;

const KEY_EVENTS = ['first_open', 'sign_up', 'login', 'review_submit'];

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

// 맞춤 측정기준(customEvent:*) 리포트 — GA4 콘솔 등록 + 앱 계측이 선행돼야 데이터가 나온다.
// 미등록이면 API 가 에러를 던지므로 격리해 {rows, error} 로 반환한다.
async function customDimReport(client, property, dateRanges, { dim, eventName, limit = 10 }) {
  try {
    const request = {
      property,
      dateRanges,
      dimensions: [{ name: dim }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit,
    };
    if (eventName) {
      request.dimensionFilter = {
        filter: { fieldName: 'eventName', stringFilter: { value: eventName } },
      };
    }
    const [resp] = await client.runReport(request);
    const rows = normalizeRows(resp)
      .map((r) => ({ name: r[dim], count: r.eventCount }))
      .filter((r) => r.name && r.name !== '(not set)');
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: e?.message || '맞춤 측정기준 미등록으로 조회 불가' };
  }
}

// 재방문율(D1/D7/D30) — cohortSpec 기반. 선택 기간을 하나의 코호트로 보고 산출.
// (cohortSpec 은 dateRanges 와 함께 못 쓴다) 최근 가입자는 아직 D30 에 도달 못해 과소집계될 수 있다.
async function runRetention(client, property, startDate, endDate) {
  try {
    const [resp] = await client.runReport({
      property,
      dimensions: [{ name: 'cohortNthDay' }],
      metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
      cohortSpec: {
        cohorts: [{ name: 'cohort', dimension: 'firstSessionDate', dateRange: { startDate, endDate } }],
        cohortsRange: { granularity: 'DAILY', startOffset: 0, endOffset: 30 },
      },
    });
    const byDay = {};
    let total = 0;
    for (const r of normalizeRows(resp)) {
      byDay[Number(r.cohortNthDay)] = r.cohortActiveUsers;
      total = Math.max(total, r.cohortTotalUsers || 0);
    }
    const rate = (n) =>
      total > 0 && byDay[n] != null ? Number(((byDay[n] / total) * 100).toFixed(1)) : null;
    return { totalUsers: total, d1: rate(1), d7: rate(7), d30: rate(30), error: null };
  } catch (e) {
    return { totalUsers: 0, d1: null, d7: null, d30: null, error: e?.message || '재방문율 조회 실패' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 만 허용됩니다.' });
  }

  try {
    assertAuthorized(req);

    // 기본 기간: 최근 28일 (yesterday 기준). 명시 시 YYYY-MM-DD 만 허용.
    const startDate = isValidDate(req.query?.startDate) ? req.query.startDate : '28daysAgo';
    const endDate = isValidDate(req.query?.endDate) ? req.query.endDate : 'yesterday';
    const dateRanges = [{ startDate, endDate }];

    const { propertyId, clientEmail, privateKey } = readGaConfig();
    const client = getClient({ clientEmail, privateKey });
    const property = `properties/${propertyId}`;

    // 내장 차원 리포트는 batch 로 한 번에 (GA4 batchRunReports 최대 5개)
    const [batch] = await client.batchRunReports({
      property,
      requests: [
        // 0) 사용자 총계
        {
          dateRanges,
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'totalUsers' },
            { name: 'sessions' },
          ],
        },
        // 1) 핵심 이벤트 카운트 (first_open / sign_up / login / review_submit)
        {
          dateRanges,
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: { fieldName: 'eventName', inListFilter: { values: KEY_EVENTS } },
          },
        },
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
        // 4) 플랫폼별 (iOS/Android) — 내장 platform 차원
        {
          dateRanges,
          dimensions: [{ name: 'platform' }],
          metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        },
      ],
    });

    const [userReport, keyEventReport, topEventReport, dailyReport, platformReport] =
      batch.reports || [];

    const userRow = normalizeRows(userReport)[0] || {};
    const userTotals = {
      activeUsers: userRow.activeUsers ?? 0,
      newUsers: userRow.newUsers ?? 0,
      totalUsers: userRow.totalUsers ?? 0,
      sessions: userRow.sessions ?? 0,
    };

    const keyEventCounts = KEY_EVENTS.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
    for (const r of normalizeRows(keyEventReport)) {
      if (r.eventName in keyEventCounts) keyEventCounts[r.eventName] = r.eventCount;
    }

    const topEvents = normalizeRows(topEventReport).map((r) => ({
      eventName: r.eventName,
      eventCount: r.eventCount,
    }));

    // 일별 추이: GA4 date 는 'YYYYMMDD' → 'YYYY-MM-DD' 로 정규화 (이미 날짜순 정렬됨)
    const dailyUsers = normalizeRows(dailyReport).map((r) => {
      const d = String(r.date || '');
      const date = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
      return { date, activeUsers: r.activeUsers, newUsers: r.newUsers };
    });

    const platforms = normalizeRows(platformReport)
      .map((r) => ({ platform: r.platform, activeUsers: r.activeUsers, newUsers: r.newUsers }))
      .filter((r) => r.platform && r.platform !== '(not set)');

    // 병렬 실행: 화면별 조회(내장) · 재방문율(cohort) · 맞춤차원 리포트(등록 전 격리)
    const screensP = client
      .runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'screenName' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      })
      .then(([resp]) =>
        normalizeRows(resp)
          .map((r) => ({ screenName: r.screenName, views: r.screenPageViews }))
          .filter((r) => r.screenName && r.screenName !== '(not set)')
      )
      .catch(() => []);

    const retentionP = runRetention(client, property, startDate, endDate);

    // B그룹: 맞춤 측정기준 (view_item 파라미터 기준). 등록 전엔 {rows:[], error} 로 반환.
    const searchP = customDimReport(client, property, dateRanges, {
      dim: 'customEvent:search_term',
      eventName: 'search',
    });
    const storeP = customDimReport(client, property, dateRanges, {
      dim: 'customEvent:item_name',
      eventName: 'view_item',
    });
    const locationP = customDimReport(client, property, dateRanges, {
      dim: 'customEvent:location',
      eventName: 'view_item',
    });
    const eventTypeP = customDimReport(client, property, dateRanges, {
      dim: 'customEvent:event_type',
      eventName: 'view_item',
    });
    const statusP = customDimReport(client, property, dateRanges, {
      dim: 'customEvent:status',
      eventName: 'view_item',
    });

    const [topScreens, retention, searchRes, storeRes, locationRes, eventTypeRes, statusRes] =
      await Promise.all([screensP, retentionP, searchP, storeP, locationP, eventTypeP, statusP]);

    return res.status(200).json({
      dateRange: { startDate, endDate },
      userTotals,
      keyEventCounts,
      topEvents,
      dailyUsers,
      platforms,
      topScreens,
      retention,
      // 검색어(B그룹) — 하위호환 위해 기존 키 유지
      searchTerms: searchRes.rows.map((r) => ({ searchTerm: r.name, eventCount: r.count })),
      searchTermsError: searchRes.error,
      // B그룹: 행사/지역/유형/상태 (등록 후 채워짐)
      byStore: storeRes,
      byLocation: locationRes,
      byEventType: eventTypeRes,
      byStatus: statusRes,
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

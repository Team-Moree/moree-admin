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

const KEY_EVENTS = ['first_open', 'sign_up', 'login'];

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

// masterToken 검증: MOREE_API_BASE 가 설정된 경우에만 백엔드로 위임 검증한다.
// (env 미설정 단계에서는 로그인 뒤 SPA 안에서만 호출되므로 존재 여부만 확인)
async function assertAuthorized(req) {
  const token = getBearer(req);
  if (!token) throw new HttpError(401, 'MISSING_TOKEN', '인증 토큰이 없습니다.');

  const base = process.env.MOREE_API_BASE;
  if (!base) return; // 검증 백엔드 미설정 — 존재 여부만으로 통과

  let resp;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    resp = await fetch(`${base.replace(/\/$/, '')}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // 검증 백엔드 접속 실패는 인증 실패로 단정하지 않는다(가용성 우선).
    return;
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new HttpError(401, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.');
  }
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 만 허용됩니다.' });
  }

  try {
    await assertAuthorized(req);

    // 기본 기간: 최근 28일 (yesterday 기준). 명시 시 YYYY-MM-DD 만 허용.
    const startDate = isValidDate(req.query?.startDate) ? req.query.startDate : '28daysAgo';
    const endDate = isValidDate(req.query?.endDate) ? req.query.endDate : 'yesterday';
    const dateRanges = [{ startDate, endDate }];

    const { propertyId, clientEmail, privateKey } = readGaConfig();
    const client = getClient({ clientEmail, privateKey });
    const property = `properties/${propertyId}`;

    // 안정적인 3개 리포트는 batch 로 한 번에 호출
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
        // 1) 핵심 이벤트 카운트 (first_open / sign_up / login)
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
      ],
    });

    const [userReport, keyEventReport, topEventReport] = batch.reports || [];

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

    // 검색어 리포트: customEvent:search_term 은 GA4 콘솔의 맞춤 측정기준 등록이 선행돼야 한다.
    // 미등록이면 API 가 에러를 반환하므로, 전체 응답이 실패하지 않도록 별도 호출 + 격리한다.
    let searchTerms = [];
    let searchTermsError = null;
    try {
      const [searchReport] = await client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'customEvent:search_term' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { value: 'search' } },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      });
      searchTerms = normalizeRows(searchReport)
        .map((r) => ({ searchTerm: r['customEvent:search_term'], eventCount: r.eventCount }))
        .filter((r) => r.searchTerm && r.searchTerm !== '(not set)');
    } catch (e) {
      searchTermsError = e?.message || '검색어 리포트를 불러오지 못했습니다.';
    }

    return res.status(200).json({
      dateRange: { startDate, endDate },
      userTotals,
      keyEventCounts,
      topEvents,
      searchTerms,
      searchTermsError,
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

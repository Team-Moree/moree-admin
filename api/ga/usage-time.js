// Vercel Serverless Function — GA4 체류 시간·미복귀율
//
// 서비스 계정 자격증명을 브라우저에 노출하지 않으려고 서버리스 함수가 GA4 Data API 를 대신 호출한다.
// 실제 함수 파일이 있는 경로는 vercel.json 의 `/api/:path*` 백엔드 rewrite 보다 우선한다.
//
// 필요한 서버 env: GA4_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY (.env.ga.example 참고)
//
// 지표 기준
//   - 이용 시간: userEngagementDuration (앱이 포그라운드였던 시간). averageSessionDuration 은 쓰지 않는다.
//   - 랜딩 웹과 앱 dev·stg 빌드가 같은 GA 속성에 섞여 있어 운영 앱만 집계한다
//     (platform != web, 스트림 이름이 -dev·-stg 로 끝나는 것 제외).
//   - 미복귀율: 기간 안에 첫 방문한 사용자 중 N일째 다시 오지 않은 비율. N일이 지나지 않은 첫 방문일은 뺀다.
//     코호트를 한 요청에 여러 개 넣으면 GA 가 두 번째 코호트를 비워서 돌려주므로 하나씩 요청한다.

import pkg from '@google-analytics/data';

const { BetaAnalyticsDataClient } = pkg;

const MAX_DAYS = 92;
const DEFAULT_DAYS = 28;
const RETURN_DAYS = [7, 30];
const SCREEN_LIMIT = 50;
const PROD_APP_ONLY = {
  andGroup: {
    expressions: [
      { notExpression: { filter: { fieldName: 'platform', stringFilter: { value: 'web' } } } },
      {
        notExpression: {
          filter: { fieldName: 'streamName', stringFilter: { matchType: 'FULL_REGEXP', value: '.*-(dev|stg)' } },
        },
      },
    ],
  },
};

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function assertAuthorized(req) {
  const raw = req.headers['authorization'] || req.headers['Authorization'];
  const ok = typeof raw === 'string' && /^Bearer\s+\S+/i.test(raw.trim());
  if (!ok) throw new HttpError(401, 'MISSING_TOKEN', '인증 토큰이 없습니다.');
}

function readGaConfig() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientEmail = process.env.GA_CLIENT_EMAIL;
  const privateKey = process.env.GA_PRIVATE_KEY;
  if (!propertyId || !clientEmail || !privateKey) {
    throw new HttpError(
      503,
      'GA_NOT_CONFIGURED',
      'GA4 환경변수(GA4_PROPERTY_ID / GA_CLIENT_EMAIL / GA_PRIVATE_KEY)가 설정되지 않았습니다.'
    );
  }
  return { propertyId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
}

let cachedClient = null;
function getClient({ clientEmail, privateKey }) {
  if (!cachedClient) {
    cachedClient = new BetaAnalyticsDataClient({
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
  }
  return cachedClient;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const todayInSeoul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export function resolveRange(query, today = todayInSeoul()) {
  const to = query?.to ?? addDays(today, -1);
  const from = query?.from ?? addDays(to, -(DEFAULT_DAYS - 1));
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new HttpError(400, 'INVALID_INPUT', '날짜는 YYYY-MM-DD 형식이어야 합니다.');
  }
  if (from > to || to >= today || daysBetween(from, to) + 1 > MAX_DAYS) {
    throw new HttpError(400, 'INVALID_INPUT', `기간은 어제까지, 최대 ${MAX_DAYS}일입니다.`);
  }
  return { from, to, today };
}

function records(report) {
  const dims = (report?.dimensionHeaders || []).map((h) => h.name);
  const mets = (report?.metricHeaders || []).map((h) => h.name);
  return (report?.rows || []).map((row) => {
    const out = {};
    dims.forEach((name, i) => {
      out[name] = row.dimensionValues?.[i]?.value ?? '';
    });
    mets.forEach((name, i) => {
      out[name] = Number(row.metricValues?.[i]?.value ?? 0);
    });
    return out;
  });
}

const round1 = (v) => Math.round(v * 10) / 10;
const perUnit = (seconds, count) => (count > 0 ? round1(seconds / count) : 0);

export function buildDaily(rows, from, to) {
  const byDate = new Map(rows.map((r) => [`${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, r]));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = byDate.get(d) || {};
    const seconds = r.userEngagementDuration || 0;
    const users = r.activeUsers || 0;
    const sessions = r.sessions || 0;
    out.push({
      date: d,
      activeUsers: users,
      sessions,
      engagementSeconds: Math.round(seconds),
      secondsPerUser: perUnit(seconds, users),
      secondsPerSession: perUnit(seconds, sessions),
    });
  }
  return out;
}

export function buildSummary(total, daily) {
  const seconds = total?.userEngagementDuration || 0;
  const sessions = total?.sessions || 0;
  const userDays = daily.reduce((sum, d) => sum + d.activeUsers, 0);
  return {
    activeUsers: total?.activeUsers || 0,
    sessions,
    engagementSeconds: Math.round(seconds),
    avgDailySecondsPerUser: perUnit(seconds, userDays),
    avgSecondsPerSession: perUnit(seconds, sessions),
  };
}

export function buildScreens(rows) {
  return rows
    .filter((r) => r.unifiedScreenName && r.unifiedScreenName !== '(not set)')
    .map((r) => ({
      screenName: r.unifiedScreenName,
      views: r.screenPageViews,
      users: r.activeUsers,
      engagementSeconds: Math.round(r.userEngagementDuration),
      secondsPerView: perUnit(r.userEngagementDuration, r.screenPageViews),
      secondsPerUser: perUnit(r.userEngagementDuration, r.activeUsers),
    }));
}

export function buildNonReturn(rows, day, cohortFrom, cohortTo) {
  const users = rows.reduce((max, r) => Math.max(max, r.cohortTotalUsers || 0), 0);
  const returned = rows.find((r) => Number(r.cohortNthDay) === day)?.cohortActiveUsers || 0;
  return {
    day,
    cohortFrom,
    cohortTo,
    users,
    returned,
    nonReturnRate: users === 0 ? null : round1(100 - (returned / users) * 100),
  };
}

async function report(client, property, request) {
  const [resp] = await client.runReport({ property, dimensionFilter: PROD_APP_ONLY, ...request });
  return records(resp);
}

async function nonReturn(client, property, { from, to, today }) {
  const windows = RETURN_DAYS.map((day) => {
    const latest = addDays(today, -(day + 1));
    return { day, cohortFrom: from, cohortTo: to < latest ? to : latest };
  }).filter((w) => w.cohortTo >= w.cohortFrom);
  return Promise.all(
    windows.map(async ({ day, cohortFrom, cohortTo }) => {
      const rows = await report(client, property, {
        dimensions: [{ name: 'cohort' }, { name: 'cohortNthDay' }],
        metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
        cohortSpec: {
          cohorts: [{ name: `d${day}`, dimension: 'firstSessionDate', dateRange: { startDate: cohortFrom, endDate: cohortTo } }],
          cohortsRange: { granularity: 'DAILY', startOffset: 0, endOffset: day },
        },
      });
      return buildNonReturn(rows, day, cohortFrom, cohortTo);
    })
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 만 허용됩니다.' });
  }
  try {
    assertAuthorized(req);
    const range = resolveRange(req.query);
    const config = readGaConfig();
    const client = getClient(config);
    const property = `properties/${config.propertyId}`;
    const dateRanges = [{ startDate: range.from, endDate: range.to }];
    const usageMetrics = [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'userEngagementDuration' }];

    const [totalRows, dailyRows, screenRows, nonReturnRates] = await Promise.all([
      report(client, property, { dateRanges, metrics: usageMetrics }),
      report(client, property, { dateRanges, metrics: usageMetrics, dimensions: [{ name: 'date' }] }),
      report(client, property, {
        dateRanges,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: SCREEN_LIMIT,
      }),
      nonReturn(client, property, range),
    ]);

    const daily = buildDaily(dailyRows, range.from, range.to);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json({
      from: range.from,
      to: range.to,
      summary: buildSummary(totalRows[0], daily),
      daily,
      screens: buildScreens(screenRows),
      nonReturn: nonReturnRates,
    });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ code: e.code, message: e.message });
    console.error('[ga/usage-time] GA 조회 실패', e);
    return res.status(502).json({ code: 'GA_REPORT_FAILED', message: e?.details || e?.message || 'GA 데이터 조회에 실패했습니다.' });
  }
}

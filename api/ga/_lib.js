import pkg from '@google-analytics/data';

const { BetaAnalyticsDataClient } = pkg;

export const MAX_DAYS = 92;
export const DEFAULT_DAYS = 28;

const V140 = [1, 4, 0];

const streamMatches = (value) => ({ filter: { fieldName: 'streamName', stringFilter: { matchType: 'FULL_REGEXP', value } } });
const NOT_WEB = { notExpression: { filter: { fieldName: 'platform', stringFilter: { value: 'web' } } } };
const SCOPE_FILTERS = {
  production: [NOT_WEB, { notExpression: streamMatches('.*-(dev|stg|prd)') }],
  dev: [NOT_WEB, streamMatches('.*-dev')],
};

export const streamScope = () => (process.env.VERCEL_ENV === 'production' ? 'production' : 'dev');

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function assertAuthorized(req) {
  const raw = req.headers['authorization'] || req.headers['Authorization'];
  const ok = typeof raw === 'string' && /^Bearer\s+\S+/i.test(raw.trim());
  if (!ok) throw new HttpError(401, 'MISSING_TOKEN', '인증 토큰이 없습니다.');
}

export function readGaConfig() {
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
export function getClient({ clientEmail, privateKey }) {
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
export const addDays = (s, n) => {
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

export function records(report) {
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

export const round1 = (v) => Math.round(v * 10) / 10;
export const perUnit = (seconds, count) => (count > 0 ? round1(seconds / count) : 0);
export const ratio = (part, whole) => (whole > 0 ? round1((part / whole) * 100) : null);
export const perEntrance = (seconds, entrances) => (seconds != null && entrances > 0 ? round1(seconds / entrances) : null);

export function isV140OrLater(version) {
  const parts = String(version).split('.').map((n) => Number.parseInt(n, 10));
  if (parts.some(Number.isNaN)) return false;
  for (let i = 0; i < V140.length; i += 1) {
    const a = parts[i] ?? 0;
    if (a !== V140[i]) return a > V140[i];
  }
  return true;
}

export const inList = (fieldName, values) => ({ filter: { fieldName, inListFilter: { values } } });
export const exact = (fieldName, value) => ({ filter: { fieldName, stringFilter: { value } } });
export const beginsWith = (fieldName, value) => ({
  filter: { fieldName, stringFilter: { matchType: 'BEGINS_WITH', value } },
});

export async function report(client, property, { filters = [], ...request }) {
  const dimensionFilter = { andGroup: { expressions: [...SCOPE_FILTERS[streamScope()], ...filters] } };
  const [resp] = await client.runReport({ property, dimensionFilter, ...request });
  return records(resp);
}

export async function v140SecondsByScreen(client, property, dateRanges) {
  const rows = await report(client, property, {
    dateRanges,
    dimensions: [{ name: 'unifiedScreenName' }, { name: 'appVersion' }],
    metrics: [{ name: 'userEngagementDuration' }],
    limit: 5000,
  });
  const out = new Map();
  for (const r of rows) {
    if (!isV140OrLater(r.appVersion)) continue;
    out.set(r.unifiedScreenName, (out.get(r.unifiedScreenName) || 0) + r.userEngagementDuration);
  }
  return out;
}

export async function optionalReport(client, property, request, label) {
  try {
    return await report(client, property, request);
  } catch (e) {
    console.warn(`[ga] ${label} 조회 실패 (맞춤 측정기준 등록 확인)`, e?.details || e?.message);
    return null;
  }
}

export function sendError(res, e, tag) {
  if (e instanceof HttpError) return res.status(e.status).json({ code: e.code, message: e.message });
  console.error(`[ga/${tag}] GA 조회 실패`, e);
  return res.status(502).json({ code: 'GA_REPORT_FAILED', message: e?.details || e?.message || 'GA 데이터 조회에 실패했습니다.' });
}

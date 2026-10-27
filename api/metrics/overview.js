// Vercel Serverless Function — Grafana Cloud(Prometheus/Mimir) 리포트 프록시
//
// 왜 서버리스 함수인가:
//   Grafana Cloud 조회에는 서비스 계정 토큰이 필요하다. 이 값은 브라우저(SPA)에 노출될 수
//   없으므로, 자격증명을 서버(Vercel env)에만 두고 이 함수가 대신 호출한다. (api/ga/overview.js
//   와 동일한 패턴)
//
// 로컬 개발 주의:
//   `npm start`(vite dev)는 서버리스 함수를 실행하지 못한다. `vercel dev` 또는
//   scripts/metrics-dev-server.mjs 로 이 handler를 띄우고 VITE_METRICS_PROXY_TARGET 지정.
//
// 필요한 서버 env (.env.metrics.example 참고):
//   GRAFANA_STACK_URL             예: https://loftysummit1845.grafana.net
//   GRAFANA_PROM_DATASOURCE_UID   Prometheus 데이터소스 UID (보통 grafanacloud-<stack>-prom)
//   GRAFANA_SA_TOKEN              서비스 계정 토큰 (Viewer 롤)
//
// env 가 채워지기 전에는 METRICS_NOT_CONFIGURED(503)로 명확히 응답한다.

// 엔드포인트별 차트에서 제외할 비즈니스 무관 경로(인프라/문서용, 실사용자 트래픽 아님)
// uri 라벨은 실제 요청 경로가 아니라 스프링 핸들러 매핑의 URI 템플릿이라
// swagger-ui 계열은 "/swagger-ui*/**" 처럼 리터럴 '*'가 붙어 내려온다 -> 슬래시 요구 없이 매칭.
// v3/api-docs 계열도 "/v3/api-docs/swagger-config" 같은 하위 경로가 있어 .* 필요.
// UNKNOWN은 매핑되지 않은 요청(404/스캐너 등)이 뭉뚱그려지는 버킷이라 특정 엔드포인트로 액션 불가 -> 제외.
// social-login은 외부 OAuth 왕복 호출이 껴서 원래도 느린 게 정상이라 -> 다른 API와 같은 척도로 비교하면 왜곡됨.
const NOISE_URI_FILTER = 'uri!~"/actuator.*|/health|/swagger-ui.*|/v3/api-docs.*|UNKNOWN|/auth/social-login"';
// 한 번에 동시에 보낼 Prometheus 쿼리 수. 쿼리를 전부 한번에 보내면 Grafana Cloud가 503으로
// 끊길 때가 있어 이 수만큼만 동시에 보낸다.
const METRICS_QUERY_CONCURRENCY = 4;
const RETRY_DELAY_MS = 500;

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

// 인증: GA 함수와 동일하게 로그인된 admin SPA 에서 same-origin 으로만 호출된다고 보고
// 토큰 "존재" 여부만 확인한다.
function assertAuthorized(req) {
  const token = getBearer(req);
  if (!token) throw new HttpError(401, 'MISSING_TOKEN', '인증 토큰이 없습니다.');
}

function readGrafanaConfig() {
  const stackUrl = process.env.GRAFANA_STACK_URL;
  const datasourceUid = process.env.GRAFANA_PROM_DATASOURCE_UID;
  const token = process.env.GRAFANA_SA_TOKEN;

  if (!stackUrl || !datasourceUid || !token) {
    throw new HttpError(
      503,
      'METRICS_NOT_CONFIGURED',
      'Grafana 환경변수(GRAFANA_STACK_URL / GRAFANA_PROM_DATASOURCE_UID / GRAFANA_SA_TOKEN)가 설정되지 않았습니다.'
    );
  }
  return {
    stackUrl: stackUrl.replace(/\/$/, ''),
    datasourceUid,
    token,
    // 선택: Grafana에 연결한 CloudWatch 데이터소스. 없으면 EC2/RDS 차트만 비운다.
    cloudwatchUid: process.env.GRAFANA_CW_DATASOURCE_UID,
  };
}

// EC2/RDS 지표는 앱(Prometheus)에 없어서 Grafana의 CloudWatch 데이터소스로 조회한다.
// AWS 자격증명은 Grafana(Assume Role)에만 있고, 여기서는 같은 Grafana 토큰만 쓴다.
const RELEASE_EC2 = { InstanceId: ['i-00e0809e4255b0490'] };
const RELEASE_RDS = { DBInstanceIdentifier: ['moree-rds-release'] };
const CLOUDWATCH_METRICS = {
  hostMem: ['CWAgent', 'mem_used_percent', RELEASE_EC2, 'Maximum'],
  hostSwap: ['CWAgent', 'swap_used_percent', RELEASE_EC2, 'Maximum'],
  rdsCpu: ['AWS/RDS', 'CPUUtilization', RELEASE_RDS, 'Maximum'],
  rdsConnections: ['AWS/RDS', 'DatabaseConnections', RELEASE_RDS, 'Maximum'],
  rdsFreeMemory: ['AWS/RDS', 'FreeableMemory', RELEASE_RDS, 'Minimum'],
};

// -> { key: [[unix초, value], ...] }. 실패해도 페이지 전체를 막지 않도록 빈 결과 + 사유를 돌려준다.
async function queryCloudWatch(config, { start, end, step }) {
  const empty = Object.fromEntries(Object.keys(CLOUDWATCH_METRICS).map((k) => [k, []]));
  if (!config.cloudwatchUid) return { ...empty, cloudwatchError: 'CloudWatch 데이터소스 미설정' };

  const queries = Object.entries(CLOUDWATCH_METRICS).map(([refId, [namespace, metricName, dimensions, statistic]]) => ({
    refId,
    datasource: { uid: config.cloudwatchUid, type: 'cloudwatch' },
    type: 'timeSeriesQuery',
    queryMode: 'Metrics',
    metricQueryType: 0,
    metricEditorMode: 0,
    region: 'ap-northeast-2',
    namespace,
    metricName,
    dimensions,
    statistic,
    // CloudWatch period는 60초 배수여야 한다 (step은 이미 60초 배수)
    period: String(step),
    matchExact: true,
    id: refId.toLowerCase(),
  }));
  try {
    const resp = await fetch(`${config.stackUrl}/api/ds/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: String(start * 1000), to: String(end * 1000), queries }),
    });
    const body = await resp.json();
    if (!resp.ok) throw new Error(body?.message || `CloudWatch 조회 실패 (${resp.status})`);
    // CloudWatch 시각은 period 시작(시계 정각 기준)이라 Prometheus 구간(start + k*step, 구간 끝 시각)과
    // 어긋난다 -> 같은 차트에서 합칠 수 있게 그 period가 끝나는 구간으로 맞춘다.
    const toBucket = (sec) => start + Math.ceil((sec + step - start) / step) * step;
    const out = { ...empty };
    for (const [key, result] of Object.entries(body.results || {})) {
      const [times = [], values = []] = result.frames?.[0]?.data?.values || [];
      out[key] = times
        .map((t, i) => [Math.min(toBucket(Math.floor(t / 1000)), end), values[i]])
        .filter(([t]) => t > start);
    }
    return out;
  } catch (err) {
    console.error('[metrics] CloudWatch query failed', err?.message);
    return { ...empty, cloudwatchError: err?.message || 'CloudWatch 조회 실패' };
  }
}

async function promRequest(config, path, params) {
  const url = new URL(
    `${config.stackUrl}/api/datasources/proxy/uid/${config.datasourceUid}/api/v1/${path}`
  );
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const doFetch = () => fetch(url, { headers: { Authorization: `Bearer ${config.token}` } });
  let resp = await doFetch();
  // 일시적 503/429는 한 번만 재시도한다.
  if (resp.status === 503 || resp.status === 429) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    resp = await doFetch();
  }

  const text = await resp.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Grafana 프록시/게이트웨이가 JSON이 아닌 본문을 줄 수 있어 원문을 그대로 쓴다.
  }
  if (!resp.ok || body?.status !== 'success') {
    // Grafana 프록시 오류는 error 가 아니라 message 로 내려오는 경우가 많다.
    const reason = String(body?.error || body?.message || text).slice(0, 200);
    console.error('[metrics] Grafana query failed', {
      status: resp.status,
      path,
      reason,
      traceId: body?.traceID,
    });
    throw new HttpError(502, 'PROM_QUERY_FAILED', `Prometheus 쿼리 실패 (${resp.status}): ${reason}`);
  }
  return body.data;
}

// 즉시값 쿼리 → [{ metric: {...}, value: number }]. time(초) 기준 시점으로 계산 (알림 시각으로 열기)
async function queryInstant(config, expr, time) {
  const data = await promRequest(config, 'query', time ? { query: expr, time } : { query: expr });
  return (data.result || []).map((r) => ({
    metric: r.metric,
    value: Number(r.value?.[1] ?? 0),
  }));
}

// 구간 쿼리 → [{ metric: {...}, points: [[timestamp, value], ...] }]
async function queryRange(config, expr, { start, end, step }) {
  const data = await promRequest(config, 'query_range', { query: expr, start, end, step });
  return (data.result || []).map((r) => ({
    metric: r.metric,
    points: (r.values || []).map(([t, v]) => [t, Number(v)]),
  }));
}

// Grafana Cloud 데이터소스 프록시에 한꺼번에 너무 많은 동시 쿼리를 보내면 503(레이트리밋으로
// 추정)이 남 -> thunk 배열을 동시 limit개씩만 실행한다.
async function runLimited(thunks, limit) {
  const results = new Array(thunks.length);
  let i = 0;
  async function worker() {
    while (i < thunks.length) {
      const idx = i++;
      results[idx] = await thunks[idx]();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// 알림을 받고 들어왔을 때 위에서부터 "살아있나 -> 영향 -> 원인 방향"을 읽는 한 페이지.
//   overview: 페이지 본문 (항상 조회)
//   detail:   접힘 영역 "API 상세" (펼칠 때만 조회해 기본 쿼리 수를 줄인다)
const VIEWS = ['overview', 'detail'];

const UP_FILTER = 'job="prometheus.scrape.moree_api"';
// 5xx/요청 건수에서 actuator 스크레이프와 5분 헬스체크 요청은 실사용자 트래픽이 아니라 제외
const APP_URI_FILTER = 'uri!~"/actuator.*|/health"';
// 업로드는 원본 이미지 변환 때문에 항상 최댓값이라 전체 지연 추이에서 빼고, API 상세 표에서만 본다.
const LATENCY_FILTER = `${NOISE_URI_FILTER}, uri!="/shared/upload-image"`;

const first = (r) => r[0]?.value ?? null;
const series = (r) => r[0]?.points ?? [];

function overviewQueries(config, { rangeHours, start, end, step }) {
  const range = { start, end, step };
  const R = `${rangeHours}h`;
  const W = `${step}s`;
  // 구간별 건수. increase(x[step])는 구간 안 샘플끼리의 증가만 세서, 앞 구간 마지막 샘플과
  // 이 구간 첫 샘플 사이(스크레이프 1회분)의 증가가 빠진다 -> 그 사이에 몰린 요청이 통째로 사라짐.
  // 스크레이프 주기(60초)만큼 겹쳐 읽고 rate * step 으로 구간 길이에 맞춘다.
  const perBucket = (expr) => `sum(rate(${expr}[${step + 60}s])) * ${step}`;
  const instant = (expr) => () => queryInstant(config, expr, end);
  const ranged = (expr) => () => queryRange(config, expr, range);
  return {
    // 1행: 지금
    // up은 Alloy가 앱 /actuator/prometheus를 읽는 데 성공했는지(1) 실패했는지(0). 앱이 멈추거나 죽으면 0.
    upNow: instant(`min_over_time(up{${UP_FILTER}}[2m])`),
    upSeries: ranged(`min_over_time(up{${UP_FILTER}}[${W}])`),
    startTime: instant('max(process_start_time_seconds)'),
    requests: instant(`sum(increase(http_server_requests_seconds_count{${APP_URI_FILTER}}[${R}]))`),
    // 직전 같은 길이 구간. 요청 수는 비교 대상이 있어야 "늘었나"를 판단할 수 있다.
    requestsPrev: instant(
      `sum(increase(http_server_requests_seconds_count{${APP_URI_FILTER}}[${R}] offset ${R}))`
    ),
    latencyMax: instant(`max(max_over_time(http_server_requests_seconds_max{${LATENCY_FILTER}}[${R}]))`),
    latencyAvg: instant(
      `sum(increase(http_server_requests_seconds_sum{${LATENCY_FILTER}}[${R}])) / sum(increase(http_server_requests_seconds_count{${LATENCY_FILTER}}[${R}]))`
    ),
    error5xx: instant(`sum(increase(http_server_requests_seconds_count{status=~"5..", ${APP_URI_FILTER}}[${R}]))`),
    // 500이 몰렸을 때 "어느 API인가"를 첫 줄에서 바로 보이게
    error5xxTopUris: instant(
      `topk(3, sum by (uri) (increase(http_server_requests_seconds_count{status=~"5..", ${APP_URI_FILTER}}[${R}])) > 0)`
    ),
    // CPU 경고 알림 때 GC/힙과 나란히 본다
    processCpuSeries: ranged(`100 * max(max_over_time(process_cpu_usage[${W}]))`),
    systemCpuSeries: ranged(`100 * max(max_over_time(system_cpu_usage[${W}]))`),
    // Discord ERROR 알림과 같은 출처. 이 값은 있는데 Discord가 조용하면 알림 경로 고장.
    errorLogs: instant(`sum(increase(log4j2_events_total{level="error"}[${R}]))`),
    // 원인 1: 앱 멈춤
    gcPauseMax: instant(`max(max_over_time(jvm_gc_pause_seconds_max[${R}]))`),
    gcPauseSeries: ranged(`max(max_over_time(jvm_gc_pause_seconds_max[${W}]))`),
    liveSetSeries: ranged(
      `100 * max(max_over_time(jvm_gc_live_data_size_bytes[${W}])) / max(jvm_gc_max_data_size_bytes)`
    ),
    // 원인 2: DB / 커넥션 풀. 순간 게이지라 구간 최댓값으로 본다.
    poolMax: instant('max(hikaricp_connections_max)'),
    poolActiveSeries: ranged(`max(max_over_time(hikaricp_connections_active[${W}]))`),
    poolPendingSeries: ranged(`max(max_over_time(hikaricp_connections_pending[${W}]))`),
    poolTimeouts: instant(`sum(increase(hikaricp_connections_timeout_total[${R}]))`),
    poolTimeoutSeries: ranged(perBucket('hikaricp_connections_timeout_total')),
    poolAcquireSeries: ranged(`max(max_over_time(hikaricp_connections_acquire_seconds_max[${W}]))`),
    // 원인 3: 트래픽 / 지연
    requestSeries: ranged(perBucket(`http_server_requests_seconds_count{${APP_URI_FILTER}}`)),
    error5xxSeries: ranged(perBucket(`http_server_requests_seconds_count{status=~"5..", ${APP_URI_FILTER}}`)),
    // 트래픽이 적어 p95는 사실상 "최근 몇 건 중 최댓값"이라 최댓값을 직접 본다.
    latencyMaxSeries: ranged(`max(max_over_time(http_server_requests_seconds_max{${LATENCY_FILTER}}[${W}]))`),
  };
}

function detailQueries(config, { rangeHours, end }) {
  const R = `${rangeHours}h`;
  const instant = (expr) => () => queryInstant(config, expr, end);
  // 같은 경로라도 GET/POST는 다른 API라 method까지 나눠 집계한다
  const BY = 'by (method, uri)';
  return {
    apiRequests: instant(`sum ${BY} (increase(http_server_requests_seconds_count{${NOISE_URI_FILTER}}[${R}]))`),
    apiErrors: instant(
      `sum ${BY} (increase(http_server_requests_seconds_count{status=~"5..", ${NOISE_URI_FILTER}}[${R}]))`
    ),
    apiSeconds: instant(`sum ${BY} (increase(http_server_requests_seconds_sum{${NOISE_URI_FILTER}}[${R}]))`),
    apiMax: instant(`max ${BY} (max_over_time(http_server_requests_seconds_max{${NOISE_URI_FILTER}}[${R}]))`),
  };
}

// { key: thunk } -> { key: result } (동시 실행 수 제한)
async function runNamed(queries) {
  const keys = Object.keys(queries);
  const results = await runLimited(
    keys.map((k) => queries[k]),
    METRICS_QUERY_CONCURRENCY
  );
  return Object.fromEntries(keys.map((k, i) => [k, results[i]]));
}

function toOverviewBody(r) {
  return {
    upNow: first(r.upNow),
    upSeries: series(r.upSeries),
    startTime: first(r.startTime),
    requests: first(r.requests) ?? 0,
    requestsPrev: first(r.requestsPrev),
    latencyMax: first(r.latencyMax),
    latencyAvg: first(r.latencyAvg),
    error5xx: first(r.error5xx) ?? 0,
    error5xxTopUris: r.error5xxTopUris
      .map((x) => ({ uri: x.metric.uri, count: x.value }))
      .sort((a, b) => b.count - a.count),
    processCpuSeries: series(r.processCpuSeries),
    systemCpuSeries: series(r.systemCpuSeries),
    errorLogs: first(r.errorLogs) ?? 0,
    gcPauseMax: first(r.gcPauseMax) ?? 0,
    gcPauseSeries: series(r.gcPauseSeries),
    liveSetSeries: series(r.liveSetSeries),
    poolMax: first(r.poolMax),
    poolActiveSeries: series(r.poolActiveSeries),
    poolPendingSeries: series(r.poolPendingSeries),
    poolTimeouts: first(r.poolTimeouts) ?? 0,
    poolTimeoutSeries: series(r.poolTimeoutSeries),
    poolAcquireSeries: series(r.poolAcquireSeries),
    requestSeries: series(r.requestSeries),
    error5xxSeries: series(r.error5xxSeries),
    latencyMaxSeries: series(r.latencyMaxSeries),
  };
}

function toDetailBody(r) {
  const key = (m) => `${m.method} ${m.uri}`;
  const byApi = (rows) => new Map(rows.map((x) => [key(x.metric), x.value]));
  const errors = byApi(r.apiErrors);
  const seconds = byApi(r.apiSeconds);
  const maxes = byApi(r.apiMax);
  const endpoints = r.apiRequests
    .map((x) => {
      const k = key(x.metric);
      const requests = x.value;
      return {
        key: k,
        method: x.metric.method,
        uri: x.metric.uri,
        requests,
        errors5xx: errors.get(k) ?? 0,
        avgSeconds: requests > 0 ? (seconds.get(k) ?? 0) / requests : 0,
        maxSeconds: maxes.get(k) ?? 0,
      };
    })
    // increase()는 기간 중 새로 생긴 API의 첫 호출을 0으로 셀 수 있어, 최대 응답시간이 있으면 호출된 것으로 본다
    .filter((e) => e.requests > 0 || e.maxSeconds > 0)
    .sort((a, b) => b.avgSeconds - a.avgSeconds);
  return { endpoints };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 만 허용됩니다.' });
  }

  try {
    assertAuthorized(req);
    const config = readGrafanaConfig();

    const view = req.query?.view || 'overview';
    if (!VIEWS.includes(view)) {
      throw new HttpError(400, 'INVALID_VIEW', `view는 ${VIEWS.join('/')} 중 하나여야 합니다.`);
    }

    const now = Math.floor(Date.now() / 1000);
    // 알림 링크로 들어오면 그 시각을 끝으로 본다(미래 시각은 지금으로).
    const end = Math.min(Number(req.query?.end) || now, now);
    const rangeHours = Number(req.query?.rangeHours) || 1;
    const start = end - rangeHours * 3600;
    // 최대 약 120 포인트(막대가 실선처럼 얇아지지 않게). 각 포인트는 직전 step 구간을 훑는다.
    // 스크레이프 주기가 60초라 increase()가 계산되려면 구간 안에 샘플이 2개 필요 -> 최소 120초.
    const step = Math.max(120, Math.floor((rangeHours * 3600) / 120));
    const params = { rangeHours, start, end, step };

    const body =
      view === 'overview'
        ? {
            ...toOverviewBody(await runNamed(overviewQueries(config, params))),
            ...(await queryCloudWatch(config, params)),
          }
        : toDetailBody(await runNamed(detailQueries(config, params)));

    return res.status(200).json({ view, range: { start, end, rangeHours, step }, ...body });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    return res.status(502).json({
      code: 'METRICS_REQUEST_FAILED',
      message: err?.message || 'Grafana 메트릭 요청에 실패했습니다.',
    });
  }
}

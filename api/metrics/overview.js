// Vercel Serverless Function — Grafana Cloud(Prometheus/Mimir) 리포트 프록시
//
// 왜 서버리스 함수인가:
//   Grafana Cloud 조회에는 서비스 계정 토큰이 필요하다. 이 값은 브라우저(SPA)에 노출될 수
//   없으므로, 자격증명을 서버(Vercel env)에만 두고 이 함수가 대신 호출한다. (api/ga/overview.js
//   와 동일한 패턴)
//
// 로컬 개발 주의:
//   `npm start`(vite dev)는 서버리스 함수를 실행하지 못한다. `vercel dev` 사용.
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
  return { stackUrl: stackUrl.replace(/\/$/, ''), datasourceUid, token };
}

async function promRequest(config, path, params) {
  const url = new URL(
    `${config.stackUrl}/api/datasources/proxy/uid/${config.datasourceUid}/api/v1/${path}`
  );
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  const body = await resp.json();
  if (!resp.ok || body.status !== 'success') {
    throw new HttpError(502, 'PROM_QUERY_FAILED', body?.error || `Prometheus 쿼리 실패 (${resp.status})`);
  }
  return body.data;
}

// 즉시값 쿼리 → [{ metric: {...}, value: number }]
async function queryInstant(config, expr) {
  const data = await promRequest(config, 'query', { query: expr });
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 만 허용됩니다.' });
  }

  try {
    assertAuthorized(req);
    const config = readGrafanaConfig();

    const now = Math.floor(Date.now() / 1000);
    const rangeHours = Number(req.query?.rangeHours) || 6;
    const start = now - rangeHours * 3600;
    const step = Math.max(15, Math.floor((rangeHours * 3600) / 200)); // 최대 약 200 포인트

    const [
      p95ByEndpointRange,
      slowestTop10,
      worstP95Instant,
      error5xxInstant,
      error5xxRange,
      error4xxInstant,
      threadPoolInstant,
      threadPoolRange,
      hikariUsageInstant,
      hikariUsageRange,
      hikariPending,
      heapUsageInstant,
      heapUsageRange,
      gcOverheadRange,
    ] = await Promise.all([
      queryRange(
        config,
        `max by (uri) (http_server_requests_seconds{quantile="0.95", ${NOISE_URI_FILTER}})`,
        { start, end: now, step }
      ),
      queryInstant(
        config,
        `topk(10, max by (uri) (max_over_time(http_server_requests_seconds{quantile="0.95", ${NOISE_URI_FILTER}}[${rangeHours}h])))`
      ),
      queryInstant(
        config,
        `max(max_over_time(http_server_requests_seconds{quantile="0.95", ${NOISE_URI_FILTER}}[${rangeHours}h]))`
      ),
      queryInstant(
        config,
        '100 * sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) / sum(rate(http_server_requests_seconds_count[5m]))'
      ),
      queryRange(
        config,
        '100 * sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) / sum(rate(http_server_requests_seconds_count[5m]))',
        { start, end: now, step }
      ),
      queryInstant(
        config,
        '100 * sum(rate(http_server_requests_seconds_count{status=~"4.."}[5m])) / sum(rate(http_server_requests_seconds_count[5m]))'
      ),
      queryInstant(config, '100 * tomcat_threads_busy_threads / tomcat_threads_config_max_threads'),
      queryRange(config, '100 * tomcat_threads_busy_threads / tomcat_threads_config_max_threads', {
        start,
        end: now,
        step,
      }),
      queryInstant(config, '100 * hikaricp_connections_active / hikaricp_connections_max'),
      queryRange(config, '100 * hikaricp_connections_active / hikaricp_connections_max', {
        start,
        end: now,
        step,
      }),
      queryInstant(config, 'hikaricp_connections_pending'),
      queryInstant(
        config,
        '100 * sum(jvm_memory_used_bytes{area="heap"}) / sum(jvm_memory_max_bytes{area="heap"})'
      ),
      queryRange(
        config,
        '100 * sum(jvm_memory_used_bytes{area="heap"}) / sum(jvm_memory_max_bytes{area="heap"})',
        { start, end: now, step }
      ),
      queryRange(config, 'jvm_gc_overhead', { start, end: now, step }),
    ]);

    return res.status(200).json({
      range: { start, end: now, rangeHours },
      p95ByEndpoint: p95ByEndpointRange.map((s) => ({ uri: s.metric.uri, points: s.points })),
      slowestEndpoints: slowestTop10
        .map((s) => ({ uri: s.metric.uri, p95Seconds: s.value }))
        .sort((a, b) => b.p95Seconds - a.p95Seconds),
      worstP95Seconds: worstP95Instant[0]?.value ?? 0,
      error5xxPercent: error5xxInstant[0]?.value ?? 0,
      error5xxSeries: error5xxRange[0]?.points ?? [],
      error4xxPercent: error4xxInstant[0]?.value ?? 0,
      threadPoolUsagePercent: threadPoolInstant[0]?.value ?? 0,
      threadPoolUsageSeries: threadPoolRange[0]?.points ?? [],
      hikariUsagePercent: hikariUsageInstant[0]?.value ?? 0,
      hikariUsageSeries: hikariUsageRange[0]?.points ?? [],
      hikariPending: hikariPending[0]?.value ?? 0,
      heapUsagePercent: heapUsageInstant[0]?.value ?? 0,
      heapUsageSeries: heapUsageRange[0]?.points ?? [],
      gcOverheadSeries: gcOverheadRange[0]?.points ?? [],
    });
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

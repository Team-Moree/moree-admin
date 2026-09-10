// ⚠️ 목업(데모) 데이터 — 실제 Grafana 메트릭이 아니다.
// 그래프 모양 확인용. 이 파일 + Metrics.jsx 의 목업 토글은 한 커밋으로 묶여 있어
// `git revert` 로 통째로 제거할 수 있다. (fetchMetricsOverview 응답과 동일한 스키마)

const ENDPOINTS = [
  { uri: '/store/list', base: 0.04, spikeAt: null },
  { uri: '/store/search', base: 0.055, spikeAt: null },
  { uri: '/store/search/autocomplete', base: 0.022, spikeAt: null },
  { uri: '/review/store', base: 0.06, spikeAt: 14 },
  { uri: '/shared/fandom-target', base: 0.048, spikeAt: null },
  { uri: '/auth/guest-login', base: 0.25, spikeAt: 10 },
];

// 인덱스 기반 결정적 생성(렌더마다 흔들리지 않도록)
function series(base, spikeAt, n) {
  return Array.from({ length: n }, (_, i) => {
    let v = base + Math.sin(i / 3) * base * 0.12 + Math.cos(i / 5) * base * 0.08;
    if (spikeAt !== null && Math.abs(i - spikeAt) <= 1) v += base * (2.4 - Math.abs(i - spikeAt));
    return Math.max(0.003, v);
  });
}

export function buildMockMetrics(rangeHours = 6) {
  const now = Math.floor(Date.now() / 1000);
  const n = 40;
  const step = Math.floor((rangeHours * 3600) / n);
  const start = now - rangeHours * 3600;
  const points = (values) => values.map((v, i) => [start + i * step, v]);

  const p95ByEndpoint = ENDPOINTS.map((e) => ({
    uri: e.uri,
    points: points(series(e.base, e.spikeAt, n)),
  }));

  const slowestEndpoints = p95ByEndpoint
    .map((s) => ({ uri: s.uri, p95Seconds: Math.max(...s.points.map((p) => p[1])) }))
    .sort((a, b) => b.p95Seconds - a.p95Seconds);

  return {
    range: { start, end: now, rangeHours },
    p95ByEndpoint,
    slowestEndpoints,
    worstP95Seconds: slowestEndpoints[0]?.p95Seconds ?? 0,
    error5xxPercent: 0.6,
    error5xxSeries: points(series(0.6, null, n).map((v) => Math.min(100, v * 40))),
    error4xxPercent: 1.8,
    threadPoolUsagePercent: 3.5,
    threadPoolUsageSeries: points(series(3.5, null, n).map((v) => Math.min(100, v * 20))),
    hikariUsagePercent: 18,
    hikariUsageSeries: points(series(18, null, n).map((v) => Math.min(100, v))),
    hikariPending: 0,
    heapUsagePercent: 41.2,
    heapUsageSeries: points(series(41.2, null, n).map((v) => Math.min(100, v))),
    gcOverheadSeries: points(series(1.1, null, n).map((v) => v * 10)),
  };
}

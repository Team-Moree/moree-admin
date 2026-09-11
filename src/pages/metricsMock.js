// ⚠️ 목업(데모) 데이터 — 실제 Grafana 메트릭이 아니다.
// 그래프 모양 확인용. 이 파일 + Metrics.jsx 의 목업 토글은 한 커밋으로 묶여 있어
// `git revert` 로 통째로 제거할 수 있다. (fetchMetricsOverview 응답과 동일한 스키마)

// [TEMP] 실데이터 규모(엔드포인트 20여개, 기준선 5~50ms + 스파이크 1000~4500ms) 재현용.
// 원래 목업(6개, 값 30배 이내)으로 되돌리려면 이 배열만 원복하면 됨.
const ENDPOINTS = [
  { uri: '/**', base: 0.003, spikeAt: null, spikeMag: 0 },
  { uri: '/admin/dashboard', base: 0.02, spikeAt: null, spikeMag: 0 },
  { uri: '/admin/fandom-target', base: 0.03, spikeAt: 22, spikeMag: 0.4 },
  { uri: '/admin/login', base: 0.015, spikeAt: null, spikeMag: 0 },
  { uri: '/auth/guest-login', base: 0.25, spikeAt: 10, spikeMag: 0.6 },
  { uri: '/auth/refresh-token', base: 0.02, spikeAt: 30, spikeMag: 0.7 },
  { uri: '/auth/sign-in', base: 0.02, spikeAt: null, spikeMag: 0 },
  { uri: '/auth/sign-up', base: 0.03, spikeAt: 18, spikeMag: 0.35 },
  { uri: '/review/store', base: 0.06, spikeAt: 14, spikeMag: 0.14 },
  { uri: '/shared/fandom-category', base: 0.01, spikeAt: null, spikeMag: 0 },
  { uri: '/shared/fandom-target', base: 0.048, spikeAt: null, spikeMag: 0 },
  { uri: '/shared/term', base: 0.005, spikeAt: null, spikeMag: 0 },
  { uri: '/shared/upload-image', base: 0.15, spikeAt: 25, spikeMag: 4.4 },
  { uri: '/store/detail/{storeId}', base: 0.04, spikeAt: 8, spikeMag: 1.7 },
  { uri: '/store/list', base: 0.04, spikeAt: null, spikeMag: 0 },
  { uri: '/store/search', base: 0.055, spikeAt: null, spikeMag: 0 },
  { uri: '/store/search/autocomplete', base: 0.022, spikeAt: null, spikeMag: 0 },
  { uri: '/user/me/devices', base: 0.015, spikeAt: null, spikeMag: 0 },
  { uri: '/user/me/moree-pedia', base: 0.03, spikeAt: 34, spikeMag: 0.3 },
  { uri: '/user/me/moree-pedia/summary', base: 0.02, spikeAt: null, spikeMag: 0 },
  { uri: '/user/me/moree-pedia/welcome', base: 0.01, spikeAt: null, spikeMag: 0 },
  { uri: '/user/me/notification/badge', base: 0.01, spikeAt: null, spikeMag: 0 },
  { uri: '/user/me/profile', base: 0.015, spikeAt: null, spikeMag: 0 },
  { uri: '/user/me/stamp', base: 0.01, spikeAt: null, spikeMag: 0 },
  { uri: '/user/validate-name', base: 0.008, spikeAt: null, spikeMag: 0 },
];

// 인덱스 기반 결정적 생성(렌더마다 흔들리지 않도록)
function series(base, spikeAt, n, spikeMag) {
  return Array.from({ length: n }, (_, i) => {
    let v = base + Math.sin(i / 3) * base * 0.12 + Math.cos(i / 5) * base * 0.08;
    if (spikeAt !== null && Math.abs(i - spikeAt) <= 1) {
      v += (spikeMag ?? base * 2.4) * (1 - Math.abs(i - spikeAt) / 1.5);
    }
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
    points: points(series(e.base, e.spikeAt, n, e.spikeMag)),
  }));

  const slowestEndpoints = p95ByEndpoint
    .map((s) => ({ uri: s.uri, p95Seconds: Math.max(...s.points.map((p) => p[1])) }))
    .sort((a, b) => b.p95Seconds - a.p95Seconds)
    .slice(0, 10);

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

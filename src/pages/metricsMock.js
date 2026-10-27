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

export function buildMockMetrics(rangeHours = 1, view = 'overview') {
  const end = Math.floor(Date.now() / 1000);
  const step = Math.max(120, Math.floor((rangeHours * 3600) / 120));
  const start = end - rangeHours * 3600;
  const n = Math.floor((end - start) / step);
  const range = { start, end, rangeHours, step };
  const at = (fn) => Array.from({ length: n }, (_, i) => [start + (i + 1) * step, fn(i, n)]);
  // 끝에서 약 1/3 지점에 짧은 장애(GC 정지 -> 앱 응답 없음 -> 풀 대기/획득 실패 -> 5xx)가 있었던 상황
  const spike = (i, len, peak, base = 0) => {
    const c = Math.floor(len * 0.65);
    if (i === c) return peak;
    if (Math.abs(i - c) === 1) return peak * 0.4;
    return base;
  };

  if (view === 'detail') {
    const endpoints = ENDPOINTS.map((e, idx) => {
      const requests = 20 + ((idx * 37) % 400);
      const method = /sign|login|upload|validate/.test(e.uri) ? 'POST' : 'GET';
      return {
        key: `${method} ${e.uri}`,
        method,
        uri: e.uri,
        requests,
        errors5xx: e.uri === '/store/detail/{storeId}' ? 3 : 0,
        avgSeconds: e.base,
        maxSeconds: e.base + (e.spikeMag ?? 0),
      };
    }).sort((a, b) => b.avgSeconds - a.avgSeconds);
    return { view, range, endpoints };
  }

  return {
    view,
    range,
    upNow: 1,
    upSeries: at((i, len) => (Math.abs(i - Math.floor(len * 0.65)) <= 1 ? 0 : 1)),
    // 기간의 약 1/3 지점에서 배포(재시작)했다고 가정 -> 차트에 세로 점선
    startTime: start + Math.floor((end - start) * 0.35),
    restarts: [start + Math.floor((end - start) * 0.35)],
    requests: 1842,
    requestsPrev: 1610,
    latencyMax: 42,
    latencyAvg: 0.18,
    error5xx: 7,
    error5xxTopUris: [
      { uri: '/store/detail/{storeId}', count: 5 },
      { uri: '/store/list', count: 2 },
    ],
    processCpuSeries: at((i, len) => spike(i, len, 72, 2 + (i % 4))),
    systemCpuSeries: at((i, len) => spike(i, len, 88, 4 + (i % 5))),
    errorLogs: 9,
    gcPauseMax: 11.5,
    gcPauseSeries: at((i, len) => spike(i, len, 11.5, 0.02 + (i % 6) * 0.01)),
    liveSetSeries: at((i) => Math.min(92, 70 + i * 0.4)),
    poolMax: 10,
    poolActiveSeries: at((i, len) => spike(i, len, 10, i % 4 === 0 ? 1 : 0)),
    poolPendingSeries: at((i, len) => spike(i, len, 6)),
    poolTimeouts: 4,
    poolTimeoutSeries: at((i, len) => Math.round(spike(i, len, 3))),
    poolAcquireSeries: at((i, len) => spike(i, len, 30, 0.002)),
    requestSeries: at((i) => 6 + ((i * 7) % 9)),
    error5xxSeries: at((i, len) => Math.round(spike(i, len, 5))),
    latencyMaxSeries: at((i, len) => spike(i, len, 42, 0.2 + (i % 5) * 0.08)),
    hostMem: at((i, len) => spike(i, len, 86, 66 + (i % 4))),
    hostSwap: at((i, len) => spike(i, len, 50, 44 + (i % 3))),
    rdsCpu: at((i) => 4 + (i % 5)),
    rdsConnections: at(() => 10),
    rdsFreeMemory: at(() => 105 * 1024 * 1024),
  };
}

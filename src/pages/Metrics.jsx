import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Segmented, Button, Alert, Spin, Table, Typography, Tag } from 'antd';
import { ReloadOutlined, ExportOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import styled from 'styled-components';
import { fetchMetricsOverview } from '../api/metrics';
import { buildMockMetrics } from './metricsMock'; // [MOCK] 롤백 시 이 줄 + 토글 제거

const { Text } = Typography;

const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 20px;
  font-size: 13px;
`;
const SectionTitle = styled.h4`
  margin: 4px 0 10px;
  font-weight: 600;
  color: #595959;
`;
const HintText = styled.p`
  margin: 8px 0 0;
  font-size: 11.5px;
  color: #bfbfbf;
  line-height: 1.4;
`;
const SoftCard = styled(Card)`
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  .ant-card-head {
    border-bottom: 1px solid #f5f5f5;
    min-height: 48px;
  }
  .ant-card-head-title {
    font-weight: 600;
  }
`;

const CAT = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#7856ff'];

// 지표별로 "정상/주의/위험" 기준이 다르다 — 하나의 공통 기준(예: 50%/80%)을 전부에 적용하면
// 에러율처럼 훨씬 낮은 값에서 위험해지는 지표를 놓친다.
const THRESHOLDS = {
  error5xx: { warn: 1, crit: 5 }, // %
  thread: { warn: 60, crit: 80 }, // %
  hikari: { warn: 60, crit: 80 }, // %
  heap: { warn: 70, crit: 85 }, // %
};
function statusFor(key, pct) {
  const t = THRESHOLDS[key];
  if (pct >= t.crit) return 'crit';
  if (pct >= t.warn) return 'warn';
  return 'ok';
}
function colorFor(status) {
  if (status === 'crit') return '#cf1322';
  if (status === 'warn') return '#d48806';
  return '#1f1f1f';
}

// 카드마다 "지금 상태 + 다음에 뭘 봐야 하는지"를 짧게 알려주는 힌트
const HINTS = {
  error5xx: {
    ok: `${THRESHOLDS.error5xx.warn}% 미만이면 대체로 정상`,
    warn: '5xx 증가 중 — 최근 배포 여부, 에러 로그 확인',
    crit: `${THRESHOLDS.error5xx.crit}% 이상 — 장애 가능성 높음, 영향받는 API부터 확인`,
  },
  thread: {
    ok: `${THRESHOLDS.thread.warn}% 미만이면 대체로 여유 있음`,
    warn: '올라가는 중 — 힙 사용률도 같이 확인 (스레드 늘리기 전에 메모리부터 체크)',
    crit: '응답 지연 시작 구간 — 메모리 여유 확인 후 스레드 수 조정 검토',
  },
  hikari: {
    ok: `${THRESHOLDS.hikari.warn}% 미만이면 대체로 여유 있음`,
    warn: 'DB 커넥션이 부족해지는 중 — pending 건수 주시',
    crit: 'DB가 병목일 가능성 — pending 건수부터 확인',
  },
  heap: {
    ok: `${THRESHOLDS.heap.warn}% 미만이면 여유 있음`,
    warn: '메모리 여유 줄어드는 중 — GC 오버헤드 차트와 같이 보기',
    crit: 'GC가 잦아져 지연을 유발하고 있을 가능성',
  },
};
function hintFor(key, pct) {
  return HINTS[key][statusFor(key, pct)];
}

// [[ts, value], ...] → recharts용 [{ time, [key]: value }, ...]
function toSeries(points, key) {
  return (points || []).map(([t, v]) => ({ time: dayjs(t * 1000).format('HH:mm'), [key]: v }));
}

// [{ uri, points: [[ts, value], ...] }, ...] → 같은 time축을 공유하는 [{ time, [uri1]: v, [uri2]: v, ... }]
function mergeByUri(seriesList) {
  const length = Math.max(0, ...seriesList.map((s) => s.points.length));
  const rows = [];
  for (let i = 0; i < length; i++) {
    const row = {};
    seriesList.forEach((s) => {
      const p = s.points[i];
      if (p) {
        row.time = dayjs(p[0] * 1000).format('HH:mm');
        row[s.uri] = p[1];
      }
    });
    rows.push(row);
  }
  return rows;
}

export default function Metrics() {
  const [rangeHours, setRangeHours] = useState(6);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mock, setMock] = useState(false); // [MOCK] 데모 데이터 토글
  const [highlightedUri, setHighlightedUri] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMetricsOverview({ rangeHours })
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [rangeHours]);

  // [MOCK] 실데이터/목업 분기. 롤백 시 refresh 를 load 직접호출로 되돌리면 됨.
  const refresh = useCallback(
    (useMock) => {
      if (useMock) {
        setError(null);
        setLoading(false);
        setData(buildMockMetrics(rangeHours));
      } else {
        load();
      }
    },
    [load, rangeHours]
  );

  useEffect(() => {
    refresh(mock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeHours]);

  const p95Chart = data ? mergeByUri(data.p95ByEndpoint || []) : [];
  const uris = data ? (data.p95ByEndpoint || []).map((s) => s.uri) : [];

  const threadChart = data ? toSeries(data.threadPoolUsageSeries, 'usagePct') : [];
  const hikariChart = data ? toSeries(data.hikariUsageSeries, 'usagePct') : [];
  const heapChart = data ? toSeries(data.heapUsageSeries, 'usagePct') : [];
  const gcChart = data ? toSeries(data.gcOverheadSeries, 'overhead') : [];

  return (
    <div>
      <PageTitle>서버 메트릭</PageTitle>
      <SubText>
        Grafana Cloud(Prometheus) 기반 지표. moree-api Alloy가 스크레이프해 전송한 데이터를 조회합니다.
      </SubText>

      <Row style={{ marginBottom: 16 }} align="middle" gutter={[12, 8]}>
        <Col>
          <Segmented
            value={rangeHours}
            onChange={setRangeHours}
            options={[
              { label: '1시간', value: 1 },
              { label: '6시간', value: 6 },
              { label: '24시간', value: 24 },
            ]}
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => refresh(mock)} loading={loading}>
            조회
          </Button>
        </Col>
        <Col>
          {/* [MOCK] 데모 토글 */}
          <Segmented
            value={mock ? 'mock' : 'real'}
            onChange={(v) => {
              const m = v === 'mock';
              setMock(m);
              refresh(m);
            }}
            options={[
              { label: '실데이터', value: 'real' },
              { label: '목업', value: 'mock' },
            ]}
          />
        </Col>
        {mock && (
          <Col>
            <Tag color="orange">목업 데이터</Tag>
          </Col>
        )}
        <Col flex="auto" />
        <Col>
          <Button
            type="link"
            icon={<ExportOutlined />}
            href="https://loftysummit1845.grafana.net/explore"
            target="_blank"
            rel="noreferrer"
          >
            Grafana에서 자세히 보기
          </Button>
        </Col>
      </Row>

      {error && (
        <Alert style={{ marginBottom: 16 }} type="error" showIcon message="메트릭 조회 실패" description={error} />
      )}

      {loading && !data ? (
        <Spin />
      ) : (
        data && (
          <>
            {/* 1. 증상 — 지금 문제가 있는가? */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic
                    title="5xx 에러율"
                    value={data.error5xxPercent}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: colorFor(statusFor('error5xx', data.error5xxPercent)) }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    4xx {data.error4xxPercent.toFixed(1)}% (참고용)
                  </Text>
                  <HintText>{hintFor('error5xx', data.error5xxPercent)}</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic
                    title="가장 느린 응답 (p95)"
                    value={Math.round(data.worstP95Seconds * 1000)}
                    suffix="ms"
                  />
                  <HintText>선택한 기간 중 가장 느렸던 엔드포인트의 p95 — 아래 Top 10 표에서 어떤 API인지 확인</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic
                    title="DB 대기 중인 요청"
                    value={data.hikariPending}
                    suffix="건"
                    valueStyle={{ color: data.hikariPending > 0 ? '#cf1322' : '#1f1f1f' }}
                  />
                  <HintText>
                    {data.hikariPending > 0
                      ? '커넥션풀이 꽉 찼다는 뜻 — DB 병목 가능성, 느린 쿼리부터 확인'
                      : '0이면 DB 커넥션 대기 없음 (정상)'}
                  </HintText>
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic
                    title="JVM 힙 사용률"
                    value={data.heapUsagePercent}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: colorFor(statusFor('heap', data.heapUsagePercent)) }}
                  />
                  <HintText>{hintFor('heap', data.heapUsagePercent)}</HintText>
                </SoftCard>
              </Col>
            </Row>

            {/* 2. 문제 API — 어디가 느린가? */}
            <SectionTitle>문제 API</SectionTitle>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} lg={10}>
                <SoftCard title="느린 엔드포인트 Top 10 (p95)" style={{ height: '100%' }}>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={data.slowestEndpoints}
                    rowKey="uri"
                    onRow={(record) => ({
                      onClick: () =>
                        setHighlightedUri((prev) => (prev === record.uri ? null : record.uri)),
                      style: { cursor: 'pointer' },
                    })}
                    rowClassName={(record) => (highlightedUri === record.uri ? 'ant-table-row-selected' : '')}
                    columns={[
                      { title: '엔드포인트', dataIndex: 'uri' },
                      {
                        title: 'p95',
                        dataIndex: 'p95Seconds',
                        width: 90,
                        render: (v) => `${Math.round(v * 1000)}ms`,
                      },
                    ]}
                  />
                  <HintText>행을 클릭하면 오른쪽 그래프에서 해당 API만 강조됩니다.</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} lg={14}>
                <SoftCard title="엔드포인트별 p95 응답시간 추이" style={{ height: '100%' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={p95Chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                      <XAxis dataKey="time" fontSize={12} />
                      <YAxis
                        fontSize={12}
                        width={60}
                        tickFormatter={(v) => `${Math.round(v * 1000)}ms`}
                        domain={[0, 'auto']}
                        tickCount={7}
                      />
                      <Tooltip formatter={(v) => `${Math.round(v * 1000)}ms`} />
                      <Legend
                        onClick={(e) => setHighlightedUri((prev) => (prev === e.dataKey ? null : e.dataKey))}
                        wrapperStyle={{ cursor: 'pointer' }}
                      />
                      {uris.map((uri, i) => (
                        <Line
                          key={uri}
                          type="monotone"
                          dataKey={uri}
                          stroke={CAT[i % CAT.length]}
                          dot={false}
                          strokeWidth={highlightedUri === uri ? 3 : 2}
                          strokeOpacity={highlightedUri && highlightedUri !== uri ? 0.15 : 1}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </SoftCard>
              </Col>
            </Row>

            {/* 3. 원인 후보 — 왜 느린가? */}
            <SectionTitle>원인 후보</SectionTitle>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard title="스레드풀 사용률 (%)">
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={threadChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                      <XAxis dataKey="time" fontSize={11} />
                      <YAxis fontSize={11} domain={[0, 100]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="usagePct" stroke={CAT[0]} fill={`${CAT[0]}22`} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <HintText>{hintFor('thread', data.threadPoolUsagePercent)}</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard title="DB 커넥션풀 사용률 (%)">
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={hikariChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                      <XAxis dataKey="time" fontSize={11} />
                      <YAxis fontSize={11} domain={[0, 100]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="usagePct" stroke={CAT[2]} fill={`${CAT[2]}22`} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <HintText>{hintFor('hikari', data.hikariUsagePercent)}</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard title="JVM 힙 사용률 추이 (%)">
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={heapChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                      <XAxis dataKey="time" fontSize={11} />
                      <YAxis fontSize={11} domain={[0, 100]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="usagePct" stroke={CAT[1]} fill={`${CAT[1]}22`} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <HintText>GC 오버헤드 차트와 같이 보면 원인 파악에 도움됨</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard title="GC 오버헤드">
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={gcChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                      <XAxis dataKey="time" fontSize={11} />
                      <YAxis fontSize={11} width={50} domain={[0, 'auto']} tickCount={6} />
                      <Tooltip />
                      <Area type="monotone" dataKey="overhead" stroke={CAT[3]} fill={`${CAT[3]}22`} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <HintText>잦아지거나 오래 걸리면 응답 지연의 흔한 원인</HintText>
                </SoftCard>
              </Col>
            </Row>
          </>
        )
      )}
    </div>
  );
}

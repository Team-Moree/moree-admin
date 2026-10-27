import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Segmented, Button, Alert, Spin, Table, Typography, Tag, Tabs, Space, Input, Switch } from 'antd';
import { ReloadOutlined, ExportOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';
import styled from 'styled-components';
import { fetchMetricsOverview } from '../api/metrics';
import { buildMockMetrics } from './metricsMock'; // [MOCK] 롤백 시 이 줄 + 토글 제거

dayjs.extend(relativeTime);

const { Text } = Typography;

const PageTitle = styled.h2`
  margin-bottom: 16px;
`;
const SectionTitle = styled.h4`
  margin: 4px 0 10px;
  font-weight: 600;
  color: #595959;
`;
const HintText = styled.p`
  margin: 8px 0 0;
  font-size: 11.5px;
  color: #a6a6a6;
  line-height: 1.4;
`;
const SoftCard = styled(Card)`
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  height: 100%;
  .ant-card-head {
    border-bottom: 1px solid #f5f5f5;
    min-height: 48px;
  }
  .ant-card-head-title {
    font-weight: 600;
  }
`;
const CardLabel = styled.div`
  font-size: 13px;
  color: #8c8c8c;
  margin-bottom: 4px;
`;
const BigValue = styled.div`
  font-size: 26px;
  font-weight: 600;
  line-height: 1.3;
  color: ${(p) => p.$color || '#1f1f1f'};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;
const ChartLabel = styled.div`
  font-size: 12px;
  color: #595959;
  margin: 4px 0;
`;
// 차트 제목 옆 '정상 범위' 메모
const Normal = styled.span`
  margin-left: 6px;
  font-size: 11px;
  color: #a6a6a6;
`;
// 앱 상태 띠: 구간마다 한 칸. 초록=응답, 빨강=응답 없음, 회색=데이터 없음(수집기/호스트까지 멈춤)
const UpBand = styled.div`
  display: flex;
  height: 14px;
  margin-top: 10px;
  border-radius: 3px;
  overflow: hidden;
`;
const UpCell = styled.div`
  flex: 1;
  background: ${(p) => (p.$v === 1 ? '#52c41a' : p.$v === 0 ? '#cf1322' : '#d9d9d9')};
`;

// 시간 축은 최소 1초까지 보여준다. 자동 축이면 수 ms짜리 정상값도 큰 언덕처럼 보인다.
const SECONDS_DOMAIN = [0, (max) => Math.max(max, 1)];

const RED = '#cf1322';
const ORANGE = '#d48806';
const BLUE = '#2a78d6';
const GREEN = '#008300';
const PURPLE = '#7856ff';
const GRAY = '#8c8c8c';

const RANGE_OPTIONS = [
  { label: '1시간', value: 1 },
  { label: '6시간', value: 6 },
  { label: '24시간', value: 24 },
  { label: '7일', value: 168 },
];

const LINKS = [
  { label: 'Grafana', href: 'https://loftysummit1845.grafana.net/explore' },
  {
    label: 'EC2',
    href: 'https://ap-northeast-2.console.aws.amazon.com/ec2/home?region=ap-northeast-2#InstanceDetails:instanceId=i-00e0809e4255b0490',
  },
  {
    label: 'RDS',
    href: 'https://ap-northeast-2.console.aws.amazon.com/rds/home?region=ap-northeast-2#database:id=moree-rds-release;is-cluster=false',
  },
  {
    label: '앱 로그',
    href: 'https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#logsV2:log-groups/log-group/moree-api',
  },
];

// 알림 링크(/metrics?end=<unix초>&range=<시간>)로 들어오면 그 시각을 끝으로 보여준다
function readUrlParams() {
  const q = new URLSearchParams(window.location.search);
  const end = Number(q.get('end')) || null;
  const range = Number(q.get('range'));
  return { end, rangeHours: RANGE_OPTIONS.some((o) => o.value === range) ? range : 1 };
}

// 24시간을 넘는 범위(7일)는 시:분만으로는 날짜를 구분할 수 없다
function timeFormat(rangeHours) {
  return rangeHours > 24 ? 'MM/DD HH:mm' : 'HH:mm';
}

// 여러 시리즈를 같은 time축의 행으로 합친다. 값이 없는 구간은 Prometheus가 포인트 자체를
// 안 돌려줘서 시리즈마다 배열 길이가 다르다 -> 인덱스가 아니라 실제 타임스탬프로 합친다.
// timestamps를 주면 그 축 전체를 깔아 둔다(데이터가 없는 구간도 빈칸으로 보이게).
function mergeSeries(seriesByKey, fmt, timestamps = []) {
  const rowsByTime = new Map();
  const row = (t) => {
    if (!rowsByTime.has(t)) rowsByTime.set(t, { time: dayjs(t * 1000).format(fmt) });
    return rowsByTime.get(t);
  };
  timestamps.forEach(row);
  Object.entries(seriesByKey).forEach(([key, points]) => {
    (points || []).forEach(([t, v]) => {
      row(t)[key] = v;
    });
  });
  return Array.from(rowsByTime.keys())
    .sort((a, b) => a - b)
    .map((t) => rowsByTime.get(t));
}

function rangeTimestamps(range) {
  const out = [];
  for (let t = range.start + range.step; t <= range.end; t += range.step) out.push(t);
  return out;
}

function formatSeconds(v) {
  if (v == null) return '-';
  if (v < 1) return `${Math.round(v * 1000)}ms`;
  return `${v.toFixed(1)}s`;
}
const count = (v) => Math.round(v ?? 0).toLocaleString();

function ChartBox({ height = 160, children }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}
const axis = { fontSize: 11 };
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />;

// 1행: 지금
function NowRow({ data }) {
  const ts = rangeTimestamps(data.range);
  const upByTime = new Map(data.upSeries.map(([t, v]) => [t, v]));
  const downCount = data.upSeries.filter(([, v]) => v === 0).length;
  const appState =
    data.upNow === 1
      ? { text: '응답 중', color: GREEN }
      : data.upNow === 0
        ? { text: '응답 없음', color: RED }
        : { text: '데이터 없음', color: RED };
  const restartedAgo = data.startTime ? dayjs(data.startTime * 1000) : null;
  const recentRestart = restartedAgo && data.range.end - data.startTime < 3600;
  const requestChange =
    data.requestsPrev > 0 ? Math.round(((data.requests - data.requestsPrev) / data.requestsPrev) * 100) : null;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <SoftCard>
          <CardLabel>앱 상태 (지금)</CardLabel>
          <BigValue $color={appState.color}>{appState.text}</BigValue>
          <UpBand title="구간별 앱 응답 여부">
            {ts.map((t) => (
              <UpCell key={t} $v={upByTime.get(t)} />
            ))}
          </UpBand>
          <HintText>
            {downCount > 0
              ? `선택 기간 중 응답 못 한 구간 ${downCount}개 - 같은 시각 GC 정지/풀 차트 확인`
              : '선택 기간 내내 응답함. 빨강=그 구간에 응답 못 한 적 있음, 회색=수집 자체가 끊김'}
          </HintText>
          <Text type="secondary" style={{ fontSize: 12, color: recentRestart ? ORANGE : undefined }}>
            마지막 재시작{' '}
            {restartedAgo
              ? `${restartedAgo.locale('ko').from(dayjs(data.range.end * 1000))} (${restartedAgo.format('MM/DD HH:mm')})`
              : '-'}
            {recentRestart && ' - 배포한 적 없으면 앱이 죽었다 다시 뜬 것'}
          </Text>
        </SoftCard>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <SoftCard>
          <CardLabel>요청 (헬스체크 제외)</CardLabel>
          <BigValue>{count(data.requests)}건</BigValue>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {requestChange == null
              ? '직전 같은 기간 데이터 없음'
              : `직전 같은 기간 ${count(data.requestsPrev)}건 대비 ${requestChange >= 0 ? '+' : ''}${requestChange}%`}
          </Text>
          <HintText>직전 기간보다 크게 늘었으면 트래픽 원인 - 아래 트래픽 차트에서 몰린 시각 확인</HintText>
        </SoftCard>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <SoftCard>
          <CardLabel>응답시간 (업로드 제외)</CardLabel>
          <Space size={[20, 0]} wrap>
            <BigValue $color={data.latencyMax >= 3 ? ORANGE : undefined}>
              {formatSeconds(data.latencyMax)}
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 4, whiteSpace: 'nowrap' }}>최대</Text>
            </BigValue>
            <BigValue>
              {formatSeconds(data.latencyAvg)}
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 4, whiteSpace: 'nowrap' }}>평균</Text>
            </BigValue>
          </Space>
          <HintText>평균은 괜찮은데 최대만 크면 일부 요청만 느렸던 것 - 아래 최대 응답시간 선에서 시각 확인</HintText>
        </SoftCard>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <SoftCard>
          <CardLabel>실패</CardLabel>
          <Space size={[20, 0]} wrap>
            <BigValue $color={data.error5xx >= 0.5 ? RED : undefined}>
              {count(data.error5xx)}
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 4, whiteSpace: 'nowrap' }}>5xx</Text>
            </BigValue>
            <BigValue $color={data.errorLogs >= 0.5 ? RED : undefined}>
              {count(data.errorLogs)}
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 4, whiteSpace: 'nowrap' }}>ERROR</Text>
            </BigValue>
          </Space>
          {data.error5xxTopUris.length > 0 ? (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {data.error5xxTopUris.map((e) => (
                <div key={e.uri} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <Text ellipsis style={{ fontSize: 12 }}>
                    {e.uri}
                  </Text>
                  <Text style={{ fontSize: 12, color: RED, whiteSpace: 'nowrap' }}>{count(e.count)}건</Text>
                </div>
              ))}
            </div>
          ) : (
            <HintText>5xx = 실패한 요청, ERROR = 앱 에러 로그</HintText>
          )}
        </SoftCard>
      </Col>
    </Row>
  );
}

// 배포(앱 재시작) 시각에 세로 점선. 배포 전후로 지표가 달라졌는지 바로 비교하려는 용도.
function deployMarks(data, fmt, { yAxisId, label } = {}) {
  const { start, end, step } = data.range;
  const lastBucket = start + Math.floor((end - start) / step) * step;
  return (data.restarts || []).map((t) => {
    const bucket = Math.min(start + Math.ceil((t - start) / step) * step, lastBucket);
    return (
      <ReferenceLine
        key={t}
        x={dayjs(bucket * 1000).format(fmt)}
        yAxisId={yAxisId}
        stroke={GRAY}
        strokeDasharray="4 3"
        label={label ? { value: '배포/재시작', position: 'insideTopLeft', fontSize: 10, fill: GRAY } : undefined}
      />
    );
  });
}

// 3행: 원인 1(서버 자원), 2(DB/풀)
function CauseRow({ data, fmt }) {
  const ts = rangeTimestamps(data.range);
  const jvm = mergeSeries(
    {
      gc: data.gcPauseSeries,
      liveSet: data.liveSetSeries,
      process: data.processCpuSeries,
      system: data.systemCpuSeries,
      hostMem: data.hostMem,
      hostSwap: data.hostSwap,
    },
    fmt,
    ts
  );
  const pool = mergeSeries(
    {
      active: data.poolActiveSeries,
      pending: data.poolPendingSeries,
      timeouts: data.poolTimeoutSeries,
      acquire: data.poolAcquireSeries,
      rdsCpu: data.rdsCpu,
    },
    fmt,
    ts
  );
  const gcColor = data.gcPauseMax >= 5 ? RED : data.gcPauseMax >= 1 ? ORANGE : undefined;
  const lastValue = (points) => points?.at(-1)?.[1];
  const rdsConnections = lastValue(data.rdsConnections);
  const rdsFreeMb = lastValue(data.rdsFreeMemory) / 1024 / 1024;
  const cloudwatchNote = data.cloudwatchError && (
    <Text type="secondary" style={{ fontSize: 11 }}>
      ({data.cloudwatchError})
    </Text>
  );

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} lg={12}>
        <SoftCard
          title="원인 1: 서버 자원 (CPU / 메모리)"
          extra={<Text style={{ color: gcColor }}>최장 GC 정지 {formatSeconds(data.gcPauseMax)}</Text>}
        >
          <ChartLabel>
            CPU % (<span style={{ color: BLUE }}>앱</span> / <span style={{ color: GRAY }}>서버 전체</span>)
            <Normal>평소 5% 이하, 80% 넘게 유지되면 이상</Normal>
          </ChartLabel>
          <ChartBox height={90}>
            <LineChart data={jvm}>
              {grid}
              {deployMarks(data, fmt)}
              <XAxis dataKey="time" {...axis} minTickGap={24} />
              <YAxis {...axis} width={48} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v, name) => [`${v.toFixed(1)}%`, name]} />
              <Line type="monotone" dataKey="process" name="앱" stroke={BLUE} dot={false} />
              <Line type="monotone" dataKey="system" name="서버" stroke={GRAY} dot={false} />
            </LineChart>
          </ChartBox>
          <ChartLabel>
            서버 메모리 % (<span style={{ color: PURPLE }}>사용</span> / <span style={{ color: RED }}>swap</span>, EC2)
            <Normal>swap이 평소보다 오르면 메모리 부족</Normal> {cloudwatchNote}
          </ChartLabel>
          <ChartBox height={90}>
            <LineChart data={jvm}>
              {grid}
              {deployMarks(data, fmt)}
              <XAxis dataKey="time" {...axis} minTickGap={24} />
              <YAxis {...axis} width={48} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v, name) => [`${v.toFixed(1)}%`, name]} />
              <Line type="monotone" dataKey="hostMem" name="메모리 사용" stroke={PURPLE} dot={false} connectNulls />
              <Line type="monotone" dataKey="hostSwap" name="swap 사용" stroke={RED} dot={false} connectNulls />
            </LineChart>
          </ChartBox>
          <ChartLabel>
            GC 정지 시간 (정지 동안 모든 요청이 멈춤)<Normal>평소 수 ms, 1초 넘으면 사용자가 느낌</Normal>
          </ChartLabel>
          <ChartBox height={90}>
            <AreaChart data={jvm}>
              {grid}
              {deployMarks(data, fmt)}
              <XAxis dataKey="time" {...axis} minTickGap={24} />
              <YAxis {...axis} width={48} domain={SECONDS_DOMAIN} tickFormatter={formatSeconds} />
              <Tooltip formatter={(v) => [formatSeconds(v), 'GC 정지']} />
              <ReferenceLine y={1} stroke={ORANGE} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="gc" stroke={ORANGE} fill={`${ORANGE}22`} />
            </AreaChart>
          </ChartBox>
          <ChartLabel>
            힙 live set % (GC 후에도 남는 앱 메모리)<Normal>85% 넘으면 GC가 잦고 길어짐</Normal>
          </ChartLabel>
          <ChartBox height={90}>
            <LineChart data={jvm}>
              {grid}
              {deployMarks(data, fmt)}
              <XAxis dataKey="time" {...axis} minTickGap={24} />
              <YAxis {...axis} width={48} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'live set']} />
              <ReferenceLine y={85} stroke={RED} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="liveSet" stroke={GREEN} dot={false} />
            </LineChart>
          </ChartBox>
          <HintText>
            CPU와 GC 정지가 같이 튀면 메모리 문제, CPU만 높으면 요청 몰림(위 사용자 영향)이나 무거운 API(API 성능 탭)
          </HintText>
        </SoftCard>
      </Col>
      <Col xs={24} lg={12}>
        <SoftCard
          title="원인 2: DB / 커넥션 풀"
          extra={
            <Text style={{ color: data.poolTimeouts >= 0.5 ? RED : undefined }}>
              획득 실패 {count(data.poolTimeouts)}건
            </Text>
          }
        >
          <ChartLabel>
            커넥션 풀 (<span style={{ color: BLUE }}>쿼리 실행 중</span> /{' '}
            <span style={{ color: RED }}>커넥션 기다리는 요청</span>, 총 {data.poolMax ?? '-'}개)
            <Normal>1분마다 측정이라 대부분 0, 빨간 막대가 보이면 풀 고갈</Normal>
          </ChartLabel>
          <ChartBox height={100}>
            {/* 기다리는 요청은 0이면 아무것도 안 그린다(선으로 그리면 0인데도 바닥에 빨간 선이 깔려 고갈처럼 보임) */}
            <ComposedChart data={pool.map((r) => ({ ...r, pending: r.pending > 0 ? r.pending : null }))}>
              {grid}
              {deployMarks(data, fmt)}
              <XAxis dataKey="time" {...axis} minTickGap={24} />
              <YAxis {...axis} width={48} allowDecimals={false} domain={[0, data.poolMax || 'auto']} />
              <Tooltip formatter={(v, name) => [`${Math.round(v)}개`, name]} />
              <Bar dataKey="pending" name="커넥션 기다리는 요청" fill={RED} />
              <Line type="stepAfter" dataKey="active" name="쿼리 실행 중" stroke={BLUE} dot={false} />
            </ComposedChart>
          </ChartBox>
          <ChartLabel>
            <span style={{ color: RED }}>획득 실패 건수</span> / <span style={{ color: PURPLE }}>획득 대기 시간</span>
            <Normal>평소 실패 0, 대기 수 ms</Normal>
          </ChartLabel>
          <ChartBox height={100}>
            <ComposedChart data={pool}>
              {grid}
              {deployMarks(data, fmt, { yAxisId: 'n' })}
              <XAxis dataKey="time" {...axis} minTickGap={24} />
              <YAxis yAxisId="n" {...axis} width={48} allowDecimals={false} />
              <YAxis yAxisId="s" orientation="right" {...axis} width={48} domain={SECONDS_DOMAIN} tickFormatter={formatSeconds} />
              <Tooltip
                formatter={(v, name) => (name === '획득 실패' ? [`${Math.round(v)}건`, name] : [formatSeconds(v), name])}
              />
              <Bar yAxisId="n" dataKey="timeouts" name="획득 실패" fill={RED} />
              <Line yAxisId="s" type="monotone" dataKey="acquire" name="획득 대기" stroke={PURPLE} dot={false} />
            </ComposedChart>
          </ChartBox>
          <ChartLabel>
            RDS CPU % - 지금 연결 {rdsConnections == null ? '-' : `${Math.round(rdsConnections)}개`}, 여유 메모리{' '}
            {Number.isFinite(rdsFreeMb) ? `${Math.round(rdsFreeMb)}MB` : '-'}
            <Normal>평소 5% 안팎, 연결 10~13개</Normal> {cloudwatchNote}
          </ChartLabel>
          <ChartBox height={100}>
            <LineChart data={pool}>
              {grid}
              {deployMarks(data, fmt)}
              <XAxis dataKey="time" {...axis} minTickGap={24} />
              <YAxis {...axis} width={48} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'RDS CPU']} />
              <Line type="monotone" dataKey="rdsCpu" name="RDS CPU" stroke={ORANGE} dot={false} connectNulls />
            </LineChart>
          </ChartBox>
          <HintText>
            풀 고갈 때: RDS CPU도 오르면 DB(느린 쿼리 알림 확인), GC 정지가 튀면 앱 멈춤, 요청이 몰렸으면 트래픽
          </HintText>
        </SoftCard>
      </Col>
    </Row>
  );
}

// 2행: 사용자 영향(요청 / 에러 / 응답시간). RED(Rate, Errors, Duration) 순서로 같은 시간축에 쌓는다.
function TrafficRow({ data, fmt }) {
  // 앱의 최대 응답시간 값은 요청이 끝난 뒤에도 약 2분 남아 있어서, 요청이 없는 다음 구간에도
  // 직전 값이 찍힌다 -> 그 구간에 요청이 있었을 때만 보여준다.
  // 5xx는 요청의 일부라 "정상 + 5xx"로 쌓아 막대 전체 높이 = 요청 수가 되게 한다.
  const rows = mergeSeries(
    { requests: data.requestSeries, errors: data.error5xxSeries, latency: data.latencyMaxSeries },
    fmt,
    rangeTimestamps(data.range)
  ).map((r) => ({
    ...r,
    ok: Math.max(0, (r.requests ?? 0) - (r.errors ?? 0)),
    latency: r.requests >= 0.5 ? r.latency : null,
  }));
  // 툴팁은 각 차트 자기 값만. (스택 막대라 기본 툴팁은 "정상"을 보여주므로 요청 합계로 직접 그린다)
  const tooltipBox = (label, lines) => (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: GRAY, marginBottom: 4 }}>{label}</div>
      {lines}
    </div>
  );
  const requestTooltip = (
    <Tooltip
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const r = payload[0].payload;
        return tooltipBox(label, [
          <div key="req" style={{ color: BLUE }}>요청 {count(r.requests)}건</div>,
          <div key="err" style={{ color: RED }}>5xx {count(r.errors)}건</div>,
        ]);
      }}
    />
  );
  const latencyTooltip = (
    <Tooltip
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const v = payload[0].payload.latency;
        return tooltipBox(label, (
          <div style={{ color: ORANGE }}>최대 응답시간 {v == null ? '- (요청 없음)' : formatSeconds(v)}</div>
        ));
      }}
    />
  );
  return (
    <SoftCard title="요청 / 에러 / 응답시간" style={{ marginBottom: 24 }}>
      <ChartLabel>
        구간별 <span style={{ color: BLUE }}>요청</span> / <span style={{ color: RED }}>5xx</span> 건수
      </ChartLabel>
      <ChartBox height={140}>
        {/* 두 차트는 같은 rows라 순서가 곧 시각 -> syncId로 한쪽에 마우스를 올리면 다른 쪽도 같은 시각을 가리킨다 */}
        <ComposedChart data={rows} syncId="traffic">
          {grid}
          {deployMarks(data, fmt, { label: true })}
          <XAxis dataKey="time" {...axis} minTickGap={24} />
          <YAxis {...axis} width={52} allowDecimals={false} />
          {requestTooltip}
          <Bar dataKey="ok" stackId="req" name="정상" fill={`${BLUE}99`} />
          <Bar dataKey="errors" stackId="req" name="5xx" fill={RED} />
        </ComposedChart>
      </ChartBox>
      <ChartLabel>
        구간별 최대 응답시간 (업로드 제외, 요청이 있던 구간만) - <span style={{ color: RED }}>1초 넘으면 빨강</span>
      </ChartLabel>
      <ChartBox height={100}>
        <ComposedChart data={rows} syncId="traffic">
          {grid}
          {deployMarks(data, fmt)}
          <XAxis dataKey="time" {...axis} minTickGap={24} />
          <YAxis {...axis} width={52} domain={SECONDS_DOMAIN} tickFormatter={formatSeconds} />
          {latencyTooltip}
          {/* 큰 값 하나가 축을 키우면 1초 기준선이 바닥에 붙어 안 보여서, 기준선 대신 막대 색으로 구분한다 */}
          <Bar dataKey="latency" name="최대 응답시간">
            {rows.map((r) => (
              <Cell key={r.time} fill={r.latency >= 1 ? RED : ORANGE} />
            ))}
          </Bar>
        </ComposedChart>
      </ChartBox>
      <HintText>
        두 차트의 시간축이 같습니다. 빨간 막대(1초 초과)만 보면 됩니다. 그 시각에 요청도 몰렸으면 트래픽, 아니면 같은 시각
        GC 정지/DB 차트 확인
      </HintText>
    </SoftCard>
  );
}

// API 성능 탭 (탭을 열 때 조회). "늘 느린 API = 개선 대상"을 찾는 용도라 평균 응답시간 순이 기본.
const AVG_WARN = 0.3; // 초
const AVG_CRIT = 1;
const MAX_WARN = 3;
const METHOD_COLOR = { GET: 'blue', POST: 'green', PUT: 'orange', PATCH: 'gold', DELETE: 'red' };
const API_SCOPES = [
  { label: '전체', value: 'all' },
  { label: '앱', value: 'app' },
  { label: '어드민', value: 'admin' },
];

function avgColor(v) {
  if (v >= AVG_CRIT) return RED;
  if (v >= AVG_WARN) return ORANGE;
  return BLUE;
}

const AvgBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  font-variant-numeric: tabular-nums;
`;
const AvgTrack = styled.div`
  width: 90px;
  height: 6px;
  border-radius: 3px;
  background: #f0f0f0;
  overflow: hidden;
`;

function ApiPanel({ detail }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const rows = detail.endpoints.filter((e) => {
    if (scope === 'admin' && !e.uri.startsWith('/admin')) return false;
    if (scope === 'app' && e.uri.startsWith('/admin')) return false;
    return !query || e.uri.toLowerCase().includes(query.toLowerCase());
  });
  const maxAvg = Math.max(...rows.map((e) => e.avgSeconds), 0.001);
  const slowCount = rows.filter((e) => e.avgSeconds >= AVG_WARN).length;
  const errorCount = rows.filter((e) => e.errors5xx >= 0.5).length;

  return (
    <>
      <Row gutter={[12, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Input.Search
            allowClear
            placeholder="경로 검색 (예: store)"
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 240 }}
          />
        </Col>
        <Col>
          <Segmented value={scope} onChange={setScope} options={API_SCOPES} />
        </Col>
        <Col flex="auto" />
        <Col>
          <Space size={8}>
            <Tag color={slowCount > 0 ? 'orange' : 'default'}>평균 300ms 넘는 API {slowCount}개</Tag>
            <Tag color={errorCount > 0 ? 'red' : 'default'}>5xx 난 API {errorCount}개</Tag>
          </Space>
        </Col>
      </Row>
      <Table
        rowKey="key"
        dataSource={rows}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: 720 }}
        columns={[
          {
            title: 'API',
            dataIndex: 'uri',
            render: (uri, e) => (
              <Space size={6}>
                <Tag color={METHOD_COLOR[e.method]} style={{ width: 56, textAlign: 'center', marginRight: 0 }}>
                  {e.method}
                </Tag>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>
                  {uri}
                </span>
              </Space>
            ),
          },
          {
            title: '평균',
            dataIndex: 'avgSeconds',
            width: 190,
            align: 'right',
            defaultSortOrder: 'descend',
            sorter: (a, b) => a.avgSeconds - b.avgSeconds,
            render: (v) => (
              <AvgBar>
                <AvgTrack>
                  <div style={{ width: `${(v / maxAvg) * 100}%`, height: '100%', background: avgColor(v) }} />
                </AvgTrack>
                <span style={{ width: 56, color: v >= AVG_WARN ? avgColor(v) : undefined }}>{formatSeconds(v)}</span>
              </AvgBar>
            ),
          },
          {
            title: '최대',
            dataIndex: 'maxSeconds',
            width: 100,
            align: 'right',
            sorter: (a, b) => a.maxSeconds - b.maxSeconds,
            render: (v) => <span style={{ color: v >= MAX_WARN ? ORANGE : undefined }}>{formatSeconds(v)}</span>,
          },
          {
            title: '요청',
            dataIndex: 'requests',
            width: 90,
            align: 'right',
            sorter: (a, b) => a.requests - b.requests,
            render: count,
          },
          {
            title: '5xx',
            dataIndex: 'errors5xx',
            width: 70,
            align: 'right',
            sorter: (a, b) => a.errors5xx - b.errors5xx,
            render: (v) => (v >= 0.5 ? <Text style={{ color: RED, fontWeight: 600 }}>{count(v)}</Text> : <Text type="secondary">-</Text>),
          },
        ]}
      />
      <HintText>
        선택 기간 집계. 평균이 높으면 늘 느린 API(개선 대상), 최대만 높으면 가끔 느렸던 것(그 시각 서버 상태 탭 확인).
        색 기준: 평균 300ms 주황, 1초 빨강 / 최대 3초 주황
      </HintText>
    </>
  );
}

// 탭마다 필요한 응답(view)만 조회한다
const TAB_VIEW = { status: 'overview', api: 'detail' };

export default function Metrics() {
  const initial = readUrlParams();
  const [tab, setTab] = useState('status');
  const [rangeHours, setRangeHours] = useState(initial.rangeHours);
  const [end, setEnd] = useState(initial.end);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mock, setMock] = useState(false); // [MOCK] 데모 데이터 토글
  const [autoRefresh, setAutoRefresh] = useState(false);
  const view = TAB_VIEW[tab];

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    (mock
      ? Promise.resolve(buildMockMetrics(rangeHours, view))
      : fetchMetricsOverview({ rangeHours, view, end: end ?? undefined })
    )
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [mock, rangeHours, view, end]);

  useEffect(() => {
    load();
  }, [load]);

  // 행사 오픈/푸시 발송처럼 지켜볼 때만 켠다. 켰을 때만 1분마다 조회하고, 특정 시각 기준(end)으로 볼 땐 의미가 없어 끈다.
  const autoRefreshOn = autoRefresh && !end;
  useEffect(() => {
    if (!autoRefreshOn) return undefined;
    const id = setInterval(load, 60 * 1000);
    return () => clearInterval(id);
  }, [autoRefreshOn, load]);

  const fmt = timeFormat(rangeHours);
  // 탭 전환 직후엔 이전 탭 응답이 남아 있어 스키마가 다르다 -> 현재 탭 응답일 때만 그린다
  const current = data?.view === view ? data : null;

  return (
    <div>
      <PageTitle>서버 메트릭</PageTitle>

      <Row style={{ marginBottom: 8 }} align="middle" gutter={[12, 8]}>
        <Col>
          <Segmented value={rangeHours} onChange={setRangeHours} options={RANGE_OPTIONS} />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            조회
          </Button>
        </Col>
        <Col>
          <Space size={6}>
            <Switch size="small" checked={autoRefreshOn} disabled={!!end} onChange={setAutoRefresh} />
            <Text type="secondary" style={{ fontSize: 13 }}>
              1분마다 자동 조회
            </Text>
          </Space>
        </Col>
        <Col>
          {/* [MOCK] 데모 토글 */}
          <Segmented
            value={mock ? 'mock' : 'real'}
            onChange={(v) => setMock(v === 'mock')}
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
        {end && (
          <Col>
            <Tag color="blue" closable onClose={() => setEnd(null)}>
              {dayjs(end * 1000).format('MM/DD HH:mm')} 기준
            </Tag>
          </Col>
        )}
        <Col flex="auto" />
        <Col>
          <Space size={0} wrap>
            {LINKS.map((l) => (
              <Button key={l.label} type="link" size="small" icon={<ExportOutlined />} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </Button>
            ))}
          </Space>
        </Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'status', label: '서버 상태' },
          { key: 'api', label: 'API 성능' },
        ]}
      />

      {error && (
        <Alert style={{ marginBottom: 16 }} type="error" showIcon message="메트릭 조회 실패" description={error} />
      )}

      {!current ? (
        loading && <Spin />
      ) : tab === 'status' ? (
        <>
          <SectionTitle>지금</SectionTitle>
          <NowRow data={current} />
          <SectionTitle>사용자 영향 (언제, 얼마나)</SectionTitle>
          <TrafficRow data={current} fmt={fmt} />
          <SectionTitle>원인 (왜)</SectionTitle>
          <CauseRow data={current} fmt={fmt} />
        </>
      ) : (
        <SoftCard>
          <ApiPanel detail={current} />
        </SoftCard>
      )}
    </div>
  );
}

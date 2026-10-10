import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Segmented, Button, Alert, Spin, Typography } from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import styled from 'styled-components';
import { fetchGrowthMetrics } from '../api/growth';

const { Text } = Typography;

const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 20px;
  font-size: 13px;
`;
const HintText = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.4;
`;
const SoftCard = styled(Card)`
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  height: 100%;
  .ant-card-head-title {
    font-weight: 600;
  }
`;
const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
`;
const DefinitionList = styled.ul`
  margin: 0;
  padding-left: 18px;
  color: #595959;
  font-size: 13px;
  line-height: 1.8;
`;

const DAU_COLOR = '#2a78d6';
const MAU_COLOR = '#1baf7a';
const RANGE_OPTIONS = [
  { label: '30일', value: 30 },
  { label: '60일', value: 60 },
  { label: '90일', value: 90 },
];

const formatDate = (d) => (d ? dayjs(d).format('YYYY.MM.DD') : '-');
const formatShort = (d) => dayjs(d).format('M/D');

function ChangeText({ metric, previousLabel }) {
  if (metric?.changeRate == null) {
    return <HintText>{previousLabel} 대비 비교 불가 (데이터 부족)</HintText>;
  }
  const rate = metric.changeRate;
  const color = rate > 0 ? '#389e0d' : rate < 0 ? '#cf1322' : '#8c8c8c';
  const icon = rate > 0 ? <ArrowUpOutlined /> : rate < 0 ? <ArrowDownOutlined /> : null;
  return (
    <HintText>
      {previousLabel} 대비{' '}
      <Text strong style={{ color }}>
        {icon} {rate > 0 ? '+' : ''}
        {rate}%
      </Text>{' '}
      ({metric.previousValue?.toLocaleString()})
    </HintText>
  );
}

function CoverageAlert({ data }) {
  if (!data.trackingStartDate) {
    return (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="아직 쌓인 활동 기록이 없음"
        description="서버 배포 후 로그인한 유저가 앱을 쓰면 그날부터 기록됨. 과거 데이터는 없음."
      />
    );
  }
  if (data.previousPeriod.complete) return null;
  const start = dayjs(data.trackingStartDate);
  const parts = [];
  if (!data.period.complete) parts.push('최근 30일이 아직 다 안 쌓여서 MAU 가 실제보다 낮게 나옴.');
  if (data.dau.previousValue == null) {
    parts.push(`DAU 증감률(30일 전 같은 날과 비교)은 ${formatDate(start.add(31, 'day'))} 부터 나옴.`);
  }
  parts.push(`MAU·평균 DAU 증감률(직전 30일과 비교)은 ${formatDate(start.add(60, 'day'))} 부터 나옴.`);
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      message={`집계 시작일 ${formatDate(data.trackingStartDate)}`}
      description={parts.join(' ')}
    />
  );
}

export default function Growth() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchGrowthMetrics({ days })
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData = (data?.daily || []).map((p) => ({ ...p, label: formatShort(p.date) }));

  return (
    <div>
      <PageTitle>핵심 성장 지표</PageTitle>
      <SubText>
        가입 계정(user_id) 기준 · iOS/Android 를 같이 써도 1명 · 게스트·비로그인 제외 · 한국 시간 기준
      </SubText>

      <Toolbar>
        <Text type="secondary">
          기준일 {formatDate(data?.baseDate)} (어제) · 최근 30일 {formatDate(data?.period.from)} ~{' '}
          {formatDate(data?.period.to)}
        </Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Segmented options={RANGE_OPTIONS} value={days} onChange={setDays} />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            새로고침
          </Button>
        </div>
      </Toolbar>

      {error && <Alert type="error" showIcon message="성장 지표 조회 실패" description={error} style={{ marginBottom: 16 }} />}

      <Spin spinning={loading && !data}>
        {data && (
          <>
            <CoverageAlert data={data} />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic title="DAU (어제)" value={data.dau.value} suffix="명" />
                  <ChangeText metric={data.dau} previousLabel="30일 전" />
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic title="MAU (최근 30일)" value={data.mau.value} suffix="명" />
                  <ChangeText metric={data.mau} previousLabel="전월(직전 30일)" />
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic title="평균 DAU (최근 30일)" value={data.averageDau.value} precision={1} suffix="명" />
                  <ChangeText metric={data.averageDau} previousLabel="전월(직전 30일)" />
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic
                    title="DAU / MAU"
                    value={data.stickiness ?? '-'}
                    precision={data.stickiness == null ? undefined : 1}
                    suffix={data.stickiness == null ? '' : '%'}
                  />
                  <HintText>오늘 지금까지 {data.todayDau.toLocaleString()}명 이용 (집계 중)</HintText>
                </SoftCard>
              </Col>
            </Row>

            <SoftCard title={`일별 추이 (최근 ${days}일)`} style={{ marginTop: 16, height: 'auto' }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} />
                  <YAxis yAxisId="dau" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="mau" orientation="right" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.date)} />
                  <Legend />
                  <Line yAxisId="dau" type="monotone" dataKey="dau" name="DAU" stroke={DAU_COLOR} strokeWidth={2} dot={false} />
                  <Line
                    yAxisId="mau"
                    type="monotone"
                    dataKey="mau"
                    name="MAU (그날까지 30일)"
                    stroke={MAU_COLOR}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </SoftCard>

            <SoftCard title="집계 기준" style={{ marginTop: 16, height: 'auto' }}>
              <DefinitionList>
                <li>DAU: 그날 로그인 상태로 앱을 1번 이상 쓴 계정 수</li>
                <li>MAU: 기준일 포함 최근 30일 동안 1번 이상 쓴 계정 수</li>
                <li>전월 대비: 바로 앞 30일 구간과 비교. DAU 는 30일 전 같은 날과 비교</li>
                <li>DAU / MAU: 평균 DAU ÷ MAU. 한 달 중 며칠꼴로 들어오는지 보는 지표</li>
                <li>GA 분석의 "활성 사용자"는 기기 단위(로그인 무관, 랜딩 웹 포함)라 이 숫자와 다름</li>
              </DefinitionList>
            </SoftCard>
          </>
        )}
      </Spin>
    </div>
  );
}

import { useCallback, useEffect } from 'react';
import { Row, Col, Statistic, Table, Tooltip as AntTooltip, Progress, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import dayjs from 'dayjs';
import { fetchUserMetrics } from '../../api/dashboard';
import {
  SoftCard,
  HintText,
  SectionTitle,
  COLORS,
  ErrorAlert,
  formatDate,
  formatShort,
  formatNumber,
  useRemote,
} from '../opsMetrics/ui';

const { Text } = Typography;

const CONSOLE_LINKS = [
  { label: 'Firebase Crashlytics', href: 'https://console.firebase.google.com/' },
  { label: 'Google Play Console', href: 'https://play.google.com/console' },
  { label: 'App Store Connect', href: 'https://appstoreconnect.apple.com/' },
];

const weekRange = (w) => (w ? `${formatShort(w.from)} ~ ${formatShort(w.to)}` : '');

function WeekCard({ title, field, data, suffix = '명', precision, extra }) {
  const cur = data.thisWeek?.[field];
  const prev = data.lastWeek?.[field];
  return (
    <SoftCard>
      <Statistic title={title} value={cur ?? '-'} precision={cur == null ? undefined : precision} suffix={cur == null ? '' : suffix} />
      <HintText>
        이번 주 {weekRange(data.thisWeek)} · 지난 주 {prev == null ? '-' : `${prev.toLocaleString()}${suffix}`}
      </HintText>
      {extra && <HintText>{extra}</HintText>}
    </SoftCard>
  );
}

function RetentionCell({ rate, retained }) {
  if (rate == null) {
    return (
      <AntTooltip title="아직 집계 전">
        <Text type="secondary">-</Text>
      </AntTooltip>
    );
  }
  return (
    <span>
      {rate}% <Text type="secondary">({formatNumber(retained)})</Text>
    </span>
  );
}

const cohortColumns = [
  { title: '가입 주', dataIndex: 'weekStart', render: (d) => `${formatDate(d)} 주` },
  { title: '가입자', dataIndex: 'signups', align: 'right', render: formatNumber },
  {
    title: 'W1 리텐션',
    key: 'w1',
    align: 'right',
    render: (_, r) => <RetentionCell rate={r.w1Rate} retained={r.w1Retained} />,
  },
  {
    title: 'W4 리텐션',
    key: 'w4',
    align: 'right',
    render: (_, r) => <RetentionCell rate={r.w4Rate} retained={r.w4Retained} />,
  },
];

const ACTIVATION_ITEMS = [
  { key: 'bookmarked', label: '북마크 1개 이상', color: COLORS.blue },
  { key: 'stamped', label: '발도장 1개 이상', color: COLORS.green },
  { key: 'gacha', label: '뽑기 1회 이상', color: COLORS.orange },
];

export default function UserMetricsSection({ days, reloadKey }) {
  const fetcher = useCallback(() => fetchUserMetrics({ days }), [days]);
  const { data, loading, error, load } = useRemote(fetcher);

  useEffect(() => {
    if (reloadKey) load();
  }, [reloadKey, load]);

  const chartData = (data?.dailySignups || []).map((p) => ({ ...p, label: formatShort(p.date) }));
  const lastWeekBeforeTracking =
    data?.trackingStartDate && data?.lastWeek?.from && dayjs(data.lastWeek.from).isBefore(dayjs(data.trackingStartDate));

  return (
    <div>
      <SectionTitle>가입·리텐션</SectionTitle>
      <ErrorAlert title="가입 지표 조회 실패" error={error} />
      {loading && !data && <HintText>불러오는 중…</HintText>}
      {data && (
        <>
          <Row gutter={[16, 16]}>
            <Col flex="1 1 200px">
              <SoftCard>
                <Statistic title="누적 가입자" value={data.totalUsers} suffix="명" />
                <HintText>현재 회원 기준 (탈퇴 제외)</HintText>
              </SoftCard>
            </Col>
            <Col flex="1 1 200px">
              <WeekCard title="이번 주 신규 가입" field="signups" data={data} />
            </Col>
            <Col flex="1 1 200px">
              <WeekCard title="이번 주 탈퇴" field="withdrawals" data={data} />
            </Col>
            <Col flex="1 1 200px">
              <WeekCard title="이번 주 탈퇴율" field="withdrawalRate" data={data} suffix="%" precision={1} />
            </Col>
            <Col flex="1 1 200px">
              <WeekCard
                title="WAU (이번 주)"
                field="wau"
                data={data}
                extra={lastWeekBeforeTracking && `접속 기록이 ${formatDate(data.trackingStartDate)}부터라 지난 주 WAU 는 낮게 나옴`}
              />
            </Col>
          </Row>

          <SoftCard title={`일별 신규 가입 (최근 ${days}일)`} style={{ marginTop: 16, height: 'auto' }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.date)} />
                <Legend />
                <Bar dataKey="signups" name="신규 가입" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
                <Bar dataKey="withdrawals" name="탈퇴" fill={COLORS.red} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SoftCard>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <SoftCard title="가입 주차별 리텐션">
                <Table
                  columns={cohortColumns}
                  dataSource={data.cohorts || []}
                  rowKey="weekStart"
                  pagination={false}
                  size="small"
                />
                <HintText>
                  W1 = 가입 다음 주(월~일)에 1번 이상 접속, W4 = 4주 뒤 그 주에 접속. 분모는 그 주 가입자 중 현재 회원.
                </HintText>
              </SoftCard>
            </Col>
            <Col xs={24} lg={10}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <SoftCard title="활성화 비율" style={{ height: 'auto' }}>
                  {ACTIVATION_ITEMS.map((item) => (
                    <div key={item.key} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{item.label}</span>
                        <Text type="secondary">
                          {formatNumber(data.activation?.[item.key])}명 · {data.activation?.[`${item.key}Rate`] ?? '-'}%
                        </Text>
                      </div>
                      <Progress
                        percent={data.activation?.[`${item.key}Rate`] ?? 0}
                        showInfo={false}
                        strokeColor={item.color}
                        size="small"
                      />
                    </div>
                  ))}
                  <HintText>현재 회원 {formatNumber(data.activation?.users)}명 중</HintText>
                </SoftCard>
                <SoftCard title="크래시율·스토어 평점" style={{ height: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {CONSOLE_LINKS.map((l) => (
                      <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                        {l.label} <ExportOutlined style={{ fontSize: 12 }} />
                      </a>
                    ))}
                  </div>
                  <HintText>API 없음 · 각 콘솔에서 확인 (새 탭)</HintText>
                </SoftCard>
              </div>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

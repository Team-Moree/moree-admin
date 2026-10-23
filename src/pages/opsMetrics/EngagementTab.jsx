import { Row, Col, Statistic, Table, Alert, Spin, Typography } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { fetchEngagementMetrics } from '../../api/dashboard';
import {
  SoftCard,
  Toolbar,
  HintText,
  COLORS,
  ErrorAlert,
  ReloadButton,
  formatDate,
  formatShort,
  formatNumber,
  useRemote,
} from './ui';

const { Text } = Typography;

function RateCard({ title, rate, hint }) {
  return (
    <SoftCard>
      <Statistic title={title} value={rate ?? '-'} precision={rate == null ? undefined : 1} suffix={rate == null ? '' : '%'} />
      <HintText>{hint}</HintText>
    </SoftCard>
  );
}

const userColumns = (countLabel) => [
  { title: '닉네임', dataIndex: 'nickname', render: (n, r) => `${n ?? '-'} (${r.userId})` },
  { title: countLabel, dataIndex: 'count', align: 'right', render: formatNumber },
];

const TOP_USERS = [
  { key: 'stamps', title: '발도장 많은 회원', label: '발도장' },
  { key: 'reviews', title: '리뷰 많은 회원', label: '리뷰' },
  { key: 'followers', title: '팔로워 많은 회원', label: '팔로워' },
];

export default function EngagementTab() {
  const { data, loading, error, load } = useRemote(fetchEngagementMetrics);
  const gacha = data?.gachaParticipation;
  const noFandom = data?.noFandom;
  const dormant = data?.dormant;
  const weekly = (data?.weeklyReviews || []).map((w) => ({ ...w, label: formatShort(w.weekStart) }));

  return (
    <div>
      <Toolbar>
        <Text type="secondary">회원(탈퇴 제외) 기준</Text>
        <ReloadButton onClick={load} loading={loading} />
      </Toolbar>
      <ErrorAlert title="참여 지표 조회 실패" error={error} />
      <Spin spinning={loading && !data}>
        {data && (
          <>
            {dormant && dormant.complete === false && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={`접속 기록이 ${formatDate(data.trackingStartDate)}부터라 아직 정확하지 않음`}
                description="한 달 이상 미접속은 기록 시작 전 접속을 구분 못 해서 실제보다 높게 나올 수 있음."
              />
            )}
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <RateCard
                  title="뽑기 참여율 (최근 30일)"
                  rate={gacha?.rate}
                  hint={`활성 회원 ${formatNumber(gacha?.activeUsers)}명 중 ${formatNumber(gacha?.gachaUsers)}명`}
                />
              </Col>
              <Col xs={24} md={8}>
                <RateCard
                  title="덕질 대상 미선택"
                  rate={noFandom?.rate}
                  hint={`회원 ${formatNumber(noFandom?.users)}명 중 ${formatNumber(noFandom?.noFandomUsers)}명`}
                />
              </Col>
              <Col xs={24} md={8}>
                <RateCard
                  title="한 달 이상 미접속"
                  rate={dormant?.rate}
                  hint={`회원 ${formatNumber(dormant?.users)}명 중 ${formatNumber(dormant?.dormantUsers)}명`}
                />
              </Col>
            </Row>

            <SoftCard title="주별 리뷰 수" style={{ marginTop: 16, height: 'auto' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(_, payload) => `${formatDate(payload?.[0]?.payload?.weekStart)} 주`}
                    formatter={(v) => [formatNumber(v), '리뷰']}
                  />
                  <Bar dataKey="reviews" fill={COLORS.purple} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <HintText>숨김 리뷰 포함 · 월요일 시작 주</HintText>
            </SoftCard>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              {TOP_USERS.map((t) => (
                <Col xs={24} lg={8} key={t.key}>
                  <SoftCard title={t.title}>
                    <Table
                      columns={userColumns(t.label)}
                      dataSource={data.topUsers?.[t.key] || []}
                      rowKey="userId"
                      pagination={false}
                      size="small"
                    />
                  </SoftCard>
                </Col>
              ))}
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}

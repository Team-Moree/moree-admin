import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  DatePicker,
  Button,
  Alert,
  Space,
  Spin,
  Empty,
  Tabs,
  Segmented,
  Tag,
  Typography,
} from 'antd';
import {
  UserOutlined,
  UsergroupAddOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  LoginOutlined,
  UserAddOutlined,
  CommentOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import styled from 'styled-components';
import { fetchGaOverview } from '../api/ga';
import { buildMockOverview } from './analyticsMock'; // [MOCK] 롤백 시 이 줄 + 토글 제거

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DATE_FMT = 'YYYY-MM-DD';
const DEFAULT_RANGE = [dayjs().subtract(28, 'day'), dayjs().subtract(1, 'day')];

// dataviz 검증 통과 팔레트(라이트). 도넛(all-pairs)까지 PASS: blue/green/magenta/yellow/aqua/orange
const C = {
  active: '#2a78d6',
  new: '#008300',
  bar: '#2a78d6',
  barTo: '#5598e7',
  grid: '#eef0f2',
  axis: '#8c8c8c',
};
const CAT = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834'];

const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 20px;
  font-size: 13px;
`;
// 부드러운 카드 (얇은 테두리 + 은은한 그림자 + 둥근 모서리)
const SoftCard = styled(Card)`
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  .ant-card-head {
    border-bottom: 1px solid #f5f5f5;
    min-height: 48px;
  }
  .ant-card-head-title {
    font-weight: 600;
  }
`;

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #f0f0f0',
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
  fontSize: 13,
};

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString() : v);
const shortDay = (d) => (typeof d === 'string' && d.length >= 10 ? d.slice(5).replace('-', '/') : d);

// ── 컬러 아이콘 스탯 카드 ───────────────────────────────────────────
function StatCard({ title, value, icon, color, suffix }) {
  return (
    <SoftCard>
      <Statistic
        title={title}
        value={value}
        suffix={suffix}
        groupSeparator=","
        valueStyle={{ fontWeight: 700, color: '#1f1f1f' }}
        prefix={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              marginRight: 10,
              color,
              background: `${color}14`,
              fontSize: 16,
            }}
          >
            {icon}
          </span>
        }
      />
    </SoftCard>
  );
}

// ── 재사용 가로 막대 (그라데이션) ──────────────────────────────────
function HBar({ data, nameKey, valueKey, valueName, gid = 'gbar' }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36 + 16)}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.bar} />
            <stop offset="100%" stopColor={C.barTo} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.grid} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={nameKey}
          width={128}
          tick={{ fill: '#595959', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
        <Bar dataKey={valueKey} name={valueName} radius={[0, 6, 6, 0]} maxBarSize={20} fill={`url(#${gid})`}>
          <LabelList dataKey={valueKey} position="right" formatter={fmt} style={{ fill: C.axis, fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const renderInsidePct = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.07) return null;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#fff" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="central">
      {Math.round(percent * 100)}%
    </text>
  );
};

// ── 도넛 (구성 비율 + 중앙 합계) ───────────────────────────────────
function Donut({ data, nameKey, valueKey, centerLabel }) {
  const total = data.reduce((a, d) => a + (Number(d[valueKey]) || 0), 0);
  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={264}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={64}
            outerRadius={94}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
            label={renderInsidePct}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CAT[i % CAT.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt(v), n]} />
          <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: 0,
          right: 0,
          transform: 'translateY(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1f1f1f' }}>{fmt(total)}</div>
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>{centerLabel || '합계'}</div>
      </div>
    </div>
  );
}

// ── B그룹(맞춤차원) 패널 — bar | donut ─────────────────────────────
function DimPanel({ title, result, valueName = '건수', paramHint, chart = 'bar', gid }) {
  const rows = result?.rows || [];
  const pending = !!result?.error;
  return (
    <SoftCard title={title} size="small">
      {pending && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message="아직 데이터 없음"
          description={`GA4 맞춤 측정기준(${paramHint}) 등록 + 앱 계측 후 표시됩니다.`}
        />
      )}
      {rows.length === 0 ? (
        <Empty description={pending ? '등록/계측 대기' : '데이터 없음'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : chart === 'donut' ? (
        <Donut data={rows} nameKey="name" valueKey="count" centerLabel={valueName} />
      ) : (
        <HBar data={rows} nameKey="name" valueKey="count" valueName={valueName} gid={gid} />
      )}
    </SoftCard>
  );
}

const EmptyCard = ({ children }) => <Empty description={children || '데이터 없음'} image={Empty.PRESENTED_IMAGE_SIMPLE} />;

export default function Analytics() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [mock, setMock] = useState(false); // [MOCK] 데모 데이터 토글

  const load = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    try {
      const [start, end] = r || [];
      const overview = await fetchGaOverview({
        startDate: start ? start.format(DATE_FMT) : undefined,
        endDate: end ? end.format(DATE_FMT) : undefined,
      });
      setData(overview);
    } catch (err) {
      const body = err.response?.data;
      setError({
        code: body?.code || 'UNKNOWN',
        message: body?.message || err.message || 'GA 데이터를 불러오지 못했습니다.',
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // [MOCK] 실데이터/목업 분기. 롤백 시 refresh 를 load 직접호출로 되돌리면 됨.
  const refresh = useCallback(
    (r, useMock) => {
      if (useMock) {
        setError(null);
        setLoading(false);
        setData(buildMockOverview(r));
      } else {
        load(r);
      }
    },
    [load]
  );

  useEffect(() => {
    refresh(DEFAULT_RANGE, false);
  }, [refresh]);

  const totals = data?.userTotals || {};
  const keyEvents = data?.keyEventCounts || {};
  const retention = data?.retention || {};
  const dailyUsers = error ? [] : data?.dailyUsers || [];
  const topEvents = error ? [] : data?.topEvents || [];
  const topScreens = error ? [] : data?.topScreens || [];
  const platforms = error ? [] : data?.platforms || [];
  const searchTerms = error ? [] : data?.searchTerms || [];

  const isNotConfigured = error?.code === 'GA_NOT_CONFIGURED';
  const stat = (v) => (error ? '-' : v ?? 0);
  const pctVal = (v) => (error || v == null ? '-' : v);
  const pctSuffix = (v) => (error || v == null ? '' : '%');

  // ── 개요 탭 ──
  const OverviewTab = (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}><StatCard title="활성 사용자" value={stat(totals.activeUsers)} icon={<UserOutlined />} color={CAT[0]} /></Col>
        <Col xs={24} sm={8}><StatCard title="신규 사용자" value={stat(totals.newUsers)} icon={<UsergroupAddOutlined />} color={CAT[1]} /></Col>
        <Col xs={24} sm={8}><StatCard title="세션" value={stat(totals.sessions)} icon={<ThunderboltOutlined />} color="#4a3aa7" /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <SoftCard title="일별 사용자 추이" size="small">
            {dailyUsers.length === 0 ? (
              <EmptyCard />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyUsers} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
                  <defs>
                    <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.active} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={C.active} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.new} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={C.new} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
                  <YAxis tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                  <Area type="monotone" dataKey="activeUsers" name="활성 사용자" stroke={C.active} strokeWidth={2.5} fill="url(#gActive)" activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="newUsers" name="신규 사용자" stroke={C.new} strokeWidth={2.5} fill="url(#gNew)" activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SoftCard>
        </Col>
        <Col xs={24} lg={8}>
          <SoftCard title="플랫폼별 활성 사용자" size="small">
            {platforms.length === 0 ? <EmptyCard /> : <Donut data={platforms} nameKey="platform" valueKey="activeUsers" centerLabel="활성 사용자" />}
          </SoftCard>
        </Col>
      </Row>

      <SoftCard title="재방문율 (선택 기간 코호트)" size="small">
        {retention?.error && !error && <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="재방문율을 계산할 데이터가 부족합니다" />}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}><Statistic title="D1 재방문율" value={pctVal(retention.d1)} suffix={pctSuffix(retention.d1)} valueStyle={{ color: CAT[0], fontWeight: 700 }} /></Col>
          <Col xs={24} sm={8}><Statistic title="D7 재방문율" value={pctVal(retention.d7)} suffix={pctSuffix(retention.d7)} valueStyle={{ color: '#256abf', fontWeight: 700 }} /></Col>
          <Col xs={24} sm={8}><Statistic title="D30 재방문율" value={pctVal(retention.d30)} suffix={pctSuffix(retention.d30)} valueStyle={{ color: '#184f95', fontWeight: 700 }} /></Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>
          코호트 기준 인원 {error ? '-' : (retention.totalUsers ?? 0).toLocaleString()}명 · 최근 가입자는 아직 D30에 도달하지 않아 과소집계될 수 있습니다.
        </Text>
      </SoftCard>
    </Space>
  );

  // ── 이벤트 탭 ──
  const keyCards = [
    { title: 'first_open (설치)', value: keyEvents.first_open, icon: <AppstoreOutlined />, color: CAT[0] },
    { title: 'sign_up (가입)', value: keyEvents.sign_up, icon: <UserAddOutlined />, color: CAT[1] },
    { title: 'login (로그인)', value: keyEvents.login, icon: <LoginOutlined />, color: '#4a3aa7' },
    { title: 'review_submit (후기)', value: keyEvents.review_submit, icon: <CommentOutlined />, color: '#eb6834' },
  ];
  const EventsTab = (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Row gutter={[16, 16]}>
        {keyCards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.title}>
            <StatCard title={c.title} value={stat(c.value)} icon={c.icon} color={c.color} />
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SoftCard title="Top 이벤트" size="small">
            {topEvents.length === 0 ? <EmptyCard /> : <HBar data={topEvents} nameKey="eventName" valueKey="eventCount" valueName="발생 수" gid="gEv" />}
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="화면별 조회 TOP" size="small">
            {topScreens.length === 0 ? <EmptyCard /> : <HBar data={topScreens} nameKey="screenName" valueKey="views" valueName="조회 수" gid="gScr" />}
          </SoftCard>
        </Col>
      </Row>
    </Space>
  );

  // ── 행사·검색 탭 (B그룹) ──
  const ContentTab = (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Alert
        type="info"
        showIcon
        message="이 탭 지표는 GA4 맞춤 측정기준 등록 + 앱 이벤트 계측이 선행되어야 채워집니다"
        description="현재는 패널만 준비된 상태이며, 등록·계측이 완료되면 자동으로 데이터가 표시됩니다. (목업 토글로 예시 모양 확인 가능)"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SoftCard title="검색어 TOP" size="small">
            {data?.searchTermsError && !error && (
              <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="아직 데이터 없음" description="GA4 맞춤 측정기준(search_term) 등록 + 앱 계측 후 표시됩니다." />
            )}
            {searchTerms.length === 0 ? (
              <EmptyCard>{data?.searchTermsError ? '등록/계측 대기' : '데이터 없음'}</EmptyCard>
            ) : (
              <HBar data={searchTerms} nameKey="searchTerm" valueKey="eventCount" valueName="검색 수" gid="gSch" />
            )}
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="행사 조회 TOP" result={error ? null : data?.byStore} valueName="조회 수" paramHint="item_name · view_item" gid="gStore" />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="지역별 조회" result={error ? null : data?.byLocation} valueName="조회 수" paramHint="location · view_item" gid="gLoc" />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="유형별 조회" result={error ? null : data?.byEventType} valueName="조회 수" paramHint="event_type · view_item" chart="donut" />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="상태별 조회" result={error ? null : data?.byStatus} valueName="조회 수" paramHint="status · view_item" chart="donut" />
        </Col>
      </Row>
    </Space>
  );

  return (
    <div>
      <PageTitle>GA 분석</PageTitle>
      <SubText>Firebase(GA4) 이벤트 기반 지표. 서버리스 함수(/api/ga)가 GA4 Data API 로 집계합니다.</SubText>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker value={range} allowClear={false} onChange={(r) => r && setRange(r)} disabledDate={(d) => d && d > dayjs().endOf('day')} />
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => refresh(range, mock)}>조회</Button>
        {/* [MOCK] 데모 토글 */}
        <Segmented
          value={mock ? 'mock' : 'real'}
          onChange={(v) => {
            const m = v === 'mock';
            setMock(m);
            refresh(range, m);
          }}
          options={[
            { label: '실데이터', value: 'real' },
            { label: '목업', value: 'mock' },
          ]}
        />
        {mock && <Tag color="orange">목업 데이터</Tag>}
        {data?.dateRange && <Text type="secondary">{data.dateRange.startDate} ~ {data.dateRange.endDate}</Text>}
      </Space>

      {error && (
        <Alert
          style={{ marginBottom: 16 }}
          type={isNotConfigured ? 'info' : 'error'}
          showIcon
          message={isNotConfigured ? 'GA 환경변수가 아직 설정되지 않았습니다' : 'GA 데이터 조회 실패'}
          description={
            isNotConfigured ? (
              <span>Vercel 프로젝트에 <code>GA4_PROPERTY_ID</code>, <code>GA_CLIENT_EMAIL</code>, <code>GA_PRIVATE_KEY</code> 를 설정하면 실제 데이터가 표시됩니다.</span>
            ) : (
              <span>[{error.code}] {error.message}</span>
            )
          }
        />
      )}

      <Spin spinning={loading}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'overview', label: '개요', children: OverviewTab },
            { key: 'events', label: '이벤트', children: EventsTab },
            { key: 'content', label: '행사·검색', children: ContentTab },
          ]}
        />
      </Spin>
    </div>
  );
}
